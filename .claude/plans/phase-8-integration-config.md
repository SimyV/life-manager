# Plan: Phase 8 — Integration Config, Portability & Multi-User Workspaces

## Problem Statement

All credentials and org-specific config are currently hardcoded across two places:
1. **Frontend `.env`** — `VITE_*` vars baked into the Vite build (R2 secret, Outlook bridge URL/key, Jira proxy base, Miro team ID, Clerk key)
2. **Cloudflare Worker secrets** — `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `MIRO_API_KEY`, `API_SECRET`, `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`

Additionally, there are **hardcoded org values in source code**:
- Jira project key `PKPI2` in `MeetingsTab.tsx`
- Simon's Jira account ID `5f7a805b25fbdf00685e6cf8` in `MeetingsTab.tsx`
- Jira instance `duluxgroup.atlassian.net` referenced in `App.tsx`
- Brand names `Selleys`, `Yates` hardcoded in `App.tsx`

**Important discovery:** Clerk is NOT actually integrated into the app code. `@clerk/clerk-react` is not in `package.json`. The `VITE_CLERK_PUBLISHABLE_KEY` is in `.env` but unused. `main.tsx` renders `<App />` directly with no auth wrapper. Clerk production instance exists at DNS level but the frontend doesn't use it yet.

**Goal:** A Settings tab in the UI where org-specific config can be viewed, edited, and swapped as a named "workspace" — with proper Clerk authentication, workspace-level access control, and email via Microsoft Graph API (replacing the COM bridge).

---

## Current Architecture

```
Browser (manage.bashai.io)
  |-- Static SPA served from VPS /opt/life-manager/dist/
  |-- Auth: NONE (Clerk configured but not integrated)
  |-- Credentials: VITE_* baked at build time
  |
  |-> Cloudflare Worker (r2.bashai.io)
  |     |-- /jira/*     -> proxies to JIRA_HOST with Basic Auth
  |     |-- /parse      -> Claude/OpenAI AI parsing
  |     |-- /miro       -> Miro diagram generation
  |     |-- /email      -> AI email generation
  |     |-- /*          -> R2 object storage (meetings bucket)
  |     Auth: Bearer API_SECRET (single shared token)
  |
  |-> Outlook Bridge (outlook-bridge.bashai.io)
        |-- /send       -> Draft email via COM bridge on local machine
        Auth: API key defined but never actually sent in requests
```

---

## Decisions Made

### 1. Secret Storage: R2 (not KV)

**Decision: Store secrets as encrypted R2 objects.**

Reasoning:
- **KV pros:** Native to Cloudflare, fast reads (~ms), simple key-value API, free tier (100k reads/day)
- **KV cons:** Requires a separate KV namespace binding in `wrangler.toml` + redeploy to add; eventually consistent (up to 60s propagation); another Cloudflare resource to manage; not portable if we ever move off Cloudflare
- **R2 pros:** We already have the R2 bucket bound (`MEETINGS`); no additional bindings needed; strongly consistent; secrets stored alongside workspace config in a logical hierarchy; portable (it's just files); simpler worker code (one storage backend)
- **R2 cons:** Slightly slower than KV for reads (~10-50ms vs ~1ms); but secrets are read once per request and cached in the worker's request context anyway

The worker will store secrets at `config/.secrets/{workspace-id}.enc` as AES-256-GCM encrypted JSON. The encryption master key stays as the sole `wrangler secret` (`MASTER_KEY`). This means we go from 6+ wrangler secrets to exactly 2 (`API_SECRET` for bearer auth + `MASTER_KEY` for encryption). Everything else becomes runtime-configurable.

### 2. Multi-User Workspace Access

**Architecture: Clerk JWT verification at the worker level + workspace membership stored in R2.**

Current state: The app has zero auth. Anyone with the R2 bearer token can do anything. This needs to change for multi-user.

**How it works:**

```
1. User signs in via Clerk (Google OAuth) in the frontend
2. Frontend gets a Clerk session JWT
3. Every request to r2.bashai.io includes:
   - Authorization: Bearer {clerk-jwt}    (replaces the static API_SECRET)
   - X-Workspace-Id: {workspace-id}
4. Worker verifies the JWT using Clerk's JWKS endpoint (cached)
5. Worker checks workspace membership: does this user's Clerk ID
   appear in the workspace's members list?
6. If yes -> proceed. If no -> 403.
```

**Workspace membership model:**
```json
{
  "id": "dulux-2024",
  "name": "Dulux Group",
  "owner": "user_clerk_abc123",
  "members": [
    {
      "clerkId": "user_clerk_abc123",
      "email": "simon@bashai.io",
      "role": "owner",
      "addedAt": "2025-01-15T00:00:00Z"
    },
    {
      "clerkId": "user_clerk_def456",
      "email": "luke@example.com",
      "role": "member",
      "addedAt": "2026-03-10T00:00:00Z"
    }
  ],
  "invites": [
    {
      "email": "luke@example.com",
      "invitedBy": "user_clerk_abc123",
      "invitedAt": "2026-03-10T00:00:00Z",
      "token": "inv_randomtoken123"
    }
  ]
}
```

**Invite flow:**
1. Owner opens Settings -> Members -> "Invite"
2. Enters the person's email address
3. Worker generates an invite token, stores it in the workspace config
4. System sends an invite email (via the new email solution, see below) with a link: `https://manage.bashai.io/invite/{token}`
5. Recipient clicks the link -> must sign in with Clerk (Google OAuth) -> their Clerk user ID is matched to the invite email -> they become a member
6. If someone tries to accept an invite but their Clerk email doesn't match the invite email -> rejected

**Role model (keep it simple for now):**
- `owner` — can manage workspace settings, secrets, members, and invite/remove people. Only one owner per workspace.
- `member` — can use the workspace (view dashboard, upload meetings, create tickets) but cannot change settings or manage members.

**Why this works long-term:**
- No separate user database — Clerk IS the user database
- No password management — Google OAuth handles it
- Workspace isolation — each workspace's data lives under its own R2 prefix
- The invite token pattern is simple, stateless (stored in R2), and doesn't require a separate email verification service
- Owner can remove a member at any time by deleting them from the members array

### 3. Email: Microsoft Graph API (replacing COM bridge)

**Decision: Replace the Outlook COM bridge with Microsoft Graph API via OAuth2.**

The current COM bridge approach:
- Requires a Windows machine with Outlook installed
- Uses COM automation to create draft emails
- Needs Cloudflare tunnel running on that machine
- Machine-specific, can't be moved between companies
- API key defined but never actually sent in requests (auth is broken)

**Microsoft Graph API approach:**
- Works entirely in the cloud — no local machine needed
- Uses OAuth2 (the user authorizes once via Microsoft login)
- Can send emails, create drafts, or both
- Works with any Microsoft 365 / Outlook account (personal or org)
- Portable — when switching companies, just re-authorize with the new org's Microsoft account

**How it integrates:**

```
1. In Settings, user clicks "Connect Microsoft Account"
2. Redirected to Microsoft OAuth2 consent screen
3. Grants permission: Mail.Send, Mail.ReadWrite (for drafts)
4. Redirect back to manage.bashai.io with auth code
5. Worker exchanges code for access_token + refresh_token
6. Tokens stored encrypted in R2 (per-workspace, per-user)
7. When sending meeting minutes:
   - Frontend calls worker: POST /email/send
   - Worker uses stored refresh_token to get fresh access_token
   - Worker calls Microsoft Graph API: POST /me/sendMail
   - Or for drafts: POST /me/messages (creates draft)
```

**Microsoft App Registration:**
- Register one app in Azure AD (bashai.io app)
- Support "accounts in any organizational directory and personal Microsoft accounts"
- This single app registration works across all companies — the user just signs in with their work account

**Why this is better:**
- No local machine dependency
- No COM bridge to maintain
- No Cloudflare tunnel needed
- Works across any Microsoft 365 org
- When Simon leaves Dulux: disconnect the Dulux Microsoft account, connect the new company's account. Done.
- Refresh tokens last 90 days by default; the worker auto-refreshes

**Fallback:** If someone doesn't use Microsoft, the `/email` endpoint on the worker already generates email content via AI. We could add SMTP as a future alternative, but Microsoft Graph covers the primary use case.

### 4. Brands: Part of Workspace Setup

When creating a new workspace, the setup wizard asks:
- Company name
- Jira instance URL
- Jira project key
- Brand/label names (comma-separated, e.g., "Selleys, Yates")
- Your Jira account ID (or auto-detect via Jira API with "get myself")

Brands are stored in the workspace profile and consumed by the dashboard filters. No auto-fetch from Jira — kept simple and explicit.

---

## Revised Architecture

```
Browser (manage.bashai.io)
  |-- Static SPA served from VPS /opt/life-manager/dist/
  |-- Auth: Clerk (Google OAuth) - ClerkProvider wrapping app
  |-- Config: loaded from R2 at runtime (no VITE_* for org config)
  |
  |-> Cloudflare Worker (r2.bashai.io)
        |-- Auth: Clerk JWT verification (replaces static bearer token)
        |-- /jira/*              -> proxies to workspace's Jira instance
        |-- /parse               -> AI parsing (Claude/OpenAI)
        |-- /miro                -> Miro diagram generation
        |-- /email/send          -> Send email via Microsoft Graph
        |-- /email/draft         -> Create draft via Microsoft Graph
        |-- /email/connect       -> OAuth2 callback for Microsoft
        |-- /config/workspaces   -> CRUD workspace profiles
        |-- /config/secrets      -> Manage encrypted secrets
        |-- /config/members      -> Manage workspace membership
        |-- /config/invites      -> Accept/manage invites
        |-- /*                   -> R2 storage (scoped to workspace)
        |
        Secrets in worker env (just 2):
          - MASTER_KEY (AES encryption for stored secrets)
          - CLERK_JWKS_URL (or CLERK_PUBLISHABLE_KEY for JWT verify)

        Everything else stored as encrypted R2 objects per workspace:
          - Jira host/email/token
          - Miro API key
          - AI API keys
          - Microsoft OAuth tokens
```

**Key changes from v1 of this plan:**
- Clerk JWT replaces static bearer token (multi-user ready)
- R2-only storage (no KV)
- Microsoft Graph replaces COM bridge
- Workspace-scoped data isolation
- Invite/membership system

---

## R2 Storage Layout

```
config/
  workspaces/
    {workspace-id}.json          <- workspace profile (name, jira config, brands, members, invites)
  secrets/
    {workspace-id}.enc           <- encrypted secrets (Jira token, Miro key, AI keys, MS tokens)
  active-workspace/
    {clerk-user-id}.json         <- per-user active workspace pointer

workspaces/
  {workspace-id}/
    meetings/
      {meeting-id}.json          <- meeting data (scoped per workspace)
    artefacts/
      {artefact-id}.json         <- artefacts (scoped per workspace)
```

This means when switching workspaces, the user sees completely different meetings and artefacts. Old Dulux data stays untouched in the `dulux-2024` workspace.

---

## Implementation Steps

### Step 1: Integrate Clerk Authentication
- Install `@clerk/clerk-react` in the frontend
- Wrap app in `<ClerkProvider>` with `<SignedIn>`/`<SignedOut>` gates
- Pass Clerk JWT in all requests to r2.bashai.io
- Update worker to verify Clerk JWTs (fetch JWKS, verify signature + expiry)
- Remove static `API_SECRET` bearer token auth
- Keep `API_SECRET` temporarily as a fallback during migration, then remove

### Step 2: Worker Config Endpoints
- Add `/config/workspaces` CRUD routes
- Add `/config/secrets` read-status / write routes
- Add `/config/members` and `/config/invites` routes
- Implement AES-256-GCM encryption for secrets using `MASTER_KEY`
- Implement workspace membership checks on all routes
- Scope all R2 reads/writes to the workspace prefix

### Step 3: Frontend Config Service + Workspace Context
- Create `src/WorkspaceContext.tsx`:
  - On app boot (after Clerk auth), fetch user's active workspace
  - Load workspace profile from R2
  - Provide React context for all components
  - Falls back to VITE_* env vars during migration (removed once stable)
- Create workspace switcher component

### Step 4: Refactor Hardcoded Values
- Replace all hardcoded Jira project key, account ID, instance URL, brands in `App.tsx` and `MeetingsTab.tsx` with workspace context values
- Scope meeting storage to workspace path
- Remove Outlook bridge references, replace with Microsoft Graph email

### Step 5: Settings UI Tab
- **Workspace section:** Name, create new, switch, export, import, delete
- **Workspace setup wizard:** Company name -> Jira config -> brands -> save
- **Integrations section:**
  - Jira: project key, account ID, display URL, brands
  - Miro: team ID
  - Microsoft: "Connect" button (OAuth2 flow), status indicator
- **Secrets section:** Status indicators for each secret, masked input fields to update
- **Members section:** List members, invite by email, remove members
- **Only visible to workspace owners** (members see a read-only workspace info panel)

### Step 6: Microsoft Graph Email Integration
- Register Azure AD app for bashai.io
- Add OAuth2 flow to worker (`/email/connect` endpoint)
- Store encrypted refresh tokens per workspace per user
- Implement `POST /email/send` using Graph API `/me/sendMail`
- Implement `POST /email/draft` using Graph API `/me/messages`
- Update MeetingsTab to use new email endpoints

### Step 7: Git, Testing & Deploy
- All changes committed to `SimyV/life-manager` on GitHub
- Test scenarios:
  - Create Dulux workspace, verify all existing functionality works
  - Create second empty workspace, verify isolation
  - Invite a second user, verify they can access only their workspace
  - Switch between workspaces, verify data isolation
  - Update secrets via UI, verify they take effect
  - Microsoft email: send test, create draft
- Build and deploy to VPS

---

## Security Considerations

- Clerk JWT verification on every request (no static tokens)
- Secrets encrypted at rest with AES-256-GCM (MASTER_KEY in wrangler secrets)
- Workspace isolation: all R2 paths scoped to workspace ID
- Membership check before any workspace operation
- Secrets endpoint: write-only (never return secret values, only "configured" / "not configured" status)
- Invite tokens: single-use, email-matched, expire after 7 days
- Microsoft OAuth tokens: stored encrypted, auto-refreshed, per-user per-workspace
- Export/import of workspace profiles: NEVER includes secrets or OAuth tokens
- Owner-only access to settings, secrets, and member management

---

## Migration Path

1. Deploy Clerk auth + workspace system
2. Auto-create a "Dulux Group" workspace from current .env values
3. Auto-migrate existing meetings from `meetings/` to `workspaces/dulux-2024/meetings/`
4. Keep VITE_* env vars as fallback for 1 week
5. Remove VITE_* fallback, clean up .env to only contain VITE_CLERK_PUBLISHABLE_KEY and VITE_R2_URL

---

## Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `package.json` | Modify | Add `@clerk/clerk-react` dependency |
| `src/main.tsx` | Modify | Wrap app in `<ClerkProvider>` |
| `src/WorkspaceContext.tsx` | Create | Workspace provider, config loading, context |
| `src/SettingsTab.tsx` | Create | Full settings UI (workspace, integrations, secrets, members) |
| `src/App.tsx` | Modify | Add Settings tab, Clerk gates, remove hardcoded values, use workspace context |
| `src/MeetingsTab.tsx` | Modify | Remove hardcoded project key/account ID, use workspace context, use new email endpoint |
| `.env.example` | Modify | Reduce to VITE_CLERK_PUBLISHABLE_KEY + VITE_R2_URL only |
| `r2-worker/src/index.js` | Modify | Clerk JWT auth, /config/* routes, encrypted secrets, workspace scoping, MS Graph email |
| `r2-worker/wrangler.toml` | Modify | Add MASTER_KEY secret reference |
