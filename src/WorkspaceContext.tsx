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
  isOwner: boolean
  reload: () => Promise<void>
  switchWorkspace: (wsId: string) => Promise<void>
  createWorkspace: (name: string) => Promise<void>
  updateWorkspace: (updates: Partial<Omit<WorkspaceConfig, 'id' | 'createdAt' | 'members'>>) => Promise<void>
  saveSecrets: (integration: string, secrets: Record<string, string>) => Promise<void>
  inviteMember: (email: string, role?: string) => Promise<{ inviteUrl: string }>
  removeMember: (userId: string) => Promise<void>
}

const defaultWorkspace: WorkspaceConfig = {
  id: 'default',
  name: 'Personal',
  brands: [],
  createdAt: new Date().toISOString(),
  members: [],
}

const noop = async () => {}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspace: defaultWorkspace,
  workspaces: [],
  integrations: {},
  loading: false,
  error: null,
  isOwner: true,
  reload: noop,
  switchWorkspace: noop,
  createWorkspace: noop,
  updateWorkspace: noop as any,
  saveSecrets: noop as any,
  inviteMember: async () => ({ inviteUrl: '' }),
  removeMember: noop,
})

const WS_STORAGE_KEY = 'life-manager-active-workspace'

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { getToken, r2Url } = useAuthToken()
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([])
  const [integrations, setIntegrations] = useState<IntegrationSummary>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeWsId, setActiveWsId] = useState<string | null>(() => {
    try { return localStorage.getItem(WS_STORAGE_KEY) } catch { return null }
  })

  const apiFetch = useCallback(async (path: string, opts: RequestInit = {}) => {
    const token = await getToken()
    // Append workspace ID as query param if we have one
    const separator = path.includes('?') ? '&' : '?'
    const wsParam = activeWsId ? `${separator}wsId=${encodeURIComponent(activeWsId)}` : ''
    return fetch(`${r2Url}${path}${wsParam}`, {
      ...opts,
      credentials: 'omit',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    })
  }, [getToken, r2Url, activeWsId])

  // Fetch list of workspaces the user belongs to
  const loadWorkspaces = useCallback(async () => {
    try {
      const token = await getToken()
      const res = await fetch(`${r2Url}/config/workspaces`, {
        credentials: 'omit',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        const data = await res.json()
        setWorkspaces(Array.isArray(data) ? data : data.workspaces || [])
      }
    } catch {}
  }, [getToken, r2Url])

  const reload = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiFetch('/config/workspace')
      if (res.ok) {
        const data = await res.json()
        const ws = data.workspace || data
        setWorkspace(ws)
        setIntegrations(data.integrations || {})
        // Persist active workspace
        if (ws.id) {
          setActiveWsId(ws.id)
          try { localStorage.setItem(WS_STORAGE_KEY, ws.id) } catch {}
        }
      } else if (res.status === 404) {
        // No workspace yet — auto-create with defaults
        const createRes = await apiFetch('/config/workspace', {
          method: 'PUT',
          body: JSON.stringify(defaultWorkspace),
        })
        if (createRes.ok) {
          const created = await createRes.json()
          const ws = created.workspace || created
          setWorkspace(ws)
          setIntegrations(created.integrations || {})
          if (ws.id) {
            setActiveWsId(ws.id)
            try { localStorage.setItem(WS_STORAGE_KEY, ws.id) } catch {}
          }
        } else {
          setWorkspace(defaultWorkspace)
        }
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

  useEffect(() => {
    reload()
    loadWorkspaces()
  }, [reload, loadWorkspaces])

  const switchWorkspace = useCallback(async (wsId: string) => {
    setActiveWsId(wsId)
    try { localStorage.setItem(WS_STORAGE_KEY, wsId) } catch {}
    // reload will pick up the new activeWsId via apiFetch
  }, [])

  // Re-reload when activeWsId changes
  useEffect(() => {
    if (activeWsId) reload()
  }, [activeWsId]) // eslint-disable-line react-hooks/exhaustive-deps

  const createWorkspace = useCallback(async (name: string) => {
    const token = await getToken()
    const res = await fetch(`${r2Url}/config/workspace`, {
      method: 'PUT',
      credentials: 'omit',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, brands: [], newWorkspace: true }),
    })
    if (!res.ok) throw new Error(`Failed to create workspace (${res.status})`)
    const data = await res.json()
    const ws = data.workspace || data
    if (ws.id) {
      setActiveWsId(ws.id)
      try { localStorage.setItem(WS_STORAGE_KEY, ws.id) } catch {}
    }
    setWorkspace(ws)
    setIntegrations(data.integrations || {})
    await loadWorkspaces()
  }, [getToken, r2Url, loadWorkspaces])

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

  const isOwner = !workspace?.members?.length || workspace.members.some(m => m.role === 'owner')

  return (
    <WorkspaceContext.Provider value={{
      workspace: workspace || defaultWorkspace,
      workspaces,
      integrations,
      loading,
      error,
      isOwner,
      reload,
      switchWorkspace,
      createWorkspace,
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
