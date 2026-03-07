import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider, SignedIn, SignedOut, SignIn } from '@clerk/clerk-react'
import { ClerkAuthProvider } from './AuthContext'
import { WorkspaceProvider } from './WorkspaceContext'
import App from './App'
import './index.css'

const CLERK_KEY = (import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {CLERK_KEY ? (
      <ClerkProvider publishableKey={CLERK_KEY}>
        <SignedIn>
          <ClerkAuthProvider>
            <WorkspaceProvider>
              <App />
            </WorkspaceProvider>
          </ClerkAuthProvider>
        </SignedIn>
        <SignedOut>
          <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_0%,#0f2a5a_0%,#030b1f_40%,#020617_100%)]">
            <SignIn />
          </div>
        </SignedOut>
      </ClerkProvider>
    ) : (
      <WorkspaceProvider>
        <App />
      </WorkspaceProvider>
    )}
  </React.StrictMode>,
)
