# Life Manager

A Jira-integrated personal dashboard built with Vite, React, TypeScript, and Tailwind CSS.

---

## Stack

- **Vite** + **React** + **TypeScript**
- **Tailwind CSS** for styling
- **Jira REST API** via server-side proxy
- **Google Sign-In** for authentication

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
