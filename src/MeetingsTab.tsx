import { useCallback, useRef, useState } from 'react'

const R2_URL = ((import.meta as any).env?.VITE_R2_URL || 'https://r2.host-ly.com').replace(/\/$/, '')
const R2_SECRET = (import.meta as any).env?.VITE_R2_SECRET || ''
const JIRA_PROXY_BASE = ((import.meta as any).env?.VITE_JIRA_PROXY_BASE || '/api/proxy/jira').replace(/\/$/, '')
const USER_ID = (import.meta as any).env?.VITE_USER_ID || ''
const OUTLOOK_BRIDGE_URL = ((import.meta as any).env?.VITE_OUTLOOK_BRIDGE_URL || '').replace(/\/$/, '')
const SIMON_ACCOUNT_ID = '5f7a805b25fbdf00685e6cf8'

export type ActionItem = {
  description: string
  owner: string
  dueDate: string
  isSimon: boolean
}

export type MeetingData = {
  id: string
  title: string
  date: string
  participants: string[]
  keyPoints: string[]
  decisions: string[]
  actionItems: ActionItem[]
  nextSteps: string[]
  rawText: string
  parsedAt: string
}

type JiraTicket = { key: string; url: string }
type OutlookResult = { id: string }

async function extractDocx(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)
  const xml = await zip.file('word/document.xml')?.async('string')
  if (!xml) throw new Error('Could not read document.xml from .docx file')
  // Strip XML tags and decode common entities
  return xml
    .replace(/<w:p[ >]/g, '\n<w:p ')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x[0-9A-Fa-f]+;/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function parseMeetingWithAI(text: string, fileName: string): Promise<Omit<MeetingData, 'id' | 'rawText' | 'parsedAt'>> {
  if (!R2_SECRET) {
    throw new Error('VITE_R2_SECRET not configured')
  }
  const res = await fetch(`${R2_URL}/parse`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${R2_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ text, fileName }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Parse API error: ${err}`)
  }
  return res.json()
}

async function saveToR2(meeting: MeetingData): Promise<void> {
  const key = `meetings/${meeting.id}.json`
  const res = await fetch(`${R2_URL}/${key}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${R2_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(meeting),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`R2 save failed: ${err}`)
  }
}

async function createJiraTicket(action: ActionItem, meetingTitle: string): Promise<JiraTicket> {
  const body = {
    fields: {
      project: { key: 'PKPI2' },
      summary: action.description,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: `From meeting: ${meetingTitle}. Due: ${action.dueDate || 'TBD'}` }],
          },
        ],
      },
      issuetype: { name: 'Task' },
      assignee: { id: SIMON_ACCOUNT_ID },
    },
  }

  const res = await fetch(`${JIRA_PROXY_BASE}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(USER_ID ? { 'X-User-ID': USER_ID } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Jira create failed: ${err}`)
  }

  const data = await res.json()
  return { key: data.key, url: `https://duluxgroup.atlassian.net/browse/${data.key}` }
}

