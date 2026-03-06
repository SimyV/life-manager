import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider, SignedIn, SignedOut, SignIn } from '@clerk/clerk-react'
import { WorkspaceProvider } from './WorkspaceContext'
import App from './App'
import './index.css'

const CLERK_PUBLISHABLE_KEY = (import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY || 'pk_live_Y2xlcmsubWFuYWdlLmJhc2hhaS5pbyQ='

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
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-100 mb-2">Personal Planning Dashboard</h1>
            <p className="text-slate-400 mb-6">Sign in to continue</p>
            <SignIn routing="hash" />
          </div>
        </div>
      </SignedOut>
    </ClerkProvider>
  </React.StrictMode>,
)
