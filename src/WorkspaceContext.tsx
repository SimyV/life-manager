import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useAuthToken } from './AuthContext'

export type WorkspaceMember = {
  clerkUserId: string
  email: string
  role: 'admin' | 'member' | 'owner'
  joinedAt: string
}

export type PendingInvite = {
  token: string
  email: string
  role: string
  invitedBy: string
  createdAt: string
  expiresAt: string
}

export type WorkspaceConfig = {
  id: string
  name: string
  brands: string[]
  createdAt: string
  updatedAt?: string
  members: WorkspaceMember[]
  pendingInvites?: PendingInvite[]
  jiraInstanceUrl?: string
  jiraProjectKey?: string
  jiraAccountId?: string
  jiraProjectKeys?: string[]
  jiraDefaultJql?: string
  miroTeamId?: string
  ownerName?: string
}

export type IntegrationSummary = Record<string, string[]>

export type WorkspaceSummary = {
  id: string
  name: string
  role: string
}

type WorkspaceContextType = {
  workspace: WorkspaceConfig | null
  workspaces: WorkspaceSummary[]
  integrations: IntegrationSummary
  loading: boolean
  error: string | null
  isAdmin: boolean
  reload: () => Promise<void>
  switchWorkspace: (wsId: string) => Promise<void>
  createWorkspace: (name: string) => Promise<void>
  updateWorkspace: (updates: Partial<Omit<WorkspaceConfig, 'id' | 'createdAt' | 'members'>>) => Promise<void>
  saveSecrets: (integration: string, secrets: Record<string, string>) => Promise<void>
  inviteMember: (email: string, role?: string) => Promise<{ inviteUrl: string }>
  removeMember: (userId: string) => Promise<void>
  changeMemberRole: (userId: string, role: string) => Promise<void>
  deleteWorkspace: (wsId: string) => Promise<void>
  cancelInvite: (token: string) => Promise<void>
}

const noop = async () => {}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspace: null,
  workspaces: [],
  integrations: {},
  loading: true,
  error: null,
  isAdmin: false,
  reload: noop,
  switchWorkspace: noop,
  createWorkspace: noop,
  updateWorkspace: noop as any,
  saveSecrets: noop as any,
  inviteMember: async () => ({ inviteUrl: '' }),
  removeMember: noop,
  changeMemberRole: noop,
  deleteWorkspace: noop,
  cancelInvite: noop,
})

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const { getToken, r2Url } = useAuthToken()
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([])
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

  const loadWorkspaces = useCallback(async () => {
    try {
      const res = await apiFetch('/config/workspaces')
      if (res.ok) {
        const data = await res.json()
        setWorkspaces(Array.isArray(data) ? data : data.workspaces || [])
      }
    } catch {}
  }, [apiFetch])

  const loadWorkspace = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiFetch('/config/workspace')
      if (res.ok) {
        const data = await res.json()
        setWorkspace(data.workspace || data)
        setIntegrations(data.integrations || {})
      } else {
        throw new Error(`Failed to load workspace (${res.status})`)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load workspace')
    } finally {
      setLoading(false)
    }
  }, [apiFetch])

  const reload = useCallback(async () => {
    await Promise.all([loadWorkspace(), loadWorkspaces()])
  }, [loadWorkspace, loadWorkspaces])

  useEffect(() => { reload() }, [reload])

  const switchWorkspace = useCallback(async (wsId: string) => {
    const res = await apiFetch('/config/workspace/switch', {
      method: 'PUT',
      body: JSON.stringify({ workspaceId: wsId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to switch workspace (${res.status})`)
    }
    await reload()
  }, [apiFetch, reload])

  const createWorkspace = useCallback(async (name: string) => {
    const res = await apiFetch('/config/workspace/create', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to create workspace (${res.status})`)
    }
    await reload()
  }, [apiFetch, reload])

  const updateWorkspace = useCallback(async (updates: Partial<Omit<WorkspaceConfig, 'id' | 'createdAt' | 'members'>>) => {
    const res = await apiFetch('/config/workspace', {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error(`Failed to update workspace (${res.status})`)
    const data = await res.json()
    setWorkspace(data.workspace || data)
    if (data.integrations) setIntegrations(data.integrations)
    await loadWorkspaces()
  }, [apiFetch, loadWorkspaces])

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
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to invite (${res.status})`)
    }
    const result = await res.json()
    await reload()
    return result
  }, [apiFetch, reload])

  const removeMember = useCallback(async (userId: string) => {
    const res = await apiFetch(`/config/members?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error(`Failed to remove member (${res.status})`)
    await reload()
  }, [apiFetch, reload])

  const changeMemberRole = useCallback(async (userId: string, role: string) => {
    const res = await apiFetch('/config/members/role', {
      method: 'PUT',
      body: JSON.stringify({ userId, role }),
    })
    if (!res.ok) throw new Error(`Failed to change role (${res.status})`)
    await reload()
  }, [apiFetch, reload])

  const deleteWorkspace = useCallback(async (wsId: string) => {
    const res = await apiFetch('/config/workspace', {
      method: 'DELETE',
      body: JSON.stringify({ workspaceId: wsId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Failed to delete workspace (${res.status})`)
    }
    await reload()
  }, [apiFetch, reload])

  const cancelInvite = useCallback(async (token: string) => {
    const res = await apiFetch(`/config/invite?token=${encodeURIComponent(token)}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error(`Failed to cancel invite (${res.status})`)
    await reload()
  }, [apiFetch, reload])

  const isAdmin = !!user && !!workspace?.members?.some(
    m => m.clerkUserId === user.id && (m.role === 'admin' || (m.role as string) === 'owner')
  )

  return (
    <WorkspaceContext.Provider value={{
      workspace,
      workspaces,
      integrations,
      loading,
      error,
      isAdmin,
      reload,
      switchWorkspace,
      createWorkspace,
      updateWorkspace,
      saveSecrets,
      inviteMember,
      removeMember,
      changeMemberRole,
      deleteWorkspace,
      cancelInvite,
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  return useContext(WorkspaceContext)
}