async function sendOutlookDraft(meeting: MeetingData): Promise<OutlookResult> {
  if (!OUTLOOK_BRIDGE_URL) throw new Error('VITE_OUTLOOK_BRIDGE_URL not configured')

  const actionList = meeting.actionItems
    .map((a) => `• ${a.description} — ${a.owner}${a.dueDate ? ` (due ${a.dueDate})` : ''}`)
    .join('\n')

  const body = {
    to: meeting.participants.map((p) => ({ email: '', name: p })),
    subject: `Meeting Minutes: ${meeting.title} — ${meeting.date}`,
    body: `Hi all,\n\nPlease find the minutes from our meeting on ${meeting.date}.\n\nKEY POINTS\n${meeting.keyPoints.map((p) => `• ${p}`).join('\n')}\n\nDECISIONS\n${meeting.decisions.map((d) => `• ${d}`).join('\n')}\n\nACTION ITEMS\n${actionList}\n\nNEXT STEPS\n${meeting.nextSteps.map((s) => `• ${s}`).join('\n')}\n\nRegards,\nSimon`,
    isDraft: true,
  }

  const res = await fetch(`${OUTLOOK_BRIDGE_URL}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Outlook draft failed: ${err}`)
  }

  return res.json()
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {children}
    </span>
  )
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-slate-200">
            <span className="mt-0.5 text-slate-500">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function MeetingsTab() {
  const [meeting, setMeeting] = useState<MeetingData | null>(null)
  const [step, setStep] = useState<'idle' | 'parsing' | 'review' | 'saving' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [jiraTickets, setJiraTickets] = useState<JiraTicket[]>([])
  const [outlookSent, setOutlookSent] = useState(false)
  const [actionLog, setActionLog] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const log = (msg: string) => setActionLog((prev) => [...prev, msg])

  const processFile = useCallback(async (file: File) => {
    setError(null)
    setJiraTickets([])
    setOutlookSent(false)
    setActionLog([])
    setStep('parsing')

    try {
      log(`Reading ${file.name}...`)
      const text = await extractDocx(file)
      log('Extracted text, sending to Claude...')

      const parsed = await parseMeetingWithAI(text, file.name)
      log('AI parsing complete.')

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const full: MeetingData = {
        ...parsed,
        id,
        rawText: text,
        parsedAt: new Date().toISOString(),
      }
      setMeeting(full)
      setStep('review')
    } catch (err: any) {
      setError(err?.message || 'Failed to parse meeting')
      setStep('idle')
    }
  }, [])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const onSaveAndAction = async () => {
    if (!meeting) return
    setStep('saving')
    setError(null)

    try {
      // Save to R2
      log('Saving to R2...')
      await saveToR2(meeting)
      log('Saved to R2.')

      // Create Jira tickets for Simon's action items
      const simonActions = meeting.actionItems.filter((a) => a.isSimon)
      for (const action of simonActions) {
        try {
          log(`Creating Jira ticket: ${action.description.slice(0, 50)}...`)
          const ticket = await createJiraTicket(action, meeting.title)
          setJiraTickets((prev) => [...prev, ticket])
          log(`Created ${ticket.key}`)
        } catch (err: any) {
          log(`Jira failed: ${err?.message}`)
        }
      }

      // Send Outlook draft
      if (OUTLOOK_BRIDGE_URL) {
        try {
          log('Creating Outlook draft...')
          await sendOutlookDraft(meeting)
          setOutlookSent(true)
          log('Outlook draft created.')
        } catch (err: any) {
          log(`Outlook failed: ${err?.message}`)
        }
      }

      setStep('done')
    } catch (err: any) {
      setError(err?.message || 'Save failed')
      setStep('review')
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload area */}
      {(step === 'idle' || step === 'parsing') && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
            isDragging ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-700 bg-slate-900/70 hover:border-slate-500'
          }`}
        >
          <input ref={fileRef} type="file" accept=".docx" className="hidden" onChange={onFileChange} />
          <div className="text-4xl">📄</div>
          <div>
            <p className="text-lg font-semibold text-slate-200">
              {step === 'parsing' ? 'Processing...' : 'Drop your Copilot meeting extract here'}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {step === 'parsing' ? 'Extracting and parsing with AI...' : 'or click to browse — .docx files only'}
            </p>
          </div>
          {step === 'parsing' && (
            <div className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full animate-pulse rounded-full bg-cyan-500" style={{ width: '60%' }} />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-700 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Action log */}
      {actionLog.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          {actionLog.map((msg, i) => (
            <p key={i} className="text-xs text-slate-400">{msg}</p>
          ))}
        </div>
      )}

      {/* Review & results */}
      {meeting && (step === 'review' || step === 'saving' || step === 'done') && (
        <div className="space-y-4">
          {/* Header */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-white">{meeting.title}</h2>
                <p className="mt-1 text-sm text-slate-400">{meeting.date}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {meeting.participants.map((p) => (
                    <Badge key={p} color="bg-slate-700/80 text-slate-200">{p}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                {step === 'review' && (
                  <>
                    <button
                      onClick={() => { setMeeting(null); setStep('idle') }}
                      className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
                    >
                      Discard
                    </button>
                    <button
                      onClick={onSaveAndAction}
                      className="rounded-xl border border-cyan-700 bg-cyan-600/20 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-600/30"
                    >
                      Save + Create Actions
                    </button>
                  </>
                )}
                {step === 'saving' && (
                  <span className="rounded-xl border border-amber-600/50 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200">
                    Processing...
                  </span>
                )}
                {step === 'done' && (
                  <div className="flex flex-wrap gap-2">
                    {jiraTickets.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {jiraTickets.map((t) => (
                          <a key={t.key} href={t.url} target="_blank" rel="noreferrer"
                            className="rounded-xl border border-violet-700 bg-violet-600/20 px-3 py-2 text-xs font-semibold text-violet-200">
                            {t.key} ↗
                          </a>
                        ))}
                      </div>
                    )}
                    {outlookSent && (
                      <Badge color="bg-emerald-500/20 text-emerald-300">Draft email created</Badge>
                    )}
                    <button
                      onClick={() => { setMeeting(null); setStep('idle'); setActionLog([]) }}
                      className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
                    >
                      New meeting
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content sections */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
              <Section title="Key Points" items={meeting.keyPoints} />
              <Section title="Decisions" items={meeting.decisions} />
              <Section title="Next Steps" items={meeting.nextSteps} />
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Action Items ({meeting.actionItems.length})
              </h4>
              <div className="space-y-2">
                {meeting.actionItems.map((a, i) => (
                  <div key={i} className={`rounded-xl p-3 ${a.isSimon ? 'border border-cyan-800 bg-cyan-500/10' : 'bg-slate-800/50'}`}>
                    <p className="text-sm text-slate-200">{a.description}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge color="bg-slate-700 text-slate-300">{a.owner}</Badge>
                      {a.dueDate && <Badge color="bg-amber-500/20 text-amber-300">{a.dueDate}</Badge>}
                      {a.isSimon && <Badge color="bg-cyan-500/20 text-cyan-300">→ Jira</Badge>}
                    </div>
                  </div>
                ))}
                {meeting.actionItems.length === 0 && (
                  <p className="text-sm text-slate-500">No action items found</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
