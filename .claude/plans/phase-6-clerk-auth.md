# Plan: Phase 6 — Clerk Authentication for manage.bashai.io

## Summary

Add Google sign-in to manage.bashai.io using Clerk, restricting access to Simon's Google account only. Clerk handles the OAuth flow, session management, and the hosted sign-in page — zero backend changes needed.

## Why Clerk (not Cloudflare Access)

Cloudflare Access was the original preferred option, but Clerk gives us:
- A proper sign-in page embedded in the React app (not a redirect to a Cloudflare login screen)
- React components (`<SignedIn>`, `<SignedOut>`, `<UserButton>`) that integrate cleanly
- Free tier covers this single-user use case
- Easy allowlist by email in the Clerk dashboard
- No Cloudflare plan upgrade needed

---

## Prerequisites (manual — Simon does these)

1. Create a Clerk account at https://clerk.com
2. Create a new application → choose **Google** as the only sign-in method
3. In Clerk dashboard → **User & Authentication → Email, Phone, Username**: disable email/password login (Google only)
4. In Clerk dashboard → **Restrictions → Allowlist**: add Simon's Google email address and enable "Enable allowlist"
5. Copy the **Publishable Key** (starts with `pk_live_` or `pk_test_`)
6. In Clerk dashboard → **Domains**: add `manage.bashai.io` as a production domain

---

## Implementation Steps

### Step 1 — Install Clerk

```bash
npm install @clerk/clerk-react
```

### Step 2 — Add env var

Add to `.env`:
```
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
```

Add to VPS environment (in `/opt/life-manager/.env` or the server's systemd/nginx config):
```
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
```

### Step 3 — Wrap app with ClerkProvider in `main.tsx`

```tsx
import { ClerkProvider } from '@clerk/clerk-react'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
)
```

### Step 4 — Add auth gate in `App.tsx`

Wrap the entire app content with Clerk's auth components:

```tsx
import { SignedIn, SignedOut, SignIn } from '@clerk/clerk-react'

// Inside App return:
return (
  <>
    <SignedOut>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <SignIn />
      </div>
    </SignedOut>
    <SignedIn>
      {/* existing app content */}
    </SignedIn>
  </>
)
```

### Step 5 — Add UserButton (optional sign-out)

Add a `<UserButton />` component somewhere in the header so Simon can sign out if needed.

```tsx
import { UserButton } from '@clerk/clerk-react'

// In the app header:
<UserButton afterSignOutUrl="/" />
```

### Step 6 — Build and deploy

```bash
# On VPS (to avoid local OOM):
ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no root@5.223.62.179 \
  "cd /root/agent-system/storage/users/user_39rSuKJwrIsejlk4SRLlPcK5aSi/projects/life-planning && \
   echo 'VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx' >> .env && \
   npm run build"

# Then deploy:
ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no root@5.223.62.179 \
  "rm -rf /opt/life-manager/dist/assets && \
   cp -r /root/agent-system/storage/users/.../projects/life-planning/dist/* /opt/life-manager/dist/"
```

---

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `@clerk/clerk-react` |
| `.env` | Add `VITE_CLERK_PUBLISHABLE_KEY` |
| `src/main.tsx` | Wrap with `<ClerkProvider>` |
| `src/App.tsx` | Add `<SignedIn>` / `<SignedOut>` / `<SignIn>` gate |

---

## Notes

- Clerk free tier: 10,000 MAU — more than enough for a single user
- The `SignIn` component renders a hosted sign-in UI (Clerk's embeddable component)
- If Simon's Google account is the only one allowlisted, any other Google account gets blocked at the Clerk layer
- No changes needed to the R2 worker or Jira proxy — those are already secured with Bearer tokens
- The `VITE_CLERK_PUBLISHABLE_KEY` is safe to expose in frontend code (it's a publishable key, not secret)
