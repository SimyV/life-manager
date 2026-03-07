import { useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useWorkspace } from './WorkspaceContext'

function Input({ label, value, onChange, placeholder, type = 'text', savedValue, disabled }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; savedValue?: string; disabled?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500 disabled:opacity-50"
      />
      {savedValue && (
        <p className="mt-1 text-xs text-emerald-400/70">Saved: {type === 'password' ? '••••••••' : savedValue}</p>
      )}
    </div>
  )
}

function Section({ title, children, description }: { title: string; children: React.ReactNode; description?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  )
}

function SaveButton({ onClick, saving, label = 'Save' }: { onClick: () => void; saving: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="rounded-xl border border-cyan-700 bg-cyan-600/20 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-600/30 disabled:opacity-50"
    >
      {saving ? 'Saving...' : label}
    </button>
  )
}

function StatusMessage({ error, success }: { error: string | null; success: string | null }) {
  if (error) return <p className="text-xs text-rose-300">{error}</p>
  if (success) return <p className="text-xs text-emerald-300">{success}</p>
  return null
}

export default function SettingsTab() {
  const { workspace, workspaces, integrations, isAdmin, updateWorkspace, saveSecrets, inviteMember, removeMember, changeMemberRole, deleteWorkspace } = useWorkspace()
  const { user } = useUser()

  // Workspace settings
  const [wsName, setWsName] = useState(workspace?.name || '')
  const [ownerName, setOwnerName] = useState(workspace?.ownerName || '')
  const [brandsText, setBrandsText] = useState((workspace?.brands || []).join(', '))
  const [wsSaving, setWsSaving] = useState(false)
  const [wsError, setWsError] = useState<string | null>(null)
  const [wsSuccess, setWsSuccess] = useState<string | null>(null)

  // Jira settings (non-secret)
  const [jiraInstanceUrl, setJiraInstanceUrl] = useState(workspace?.jiraInstanceUrl || '')
  const [jiraProjectKey, setJiraProjectKey] = useState(workspace?.jiraProjectKey || '')
  const [jiraAccountId, setJiraAccountId] = useState(workspace?.jiraAccountId || '')
  const [jiraSaving, setJiraSaving] = useState(false)
  const [jiraError, setJiraError] = useState<string | null>(null)
  const [jiraSuccess, setJiraSuccess] = useState<string | null>(null)

  // Jira secrets
  const [jiraHost, setJiraHost] = useState('')
  const [jiraEmail, setJiraEmail] = useState('')
  const [jiraApiToken, setJiraApiToken] = useState('')
  const [jiraSecretSaving, setJiraSecretSaving] = useState(false)
  const [jiraSecretError, setJiraSecretError] = useState<string | null>(null)
  const [jiraSecretSuccess, setJiraSecretSuccess] = useState<string | null>(null)

  // Miro settings
  const [miroTeamId, setMiroTeamId] = useState(workspace?.miroTeamId || '')
  const [miroApiKey, setMiroApiKey] = useState('')
  const [miroSaving, setMiroSaving] = useState(false)
  const [miroError, setMiroError] = useState<string | null>(null)
  const [miroSuccess, setMiroSuccess] = useState<string | null>(null)

  // Members
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<string | null>(null)
  const [memberError, setMemberError] = useState<string | null>(null)

  // Delete workspace
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const jiraSecretsConfigured = integrations.jira?.length > 0
  const miroSecretsConfigured = integrations.miro?.length > 0

  const memberDisplayName = (m: { clerkUserId: string; email: string }) => {
    if (user && m.clerkUserId === user.id) {
      return user.fullName || user.primaryEmailAddress?.emailAddress || m.email || m.clerkUserId
    }
    return m.email || m.clerkUserId
  }

  const onSaveWorkspace = async () => {
    setWsSaving(true); setWsError(null); setWsSuccess(null)
    try {
      const brands = brandsText.split(',').map(b => b.trim()).filter(Boolean)
      await updateWorkspace({ name: wsName, ownerName, brands })
      setWsSuccess('Workspace updated')
    } catch (err: any) { setWsError(err?.message || 'Failed') }
    finally { setWsSaving(false) }
  }

  const onSaveJiraSettings = async () => {
    setJiraSaving(true); setJiraError(null); setJiraSuccess(null)
    try {
      await updateWorkspace({ jiraInstanceUrl, jiraProjectKey, jiraAccountId })
      setJiraSuccess('Jira settings updated')
    } catch (err: any) { setJiraError(err?.message || 'Failed') }
    finally { setJiraSaving(false) }
  }

  const onSaveJiraSecrets = async () => {
    setJiraSecretSaving(true); setJiraSecretError(null); setJiraSecretSuccess(null)
    try {
      await saveSecrets('jira', { host: jiraHost, email: jiraEmail, apiToken: jiraApiToken })
      setJiraApiToken(''); setJiraEmail(''); setJiraHost('')
      setJiraSecretSuccess('Jira credentials saved (encrypted)')
    } catch (err: any) { setJiraSecretError(err?.message || 'Failed') }
    finally { setJiraSecretSaving(false) }
  }

  const onSaveMiro = async () => {
    setMiroSaving(true); setMiroError(null); setMiroSuccess(null)
    try {
      if (miroTeamId) await updateWorkspace({ miroTeamId })
      if (miroApiKey) {
        await saveSecrets('miro', { apiKey: miroApiKey })
        setMiroApiKey('')
      }
      setMiroSuccess('Miro settings saved')
    } catch (err: any) { setMiroError(err?.message || 'Failed') }
    finally { setMiroSaving(false) }
  }

  const onInvite = async () => {
    setInviting(true); setMemberError(null); setInviteResult(null)
    try {
      const { inviteUrl } = await inviteMember(inviteEmail, inviteRole)
      setInviteResult(inviteUrl)
      setInviteEmail('')
    } catch (err: any) { setMemberError(err?.message || 'Failed') }
    finally { setInviting(false) }
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
        <p className="text-lg text-slate-300">Only workspace admins can manage settings.</p>
        <p className="mt-2 text-sm text-slate-500">
          Workspace: {workspace?.name || 'Loading...'} | Your role: member
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Workspace */}
      <Section title="Workspace" description="General workspace settings visible to all members.">
        <Input label="Workspace Name" value={wsName} onChange={setWsName} placeholder="My Workspace" savedValue={workspace?.name || undefined} />
        <Input label="Owner Name" value={ownerName} onChange={setOwnerName} placeholder="Jane Smith" savedValue={workspace?.ownerName || undefined} />
        <Input label="Brands (comma-separated)" value={brandsText} onChange={setBrandsText} placeholder="Brand A, Brand B" savedValue={workspace?.brands?.length ? workspace.brands.join(', ') : undefined} />
        <div className="flex items-center gap-3">
          <SaveButton onClick={onSaveWorkspace} saving={wsSaving} />
          <StatusMessage error={wsError} success={wsSuccess} />
        </div>
      </Section>

      {/* Jira Settings */}
      <Section title="Jira Settings" description="Non-sensitive Jira configuration. These values are stored in plain text.">
        <Input label="Jira Instance URL" value={jiraInstanceUrl} onChange={setJiraInstanceUrl} placeholder="yourcompany.atlassian.net" savedValue={workspace?.jiraInstanceUrl || undefined} />
        <Input label="Default Project Key (for ticket creation)" value={jiraProjectKey} onChange={setJiraProjectKey} placeholder="PROJ" savedValue={workspace?.jiraProjectKey || undefined} />
        <Input label="Your Jira Account ID" value={jiraAccountId} onChange={setJiraAccountId} placeholder="Your Atlassian account ID" savedValue={workspace?.jiraAccountId || undefined} />
        <div className="flex items-center gap-3">
          <SaveButton onClick={onSaveJiraSettings} saving={jiraSaving} />
          <StatusMessage error={jiraError} success={jiraSuccess} />
        </div>
      </Section>

      {/* Jira Credentials */}
      <Section title="Jira Credentials" description="These are encrypted with AES-256-GCM before storage. Values are never sent back to the browser.">
        {jiraSecretsConfigured && (
          <p className="rounded-lg border border-emerald-800 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            Jira credentials are configured ({integrations.jira.join(', ')}). Enter new values below to update.
          </p>
        )}
        <Input label="Jira Host (full URL)" value={jiraHost} onChange={setJiraHost} placeholder="https://yourcompany.atlassian.net" savedValue={jiraSecretsConfigured && integrations.jira.includes('host') ? 'Configured' : undefined} />
        <Input label="Org Email (use your bashai.io email if not available)" value={jiraEmail} onChange={setJiraEmail} placeholder="you@company.com" type="email" savedValue={jiraSecretsConfigured && integrations.jira.includes('email') ? 'Configured' : undefined} />
        <Input label="Jira API Token" value={jiraApiToken} onChange={setJiraApiToken} placeholder="Enter API token" type="password" savedValue={jiraSecretsConfigured && integrations.jira.includes('apiToken') ? 'Configured' : undefined} />
        <div className="flex items-center gap-3">
          <SaveButton onClick={onSaveJiraSecrets} saving={jiraSecretSaving} label="Save Credentials" />
          <StatusMessage error={jiraSecretError} success={jiraSecretSuccess} />
        </div>
      </Section>

      {/* Miro */}
      <Section title="Miro" description="Miro board generation settings. API key is encrypted.">
        <Input label="Miro Team ID" value={miroTeamId} onChange={setMiroTeamId} placeholder="Your Miro team ID" savedValue={workspace?.miroTeamId || undefined} />
        <Input label="Miro API Key" value={miroApiKey} onChange={setMiroApiKey} placeholder="Enter Miro API key" type="password" savedValue={miroSecretsConfigured ? 'Configured' : undefined} />
        <div className="flex items-center gap-3">
          <SaveButton onClick={onSaveMiro} saving={miroSaving} />
          <StatusMessage error={miroError} success={miroSuccess} />
        </div>
      </Section>

      {/* Members */}
      <Section title="Members" description="Manage workspace access. Admins can change settings. Members can use all features but cannot modify settings.">
        <div className="space-y-2">
          {(workspace?.members || []).map((m) => (
            <div key={m.clerkUserId} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
              <div>
                <p className="text-sm text-slate-200">{memberDisplayName(m)}</p>
                <p className="text-xs text-slate-500">
                  joined {new Date(m.joinedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {user && m.clerkUserId !== user.id ? (
                  <>
                    <select
                      value={m.role === 'owner' ? 'admin' : m.role}
                      onChange={(e) => changeMemberRole(m.clerkUserId, e.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300"
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                    <button
                      onClick={() => removeMember(m.clerkUserId)}
                      className="rounded-lg border border-rose-800 bg-rose-500/10 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/20"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <span className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-400">
                    {m.role === 'owner' ? 'Admin' : m.role === 'admin' ? 'Admin' : 'Member'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email to invite"
            className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={onInvite}
            disabled={inviting || !inviteEmail}
            className="rounded-xl border border-cyan-700 bg-cyan-600/20 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-600/30 disabled:opacity-50"
          >
            {inviting ? 'Inviting...' : 'Invite'}
          </button>
        </div>
        {inviteResult && (
          <div className="rounded-lg border border-cyan-800 bg-cyan-500/10 px-3 py-2">
            <p className="text-xs text-cyan-300">Invite link (share with the user):</p>
            <p className="mt-1 break-all text-xs font-mono text-cyan-200">{inviteResult}</p>
          </div>
        )}
        <StatusMessage error={memberError} success={null} />
      </Section>

      {/* Danger Zone */}
      {workspaces.length > 1 && (
        <Section title="Danger Zone" description="Irreversible actions for this workspace.">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-xl border border-rose-800 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/20"
            >
              Delete Workspace
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-rose-300">
                This will permanently delete <strong>{workspace?.name}</strong> and all its data (meetings, reference docs, Miro boards, settings). This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!workspace?.id) return
                    setDeleting(true)
                    setDeleteError(null)
                    try {
                      await deleteWorkspace(workspace.id)
                      setConfirmDelete(false)
                    } catch (err: any) {
                      setDeleteError(err?.message || 'Failed to delete')
                    } finally {
                      setDeleting(false)
                    }
                  }}
                  disabled={deleting}
                  className="rounded-xl border border-rose-700 bg-rose-600/30 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600/50 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Yes, delete permanently'}
                </button>
                <button
                  onClick={() => { setConfirmDelete(false); setDeleteError(null) }}
                  className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>
              <StatusMessage error={deleteError} success={null} />
            </div>
          )}
        </Section>
      )}
    </div>
  )
}
