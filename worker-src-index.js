/**
 * life-manager R2 Worker
 * Proxies read/write requests to the life-manager-meetings R2 bucket.
 * Auth: Clerk JWT verification (RS256) with API_SECRET fallback during migration.
 * Required secrets: CLERK_ISSUER_URL (e.g. https://clerk.bashai.io)
 */

const ALLOWED_ORIGIN = 'https://manage.bashai.io';

function corsHeaders(origin) {
  const allowed = origin === ALLOWED_ORIGIN || origin === 'http://localhost:5173';
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-User-ID',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

function unauthorized(origin) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

// ── Clerk JWT verification ──────────────────────────────────────────────────

let jwksCache = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 3600000; // 1 hour

async function fetchJWKS(issuerUrl) {
  const now = Date.now();
  if (jwksCache && (now - jwksCacheTime) < JWKS_CACHE_TTL) return jwksCache;

  const res = await fetch(`${issuerUrl}/.well-known/jwks.json`);
  if (!res.ok) throw new Error(`Failed to fetch JWKS: ${res.status}`);
  jwksCache = await res.json();
  jwksCacheTime = now;
  return jwksCache;
}

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importRSAKey(jwk) {
  return crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

async function verifyClerkJWT(token, issuerUrl) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');

  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));

  // Verify expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error('Token expired');
  if (payload.nbf && payload.nbf > now + 60) throw new Error('Token not yet valid');

  // Verify issuer
  if (payload.iss && payload.iss !== issuerUrl) throw new Error('Invalid issuer');

  // Fetch JWKS and find matching key
  const jwks = await fetchJWKS(issuerUrl);
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('No matching key found in JWKS');

  // Verify signature
  const key = await importRSAKey(jwk);
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlDecode(parts[2]);

  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
  if (!valid) throw new Error('Invalid JWT signature');

  return payload; // { sub, email, ... }
}

