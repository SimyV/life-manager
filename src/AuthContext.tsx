import { createContext, useContext, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'

const R2_TOKEN = (import.meta as any).env?.VITE_R2_SECRET || (import.meta as any).env?.VITE_R2_TOKEN || ''
const R2_URL = ((import.meta as any).env?.VITE_R2_URL || 'https://r2.bashai.io').replace(/\/$/, '')

type AuthContextType = {
  getToken: () => Promise<string>
  r2Url: string
}

const AuthContext = createContext<AuthContextType>({
  getToken: async () => R2_TOKEN,
  r2Url: R2_URL,
})

/** Use inside ClerkProvider — returns Clerk JWT, falls back to static token */
export function ClerkAuthProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth()
  const getAuthToken = useCallback(async () => {
    try {
      const jwt = await getToken()
      if (jwt) return jwt
    } catch {}
    return R2_TOKEN
  }, [getToken])

  return (
    <AuthContext.Provider value={{ getToken: getAuthToken, r2Url: R2_URL }}>
      {children}
    </AuthContext.Provider>
  )
}

/** Use outside ClerkProvider — always returns static token */
export function StaticAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={{ getToken: async () => R2_TOKEN, r2Url: R2_URL }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthToken() {
  return useContext(AuthContext)
}

export { R2_URL }
