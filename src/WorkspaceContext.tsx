import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'

const R2_URL = ((import.meta as any).env?.VITE_R2_URL || 'https://r2.bashai.io').replace(/\/$/, '')

export type WorkspaceMember = {
  clerkUserId: string
  email: string
  role: 'owner' | 'member'
  joinedAt: string
}

export type WorkspaceConfig = {
  id: string
  name: string
  brands: string[]
  createdAt: string
  updatedAt?: string
  members: WorkspaceMember[]
  // Jira integration settings (non-secret)
  jiraInstanceUrl?: string
  jiraProjectKey?: string
  jiraAccountId?: string
  jiraProjectKeys?: string[]
  jiraDefaultJql?: string
  // Miro
  miroTeamId?: string
  // User identity
  ownerName?: string
}

export type IntegrationSummary = Record<string, string[]>

type WorkspaceContextType = {
  workspace: WorkspaceConfig | null
  integrations: IntegrationSummary
  loading: boolean
  error: string | null
  isOwner: boolean
  reload: () => Promise<void>
  updateWorkspace: (updates: Partial<Omit<WorkspaceConfig, 'id' | 'createdAt' | 'members'>>) => Promise<void>
  saveSecrets: (integration: string, secrets: Record<string, string>) => Promise<void>
  inviteMember: (email: string, role?: string) => Promise<{ inviteUrl: string }>
  removeMember: (userId: string) => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null)

async function apiFetch(path: string, token: string, opts?: RequestInit) {
  const res = await fetch(`${R2_URL}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...opts?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `API error ${res.status}`)
  }
  return res.json()
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { getToken, userId } = useAuth()
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null)
  const [integrations, setIntegrations] = useState<IntegrationSummary>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isOwner = !!(workspace && userId && workspace.members?.some(m => m.clerkUserId === userId && m.role === 'owner'))

  const reload = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const [ws, secrets] = await Promise.all([
        apiFetch('/config/workspace', token),
        apiFetch('/config/secrets', token),
      ])
      setWorkspace(ws)
      setIntegrations(secrets.integrations || {})
    } catch (err: any) {
      setError(err?.message || 'Failed to load workspace')
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => { reload() }, [reload])

  const updateWorkspace = useCallback(async (updates: Partial<Omit<WorkspaceConfig, 'id' | 'createdAt' | 'members'>>) => {
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    const ws = await apiFetch('/config/workspace', token, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    setWorkspace(ws)
  }, [getToken])

  const saveSecrets = useCallback(async (integration: string, secrets: Record<string, string>) => {
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    await apiFetch('/config/secrets', token, {
      method: 'PUT',
      body: JSON.stringify({ integration, secrets }),
    })
    const updated = await apiFetch('/config/secrets', token)
    setIntegrations(updated.integrations || {})
  }, [getToken])

  const inviteMember = useCallback(async (email: string, role = 'member') => {
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    const result = await apiFetch('/config/invite', token, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    })
    return { inviteUrl: result.inviteUrl }
  }, [getToken])

  const removeMember = useCallback(async (targetUserId: string) => {
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    await apiFetch(`/config/members?userId=${encodeURIComponent(targetUserId)}`, token, {
      method: 'DELETE',
    })
    await reload()
  }, [getToken, reload])

  return (
    <WorkspaceContext.Provider value={{
      workspace, integrations, loading, error, isOwner,
      reload, updateWorkspace, saveSecrets, inviteMember, removeMember,
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
