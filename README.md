# Life Manager

A Jira-integrated personal dashboard built with Vite, React, TypeScript, and Tailwind CSS.

---

## Stack

- **Vite** + **React** + **TypeScript**
- **Tailwind CSS** for styling
- **Jira REST API** via server-side proxy
- **Google Sign-In** for authentication
- **recharts** for data visualisations (bar, pie charts)
- **jszip** for .docx file extraction

---

## Setup

1. Install dependencies:
```bash
npm ci
```

2. Create env file:
```bash
cp .env.example .env
```

3. Set values in `.env`:
- `VITE_USER_ID`: your user ID used by the Jira proxy for auth.
- `VITE_JIRA_PROXY_BASE`: leave default unless your proxy path differs.
- `VITE_GOOGLE_SIGN_IN_URL`: Google sign-in URL for the app.
- `VITE_R2_URL`: base URL of the R2 worker used for meeting data storage and AI parsing.
- `VITE_R2_SECRET`: bearer token for authenticating with the R2 worker.
- `VITE_OUTLOOK_BRIDGE_URL`: URL of the Windows Outlook bridge for sending meeting invites (optional).

4. Run locally:
```bash
npm run dev
```

5. Build:
```bash
npm run build
```

Output goes to `dist/`.

---

## Jira Integration

The app connects to Jira through a server-side proxy -- the Atlassian API token is never exposed to the frontend.

Create your Jira API token at:
- https://id.atlassian.com/manage-profile/security/api-tokens

Configure the token in your proxy/backend environment, not in the frontend `.env`.

---

## Meeting Notes

The app includes an AI-powered **Meeting Notes** tab for parsing and actioning meeting records.

### Features

- **Upload a `.docx` file** -- drag and drop a meeting notes document; the app extracts the raw text using JSZip
- **AI parsing** -- the text is sent to a serverless R2 worker which uses Claude to extract:
  - Meeting title, date, participants
  - Key discussion points
  - Decisions made
  - Action items (with owner and due date, flagged if assigned to you)
  - Next steps
- **Jira ticket creation** -- create Jira tickets directly from individual action items with one click
- **Outlook invite** -- send follow-up calendar invites via the Windows Outlook bridge (if configured)
- **R2 storage** -- parsed meetings are saved as JSON to Cloudflare R2 for later retrieval

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_R2_URL` | Base URL of the R2 worker (e.g. `https://r2.host-ly.com`) |
| `VITE_R2_SECRET` | Bearer token for R2 worker authentication |
| `VITE_OUTLOOK_BRIDGE_URL` | Windows Outlook bridge URL for calendar invite sending (optional) |

The R2 worker exposes two endpoints:
- `POST /parse` -- accepts `{ text, fileName }`, returns structured meeting JSON
- `PUT /meetings/{id}.json` -- stores the parsed meeting data

---

## Deployment

Build the app and deploy the `dist/` folder to any static hosting provider. The app requires:

1. **SPA routing fallback** -- all paths should serve `index.html` (configure via your web server or `.htaccess`)
2. **Jira API proxy** -- requests to `/api/proxy/jira/*` must be routed to your backend proxy
3. **Environment variables** set at build time (`VITE_USER_ID`, `VITE_GOOGLE_SIGN_IN_URL`, `VITE_JIRA_PROXY_BASE`)

```bash
npm ci
npm run build
# Upload dist/ to your hosting
```

---

## Licence

MIT

---

Last updated: 2026-02-27
