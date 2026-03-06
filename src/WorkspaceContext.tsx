import { createContext, useContext } from 'react'

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

// Static defaults — no auth required
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
  return (
    <WorkspaceContext.Provider value={{
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
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  return useContext(WorkspaceContext)
}
