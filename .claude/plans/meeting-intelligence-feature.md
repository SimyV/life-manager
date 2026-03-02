# Plan: Meeting Intelligence Feature

## Summary

Extend `life-manager` (deployed at manage.bashai.io) with a **Meeting Intelligence** module. Users upload a Copilot `.docx` extract, an AI agent parses it into a structured record, and automations fire: follow-up email as `.eml`, Jira tickets for my action items, Confluence meeting minutes, and diagrams in Confluence (easier than Miro — no OAuth2 needed, already connected). All meeting history is stored in blob storage (NOT agent-purple — use R2 or equivalent cheap blob) and queryable via an agent chat UI.

---

## Decisions Locked In

| Question | Decision |
|----------|----------|
| Storage | Cheap blob (Cloudflare R2 or equivalent) — NOT agent-purple storage |
| Jira project | **PKPI** (duluxgroup.atlassian.net) — ⚠️ see Jira auth note below |
| Tempo | Skip for now |
| Meeting minutes delivery | Email as `.eml` attachment (not Confluence page) |
| Diagrams | Confluence (already connected, no extra OAuth needed) |
| Copilot extract format | `.docx` file upload |
| Confluence space template | **Work Management → Project management** (plan and deliver projects) |

---

## Architecture

```
[manage.bashai.io — /meetings tab]
         |
    [Upload .docx]
         |
    [DOCX → text extraction (mammoth.js)]
         |
    [Claude API parser] → structured MeetingRecord
         |
    [Review & edit UI]
         |
    [Save to blob storage as JSON]
         ↓
  ┌──────┬──────────┬────────────────┐
  ↓      ↓          ↓                ↓
.eml  Jira tasks  Confluence      Agent Chat
email  (mine only)  diagrams     (query history)
```

---

## Storage Strategy

**Blob-first, minimal cost.**

Each meeting = one JSON file. No DB needed.

```
meetings/{userId}/2026/02/22-{uuid}.json   ← full meeting record
meetings/{userId}/index.json               ← lightweight index: {id, title, date, participants[]}
```

Storage options (pick one at setup time):
- **Cloudflare R2** — $0.015/GB, zero egress. ~free at this scale.
- **Backblaze B2** — $0.006/GB. Even cheaper.
- Configure via `VITE_MEETINGS_STORAGE_URL` + `VITE_MEETINGS_STORAGE_TOKEN` env vars

---

## Data Model

```typescript
interface MeetingRecord {
  id: string
  userId: string
  title: string
  date: string                      // ISO date
  duration?: number                 // minutes (if parseable from extract)
  participants: {
    name: string
    email?: string
  }[]
  rawText: string                   // extracted text from .docx
  keyPoints: string[]
  decisions: string[]
  actionItems: {
    id: string
    task: string
    owner: string
    ownerEmail?: string
    dueDate?: string
    myItem: boolean                 // true = assigned to me → Jira ticket
    jiraTicket?: string
    status: 'open' | 'done'
  }[]
  workProducts: {
    id: string
    type: 'diagram' | 'document' | 'report' | 'other'
    description: string
    assignee?: string
    confluencePageId?: string       // populated after diagram created
  }[]
  automations: {
    emailDrafted: boolean           // .eml file generated
    jiraTicketsCreated: string[]
    confluenceDiagramPageId?: string
  }
  createdAt: string
  updatedAt: string
}
```

---

## UI Layout (manage.bashai.io /meetings tab)

Three sub-tabs:

### 1. Ingest

