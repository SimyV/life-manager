import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuthToken } from './AuthContext'

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
  jiraInstanceUrl?: string
  jiraProjectKey?: string
  jiraAccountId?: string
  jiraProjectKeys?: string[]
  jiraDefaultJql?: string
  miroTeamId?: string
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

const defaultWorkspace: WorkspaceConfig = {
  id: 'default',
  name: 'Personal',
  brands: ['Selleys', 'Yates'],
  createdAt: new Date().toISOString(),
  members: [],
  jiraInstanceUrl: 'duluxgroup.atlassian.net',
  jiraProjectKey: 'PKPI2',
  jiraAccountId: '5f7a805b25fbdf00685e6cf8',
  miroTeamId: '3458764661111748896',
  ownerName: 'Simon Lobascher',
}

const noop = async () => {}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspace: defaultWorkspace,
  integrations: {},
  loading: false,
  error: null,
  isOwner: true,
  reload: noop,
  updateWorkspace: noop as any,
  saveSecrets: noop as any,
  inviteMember: async () => ({ inviteUrl: '' }),
  removeMember: noop,
})

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { getToken, r2Url } = useAuthToken()
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null)
  const [integrations, setIntegrations] = useState<IntegrationSummary>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const apiFetch = useCallback(async (path: string, opts: RequestInit = {}) => {
    const token = await getToken()
    return fetch(`${r2Url}${path}`, {
      ...opts,
      credentials: 'omit',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    })
  }, [getToken, r2Url])

  const reload = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiFetch('/config/workspace')
      if (res.ok) {
        const data = await res.json()
        setWorkspace(data.workspace || data)
        setIntegrations(data.integrations || {})
      } else if (res.status === 404) {
        // No workspace yet — use defaults
        setWorkspace(defaultWorkspace)
      } else {
        throw new Error(`Failed to load workspace (${res.status})`)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load workspace')
      setWorkspace(defaultWorkspace)
    } finally {
      setLoading(false)
    }
  }, [apiFetch])

  useEffect(() => { reload() }, [reload])

  const updateWorkspace = useCallback(async (updates: Partial<Omit<WorkspaceConfig, 'id' | 'createdAt' | 'members'>>) => {
    const res = await apiFetch('/config/workspace', {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error(`Failed to update workspace (${res.status})`)
    const data = await res.json()
    setWorkspace(data.workspace || data)
    if (data.integrations) setIntegrations(data.integrations)
  }, [apiFetch])

  const saveSecrets = useCallback(async (integration: string, secrets: Record<string, string>) => {
    const res = await apiFetch('/config/secrets', {
      method: 'PUT',
      body: JSON.stringify({ integration, secrets }),
    })
    if (!res.ok) throw new Error(`Failed to save secrets (${res.status})`)
    const data = await res.json()
    if (data.integrations) setIntegrations(data.integrations)
  }, [apiFetch])

  const inviteMember = useCallback(async (email: string, role = 'member') => {
    const res = await apiFetch('/config/invite', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    })
    if (!res.ok) throw new Error(`Failed to invite (${res.status})`)
    return res.json()
  }, [apiFetch])

  const removeMember = useCallback(async (userId: string) => {
    const res = await apiFetch(`/config/members?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error(`Failed to remove member (${res.status})`)
    await reload()
  }, [apiFetch, reload])

  // Determine owner status — if workspace loaded and has members, check; otherwise assume owner
  const isOwner = !workspace?.members?.length || workspace.members.some(m => m.role === 'owner')

  return (
    <WorkspaceContext.Provider value={{
      workspace: workspace || defaultWorkspace,
      integrations,
      loading,
      error,
      isOwner,
      reload,
      updateWorkspace,
      saveSecrets,
      inviteMember,
      removeMember,
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  return useContext(WorkspaceContext)
}
