import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider, SignedIn, SignedOut, SignIn } from '@clerk/clerk-react'
import { WorkspaceProvider } from './WorkspaceContext'
import App from './App'
import './index.css'

const CLERK_PUBLISHABLE_KEY = (import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY || ''

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('VITE_CLERK_PUBLISHABLE_KEY is required. Add it to your .env file.')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <SignedIn>
        <WorkspaceProvider>
          <App />
        </WorkspaceProvider>
      </SignedIn>
      <SignedOut>
        <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_0%,#0f2a5a_0%,#030b1f_40%,#020617_100%)]">
          <SignIn routing="hash" />
        </div>
      </SignedOut>
    </ClerkProvider>
  </React.StrictMode>,
)