```
┌─────────────────────────────────────────┐
│  Upload Copilot Extract (.docx)         │
│  ┌──────────────────────────────────┐  │
│  │  Drag & drop or click to upload  │  │
│  └──────────────────────────────────┘  │
│  [Parse Meeting]                        │
│                                         │
│  ── Parsed Output ───────────────────  │
│  Title: Team Sync — 22 Feb 2026         │
│  Date: 2026-02-22  Participants: 4      │
│                                         │
│  Key Points (editable):                 │
│    • Decision to adopt new arch         │
│    • Budget approved for Q2             │
│                                         │
│  Action Items:                          │
│    ☑ [ME]   Build solution arch diagram │
│    ☐ [Bob]  Review vendor quote         │
│                                         │
│  Work Products:                         │
│    • Solution architecture diagram      │
│      → [Create in Confluence]           │
│                                         │
│  ── Actions ──────────────────────── │
│  [📧 Generate .eml]  [🎫 Create Jira]  │
└─────────────────────────────────────────┘
```

### 2. History

- List of all meetings (from index.json)
- Each card: title, date, participant count, badges (email sent, Jira created, diagram done)
- Click to expand full record + re-trigger any automation

### 3. Chat

```
┌─────────────────────────────────────────┐
│  Meeting Assistant                      │
│                                         │
│  You: What are my open action items?   │
│  AI:  3 open items across 2 meetings:  │
│       1. Build arch diagram (Feb 22)   │
│       2. Submit vendor review...       │
│                                         │
│  [Type a question...]        [Send]     │
└─────────────────────────────────────────┘
```

---

## Build Phases

### Phase 1 — Storage & Data Layer
- `src/lib/meetingStore.ts` — read/write meeting blobs + index
- Configure env vars for storage endpoint + token
- TypeScript `MeetingRecord` type

### Phase 2 — DOCX Upload & AI Parsing
- Add `/meetings` route and tab nav to `App.tsx`
- `src/components/meetings/MeetingIngest.tsx` — drag-drop `.docx` uploader
- `src/lib/docxParser.ts` — extract plain text from `.docx` using `mammoth`
- `src/lib/meetingParser.ts` — call Claude API (claude-sonnet-4-6) to parse text → `MeetingRecord`
- `src/components/meetings/MeetingReview.tsx` — editable review before saving

### Phase 3 — Outlook Email (minutes + actions)
- Use Outlook bridge (`OUTLOOK_BRIDGE_URL`) — already available
- `src/lib/outlookClient.ts` — wrapper over Outlook bridge `/send` endpoint
- Generate email body: meeting title, date, key points, decisions, action items table (owner / task / due)
- Recipients: auto-populated from parsed participant list
- **Always save as draft first** (`draft: true`) — user reviews in Outlook then sends
- Fallback: if Outlook bridge unavailable, generate `.eml` file download instead
- Mark `automations.emailDrafted = true` on success

### Phase 4 — Jira Ticket Creation
- `src/lib/jiraClient.ts` — thin wrapper over existing Jira proxy
- Filter `myItem === true` action items
- Modal: confirm project key + optional parent epic
- Create tickets → update record with keys

### Phase 5 — Confluence Diagrams
- For work products of type `diagram` assigned to me:
  - Generate a structured Confluence page with:
    - Mermaid / draw.io diagram macro (Confluence supports both)
    - Action item context
  - Use `POST /proxy/jira/wiki/api/v2/pages` (already available via Jira skill)
- User selects target Confluence space (Work Management space template recommended)
- Save `confluencePageId` into work product record

### Phase 6 — Meeting History View
- `src/components/meetings/MeetingHistory.tsx`
- Load and render `index.json` from blob storage
- Expandable cards per meeting

### Phase 7 — Agent Chat
- `src/components/meetings/MeetingChat.tsx`
- On send: load relevant records from blob, build context, call Claude API
- Streaming response
- Can answer: open items, meeting summaries, who owns what, follow-up status

---

## Remaining Open Question

- **Jira project key** — which project should action item tickets default to? (e.g. `EPM`, `DLWLC`, or another)

---

## agent-purple References — Cleaned Up

All references removed from:
- `README.md` — removed mention of agent-purple proxy URL and "Agent Purple user ID"
- `.env.example` — removed example Google sign-in URL with agent-purple domain
- Plan file — storage alternative reference removed

Remaining in source code: **none** (confirmed via grep — no .ts/.tsx files reference agent-purple).