async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  // Try Clerk JWT first (if CLERK_ISSUER_URL is configured)
  if (env.CLERK_ISSUER_URL) {
    try {
      const payload = await verifyClerkJWT(token, env.CLERK_ISSUER_URL);
      return { type: 'clerk', userId: payload.sub, email: payload.email || null, payload };
    } catch (_) {
      // Fall through to API_SECRET check
    }
  }

  // Legacy fallback: static API_SECRET
  if (env.API_SECRET && token === env.API_SECRET) {
    return { type: 'legacy', userId: 'legacy', email: null, payload: null };
  }

  return null;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const auth = await authenticateRequest(request, env);
    if (!auth) {
      return unauthorized(origin);
    }

    // ── Resolve workspace for data scoping ─────────────────────────────────
    let dataPrefix = '';
    let resolvedWsId = null;
    if (auth.type === 'clerk') {
      try {
        const mappingObj = await env.MEETINGS.get(`user-workspaces/${auth.userId}.json`);
        if (mappingObj) {
          const mapping = await mappingObj.json();
          resolvedWsId = mapping?.workspaceId || null;
          if (resolvedWsId) dataPrefix = `workspaces/${resolvedWsId}/data/`;
        }
      } catch {}
    }

    // ── Helper: get decrypted workspace secrets for proxy routes ───────────
    async function getWorkspaceSecrets(integration) {
      if (auth.type !== 'clerk' || !env.MASTER_KEY) return null;
      try {
        const mapping = await env.MEETINGS.get(`user-workspaces/${auth.userId}.json`);
        if (!mapping) return null;
        const { workspaceId } = await mapping.json();
        const secretsObj = await env.MEETINGS.get(`workspaces/${workspaceId}/secrets.json`);
        if (!secretsObj) return null;
        const secrets = await secretsObj.json();
        const fields = secrets?.integrations?.[integration];
        if (!fields) return null;

        // Decrypt each field
        const masterRaw = Uint8Array.from(atob(env.MASTER_KEY), c => c.charCodeAt(0));
        const masterKey = await crypto.subtle.importKey('raw', masterRaw, 'AES-GCM', false, ['decrypt']);
        const decrypted = {};
        for (const [k, v] of Object.entries(fields)) {
          const data = Uint8Array.from(atob(v), c => c.charCodeAt(0));
          const iv = data.slice(0, 12);
          const ciphertext = data.slice(12);
          const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, masterKey, ciphertext);
          decrypted[k] = new TextDecoder().decode(plain);
        }
        return decrypted;
      } catch { return null; }
    }

    // ── Jira proxy ──────────────────────────────────────────────────────────
    if (url.pathname.startsWith('/jira/')) {
      // Try workspace secrets first, fall back to env secrets
      const wsJira = await getWorkspaceSecrets('jira');
      const jiraHost = wsJira?.host || env.JIRA_HOST;
      const jiraEmail = wsJira?.email || env.JIRA_EMAIL;
      const jiraApiToken = wsJira?.apiToken || env.JIRA_API_TOKEN;

      if (!jiraHost || !jiraEmail || !jiraApiToken) {
        return new Response(JSON.stringify({ error: 'Jira not configured. Add credentials in Settings.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }
      const jiraPath = url.pathname.replace('/jira/', '/');
      const jiraUrl = `${jiraHost}${jiraPath}${url.search}`;
      const basicAuth = btoa(`${jiraEmail}:${jiraApiToken}`);
      const hasBody = !['GET', 'HEAD'].includes(request.method);
      const bodyText = hasBody ? await request.text() : undefined;
      const jiraRes = await fetch(jiraUrl, {
        method: request.method,
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: bodyText,
      });
      const jiraBody = await jiraRes.text();
      return new Response(jiraBody, {
        status: jiraRes.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // ── AI Parse ────────────────────────────────────────────────────────────
    if (request.method === 'POST' && url.pathname === '/parse') {
      try {
        const useOpenAI = !!env.OPENAI_API_KEY;
        const apiKey = useOpenAI ? env.OPENAI_API_KEY : env.ANTHROPIC_API_KEY;

        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'No AI API key configured on worker' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        const body = await request.json();
        const text = String(body?.text || '');
        const fileName = String(body?.fileName || '');

        if (!text) {
          return new Response(JSON.stringify({ error: 'Missing text' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        const today = new Date().toISOString().slice(0, 10);

        const systemPrompt = `You are an expert meeting analyst. Extract structured information from meeting transcripts or summaries.
You MUST return ONLY a single valid JSON object — no markdown, no code blocks, no explanation, just raw JSON.
Be thorough: capture every action item, every decision, every key point mentioned.
For action items: extract the exact task, who owns it, and any due date mentioned.
For dates: use YYYY-MM-DD format. If no date is found use today: ${today}.
For participants: include everyone mentioned as speaking or assigned a task.`;

        const userPrompt = `Extract all structured data from this meeting transcript/summary and return ONLY this exact JSON shape:

{
  "title": "meeting title (infer from context if not explicit)",
  "date": "YYYY-MM-DD",
  "participants": ["Full Name 1", "Full Name 2"],
  "keyPoints": ["key discussion point 1", "key discussion point 2"],
  "decisions": ["decision made 1", "decision made 2"],
  "actionItems": [
    {
      "description": "clear description of the task to be done",
      "owner": "Full Name of person responsible",
      "dueDate": "YYYY-MM-DD or empty string if not mentioned",
      "isSimon": false
    }
  ],
  "nextSteps": ["next step 1", "next step 2"]
}

Rules:
- isSimon = true if owner is "Simon Lobascher", "Simon L", or "Simon"
- Extract EVERY action item even if loosely mentioned
- keyPoints should be substantive discussion topics (3-8 points)
- decisions are concrete conclusions reached (not tasks)
- nextSteps are broader follow-on activities beyond specific actions
- File name hint: ${fileName}

Meeting content:
${text.slice(0, 15000)}`;

        let content = '';

        if (useOpenAI) {
          const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-5.2',
              temperature: 0,
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
            }),
          });
          if (!aiRes.ok) {
            const errText = await aiRes.text();
            return new Response(JSON.stringify({ error: `OpenAI API error: ${errText}` }), {
              status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }
          const aiData = await aiRes.json();
          content = aiData?.choices?.[0]?.message?.content || '';
        } else {
          const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-6',
              max_tokens: 4096,
              messages: [{ role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }],
            }),
          });
          if (!aiRes.ok) {
            const errText = await aiRes.text();
            return new Response(JSON.stringify({ error: `Claude API error: ${errText}` }), {
              status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }
          const aiData = await aiRes.json();
          content = aiData?.content?.[0]?.text || '';
        }

        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch {
          const match = content.match(/\{[\s\S]*\}/);
          if (!match) {
            return new Response(JSON.stringify({ error: 'No valid JSON in AI response', raw: content.slice(0, 500) }), {
              status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }
          parsed = JSON.parse(match[0]);
        }

        return new Response(JSON.stringify(parsed), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }
    }

    // ── Artefact Deep Parse ─────────────────────────────────────────────────
    if (request.method === 'POST' && url.pathname === '/parse-artefact') {
      try {
        const useOpenAI = !!env.OPENAI_API_KEY;
        const apiKey = useOpenAI ? env.OPENAI_API_KEY : env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'No AI API key configured' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }
        const body = await request.json();
        const text = String(body?.text || '');
        const fileName = String(body?.fileName || 'document');
        if (!text) {
          return new Response(JSON.stringify({ error: 'Missing text' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        const artefactPrompt = `You are a senior Enterprise Architect and Business Analyst at DuluxGroup (an AkzoNobel company that manufactures and sells paint, coatings, and related products in Australia/NZ).

TASK: Thoroughly parse the following document and extract ALL structured knowledge for use in Miro diagram generation. Be exhaustive — capture every entity, system, process, data flow, person, decision, and relationship mentioned or implied.

Document: ${fileName}

Return ONLY a valid JSON object with this exact schema:
{
  "summary": "2-3 sentence executive summary of what this document describes",
  "documentType": "one of: architecture-diagram, process-map, requirements, meeting-notes, data-model, system-spec, org-chart, other",
  "systems": [{ "name": "system name", "type": "internal|external|saas|database|middleware|infrastructure", "description": "what it does", "owner": "team/person if known", "technology": "tech stack if known" }],
  "processes": [{ "name": "process name", "steps": ["step 1", "step 2"], "owner": "who runs this", "systems": ["system names involved"] }],
  "dataFlows": [{ "from": "source system/actor", "to": "target system/actor", "data": "what data", "protocol": "REST/SOAP/MQ/batch/etc", "frequency": "realtime/batch/event if known" }],
  "entities": [{ "name": "entity/object name", "attributes": ["key attributes"], "relationships": ["related entity: relationship type"] }],
  "people": [{ "name": "person or role name", "role": "job title/role", "responsibilities": ["key responsibilities"] }],
  "decisions": ["key decisions or constraints documented"],
  "keyInsights": ["important facts, patterns, or architectural decisions that should inform diagram generation"],
  "duluxContext": "any Dulux/AkzoNobel-specific context: brands (Dulux, Cabot's, Selleys, Feast Watson, etc), divisions (D&I, Parchem, etc), known systems (SAP, Salesforce, etc)"
}

Document content:
${text.slice(0, 20000)}`;

        let content = '';
        if (useOpenAI) {
          const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gpt-5.2', temperature: 0,
              response_format: { type: 'json_object' },
              messages: [{ role: 'user', content: artefactPrompt }],
            }),
          });
          if (!aiRes.ok) throw new Error(`OpenAI error: ${await aiRes.text()}`);
          const d = await aiRes.json();
          content = d?.choices?.[0]?.message?.content || '';
        } else {
          const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-sonnet-4-6', max_tokens: 8000,
              messages: [{ role: 'user', content: artefactPrompt }],
            }),
          });
          if (!aiRes.ok) throw new Error(`Claude error: ${await aiRes.text()}`);
          const d = await aiRes.json();
          content = d?.content?.[0]?.text || '';
        }

        let parsed;
        try { parsed = JSON.parse(content); }
        catch {
          const match = content.match(/\{[\s\S]*\}/);
          if (!match) throw new Error('No valid JSON in AI response');
          parsed = JSON.parse(match[0]);
        }
        parsed.fileName = fileName;
        parsed.parsedAt = new Date().toISOString();
        return new Response(JSON.stringify(parsed), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }
    }

    // ── AI Email ────────────────────────────────────────────────────────────
    if (request.method === 'POST' && url.pathname === '/email') {
      try {
        const useOpenAI = !!env.OPENAI_API_KEY;
        const apiKey = useOpenAI ? env.OPENAI_API_KEY : env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'No AI API key configured on worker' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        const body = await request.json();
        const meeting = body?.meeting;
        if (!meeting) {
          return new Response(JSON.stringify({ error: 'Missing meeting data' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        // Work out which first names appear more than once so we know when to use full names
        const allNames = (meeting.participants || []);
        const firstNames = allNames.map(n => n.trim().split(/\s+/)[0].toLowerCase());
        const firstNameCounts = firstNames.reduce((acc, fn) => { acc[fn] = (acc[fn] || 0) + 1; return acc; }, {});
        const shortName = (fullName) => {
          const first = fullName.trim().split(/\s+/)[0];
          return firstNameCounts[first.toLowerCase()] > 1 ? fullName.trim() : first;
        };
        const actionLines = (meeting.actionItems || []).map(a =>
          `- ${shortName(a.owner)} to ${a.description}${a.dueDate ? ' Due Date: ' + a.dueDate : ' Due Date: TBC'}`
        ).join('\n');
        const decisionLines = (meeting.decisions || []).map(d => `- ${d}`).join('\n');
        const nextStepLines = (meeting.nextSteps || []).join('\n');

        const prompt = `You are Simon Lobascher, a business analyst at DuluxGroup. Write a warm, conversational follow-up email summarising a meeting.

CRITICAL ENCODING RULE: Use ONLY plain ASCII characters. Never use em dashes (--), en dashes, smart/curly quotes, ellipsis characters, or any Unicode punctuation. Use a plain hyphen (-) instead of dashes, straight apostrophes and quotes only.

Tone: friendly and collegial - like a message to colleagues you work well with. Natural language, contractions, light touch. No corporate buzzwords or stiff phrasing.

NAME RULE: Use first names only for all people, UNLESS two or more attendees share the same first name — in that case use their full name throughout.

FIRST PERSON RULE: Never use "I'll", "I will", "I've", "I am", "I'm", or any first-person language. You are writing as Simon but in third person — always refer to Simon Lobascher as "Simon" (or full name if needed), never as "I". For example: write "Simon will follow up" not "I'll follow up".

Follow this EXACT structure:

1. Opening — start with "Hi all," on its own line, then a warm thank-you for the meeting on the next line. Do NOT mention the date. Reference the meeting topic naturally, e.g. "Thanks for joining our LeanIX brainstorming session - it was a really productive conversation and..." Briefly capture the vibe/theme in one or two sentences. Make it specific to the meeting topic, not generic.

2. Section heading: Next Steps
A short list of the immediate next steps from the meeting. Keep these brief and directional — no owners or dates needed here.

3. Section heading: Actions
CRITICAL RULES:
- Every action MUST be a bullet point starting with "- " and end with "Due Date: DD/MM/YYYY". If no date was given, propose a reasonable one (e.g. 2 weeks from meeting date).
- Use first name only unless two attendees share the same first name, in which case use full name.
- Format: - [Name] to [do X] Due Date: DD/MM/YYYY

4. Section heading: Decisions
CRITICAL RULES:
- Every decision MUST be a bullet point starting with "- " and include the date the decision was made (the meeting date).
- Use first name only unless two attendees share the same first name.
- Format: - [Name] agreed/decided to [X] (decided DD/MM/YYYY)

5. Section heading: Key Minutes
A brief paragraph or short bullets summarising the main discussion themes. Synthesise — don't just repeat every point verbatim.

6. Sign off:
Kind regards,
Simon Lobascher

Meeting data:
Title: ${meeting.title}
Date: ${meeting.date}
Attendees: ${allNames.join(', ')}
Key Points: ${(meeting.keyPoints || []).join(' | ')}
Next Steps:
${nextStepLines}
Actions:
${actionLines}
Decisions:
${decisionLines}

Return ONLY the plain text email body — no subject line, no markdown, no explanation. Use plain section headings (not bold/asterisks).`;

        let emailBody = '';

        if (useOpenAI) {
          const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gpt-5.2',
              temperature: 0.7,
              messages: [{ role: 'user', content: prompt }],
            }),
          });
          if (!aiRes.ok) {
            const errText = await aiRes.text();
            return new Response(JSON.stringify({ error: `OpenAI error: ${errText}` }), {
              status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }
          const aiData = await aiRes.json();
          emailBody = aiData?.choices?.[0]?.message?.content || '';
        } else {
          const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-sonnet-4-6',
              max_tokens: 2048,
              messages: [{ role: 'user', content: prompt }],
            }),
          });
          if (!aiRes.ok) {
            const errText = await aiRes.text();
            return new Response(JSON.stringify({ error: `Claude error: ${errText}` }), {
              status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }
          const aiData = await aiRes.json();
          emailBody = aiData?.content?.[0]?.text || '';
        }

        // Sanitize to plain ASCII-safe characters for Outlook compatibility
        const sanitized = emailBody.trim()
          .replace(/\u2014/g, '-')   // em dash -> hyphen
          .replace(/\u2013/g, '-')   // en dash -> hyphen
          .replace(/\u2018/g, "'")   // left single quote
          .replace(/\u2019/g, "'")   // right single quote / apostrophe
          .replace(/\u201C/g, '"')   // left double quote
          .replace(/\u201D/g, '"')   // right double quote
          .replace(/\u2026/g, '...') // ellipsis
          .replace(/\u00A0/g, ' ');  // non-breaking space

        return new Response(JSON.stringify({ body: sanitized }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }
    }

    // ── Miro Diagram ────────────────────────────────────────────────────────
    if (request.method === 'POST' && url.pathname === '/miro') {
      try {
        const wsMiro = await getWorkspaceSecrets('miro');
        const miroApiKey = wsMiro?.apiKey || env.MIRO_API_KEY;
        if (!miroApiKey) {
          return new Response(JSON.stringify({ error: 'Miro not configured. Add API key in Settings.' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }
        const useOpenAI = !!env.OPENAI_API_KEY;
        const apiKey = useOpenAI ? env.OPENAI_API_KEY : env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'No AI API key configured on worker' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        const body = await request.json();
        const { meeting, prompt: userPrompt, context: userContext, teamId } = body;
        if (!meeting || !userPrompt) {
          return new Response(JSON.stringify({ error: 'Missing meeting or prompt' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        // ── Detect diagram type from prompt ─────────────────────────────────
        const pLow = userPrompt.toLowerCase();
        const isSequence    = /sequence|auth.*flow|login.*flow|oauth|api.*flow|message.*flow|uml.*seq/.test(pLow);
        const isClass       = /class diagram|domain model|data model|\berd\b|entity.*diagram|uml.*class/.test(pLow);
        const isSwimLane    = /swim.?lane|cross.functional|lane diagram/.test(pLow);
        const isC4          = /\bc4\b|context diagram|system context/.test(pLow);
        const isAppArch     = /app(lication)?\s+arch|apps\s+arch|system landscape|application map/.test(pLow);
        const isIntegArch   = /integrat(ion)?\s+arch|middleware|\besb\b|mulesoft|api\s+gateway/.test(pLow);
        const isNetworkArch = /network\s+arch|infra(structure)?\s+arch|\bvpc\b|\bdmz\b|network diagram/.test(pLow);
        const isCapMap      = /capability\s+map|capability\s+model|\bbcm\b|business capability/.test(pLow);
        const isDataArch    = /data\s+arch|data\s+lineage|data\s+flow|\betl\b|data pipeline/.test(pLow);
        const isServiceDesign = /service\s+design|customer\s+journey|cx\s+journey|user\s+journey|touchpoint/.test(pLow);
        const isWireframe   = /wireframe|ui\s+mock|screen\s+design|ux\s+wire|app\s+wireframe/.test(pLow);

        const meetingContext = `Meeting: ${meeting.title} (${meeting.date})
Participants: ${(meeting.participants || []).join(', ')}
Key Points: ${(meeting.keyPoints || []).join(' | ')}
Decisions: ${(meeting.decisions || []).join(' | ')}
Actions: ${(meeting.actionItems || []).map(a => `${a.owner}: ${a.description}`).join(' | ')}
Next Steps: ${(meeting.nextSteps || []).join(' | ')}${userContext ? `\n\nAdditional reference material (use as primary source of truth — prefer over meeting notes):\n${userContext.substring(0, 8000)}` : ''}`;

        const COLOURS = `COLOURS by role: #1E3A5F navy=primary/core, #2E86C1 blue=secondary, #1A8C6B teal=confirmed/done, #E67E22 orange=actions/pending, #7D3C98 purple=external/3rd-party, #717D7E grey=supporting, #C0392B red=risk/blocker. White text (#fff) on dark fills; dark text (#1a1a1a) on light fills.`;
        const VALID_SHAPE_NAMES = `ONLY use these exact shape values: rectangle, round_rectangle, circle, rhombus, can, parallelogram, hexagon, pentagon, star, chevron, cross, cloud, triangle. NO other values — actor/database/cylinder/note/diamond/oval are invalid.`;
        const GLOBAL_RULES = `
CRITICAL LAYOUT RULES (apply to ALL diagrams):
- CONNECTOR LABELS: Max 5 words per label. Use short verbs/protocols ONLY (e.g. "REST API", "sends via MQ", "batch ETL", "HTTPS"). NEVER write full sentences, explanations, or long descriptions on connectors. If you need more detail, put it in the node label instead.
- SPACING: Minimum 100px gap between all nodes in every direction. Nodes must NEVER overlap or touch.
- NODE LABELS: Max 4 lines of text per node. Keep labels concise. Long descriptions belong in separate description nodes, not crammed into one box.
- COORDINATES: Double-check that no two nodes share the same (x,y) position. Every node must have unique coordinates with adequate spacing.`;

        let aiPrompt;

        if (isSequence) {
          aiPrompt = `You are creating a UML sequence diagram in Miro.

USER REQUEST: ${userPrompt}

${meetingContext}

LAYOUT APPROACH — follow this exactly:
Each actor/system has:
1. A HEADER BOX: rectangle, width:180, height:55, at y:0
2. A STEM: rectangle, width:10, height:1400, at y:750 (same x as header), label:"", fillColor:"#94A3B8"
3. ANCHOR NODES for each message: tiny rectangle width:10, height:10, placed at the actor's x and the message's y. These are invisible (fillColor:"#94A3B8", label:""). Name them like "a_ll1_msg1" (anchor, lifeline 1, message 1).

Messages are connectors between the TWO anchor nodes (one per lifeline) at the same y level.
- Place message anchors starting at y:140, increment by 100 for each message
- Each message has an anchor on the FROM lifeline and an anchor on the TO lifeline — both at the same y
- Connector goes FROM anchor → TO anchor, style "straight"
- Message label on the connector — MAX 5 WORDS (e.g. "1: POST /token", "2: 200 OK")
- Return messages: dashed:true, lighter strokeColor "#94A3B8"

X positions: first lifeline x=-800, increment by 400 each. All header, stem, and anchor nodes for a lifeline share the same x.

Lifeline colours:
- Internal actor/system: fillColor "#1E3A5F" (header), stem "#94A3B8"
- External system/3rd party: fillColor "#7D3C98" (header), stem "#94A3B8"
- Database/store: fillColor "#1A8C6B" (header), stem "#94A3B8"

${COLOURS}
${VALID_SHAPE_NAMES}
${GLOBAL_RULES}

Return ONLY valid JSON, no markdown. Example for 2 lifelines, 2 messages:
{
  "title": "short board title max 55 chars",
  "frames": [],
  "nodes": [
    { "id": "ll1_header", "label": "Client", "shape": "rectangle", "fillColor": "#1E3A5F", "textColor": "#ffffff", "fontSize": 14, "x": -800, "y": 0, "width": 180, "height": 55 },
    { "id": "ll1_stem",   "label": "", "shape": "rectangle", "fillColor": "#94A3B8", "textColor": "#ffffff", "fontSize": 12, "x": -800, "y": 750, "width": 10, "height": 1400 },
    { "id": "a_ll1_msg1", "label": "", "shape": "rectangle", "fillColor": "#94A3B8", "textColor": "#ffffff", "fontSize": 12, "x": -800, "y": 140, "width": 10, "height": 10 },
    { "id": "a_ll1_msg2", "label": "", "shape": "rectangle", "fillColor": "#94A3B8", "textColor": "#ffffff", "fontSize": 12, "x": -800, "y": 240, "width": 10, "height": 10 },
    { "id": "ll2_header", "label": "Auth Server", "shape": "rectangle", "fillColor": "#7D3C98", "textColor": "#ffffff", "fontSize": 14, "x": -400, "y": 0, "width": 180, "height": 55 },
    { "id": "ll2_stem",   "label": "", "shape": "rectangle", "fillColor": "#94A3B8", "textColor": "#ffffff", "fontSize": 12, "x": -400, "y": 750, "width": 10, "height": 1400 },
    { "id": "a_ll2_msg1", "label": "", "shape": "rectangle", "fillColor": "#94A3B8", "textColor": "#ffffff", "fontSize": 12, "x": -400, "y": 140, "width": 10, "height": 10 },
    { "id": "a_ll2_msg2", "label": "", "shape": "rectangle", "fillColor": "#94A3B8", "textColor": "#ffffff", "fontSize": 12, "x": -400, "y": 240, "width": 10, "height": 10 }
  ],
  "edges": [
    { "from": "a_ll1_msg1", "to": "a_ll2_msg1", "label": "1: POST /token", "style": "straight", "strokeColor": "#334155", "strokeWidth": 2, "endCap": "stealth", "startCap": "none", "dashed": false },
    { "from": "a_ll2_msg2", "to": "a_ll1_msg2", "label": "2: 200 access_token", "style": "straight", "strokeColor": "#94A3B8", "strokeWidth": 1, "endCap": "stealth", "startCap": "none", "dashed": true }
  ]
}

Generate 3-7 lifelines and 8-15 messages. Every message needs a specific technical label. Number messages sequentially.`;

        } else if (isClass) {
          aiPrompt = `You are creating a UML class / entity diagram in Miro.

USER REQUEST: ${userPrompt}

${meetingContext}

CLASS DIAGRAM RULES:
- Each class is a rectangle (width:260, height:auto — 65px header + 30px per attribute)
- Class header: fillColor #1E3A5F, white text, bold class name
- Attribute rows: fillColor #f8fafc, dark text, format "- attributeName: Type"
- Arrange classes in a grid: 4 columns max, 420px x-spacing, 320px y-spacing, centred at x=0
- Relationships as labelled connectors (max 3 words per label):
  - Inheritance: endCap "filled_triangle", label "extends"
  - Composition: startCap "filled_diamond", label "1..*"
  - Association: endCap "stealth", label the relationship (e.g. "has many", "belongs to")
- DO NOT use frames

${COLOURS}
${VALID_SHAPE_NAMES}
${GLOBAL_RULES}

Return ONLY valid JSON, no markdown:
{
  "title": "short board title max 55 chars",
  "frames": [],
  "nodes": [
    { "id": "c1", "label": "ClassName\n- id: UUID\n- name: String\n- createdAt: Date", "shape": "rectangle", "fillColor": "#1E3A5F", "textColor": "#ffffff", "fontSize": 13, "x": -630, "y": 0, "width": 260, "height": 155 }
  ],
  "edges": [
    { "from": "c1", "to": "c2", "label": "has many", "style": "elbowed", "strokeColor": "#334155", "strokeWidth": 2, "endCap": "stealth", "startCap": "none" }
  ]
}

Generate all entities/classes mentioned or implied by the context. Include key attributes.`;

        } else if (isSwimLane) {
          aiPrompt = `You are creating a swim lane process flow diagram in Miro.

USER REQUEST: ${userPrompt}

${meetingContext}

SWIM LANE RULES:
- Each lane is a tall background rectangle: width=340, height=1000, fillColor very light (#EBF5FB for first, #EAFAF1 for second, #FEF9E7 for third, #F5EEF8 for fourth)
- Lane header: rectangle width=340, height=55, fillColor matching a darker tint, at top of lane
- Lanes are placed side by side: x = laneIndex * 400, y = 0
- Lane backgrounds y = 500 (centred vertically for height 1000)
- Process steps are rectangles (width:240, height:70) centred within each lane's x, incrementing y by 150
- Decision diamonds: width:180, height:90, shape "rhombus"
- Connectors flow top-to-bottom within a lane, cross lanes for handoffs. Labels max 3 words (e.g. "yes", "no", "approved", "next step").
- Start node: circle shape (width:60, height:60, fillColor:#1A8C6B) at top centre
- End node: circle shape (width:60, height:60, fillColor:#C0392B) at bottom centre
- DO NOT use the frames array — lane backgrounds are just nodes with rectangle shape

${COLOURS}
${VALID_SHAPE_NAMES}
${GLOBAL_RULES}

Return ONLY valid JSON, no markdown:
{
  "title": "short board title max 55 chars",
  "frames": [],
  "nodes": [
    { "id": "lane1_bg", "label": "", "shape": "rectangle", "fillColor": "#EBF5FB", "textColor": "#1a1a1a", "fontSize": 14, "x": 0, "y": 500, "width": 340, "height": 1000 },
    { "id": "lane1_header", "label": "Lane Name", "shape": "rectangle", "fillColor": "#2E86C1", "textColor": "#ffffff", "fontSize": 14, "x": 0, "y": 28, "width": 340, "height": 55 },
    { "id": "step1", "label": "Process Step", "shape": "rectangle", "fillColor": "#1E3A5F", "textColor": "#ffffff", "fontSize": 14, "x": 0, "y": 140, "width": 240, "height": 70 }
  ],
  "edges": [
    { "from": "step1", "to": "step2", "label": "next", "style": "straight", "strokeColor": "#334155", "strokeWidth": 2, "endCap": "stealth", "startCap": "none" }
  ]
}

Generate 3-5 lanes with 4-8 steps each. Use real process step names from the meeting context.`;

        } else if (isC4) {
          aiPrompt = `You are a senior Enterprise Architect creating a C4 Level 1 System Context diagram in Miro.

USER REQUEST: ${userPrompt}

${meetingContext}

LAYOUT RULES — RADIAL SPREAD (CRITICAL):
The diagram MUST be laid out as a radial/spoke pattern with the primary system at the centre and other systems SPREAD around it in a wide circle. DO NOT stack systems vertically or horizontally — they must be distributed evenly around the centre.

- Person/user: round_rectangle (w:200, h:90), fillColor:#1E3A5F, placed at top (x:0, y:-600)
- Primary system: large rectangle (w:360, h:150), fillColor:#1E3A5F, CENTRE at (x:0, y:0)
- Internal systems: rectangle (w:260, h:100), fillColor:#2E86C1, placed on INNER RING at these EXACT clock positions (pick from these):
  - 12 o'clock: (0, -500)
  - 1:30: (430, -250)
  - 3 o'clock: (500, 0)
  - 4:30: (430, 250)
  - 6 o'clock: (0, 500)
  - 7:30: (-430, 250)
  - 9 o'clock: (-500, 0)
  - 10:30: (-430, -250)
- External systems: rectangle (w:260, h:100), fillColor:#7D3C98, placed on OUTER RING at these positions:
  - 12 o'clock: (0, -850)
  - 1:30: (730, -425)
  - 3 o'clock: (850, 0)
  - 4:30: (730, 425)
  - 6 o'clock: (0, 850)
  - 7:30: (-730, 425)
  - 9 o'clock: (-850, 0)
  - 10:30: (-730, -425)
- Data stores: can shape (w:180, h:100), fillColor:#1A8C6B, place on inner or outer ring
- Connectors: style "straight" (NOT elbowed — straight lines work better for radial), label max 3 words
- DO NOT use frames
- NEVER place two nodes at the same clock position — distribute evenly

${COLOURS}
${VALID_SHAPE_NAMES}
${GLOBAL_RULES}

Return ONLY valid JSON, no markdown. Example with 5 systems around centre:
{
  "title": "short board title max 55 chars",
  "frames": [],
  "nodes": [
    { "id": "user", "label": "Sales Rep", "shape": "round_rectangle", "fillColor": "#1E3A5F", "textColor": "#ffffff", "fontSize": 14, "x": 0, "y": -600, "width": 200, "height": 90 },
    { "id": "sys", "label": "SAP S/4HANA", "shape": "rectangle", "fillColor": "#1E3A5F", "textColor": "#ffffff", "fontSize": 16, "x": 0, "y": 0, "width": 360, "height": 150 },
    { "id": "int1", "label": "MuleSoft ESB", "shape": "rectangle", "fillColor": "#2E86C1", "textColor": "#ffffff", "fontSize": 14, "x": 500, "y": 0, "width": 260, "height": 100 },
    { "id": "ext1", "label": "Salesforce CRM", "shape": "rectangle", "fillColor": "#7D3C98", "textColor": "#ffffff", "fontSize": 14, "x": 850, "y": 0, "width": 260, "height": 100 },
    { "id": "db1", "label": "Product DB", "shape": "can", "fillColor": "#1A8C6B", "textColor": "#ffffff", "fontSize": 14, "x": -500, "y": 0, "width": 180, "height": 100 },
    { "id": "ext2", "label": "OAuth Server", "shape": "rectangle", "fillColor": "#7D3C98", "textColor": "#ffffff", "fontSize": 14, "x": 0, "y": 850, "width": 260, "height": 100 }
  ],
  "edges": [
    { "from": "user", "to": "sys", "label": "uses", "style": "straight", "strokeColor": "#334155", "strokeWidth": 2, "endCap": "stealth", "startCap": "none" },
    { "from": "sys", "to": "int1", "label": "REST API", "style": "straight", "strokeColor": "#334155", "strokeWidth": 2, "endCap": "stealth", "startCap": "none" },
    { "from": "int1", "to": "ext1", "label": "SOAP/REST", "style": "straight", "strokeColor": "#334155", "strokeWidth": 2, "endCap": "stealth", "startCap": "none" }
  ]
}

Generate all relevant systems spread around the centre. Use the clock position coordinates above — pick different positions for each node. Every connector labelled (max 3 words).`;

        } else if (isIntegArch) {
          aiPrompt = `You are a senior Integration Architect creating an integration architecture diagram in Miro.

USER REQUEST: ${userPrompt}

${meetingContext}

LAYOUT RULES:
- 3 vertical columns: Source Systems (x:-1000), Integration Layer (x:0), Target Systems (x:1000)
- Source systems: rectangle (w:240, h:80), fillColor:#1E3A5F, stacked vertically starting y:-350, +180 each
- Integration platform (MuleSoft/ESB/API GW etc): rectangle (w:300, h:110), fillColor:#7D3C98, centred at x:0
- Sub-components of integration layer (transforms, routers): rectangle (w:220, h:70), fillColor:#7D3C98, below integration platform +150 each
- Target systems: rectangle (w:240, h:80), fillColor:#2E86C1, stacked vertically starting y:-350, +180 each
- Message queues / service bus: rectangle (w:260, h:80), fillColor:#E67E22, horizontal band at y:600
- Data stores: can (w:160, h:90), fillColor:#1A8C6B, placed near relevant system
- Connectors: style "straight" left-to-right, label with protocol ONLY (e.g. "REST", "JMS", "SFTP", "SOAP") — max 3 words
- DO NOT use frames

${COLOURS}
${VALID_SHAPE_NAMES}
${GLOBAL_RULES}

Return ONLY valid JSON, no markdown:
{
  "title": "short board title max 55 chars",
  "frames": [],
  "nodes": [
    { "id": "src1", "label": "SAP S/4HANA", "shape": "rectangle", "fillColor": "#1E3A5F", "textColor": "#ffffff", "fontSize": 14, "x": -1000, "y": -175, "width": 240, "height": 80 },
    { "id": "integ", "label": "MuleSoft Integration", "shape": "rectangle", "fillColor": "#7D3C98", "textColor": "#ffffff", "fontSize": 14, "x": 0, "y": 0, "width": 300, "height": 110 },
    { "id": "tgt1", "label": "Salesforce CRM", "shape": "rectangle", "fillColor": "#2E86C1", "textColor": "#ffffff", "fontSize": 14, "x": 1000, "y": -175, "width": 240, "height": 80 }
  ],
  "edges": [
    { "from": "src1", "to": "integ", "label": "IDOC via JMS", "style": "straight", "strokeColor": "#334155", "strokeWidth": 2, "endCap": "stealth", "startCap": "none" }
  ]
}

Generate all source/target systems and integration components from the context. Label every connector with protocol (max 3 words).`;

        } else if (isAppArch) {
          aiPrompt = `You are a senior Enterprise Architect creating an application architecture diagram in Miro.

USER REQUEST: ${userPrompt}

${meetingContext}

LAYOUT RULES — tier-based horizontal rows:
- Define tiers: Frontend / API & Gateway / Core Applications / Integration / Data / Infrastructure
- Tier label node: rectangle (w:160, h:60), fillColor:#334155, textColor:#ffffff, x:-1050, one per tier
- Tier row y positions: Frontend y:-500, API y:-300, Core y:-100, Integration y:100, Data y:300, Infrastructure y:500
- Apps within each tier: rectangle (w:240, h:80), x-spaced +300 starting x:-600, y = tier y
- Colour by tier: Frontend=#2E86C1, API/Gateway=#1E3A5F, Core=#1E3A5F, Integration=#7D3C98, Data=#1A8C6B, Infra=#717D7E
- External systems: rectangle (w:220, h:70), fillColor:#7D3C98, placed at far right x:1000+
- Connectors: style "elbowed", label with protocol ONLY (max 3 words e.g. "REST API", "GraphQL", "JDBC")
- DO NOT use frames

${COLOURS}
${VALID_SHAPE_NAMES}
${GLOBAL_RULES}

Return ONLY valid JSON, no markdown:
{
  "title": "short board title max 55 chars",
  "frames": [],
  "nodes": [
    { "id": "tier_frontend", "label": "Frontend", "shape": "rectangle", "fillColor": "#334155", "textColor": "#ffffff", "fontSize": 13, "x": -1050, "y": -500, "width": 160, "height": 60 },
    { "id": "app1", "label": "React Web App", "shape": "rectangle", "fillColor": "#2E86C1", "textColor": "#ffffff", "fontSize": 14, "x": -600, "y": -500, "width": 240, "height": 80 }
  ],
  "edges": [
    { "from": "app1", "to": "api1", "label": "REST API", "style": "elbowed", "strokeColor": "#334155", "strokeWidth": 2, "endCap": "stealth", "startCap": "none" }
  ]
}

Generate all apps/services implied by the context, organised by tier. Include external systems at the boundary.`;

        } else if (isNetworkArch) {
          aiPrompt = `You are a senior Infrastructure Architect creating a network/infrastructure architecture diagram in Miro.

USER REQUEST: ${userPrompt}

${meetingContext}

LAYOUT RULES — zone-based:
- Zones as large background rectangles: Internet (x:0,y:0,w:480,h:1400), DMZ (x:540,y:0,w:480,h:1400), Internal (x:1080,y:0,w:680,h:1400), Cloud (x:1820,y:0,w:580,h:1400)
- Zone headers: rectangle (w=zone w, h:55), fillColor:#334155, textColor:#ffffff, at top of zone
- Devices within zones: rectangle (w:220, h:70), centred in zone x, y increments +160 from y:120
- Firewalls: rhombus (w:120, h:70), fillColor:#C0392B
- Load balancers: parallelogram (w:220, h:70), fillColor:#E67E22
- Servers/VMs: rectangle (w:220, h:70), fillColor:#1E3A5F
- Cloud services: round_rectangle (w:220, h:70), fillColor:#2E86C1
- Databases: can (w:150, h:90), fillColor:#1A8C6B
- Connectors: style "straight", label with port/protocol ONLY max 2 words (e.g. "HTTPS:443", "SSH:22", "TCP:5432")
- DO NOT use frames — zones are just background rectangle nodes

${COLOURS}
${VALID_SHAPE_NAMES}
${GLOBAL_RULES}

Return ONLY valid JSON, no markdown:
{
  "title": "short board title max 55 chars",
  "frames": [],
  "nodes": [
    { "id": "zone_dmz_bg", "label": "", "shape": "rectangle", "fillColor": "#FEF9E7", "textColor": "#1a1a1a", "fontSize": 14, "x": 780, "y": 700, "width": 480, "height": 1400 },
    { "id": "zone_dmz_hdr", "label": "DMZ", "shape": "rectangle", "fillColor": "#334155", "textColor": "#ffffff", "fontSize": 14, "x": 780, "y": 28, "width": 480, "height": 55 },
    { "id": "fw1", "label": "Firewall", "shape": "rhombus", "fillColor": "#C0392B", "textColor": "#ffffff", "fontSize": 13, "x": 780, "y": 140, "width": 120, "height": 70 }
  ],
  "edges": [
    { "from": "fw1", "to": "lb1", "label": "HTTPS:443", "style": "straight", "strokeColor": "#334155", "strokeWidth": 2, "endCap": "stealth", "startCap": "none" }
  ]
}

Generate all relevant network zones, devices, and connections from the context.`;

        } else if (isCapMap) {
          aiPrompt = `You are a senior Enterprise Architect creating a Business Capability Map in Miro.

USER REQUEST: ${userPrompt}

${meetingContext}

LAYOUT RULES:
- Domain background rows: rectangle (w:1600, h:150), x:0, stacked vertically — y:0, y:190, y:380, y:570 etc (190px gap between rows)
- Domain label: rectangle (w:160, h:150), fillColor:#334155, textColor:#ffffff, x:-880, same y as domain bg — left-side label
- Domain background fills (alternate): #EBF5FB, #EAFAF1, #FEF9E7, #F5EEF8, #EBF5FB
- Capability nodes: rectangle (w:210, h:100), within domain row, x starting at -680, +240 per capability
- Maturity colour: #1A8C6B=mature/strong, #E67E22=developing/partial, #C0392B=gap/missing, #717D7E=not in scope
- NO connectors needed — capability maps are spatial grids, not flowcharts
- DO NOT use frames

${COLOURS}
${VALID_SHAPE_NAMES}
${GLOBAL_RULES}

Return ONLY valid JSON, no markdown:
{
  "title": "short board title max 55 chars",
  "frames": [],
  "nodes": [
    { "id": "dom1_bg", "label": "", "shape": "rectangle", "fillColor": "#EBF5FB", "textColor": "#1a1a1a", "fontSize": 14, "x": 0, "y": 75, "width": 1600, "height": 150 },
    { "id": "dom1_lbl", "label": "Customer\nManagement", "shape": "rectangle", "fillColor": "#334155", "textColor": "#ffffff", "fontSize": 13, "x": -880, "y": 75, "width": 160, "height": 150 },
    { "id": "cap1", "label": "Customer Onboarding", "shape": "rectangle", "fillColor": "#1A8C6B", "textColor": "#ffffff", "fontSize": 13, "x": -680, "y": 75, "width": 210, "height": 100 }
  ],
  "edges": []
}

Generate 5-8 capability domains with 3-6 capabilities each. Use real capability names from the context. Colour by maturity if inferable.`;

        } else if (isDataArch) {
          aiPrompt = `You are a senior Data Architect creating a data architecture / lineage diagram in Miro.

USER REQUEST: ${userPrompt}

${meetingContext}

LAYOUT RULES — left-to-right pipeline:
- 4 stage columns: Sources (x:-1100), Transform/Process (x:-550), Store/Serve (x:0), Consume (x:550)
- Stage header: rectangle (w:240, h:55), fillColor:#334155, textColor:#ffffff, y:-450
- Data sources: rectangle (w:220, h:80), fillColor:#1E3A5F, y starting -340, +160 each
- Transformation steps: parallelogram (w:220, h:80), fillColor:#7D3C98
- Storage / databases: can (w:160, h:100), fillColor:#1A8C6B
- Data marts / warehouses: rectangle (w:220, h:80), fillColor:#1A8C6B
- Consumers / reports / APIs: round_rectangle (w:220, h:80), fillColor:#2E86C1
- Connectors: style "straight" left-to-right, label max 3 words (e.g. "nightly ETL", "REST API", "batch SFTP")
- DO NOT use frames

${COLOURS}
${VALID_SHAPE_NAMES}
${GLOBAL_RULES}

Return ONLY valid JSON, no markdown:
{
  "title": "short board title max 55 chars",
  "frames": [],
  "nodes": [
    { "id": "hdr_src", "label": "Sources", "shape": "rectangle", "fillColor": "#334155", "textColor": "#ffffff", "fontSize": 14, "x": -1100, "y": -450, "width": 240, "height": 55 },
    { "id": "src1", "label": "SAP S/4HANA", "shape": "rectangle", "fillColor": "#1E3A5F", "textColor": "#ffffff", "fontSize": 14, "x": -1100, "y": -340, "width": 220, "height": 80 },
    { "id": "store1", "label": "Data Warehouse", "shape": "can", "fillColor": "#1A8C6B", "textColor": "#ffffff", "fontSize": 14, "x": 0, "y": -340, "width": 160, "height": 100 }
  ],
  "edges": [
    { "from": "src1", "to": "store1", "label": "nightly ETL", "style": "straight", "strokeColor": "#334155", "strokeWidth": 2, "endCap": "stealth", "startCap": "none" }
  ]
}

Generate all data sources, transformations, stores, and consumers implied by the context.`;

        } else if (isServiceDesign) {
          aiPrompt = `You are a Service Designer creating a Customer Journey Map in Miro.

USER REQUEST: ${userPrompt}

${meetingContext}

LAYOUT RULES — phase columns, layer rows:
- Phases as column headers: rectangle (w:240, h:65), fillColor:#1E3A5F, textColor:#ffffff, y:-120, x = phaseIndex*290 starting x=-580
- Row labels (left margin x:-900): rectangle (w:200, h:70), fillColor:#334155, textColor:#ffffff, one per row
- Rows (y positions): Customer Actions y:0, Touchpoints y:150, Frontstage y:300, Backstage y:450, Support Processes y:600, Pain Points y:750
- Cell nodes within each row: rectangle (w:240, h:70), colour by row:
  - Customer Actions: #2E86C1
  - Touchpoints: #E67E22
  - Frontstage: #1E3A5F
  - Backstage: #7D3C98
  - Support Processes: #717D7E
  - Pain Points: #C0392B (use circle w:70,h:70 for emotion icons)
- Connectors: style "straight", horizontal arrows linking steps in the same row left-to-right. Labels empty or max 2 words.
- DO NOT use frames

${COLOURS}
${VALID_SHAPE_NAMES}
${GLOBAL_RULES}

Return ONLY valid JSON, no markdown:
{
  "title": "short board title max 55 chars",
  "frames": [],
  "nodes": [
    { "id": "phase1_hdr", "label": "Awareness", "shape": "rectangle", "fillColor": "#1E3A5F", "textColor": "#ffffff", "fontSize": 14, "x": -580, "y": -120, "width": 240, "height": 65 },
    { "id": "row_actions_lbl", "label": "Customer\nActions", "shape": "rectangle", "fillColor": "#334155", "textColor": "#ffffff", "fontSize": 13, "x": -900, "y": 0, "width": 200, "height": 70 },
    { "id": "ca_p1", "label": "Searches for product online", "shape": "rectangle", "fillColor": "#2E86C1", "textColor": "#ffffff", "fontSize": 12, "x": -580, "y": 0, "width": 240, "height": 70 }
  ],
  "edges": [
    { "from": "ca_p1", "to": "ca_p2", "label": "", "style": "straight", "strokeColor": "#94A3B8", "strokeWidth": 1, "endCap": "stealth", "startCap": "none" }
  ]
}

Generate 4-6 journey phases. Fill every row with real content from the context. Identify genuine pain points.`;

        } else if (isWireframe) {
          aiPrompt = `You are a UX designer creating a greyscale wireframe in Miro.

USER REQUEST: ${userPrompt}

${meetingContext}

LAYOUT RULES — greyscale only, realistic UI proportions:
- Use ONLY these colours: #F8FAFC (page bg), #FFFFFF (input/card bg), #E2E8F0 (panels/placeholders), #CBD5E1 (borders), #94A3B8 (secondary text/icons), #334155 (primary text), #1E3A5F (buttons/nav)
- Screen container: rectangle (w:1200, h:800) for desktop or (w:390, h:844) for mobile, fillColor:#F8FAFC, centred at x:0, y:0
- Navigation bar: rectangle (w=screen width, h:60), fillColor:#1E3A5F, y = screen top edge
- Sidebar (if applicable): rectangle (w:240, h=screen height-60), fillColor:#E2E8F0, left edge
- Content cards: rectangle (w:varies, h:varies), fillColor:#FFFFFF, rounded (use round_rectangle)
- Buttons: round_rectangle (w:140, h:40), fillColor:#1E3A5F, textColor:#ffffff
- Input fields: rectangle (w:300, h:40), fillColor:#FFFFFF, borderColor:#CBD5E1
- Text placeholders: rectangle (w:varies, h:14), fillColor:#E2E8F0 (simulate body text lines)
- Section headings: rectangle (w:200, h:24), fillColor:#334155 (dark placeholder for heading text)
- Images/media: rectangle with label "[ Image ]", fillColor:#E2E8F0
- Icons: circle (w:24, h:24), fillColor:#94A3B8
- NO connectors for static mockup; use right_arrow for navigation flow between screens
- DO NOT use frames

${VALID_SHAPE_NAMES}
${GLOBAL_RULES}

Return ONLY valid JSON, no markdown:
{
  "title": "short board title max 55 chars",
  "frames": [],
  "nodes": [
    { "id": "screen", "label": "", "shape": "rectangle", "fillColor": "#F8FAFC", "textColor": "#334155", "fontSize": 14, "x": 0, "y": 0, "width": 1200, "height": 800 },
    { "id": "nav", "label": "Navigation Bar", "shape": "rectangle", "fillColor": "#1E3A5F", "textColor": "#ffffff", "fontSize": 14, "x": 0, "y": -370, "width": 1200, "height": 60 },
    { "id": "btn1", "label": "Save", "shape": "round_rectangle", "fillColor": "#1E3A5F", "textColor": "#ffffff", "fontSize": 14, "x": 400, "y": 200, "width": 140, "height": 40 }
  ],
  "edges": []
}

Generate a complete, realistic wireframe screen with all relevant UI components for the described screen/app. Be specific to the context — use real labels, section names, form fields, etc.`;

        } else {
          // Default: general architecture / solution architecture
          aiPrompt = `You are a senior Enterprise Architect creating a professional architecture diagram in Miro.

USER REQUEST: ${userPrompt}

${meetingContext}

LAYOUT & STYLE RULES:
- Shapes: "rectangle" for systems/components, "round_rectangle" for actors/users/services, "rhombus" for decisions, "can" for databases
- Node size: width:280, height:90 standard; width:200, height:70 for secondary nodes
- Layout: arrange in logical rows/columns. Increment y by 200 per row, x by 340 per column. Centre at x=0, y=0.
- Group related components visually by proximity (no frames — just place them near each other)
- For solution architecture: show tiers — User → Frontend → API → Backend → Integration → Data
- Connectors: style "elbowed", endCap "stealth", strokeColor "#334155", strokeWidth 2
- Label every connector with max 4 words (protocol or action e.g. "REST API", "publishes events", "reads via JDBC")
- DO NOT use frames — they render on top of nodes and obscure content
- Minimum 120px gap between all nodes
- External/3rd-party systems: fillColor "#7D3C98"
- Internal systems: fillColor "#1E3A5F"
- Databases/stores: fillColor "#1A8C6B", shape "can"

${COLOURS}
${VALID_SHAPE_NAMES}
${GLOBAL_RULES}

Return ONLY valid JSON, no markdown:
{
  "title": "short board title max 55 chars",
  "frames": [],
  "nodes": [
    { "id": "n1", "label": "System Name", "shape": "rectangle", "fillColor": "#1E3A5F", "textColor": "#ffffff", "fontSize": 16, "x": 0, "y": 0, "width": 280, "height": 90 }
  ],
  "edges": [
    { "from": "n1", "to": "n2", "label": "calls via REST", "style": "elbowed", "strokeColor": "#334155", "strokeWidth": 2, "endCap": "stealth", "startCap": "none" }
  ]
}

Generate 10-20 nodes with precise coordinates. Every node must use real names from the context — no placeholders.`;
        }

        // ── Call AI ─────────────────────────────────────────────────────────
        let content = '';
        if (useOpenAI) {
          const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gpt-5.2',
              temperature: 0.2,
              response_format: { type: 'json_object' },
              messages: [{ role: 'user', content: aiPrompt }],
            }),
          });
          if (!aiRes.ok) throw new Error(`OpenAI error: ${await aiRes.text()}`);
          const d = await aiRes.json();
          content = d?.choices?.[0]?.message?.content || '';
        } else {
          const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-sonnet-4-6',
              max_tokens: 8000,
              messages: [{ role: 'user', content: aiPrompt }],
            }),
          });
          if (!aiRes.ok) throw new Error(`Claude error: ${await aiRes.text()}`);
          const d = await aiRes.json();
          content = d?.content?.[0]?.text || '';
        }

        let diagram;
        try {
          diagram = JSON.parse(content);
        } catch {
          const match = content.match(/\{[\s\S]*\}/);
          if (!match) throw new Error('No valid JSON in AI response');
          diagram = JSON.parse(match[0]);
        }

        // ── Create Miro board ───────────────────────────────────────────────
        const rawBoardName = (diagram.title || meeting.title || 'Diagram').trim();
        const boardPayload = { name: rawBoardName.length > 60 ? rawBoardName.substring(0, 57) + '…' : rawBoardName };
        if (teamId) boardPayload.teamId = teamId;
        const boardRes = await fetch('https://api.miro.com/v2/boards', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${miroApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(boardPayload),
        });
        if (!boardRes.ok) throw new Error(`Miro board creation failed: ${await boardRes.text()}`);
        const board = await boardRes.json();
        // Use raw board.id — fetch() in CF Workers encodes special chars in template literals correctly
        const boardId = board.id;
        const miroHeaders = { 'Authorization': `Bearer ${miroApiKey}`, 'Content-Type': 'application/json' };

        // ── Valid Miro shape types (exhaustive list from API) ───────────────
        const VALID_SHAPES = new Set(['rectangle','circle','triangle','wedge_round_rectangle_callout',
          'round_rectangle','rhombus','parallelogram','star','right_arrow','left_arrow','pentagon',
          'hexagon','octagon','trapezoid','flow_chart_predefined_process','left_right_arrow','cloud',
          'left_brace','right_brace','cross','can','chevron','notched_chevron']);
        const SHAPE_MAP = {
          actor: 'round_rectangle', user: 'round_rectangle', person: 'round_rectangle',
          note: 'rectangle', database: 'can', cylinder: 'can', storage: 'can',
          diamond: 'rhombus', decision: 'rhombus', process: 'rectangle',
          component: 'rectangle', module: 'rectangle', service: 'rectangle',
          system: 'rectangle', container: 'rectangle', class: 'rectangle',
          interface: 'round_rectangle', oval: 'circle', ellipse: 'circle',
          uml_actor: 'round_rectangle', boundary: 'rectangle', entity: 'rectangle',
          control: 'circle', usecase: 'round_rectangle',
        };

        // ── Helper: run promises in parallel batches ────────────────────────
        // CF Workers cap at 50 subrequests total (1 board + nodes + edges)
        // Cap: 25 nodes + 20 edges = 46 total. Batch size 5 = fast but safe.
        const batchAll = async (items, fn, batchSize = 5) => {
          const results = [];
          for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(fn));
            results.push(...batchResults);
          }
          return results;
        };

        // Hard cap to stay within CF 50 subrequest limit
        const cappedNodes = (diagram.nodes || []).slice(0, 25);
        const cappedEdges = (diagram.edges || []).slice(0, 20);

        // ── Create nodes (parallel batches) ─────────────────────────────────
        const nodeIdMap = {};
        const nodeErrors = [];
        await batchAll(cappedNodes, async (node) => {
          const isLifelineStem = node.width <= 10 && node.height >= 200;
          const fillC = isLifelineStem ? '#e2e8f0' : (node.fillColor || '#1E3A5F');
          const rawLabel = isLifelineStem ? '' : (node.label || '').replace(/<[^>]+>/g, '');
          const rawShape = (node.shape || 'rectangle').toLowerCase();
          const safeShape = VALID_SHAPES.has(rawShape) ? rawShape : (SHAPE_MAP[rawShape] || 'rectangle');
          const shapeBody = {
            data: { shape: safeShape, content: rawLabel },
            style: {
              fillColor: fillC,
              color: node.textColor || '#ffffff',
              fontSize: node.fontSize || 16,
              fontFamily: 'open_sans',
              textAlign: 'center',
              textAlignVertical: 'middle',
              borderColor: fillC,
            },
            position: { x: node.x || 0, y: node.y || 0, origin: 'center' },
            geometry: { width: Math.max(node.width || 240, 10), height: Math.max(node.height || 80, 10) },
          };
          const res = await fetch(`https://api.miro.com/v2/boards/${boardId}/shapes`, {
            method: 'POST', headers: miroHeaders,
            body: JSON.stringify(shapeBody),
          });
          if (res.ok) {
            const d = await res.json();
            nodeIdMap[node.id] = d.id;
          } else {
            const errText = await res.text();
            nodeErrors.push({ nodeId: node.id, status: res.status, error: errText.substring(0, 500) });
          }
        });

        // ── Create connectors (parallel batches) ────────────────────────────
        let edgeCount = 0;
        const edgeErrors = [];
        const validEdges = cappedEdges.filter(e => nodeIdMap[e.from] && nodeIdMap[e.to] && e.from !== e.to);
        // Hard-truncate connector labels to max 35 chars to prevent overlapping text
        const truncateLabel = (lbl) => {
          if (!lbl) return '';
          const s = String(lbl).trim();
          if (s.length <= 35) return s;
          // Cut at last space before 35 chars
          const cut = s.substring(0, 35);
          const lastSpace = cut.lastIndexOf(' ');
          return (lastSpace > 10 ? cut.substring(0, lastSpace) : cut) + '...';
        };
        await batchAll(validEdges, async (edge) => {
          const safeLabel = truncateLabel(edge.label);
          const connectorBody = {
            startItem: { id: nodeIdMap[edge.from], snapTo: 'auto' },
            endItem:   { id: nodeIdMap[edge.to],   snapTo: 'auto' },
            shape: edge.style === 'straight' ? 'straight' : 'elbowed',
            captions: safeLabel ? [{ content: safeLabel, position: '50%' }] : [],
            style: {
              strokeColor: edge.strokeColor || '#334155',
              strokeWidth: edge.strokeWidth || 2,
              strokeStyle: edge.dashed ? 'dashed' : 'normal',
              startStrokeCap: edge.startCap || 'none',
              endStrokeCap: edge.endCap || 'stealth',
            },
          };
          const res = await fetch(`https://api.miro.com/v2/boards/${boardId}/connectors`, {
            method: 'POST', headers: miroHeaders,
            body: JSON.stringify(connectorBody),
          });
          if (res.ok) {
            edgeCount++;
          } else {
            const errText = await res.text();
            edgeErrors.push({ edgeFrom: edge.from, edgeTo: edge.to, status: res.status, error: errText.substring(0, 300) });
          }
        });

        return new Response(JSON.stringify({
          boardId: board.id,
          viewLink: board.viewLink,
          title: board.name,
          nodeCount: Object.keys(nodeIdMap).length,
          edgeCount,
          aiNodeCount: (diagram.nodes || []).length,
          aiEdgeCount: (diagram.edges || []).length,
          nodeErrors: nodeErrors.slice(0, 3),
          edgeErrors: edgeErrors.slice(0, 3),
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }
    }

    // ── Workspace Config API ────────────────────────────────────────────────

    // Workspace config endpoints (Clerk auth required) — only specific paths, not all /config/*
    const wsConfigPaths = ['/config/workspace', '/config/workspaces', '/config/secrets', '/config/members', '/config/invite', '/config/join'];
    if (wsConfigPaths.some(p => url.pathname === p || url.pathname.startsWith(p + '/'))) {
      if (auth.type !== 'clerk') {
        return new Response(JSON.stringify({ error: 'Clerk authentication required for config endpoints' }), {
          status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }

      const clerkUserId = auth.userId;
      const clerkEmail = auth.email;

      // ── Encryption helpers (AES-256-GCM) ──────────────────────────────
      async function getEncryptionKey() {
        if (!env.MASTER_KEY) throw new Error('MASTER_KEY not configured');
        const raw = Uint8Array.from(atob(env.MASTER_KEY), c => c.charCodeAt(0));
        return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
      }

      async function encryptValue(plaintext) {
        const key = await getEncryptionKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(plaintext);
        const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
        const combined = new Uint8Array(iv.length + ciphertext.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(ciphertext), iv.length);
        return btoa(String.fromCharCode(...combined));
      }

      async function decryptValue(encrypted) {
        const key = await getEncryptionKey();
        const data = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
        const iv = data.slice(0, 12);
        const ciphertext = data.slice(12);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        return new TextDecoder().decode(decrypted);
      }

      // ── Helper: read/write JSON from R2 ───────────────────────────────
      async function readJSON(r2Key) {
        const obj = await env.MEETINGS.get(r2Key);
        if (!obj) return null;
        return obj.json();
      }

      async function writeJSON(r2Key, data) {
        await env.MEETINGS.put(r2Key, JSON.stringify(data), {
          httpMetadata: { contentType: 'application/json' },
        });
      }

      // ── Helper: resolve user → workspace ──────────────────────────────
      async function getUserWorkspaceId() {
        const mapping = await readJSON(`user-workspaces/${clerkUserId}.json`);
        return mapping?.workspaceId || null;
      }

      async function requireWorkspace() {
        const wsId = await getUserWorkspaceId();
        if (!wsId) throw new Error('No workspace found. Create one first.');
        const ws = await readJSON(`workspaces/${wsId}/config.json`);
        if (!ws) throw new Error('Workspace config missing');
        return { wsId, ws };
      }

      async function requireAdmin() {
        const { wsId, ws } = await requireWorkspace();
        const member = (ws.members || []).find(m => m.clerkUserId === clerkUserId);
        if (!member || (member.role !== 'admin' && member.role !== 'owner')) throw new Error('Only workspace admins can do this');
        return { wsId, ws };
      }

      try {
        // ── GET /config/workspace ─────────────────────────────────────────
        if (request.method === 'GET' && url.pathname === '/config/workspace') {
          let wsId = await getUserWorkspaceId();

          if (!wsId) {
            // Auto-create workspace for first-time user
            wsId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const workspace = {
              id: wsId,
              name: 'My Workspace',
              brands: [],
              createdAt: new Date().toISOString(),
              members: [{
                clerkUserId,
                email: clerkEmail,
                role: 'admin',
                joinedAt: new Date().toISOString(),
              }],
            };
            await writeJSON(`workspaces/${wsId}/config.json`, workspace);
            await writeJSON(`user-workspaces/${clerkUserId}.json`, { workspaceId: wsId });
            return new Response(JSON.stringify(workspace), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }

          const ws = await readJSON(`workspaces/${wsId}/config.json`);
          return new Response(JSON.stringify(ws), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        // ── PUT /config/workspace ─────────────────────────────────────────
        if (request.method === 'PUT' && url.pathname === '/config/workspace') {
          const { wsId, ws } = await requireAdmin();
          const body = await request.json();

          // Only allow updating specific fields
          if (body.name !== undefined) ws.name = String(body.name).slice(0, 100);
          if (body.brands !== undefined) ws.brands = (body.brands || []).map(b => String(b).slice(0, 100)).slice(0, 50);
          if (body.jiraInstanceUrl !== undefined) ws.jiraInstanceUrl = String(body.jiraInstanceUrl).slice(0, 200);
          if (body.jiraProjectKey !== undefined) ws.jiraProjectKey = String(body.jiraProjectKey).slice(0, 20);
          if (body.jiraAccountId !== undefined) ws.jiraAccountId = String(body.jiraAccountId).slice(0, 100);
          if (body.jiraProjectKeys !== undefined) ws.jiraProjectKeys = (body.jiraProjectKeys || []).map(k => String(k).slice(0, 20)).slice(0, 20);
          if (body.jiraDefaultJql !== undefined) ws.jiraDefaultJql = String(body.jiraDefaultJql).slice(0, 2000);
          if (body.miroTeamId !== undefined) ws.miroTeamId = String(body.miroTeamId).slice(0, 100);
          if (body.ownerName !== undefined) ws.ownerName = String(body.ownerName).slice(0, 100);

          ws.updatedAt = new Date().toISOString();
          await writeJSON(`workspaces/${wsId}/config.json`, ws);
          return new Response(JSON.stringify(ws), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        // ── GET /config/secrets ───────────────────────────────────────────
        // Returns list of configured integration names (no values)
        if (request.method === 'GET' && url.pathname === '/config/secrets') {
          const { wsId } = await requireWorkspace();
          const secrets = await readJSON(`workspaces/${wsId}/secrets.json`);
          if (!secrets) {
            return new Response(JSON.stringify({ integrations: {} }), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }
          // Return only which integrations are configured, never actual values
          const summary = {};
          for (const [integration, fields] of Object.entries(secrets.integrations || {})) {
            summary[integration] = Object.keys(fields);
          }
          return new Response(JSON.stringify({ integrations: summary }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        // ── PUT /config/secrets ───────────────────────────────────────────
        // Body: { integration: "jira", secrets: { host: "...", email: "...", apiToken: "..." } }
        if (request.method === 'PUT' && url.pathname === '/config/secrets') {
          const { wsId } = await requireAdmin();
          const body = await request.json();
          const integration = String(body.integration || '');
          const rawSecrets = body.secrets || {};

          if (!integration || typeof rawSecrets !== 'object') {
            return new Response(JSON.stringify({ error: 'Invalid body: need integration and secrets' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }

          // Read existing secrets file
          const existing = await readJSON(`workspaces/${wsId}/secrets.json`) || { integrations: {} };

          // Encrypt each secret value
          const encrypted = {};
          for (const [key, value] of Object.entries(rawSecrets)) {
            if (value === null || value === '') {
              // Allow clearing a secret
              continue;
            }
            encrypted[key] = await encryptValue(String(value));
          }

          existing.integrations[integration] = encrypted;
          existing.updatedAt = new Date().toISOString();
          await writeJSON(`workspaces/${wsId}/secrets.json`, existing);

          return new Response(JSON.stringify({ success: true, integration, fields: Object.keys(encrypted) }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        // ── GET /config/secrets/decrypt?integration=jira&field=apiToken ──
        // Internal use only — worker uses this to get decrypted secrets for proxy calls
        if (request.method === 'GET' && url.pathname === '/config/secrets/decrypt') {
          // This endpoint is called internally by the worker itself, not by the frontend
          // For now, block external access — secrets are decrypted server-side only
          return new Response(JSON.stringify({ error: 'Secrets are decrypted server-side only' }), {
            status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        // ── GET /config/members ───────────────────────────────────────────
        if (request.method === 'GET' && url.pathname === '/config/members') {
          const { ws } = await requireWorkspace();
          return new Response(JSON.stringify({ members: ws.members || [] }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        // ── POST /config/invite ───────────────────────────────────────────
        // Body: { email: "luke@example.com", role: "member" }
        if (request.method === 'POST' && url.pathname === '/config/invite') {
          const { wsId, ws } = await requireAdmin();
          const body = await request.json();
          const email = String(body.email || '').toLowerCase().trim();
          const role = body.role === 'admin' ? 'admin' : 'member';

          if (!email || !email.includes('@')) {
            return new Response(JSON.stringify({ error: 'Valid email required' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }

          // Check if already a member
          if ((ws.members || []).some(m => m.email === email)) {
            return new Response(JSON.stringify({ error: 'User is already a member' }), {
              status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }

          // Create invite token
          const inviteToken = crypto.randomUUID();
          const invite = {
            token: inviteToken,
            workspaceId: wsId,
            workspaceName: ws.name,
            email,
            role,
            invitedBy: clerkEmail || clerkUserId,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          };
          await writeJSON(`invites/${inviteToken}.json`, invite);

          return new Response(JSON.stringify({
            success: true,
            inviteToken,
            inviteUrl: `https://manage.bashai.io/#/invite/${inviteToken}`,
            expiresAt: invite.expiresAt,
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        // ── POST /config/join ─────────────────────────────────────────────
        // Body: { inviteToken: "..." }
        if (request.method === 'POST' && url.pathname === '/config/join') {
          const body = await request.json();
          const inviteToken = String(body.inviteToken || '');

          const invite = await readJSON(`invites/${inviteToken}.json`);
          if (!invite) {
            return new Response(JSON.stringify({ error: 'Invalid or expired invite' }), {
              status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }

          // Check expiry
          if (new Date(invite.expiresAt) < new Date()) {
            await env.MEETINGS.delete(`invites/${inviteToken}.json`);
            return new Response(JSON.stringify({ error: 'Invite has expired' }), {
              status: 410, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }

          // Check email matches
          if (invite.email && clerkEmail && invite.email !== clerkEmail.toLowerCase()) {
            return new Response(JSON.stringify({ error: 'This invite is for a different email address' }), {
              status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }

          // Add user to workspace
          const ws = await readJSON(`workspaces/${invite.workspaceId}/config.json`);
          if (!ws) {
            return new Response(JSON.stringify({ error: 'Workspace no longer exists' }), {
              status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }

          // Check not already a member
          if (!(ws.members || []).some(m => m.clerkUserId === clerkUserId)) {
            ws.members = ws.members || [];
            ws.members.push({
              clerkUserId,
              email: clerkEmail,
              role: invite.role || 'member',
              joinedAt: new Date().toISOString(),
            });
            await writeJSON(`workspaces/${invite.workspaceId}/config.json`, ws);
          }

          // Map user to workspace
          await writeJSON(`user-workspaces/${clerkUserId}.json`, { workspaceId: invite.workspaceId });

          // Delete used invite
          await env.MEETINGS.delete(`invites/${inviteToken}.json`);

          return new Response(JSON.stringify({ success: true, workspace: ws }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        // ── DELETE /config/members?userId=xxx ─────────────────────────────
        if (request.method === 'DELETE' && url.pathname === '/config/members') {
          const { wsId, ws } = await requireAdmin();
          const targetUserId = url.searchParams.get('userId');
          if (!targetUserId) {
            return new Response(JSON.stringify({ error: 'userId query param required' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }
          if (targetUserId === clerkUserId) {
            return new Response(JSON.stringify({ error: 'Cannot remove yourself' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }
          ws.members = (ws.members || []).filter(m => m.clerkUserId !== targetUserId);
          await writeJSON(`workspaces/${wsId}/config.json`, ws);
          // Remove their user→workspace mapping
          await env.MEETINGS.delete(`user-workspaces/${targetUserId}.json`);
          return new Response(JSON.stringify({ success: true, members: ws.members }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        // ── GET /config/workspaces ───────────────────────────────────────
        // List all workspaces the user belongs to
        if (request.method === 'GET' && url.pathname === '/config/workspaces') {
          const mapping = await readJSON(`user-workspaces/${clerkUserId}.json`);
          const results = [];

          if (mapping?.workspaceId) {
            const ws = await readJSON(`workspaces/${mapping.workspaceId}/config.json`);
            if (ws) {
              const member = (ws.members || []).find(m => m.clerkUserId === clerkUserId);
              results.push({ id: ws.id, name: ws.name, role: member?.role || 'member' });
            }
          }

          if (Array.isArray(mapping?.additionalWorkspaces)) {
            for (const wsId of mapping.additionalWorkspaces) {
              if (results.some(r => r.id === wsId)) continue;
              const ws = await readJSON(`workspaces/${wsId}/config.json`);
              if (ws) {
                const member = (ws.members || []).find(m => m.clerkUserId === clerkUserId);
                results.push({ id: ws.id, name: ws.name, role: member?.role || 'member' });
              }
            }
          }

          return new Response(JSON.stringify(results), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        // ── PUT /config/workspace/switch ──────────────────────────────────
        // Switch active workspace: { workspaceId: "ws-xxx" }
        if (request.method === 'PUT' && url.pathname === '/config/workspace/switch') {
          const body = await request.json();
          const targetWsId = String(body.workspaceId || '');
          if (!targetWsId) {
            return new Response(JSON.stringify({ error: 'workspaceId required' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }

          // Verify user is a member of target workspace
          const targetWs = await readJSON(`workspaces/${targetWsId}/config.json`);
          if (!targetWs || !(targetWs.members || []).some(m => m.clerkUserId === clerkUserId)) {
            return new Response(JSON.stringify({ error: 'Not a member of that workspace' }), {
              status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }

          // Update mapping — move old primary to additional, set new primary
          const mapping = await readJSON(`user-workspaces/${clerkUserId}.json`) || {};
          const oldWsId = mapping.workspaceId;
          mapping.workspaceId = targetWsId;
          mapping.additionalWorkspaces = mapping.additionalWorkspaces || [];
          if (oldWsId && oldWsId !== targetWsId && !mapping.additionalWorkspaces.includes(oldWsId)) {
            mapping.additionalWorkspaces.push(oldWsId);
          }
          mapping.additionalWorkspaces = mapping.additionalWorkspaces.filter(id => id !== targetWsId);
          await writeJSON(`user-workspaces/${clerkUserId}.json`, mapping);

          return new Response(JSON.stringify({ success: true, workspace: targetWs }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        // ── POST /config/workspace/create ─────────────────────────────────
        // Create new workspace (admin-only — must be admin in current workspace)
        if (request.method === 'POST' && url.pathname === '/config/workspace/create') {
          // Only admins of their current workspace can create new ones
          const currentMapping = await readJSON(`user-workspaces/${clerkUserId}.json`);
          if (currentMapping?.workspaceId) {
            const currentWs = await readJSON(`workspaces/${currentMapping.workspaceId}/config.json`);
            if (currentWs) {
              const member = (currentWs.members || []).find(m => m.clerkUserId === clerkUserId);
              if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
                return new Response(JSON.stringify({ error: 'Only admins can create workspaces' }), {
                  status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
                });
              }
            }
          }

          const body = await request.json();
          const newWsId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const newWorkspace = {
            id: newWsId,
            name: String(body.name || 'New Workspace').slice(0, 100),
            brands: [],
            createdAt: new Date().toISOString(),
            members: [{
              clerkUserId,
              email: clerkEmail,
              role: 'admin',
              joinedAt: new Date().toISOString(),
            }],
          };
          await writeJSON(`workspaces/${newWsId}/config.json`, newWorkspace);

          // Update user mapping — new workspace becomes primary
          const mapping = await readJSON(`user-workspaces/${clerkUserId}.json`) || {};
          const oldWsId = mapping.workspaceId;
          mapping.workspaceId = newWsId;
          mapping.additionalWorkspaces = mapping.additionalWorkspaces || [];
          if (oldWsId && !mapping.additionalWorkspaces.includes(oldWsId)) {
            mapping.additionalWorkspaces.push(oldWsId);
          }
          await writeJSON(`user-workspaces/${clerkUserId}.json`, mapping);

          return new Response(JSON.stringify(newWorkspace), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        // ── PUT /config/members/role ──────────────────────────────────────
        // Change member role: { userId: "user_xxx", role: "admin" | "member" }
        if (request.method === 'PUT' && url.pathname === '/config/members/role') {
          const { wsId, ws } = await requireAdmin();
          const body = await request.json();
          const targetUserId = String(body.userId || '');
          const newRole = body.role === 'admin' ? 'admin' : 'member';

          if (!targetUserId) {
            return new Response(JSON.stringify({ error: 'userId required' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }

          // Cannot change your own role
          if (targetUserId === clerkUserId) {
            return new Response(JSON.stringify({ error: 'Cannot change your own role' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }

          const member = (ws.members || []).find(m => m.clerkUserId === targetUserId);
          if (!member) {
            return new Response(JSON.stringify({ error: 'User is not a member' }), {
              status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }

          member.role = newRole;
          ws.updatedAt = new Date().toISOString();
          await writeJSON(`workspaces/${wsId}/config.json`, ws);

          return new Response(JSON.stringify({ success: true, members: ws.members }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        // ── DELETE /config/workspace ────────────────────────────────────
        // Delete a workspace (admin-only). Cannot delete your last workspace.
        if (request.method === 'DELETE' && url.pathname === '/config/workspace') {
          const body = await request.json();
          const targetWsId = String(body.workspaceId || '');
          if (!targetWsId) {
            return new Response(JSON.stringify({ error: 'workspaceId required' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }

          // Verify user is admin of the target workspace
          const targetWs = await readJSON(`workspaces/${targetWsId}/config.json`);
          if (!targetWs) {
            return new Response(JSON.stringify({ error: 'Workspace not found' }), {
              status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }
          const member = (targetWs.members || []).find(m => m.clerkUserId === clerkUserId);
          if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
            return new Response(JSON.stringify({ error: 'Only admins can delete workspaces' }), {
              status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }

          // Check user has at least one other workspace to fall back to
          const mapping = await readJSON(`user-workspaces/${clerkUserId}.json`) || {};
          const allWsIds = [mapping.workspaceId, ...(mapping.additionalWorkspaces || [])].filter(Boolean);
          const remaining = allWsIds.filter(id => id !== targetWsId);
          if (remaining.length === 0) {
            return new Response(JSON.stringify({ error: 'Cannot delete your only workspace' }), {
              status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
            });
          }

          // Delete workspace data from R2 (config, secrets, and all data/ contents)
          const dataPrefix = `workspaces/${targetWsId}/data/`;
          const listed = await env.MEETINGS.list({ prefix: dataPrefix });
          for (const obj of listed.objects) {
            await env.MEETINGS.delete(obj.key);
          }
          await env.MEETINGS.delete(`workspaces/${targetWsId}/config.json`);
          await env.MEETINGS.delete(`workspaces/${targetWsId}/secrets.json`);

          // Update user mapping — switch to another workspace
          mapping.workspaceId = remaining[0];
          mapping.additionalWorkspaces = remaining.slice(1);
          await writeJSON(`user-workspaces/${clerkUserId}.json`, mapping);

          // Remove workspace from other members' mappings too
          for (const m of targetWs.members) {
            if (m.clerkUserId === clerkUserId) continue;
            try {
              const otherMapping = await readJSON(`user-workspaces/${m.clerkUserId}.json`);
              if (!otherMapping) continue;
              if (otherMapping.workspaceId === targetWsId) {
                const otherRemaining = (otherMapping.additionalWorkspaces || []).filter(id => id !== targetWsId);
                otherMapping.workspaceId = otherRemaining[0] || null;
                otherMapping.additionalWorkspaces = otherRemaining.slice(1);
              } else {
                otherMapping.additionalWorkspaces = (otherMapping.additionalWorkspaces || []).filter(id => id !== targetWsId);
              }
              await writeJSON(`user-workspaces/${m.clerkUserId}.json`, otherMapping);
            } catch {}
          }

          return new Response(JSON.stringify({ success: true, switchedTo: remaining[0] }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }

        return new Response(JSON.stringify({ error: 'Unknown config endpoint' }), {
          status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }
    }

    // ── R2 Object Store ─────────────────────────────────────────────────────
    const rawKey = url.pathname.slice(1);
    if (!rawKey) {
      return new Response(JSON.stringify({ error: 'No key specified' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // Apply workspace data prefix for Clerk-authenticated users
    const key = dataPrefix ? `${dataPrefix}${rawKey}` : rawKey;

    try {
      if (request.method === 'GET') {
        if (rawKey.endsWith('/') || rawKey === 'list') {
          const prefix = rawKey === 'list' ? dataPrefix : key;
          const listed = await env.MEETINGS.list({ prefix });
          return new Response(JSON.stringify({
            objects: listed.objects.map(o => ({
              key: dataPrefix ? o.key.slice(dataPrefix.length) : o.key,
              size: o.size,
              uploaded: o.uploaded,
            })),
            truncated: listed.truncated,
          }), { headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } });
        }
        const object = await env.MEETINGS.get(key);
        if (!object) {
          return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }
        const contentType = object.httpMetadata?.contentType || 'application/octet-stream';
        // Serve JSON as text, everything else as binary
        if (contentType.includes('json') || key.endsWith('.json')) {
          const respBody = await object.text();
          return new Response(respBody, {
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
          });
        }
        const respBody = await object.arrayBuffer();
        return new Response(respBody, {
          headers: { 'Content-Type': contentType, ...corsHeaders(origin) },
        });

      } else if (request.method === 'PUT') {
        const putBody = await request.arrayBuffer();
        const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
        await env.MEETINGS.put(key, putBody, { httpMetadata: { contentType } });
        return new Response(JSON.stringify({ success: true, key }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });

      } else if (request.method === 'DELETE') {
        await env.MEETINGS.delete(key);
        return new Response(JSON.stringify({ success: true, key }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });

      } else {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }
  },
};
