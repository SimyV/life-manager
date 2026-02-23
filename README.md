# Life Manager (Jira Dashboard)

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
- `VITE_GOOGLE_SIGN_IN_URL`: Google sign-in URL you want the app button to open.

4. Run locally:
```bash
npm run dev
```

5. Build:
```bash
npm run build
```

## Jira Token (Atlassian)

Create token at:
- `https://id.atlassian.com/manage-profile/security/api-tokens`

The token is used server-side by your proxy/integration (not hardcoded in frontend).

## Host-ly Subdomain Deploy (non-local)

Use a dedicated subdomain, for example `life.yourdomain.com`.

1. In `manage.host-ly.com`:
- Create subdomain (`life`).
- Point document root to your app publish folder (for example `public_html/life`).

2. Build and upload:
```bash
npm ci
npm run build
```
Upload contents of `dist/` into the subdomain document root.

3. SPA routing fallback:
Add `.htaccess` in the subdomain root:
```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

4. Proxy for Jira API path:
Configure reverse proxy so requests from
- `/api/proxy/jira/*`
route to your backend proxy (configured separately).

5. Set production env values at build time:
- `VITE_USER_ID=<your_user_id>`
- `VITE_GOOGLE_SIGN_IN_URL=<your_google_signin_url>`
- `VITE_JIRA_PROXY_BASE=/api/proxy/jira`
