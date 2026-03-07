import { useEffect, useMemo, useState } from 'react'
import { UserButton } from '@clerk/clerk-react'
import { MeetingsTab, ReferenceDocsTab } from './MeetingsTab'
import SettingsTab from './SettingsTab'
import { useAuthToken } from './AuthContext'
import { useWorkspace } from './WorkspaceContext'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import report from './data/reportData.json'

type Ticket = {
  key: string
  url: string
  summary: string
  status: string
  rag: string
  issueType: string
  projectKey: string
  projectName: string
  projectType: string
  projectTypeTags?: string[]
  projectTypeValue?: string
  labels: string[]
  startDate: string | null
  endDate: string | null
  dueDate: string | null
  created: string | null
  resolved: string | null
  assignee: string | null
  reporter: string | null
  businessContact?: string | null
  priority: string | null
  agingDays: number | null
  agingBucket: string
  isDone: boolean
  isOverdue: boolean
  stream: 'Demand' | 'Delivery'
  category: 'Strategic' | 'Tactical' | 'Ad hoc'
  brand: string
  active: boolean
  projectTag?: string | null  // extracted from label "project-<id>"
  projectNameFromDesc?: string | null  // extracted from description "Project: ..." line
}

type ReportShape = {
  summary: {
    generatedAt: string
    owner: { name: string }
    scopeNote?: string
    totals: {
      allTickets: number
      totalInitiatives: number
      overdueItems: number
      completed: number
      activeTickets: number
      aiProjectTypeTickets?: number
    }
  }
  tickets: Ticket[]
}

type ColumnDef<T> = {
  key: string
  label: string
  value: (row: T) => string | number | null | undefined
  render?: (row: T) => JSX.Element | string | number
  width?: string
}

type PeriodOption = {
  key: string
  label: string
  kind: 'all' | 'quarter' | 'annual'
  year: number
  quarter?: number
}

const data = report as ReportShape
const PIE_COLORS = ['#38bdf8', '#22c55e', '#f59e0b', '#ef4444', '#a78bfa', '#14b8a6', '#f43f5e', '#8b5cf6']

function ragClass(rag: string): string {
  const r = rag.toLowerCase()
  if (r.includes('red')) return 'bg-rose-500/20 text-rose-300'
  if (r.includes('amber') || r.includes('yellow')) return 'bg-amber-500/20 text-amber-300'
  if (r.includes('green')) return 'bg-emerald-500/20 text-emerald-300'
  return 'bg-slate-500/20 text-slate-300'
}

function toDate(value: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function signedAgingDays(dueDate: string | null): number | null {
  const due = toDate(dueDate)
  if (!due) return null
  const today = new Date()
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffMs = todayDay.getTime() - dueDay.getTime()
  return Math.round(diffMs / 86400000)
}

function deliveryOutcome(resolvedDate: string | null, dueDate: string | null): string {
  const due = toDate(dueDate)
  if (!due) return 'No due date'

  const resolved = toDate(resolvedDate)
  if (!resolved) return 'Unknown completion date'

  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const resolvedDay = new Date(resolved.getFullYear(), resolved.getMonth(), resolved.getDate())
  return resolvedDay.getTime() <= dueDay.getTime() ? 'On Time' : 'Late'
}

function quarterOf(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1
}

function periodOptions(): PeriodOption[] {
  const options: PeriodOption[] = [{ key: 'ALL', label: 'ALL TIME', kind: 'all', year: 0 }]
  const startYear = 2024
  const now = new Date()
  const endYear = now.getFullYear()
  const endQuarter = quarterOf(now)

  for (let y = startYear; y <= endYear; y += 1) {
    const maxQ = y === endYear ? endQuarter : 4
    for (let q = 1; q <= maxQ; q += 1) {
      options.push({ key: `Q${q}-${y}`, label: `QTR ${q} ${y}`, kind: 'quarter', year: y, quarter: q })
    }
  }
  for (let y = startYear; y <= endYear; y += 1) {
    options.push({ key: `ANNUAL-${y}`, label: `ANNUAL ${y}`, kind: 'annual', year: y })
  }
  return options
}

function groupCount(rows: Ticket[], keyFn: (r: Ticket) => string): Array<{ name: string; value: number }> {
  const map = new Map<string, number>()
  for (const r of rows) {
    const k = keyFn(r) || 'Unknown'
    map.set(k, (map.get(k) || 0) + 1)
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

function normalizeAgingBucket(name: string): string {
  const lower = name.toLowerCase().trim()
  if (lower.includes('90+')) return '90+'
  if (lower.includes('61-90') || lower.includes('60-90')) return '61-90'
  if (lower.includes('31-60') || lower.includes('30-60')) return '31-60'
  if (lower.includes('0-30') || lower.includes('0 to 30')) return '0-30'
  return 'Unknown'
}

function sortAgingBuckets(data: Array<{ name: string; value: number }>): Array<{ name: string; value: number }> {
  const ordered = ['90+', '61-90', '31-60', '0-30', 'Unknown']
  const totals = new Map<string, number>()

  for (const row of data) {
    const bucket = normalizeAgingBucket(row.name)
    totals.set(bucket, (totals.get(bucket) || 0) + row.value)
  }

  return ordered
    .map((name) => ({ name, value: totals.get(name) || 0 }))
    .filter((row) => row.value > 0)
}

function bucketFromSignedAgingDays(days: number | null): string {
  if (days === null) return 'Unknown'
  if (days > 90) return '90+'
  if (days > 60) return '61-90'
  if (days > 30) return '31-60'
  return '0-30'
}


function deriveBrand(labels: string[], brands: string[], configuredBrands?: string[]): string {
  if (brands.length > 0) return brands[0]
  const hay = labels.join(' ').toLowerCase()
  const knownBrands = configuredBrands && configuredBrands.length > 0 ? configuredBrands : []
  for (const b of knownBrands) {
    if (hay.includes(b.toLowerCase())) return b
  }
  return 'Other'
}

const R2_URL = ((import.meta as any).env?.VITE_R2_URL || 'https://r2.bashai.io').replace(/\/$/, '')

async function fetchJiraSearch(jql: string, maxResults: number, token: string, nextPageToken?: string): Promise<any> {
  const fields = [
    'summary',
    'status',
    'issuetype',
    'project',
    'labels',
    'created',
    'resolutiondate',
    'assignee',
    'reporter',
    'priority',
    'duedate',
    'customfield_11342',
    'customfield_11578',
    'customfield_11580',
    'customfield_11588',
    'customfield_11768',
    'customfield_12577',
    'description',
  ]

  // POST body — Atlassian removed GET /search in Jan 2026, must use POST /search/jql
  const body: Record<string, any> = { jql, maxResults, fields }
  if (nextPageToken) body.nextPageToken = nextPageToken

  const url = `${R2_URL}/jira/rest/api/3/search/jql`
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await res.text()
    if (text.includes('Sign In Required')) throw new Error('Session expired — please refresh and sign in again.')
    throw new Error(`Non-JSON response (HTTP ${res.status})`)
  }

  const resBody = await res.json()
  if (!res.ok) throw new Error(String(resBody?.message || resBody?.error || `HTTP ${res.status}`))
  return resBody
}

function mapIssueToTicket(issue: any, jiraInstanceUrl = '', configuredBrands?: string[]): Ticket {
  const f = issue.fields || {}
  const statusCategoryName = (f.status?.statusCategory?.name || '').toLowerCase()
  const isDone = statusCategoryName === 'done'
  const dueDate = f.duedate || null
  const age = signedAgingDays(dueDate)
  const projectTypeValues = Array.isArray(f.customfield_11588)
    ? f.customfield_11588.map((x: any) => x?.value).filter(Boolean)
    : []
  const projectTypeValue = projectTypeValues[0] || 'Not yet classified'
  const brandsMulti = Array.isArray(f.customfield_11768)
    ? f.customfield_11768.map((x: any) => x?.value).filter(Boolean)
    : []
  const brandText = typeof f.customfield_12577 === 'string' ? [f.customfield_12577] : []
  const labels = Array.isArray(f.labels) ? f.labels : []
  const allBrandTokens = [...brandsMulti, ...brandText]
  const lowerType = projectTypeValue.toLowerCase()

  let category: Ticket['category'] = 'Strategic'
  if (lowerType.includes('tactical') || lowerType.includes('operational')) category = 'Tactical'
  else if (lowerType.includes('not yet')) category = 'Ad hoc'

  return {
    key: issue.key,
    url: `https://${jiraInstanceUrl}/browse/${issue.key}`,
    summary: f.summary || '',
    status: f.status?.name || 'Unknown',
    rag: f.customfield_11578?.value || 'Unknown',
    issueType: f.issuetype?.name || 'Unknown',
    projectKey: f.project?.key || '',
    projectName: f.project?.name || '',
    projectType: f.project?.projectTypeKey || '',
    projectTypeTags: projectTypeValues,
    projectTypeValue,
    labels,
    startDate: f.customfield_11342 || null,
    endDate: dueDate,
    dueDate,
    created: f.created ? String(f.created) : null,
    resolved: f.resolutiondate ? String(f.resolutiondate).slice(0, 10) : null,
    assignee: f.assignee?.displayName || null,
    reporter: f.reporter?.displayName || null,
    businessContact: typeof f.customfield_11580 === 'string' ? f.customfield_11580 : null,
    priority: f.priority?.name || null,
    agingDays: age,
    agingBucket: bucketFromSignedAgingDays(age),
    isDone,
    isOverdue: !isDone && age !== null && age > 0,
    stream: 'Demand',
    category,
    brand: deriveBrand(labels, allBrandTokens, configuredBrands),
    active: !isDone,
    projectTag: labels.find((l: string) => l.startsWith('project-'))?.replace('project-', '') ?? null,
    projectNameFromDesc: (() => {
      const descText: string = f.description?.content?.[0]?.content?.[0]?.text ?? ''
      return descText.trim() || null
    })(),
  }
}

// Default Jira accountId — used in JQL since currentUser() doesn't resolve via the proxy
const DEFAULT_ACCOUNT_ID = ''

type RefreshConfig = {
  token: string
  accountId?: string
  defaultJql?: string
  jiraInstanceUrl?: string
  brands?: string[]
}

async function refreshFromJira(prev: ReportShape, config: RefreshConfig): Promise<ReportShape> {
  const accountId = config.accountId || DEFAULT_ACCOUNT_ID
  const jiraInstance = config.jiraInstanceUrl || ''
  const brands = config.brands && config.brands.length > 0 ? config.brands : []

  // Use workspace-configured JQL if available, otherwise build a generic fallback
  let jql = config.defaultJql || ''
  if (!jql && accountId) {
    jql = `(assignee = "${accountId}" OR reporter = "${accountId}") ORDER BY updated DESC`
  }
  if (!jql) {
    throw new Error('No Jira configuration found. Please configure Jira settings for this workspace.')
  }

  const runQuery = async (): Promise<any[]> => {
    const allIssues: any[] = []
    const maxResults = 100
    let nextPageToken: string | undefined

    while (true) {
      const page = await fetchJiraSearch(jql, maxResults, config.token, nextPageToken)
      const issues = Array.isArray(page?.issues) ? page.issues : Array.isArray(page) ? page : []
      allIssues.push(...issues)
      if (issues.length === 0 || page?.isLast) break
      nextPageToken = page?.nextPageToken
      if (!nextPageToken) break
    }

    return allIssues
  }

  const allIssues = await runQuery()

  if (allIssues.length === 0) {
    throw new Error('Refresh returned zero tickets; keeping previous dashboard data.')
  }

  const refreshedTickets = allIssues.map(i => mapIssueToTicket(i, jiraInstance, brands))
  const mergedByKey = new Map<string, Ticket>()
  for (const t of prev.tickets) mergedByKey.set(t.key, t)
  for (const t of refreshedTickets) mergedByKey.set(t.key, t)
  const tickets = Array.from(mergedByKey.values())
  const completed = tickets.filter((t) => t.isDone).length
  const activeTickets = tickets.filter((t) => t.active).length
  const overdueItems = tickets.filter((t) => t.isOverdue).length
  const totalInitiatives = tickets.filter((t) => ['Initiative', 'Epic', 'Capability'].includes(t.issueType) || t.category === 'Strategic').length
  const aiProjectTypeTickets = tickets.filter((t) => (t.projectTypeValue || '').toLowerCase() === 'ai').length

  return {
    ...prev,
    summary: {
      ...prev.summary,
      generatedAt: new Date().toISOString(),
      owner: { name: prev.summary.owner.name },
      scopeNote: 'Your assigned and reported tickets, plus all tickets with Project Type = AI.',
      totals: {
        ...prev.summary.totals,
        allTickets: tickets.length,
        totalInitiatives,
        overdueItems,
        completed,
        activeTickets,
        aiProjectTypeTickets,
      },
    },
    tickets,
  }
}

function ClickablePieLegend({ data, onSelect }: { data: Array<{ name: string; value: number }>; onSelect: (name: string) => void }) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
      {data.map((row, idx) => (
        <button
          key={row.name}
          onClick={() => onSelect(row.name)}
          className="flex items-center justify-between rounded bg-slate-950/60 px-2 py-1 text-slate-200 transition hover:bg-slate-700/60 hover:text-white"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
            <span className="truncate">{row.name}</span>
          </div>
          <span className="ml-2 font-semibold text-slate-100">{row.value}</span>
        </button>
      ))}
    </div>
  )
}

function SortableFilterableTable<T>({
  title,
  rows,
  columns,
  limit,
  defaultSortKey,
  defaultSortDir = 'asc',
}: {
  title: string
  rows: T[]
  columns: ColumnDef<T>[]
  limit?: number
  defaultSortKey?: string
  defaultSortDir?: 'asc' | 'desc'
}) {
  const [sortKey, setSortKey] = useState<string>(defaultSortKey || '')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir)
  const [filters, setFilters] = useState<Record<string, string>>({})

  const filteredSorted = useMemo(() => {
    let out = [...rows]

    out = out.filter((row) =>
      columns.every((col) => {
        const f = (filters[col.key] || '').trim().toLowerCase()
        if (!f) return true
        return String(col.value(row) ?? '')
          .toLowerCase()
          .includes(f)
      }),
    )

    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey)
      if (col) {
        out.sort((a, b) => {
          const av = String(col.value(a) ?? '')
          const bv = String(col.value(b) ?? '')

          if (sortKey === 'agingBucket') {
            const ar = ['90+', '61-90', '31-60', '0-30', 'Unknown'].indexOf(normalizeAgingBucket(av))
            const br = ['90+', '61-90', '31-60', '0-30', 'Unknown'].indexOf(normalizeAgingBucket(bv))
            return sortDir === 'asc' ? ar - br : br - ar
          }

          const an = Number(av)
          const bn = Number(bv)
          if (!Number.isNaN(an) && !Number.isNaN(bn) && av !== '' && bv !== '') {
            return sortDir === 'asc' ? an - bn : bn - an
          }

          const ad = Date.parse(av)
          const bd = Date.parse(bv)
          if (!Number.isNaN(ad) && !Number.isNaN(bd) && av !== '' && bv !== '') {
            return sortDir === 'asc' ? ad - bd : bd - ad
          }

          return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
        })
      }
    }

    if (limit && out.length > limit) return out.slice(0, limit)
    return out
  }, [rows, columns, filters, sortKey, sortDir, limit])

  const onSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir('asc')
      return
    }
    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        <p className="text-xs text-slate-400">Rows: {filteredSorted.length}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            {columns.map((col) => (
              <col key={col.key} style={{ width: col.width ?? 'auto' }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-slate-700 text-left text-slate-300">
              {columns.map((col) => (
                <th key={col.key} onClick={() => onSort(col.key)} className="cursor-pointer whitespace-nowrap px-2 py-2 font-semibold">
                  {col.label}
                  {sortKey === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ↕'}
                </th>
              ))}
            </tr>
            <tr className="border-b border-slate-800">
              {columns.map((col) => (
                <th key={col.key} className="px-2 py-2">
                  <input
                    value={filters[col.key] || ''}
                    onChange={(e) => setFilters((prev) => ({ ...prev, [col.key]: e.target.value }))}
                    placeholder="Filter..."
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 outline-none focus:border-cyan-500"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredSorted.map((row, idx) => (
              <tr key={idx} className="border-b border-slate-800 text-slate-200 hover:bg-slate-800/50">
                {columns.map((col) => (
                  <td key={col.key} className={`px-2 py-2 align-top ${col.width ? 'break-words' : 'whitespace-nowrap'}`}>
                    {col.render ? col.render(row) : String(col.value(row) ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

type SpotlightKey = 'initiatives' | 'overdue' | 'completed' | 'active' | 'all' | null
type PieSpotlight = { title: string; rows: Ticket[]; cols?: ColumnDef<Ticket>[] } | null

function SpotlightModal({ title, rows, columns, onClose }: { title: string; rows: Ticket[]; columns: ColumnDef<Ticket>[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-6xl overflow-auto rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-100">{title} <span className="ml-2 text-sm font-normal text-slate-400">({rows.length} tickets)</span></h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100">✕</button>
        </div>
        <div className="p-4">
          <SortableFilterableTable<Ticket> title="" rows={rows} columns={columns} defaultSortKey={columns[0]?.key} />
        </div>
      </div>
    </div>
  )
}

function App() {
  const { getToken } = useAuthToken()
  const { workspace, workspaces, switchWorkspace, createWorkspace, isAdmin } = useWorkspace()
  const [showNewWs, setShowNewWs] = useState(false)
  const [newWsName, setNewWsName] = useState('')
  const [creatingWs, setCreatingWs] = useState(false)
  const [reportData, setReportData] = useState<ReportShape>(data)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [hasInitialLoadCompleted, setHasInitialLoadCompleted] = useState(false)
  const [spotlight, setSpotlight] = useState<SpotlightKey>(null)
  const [pieSpotlight, setPieSpotlight] = useState<PieSpotlight>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'meetings' | 'reference' | 'settings'>('dashboard')
  const [projects, setProjects] = useState<Array<{ id: string; name: string; colour: string }>>([])

  const wsId = workspace?.id

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const token = await getToken()
        if (!token) return
        const res = await fetch(`${R2_URL}/config/projects.json`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'omit',
        })
        if (res.ok) setProjects(await res.json())
        else setProjects([])
      } catch { setProjects([]) }
    }
    loadProjects()
  }, [getToken, wsId])

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
  const { summary, tickets } = reportData
  const options = useMemo(periodOptions, [])
  const [periodKey, setPeriodKey] = useState<string>('ALL')
  const [dashTab, setDashTab] = useState<'my' | 'stakeholder' | 'completed' | 'decisions'>('my')
  const [decisionTickets, setDecisionTickets] = useState<Ticket[]>([])
  const [decisionsLoading, setDecisionsLoading] = useState(false)
  const [decisionsError, setDecisionsError] = useState<string | null>(null)

  useEffect(() => {
    if (dashTab !== 'decisions') return
    if (decisionTickets.length > 0) return  // already loaded for this workspace
    setDecisionsLoading(true)
    setDecisionsError(null)
    const loadDecisions = async () => {
      try {
        const token = await getToken()
        if (!token) throw new Error('Not authenticated')
        const projectKey = workspace?.jiraProjectKey
        const jiraInstance = workspace?.jiraInstanceUrl
        if (!projectKey) {
          setDecisionTickets([])
          return
        }
        const allIssues: any[] = []
        let nextPageToken: string | undefined
        while (true) {
          const page = await fetchJiraSearch(`project = ${projectKey} AND labels = decision ORDER BY created DESC`, 100, token, nextPageToken)
          const issues = Array.isArray(page?.issues) ? page.issues : []
          allIssues.push(...issues)
          if (issues.length === 0 || page?.isLast) break
          nextPageToken = page?.nextPageToken
          if (!nextPageToken) break
        }
        setDecisionTickets(allIssues.map(i => mapIssueToTicket(i, jiraInstance)))
      } catch (e: any) {
        setDecisionsError(e.message)
      } finally {
        setDecisionsLoading(false)
      }
    }
    loadDecisions()
  }, [dashTab, wsId])

  const selected = options.find((o) => o.key === periodKey) || options[0]

  const isDecision = (t: Ticket) => t.labels.includes('decision')

  const projectFilteredTickets = useMemo(() => {
    const nonDecision = tickets.filter((t) => !isDecision(t))
    if (selected.kind === 'all') return nonDecision
    return nonDecision.filter((t) => {
      const ref = toDate(t.startDate) || toDate(t.created)
      if (!ref) return false
      const y = ref.getFullYear()
      const q = quarterOf(ref)
      if (selected.kind === 'annual') return y === selected.year
      return y === selected.year && q === selected.quarter
    })
  }, [tickets, selected])

  const completedTickets = projectFilteredTickets.filter((t) => t.isDone)
  const ownerName = (summary.owner.name || '').toLowerCase()
  const ownerParts = ownerName.split(/\s+/).filter(Boolean)

  // "Mine" = assigned to the workspace owner, or project-key tickets where owner is the business contact
  const isMyTicket = (t: Ticket) => !t.assignee || !ownerName || t.assignee.toLowerCase().includes(ownerName) || ownerName.includes(t.assignee.toLowerCase())
  const isOwnerContact = (t: Ticket) => !t.businessContact || ownerParts.some((p: string) => t.businessContact!.toLowerCase().includes(p))
  const wsProjectKey = workspace?.jiraProjectKey || ''
  const isWsProject = (t: Ticket) => wsProjectKey ? t.key.startsWith(`${wsProjectKey}-`) : false

  const myAllTickets = projectFilteredTickets.filter((t) =>
    t.active && (isMyTicket(t) || (isWsProject(t) && isOwnerContact(t)))
  )
  // Stakeholder = active project-key tickets with non-owner business contact AND not assigned to owner
  const projectOtherTickets = projectFilteredTickets.filter((t) =>
    isWsProject(t) && t.active && !isMyTicket(t) && t.businessContact && !isOwnerContact(t)
  )
  const stakeholderNonProjectActive = projectFilteredTickets.filter((t) => t.active && !isWsProject(t) && !isMyTicket(t))
  const stakeholderNonProjectCompleted = projectFilteredTickets.filter((t) => t.isDone && !isWsProject(t) && !isMyTicket(t))
  const allStakeholderTickets = [...projectOtherTickets, ...stakeholderNonProjectActive]

  // My Tickets tab charts
  const projectTagSplit = groupCount(myAllTickets.filter((t) => isWsProject(t)), (r) => r.projectNameFromDesc || r.projectTag || 'Untagged')
  const brandSplit = groupCount(myAllTickets, (r) => r.brand)
  const agingSplit = sortAgingBuckets(groupCount(myAllTickets, (r) => r.agingBucket))

  // Stakeholder tab charts
  const stakeholderBrandSplit = groupCount(allStakeholderTickets, (r) => r.brand)
  const stakeholderAgingSplit = sortAgingBuckets(groupCount(allStakeholderTickets, (r) => r.agingBucket))
  const stakeholderProjectAreaSplit = groupCount(allStakeholderTickets, (r) => r.projectNameFromDesc || r.projectTag || 'Untagged')

  // Completed tab charts
  const completedBrandSplit = groupCount(completedTickets, (r) => r.brand)
  const completedResolutionSplit = groupCount(completedTickets, (r) => (r.resolved || '').slice(0, 7) || 'Unknown')

  const initiativeTickets = projectFilteredTickets.filter((t) => ['Initiative', 'Epic', 'Capability'].includes(t.issueType) || t.category === 'Strategic')
  const overdueTickets = projectFilteredTickets.filter((t) => t.isOverdue)
  const overdue = overdueTickets.length


  const columns: ColumnDef<Ticket>[] = [
    {
      key: 'key',
      label: 'Key',
      value: (r) => r.key,
      render: (r) => (
        <a href={r.url} target="_blank" rel="noreferrer" className="font-semibold text-cyan-300 underline">
          {r.key}
        </a>
      ),
    },
    { key: 'summary', label: 'Summary', value: (r) => r.summary, width: '30%' },
    { key: 'status', label: 'Status', value: (r) => r.status },
    {
      key: 'rag',
      label: 'RAG',
      value: (r) => r.rag,
      render: (r) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ragClass(r.rag)}`}>{r.rag}</span>,
    },
    { key: 'agingDays', label: 'Aging (days)', value: (r) => signedAgingDays(r.dueDate ?? r.endDate) ?? '' },
    { key: 'agingBucket', label: 'Aging Bucket', value: (r) => r.agingBucket },
    { key: 'endDate', label: 'End (Due date)', value: (r) => r.dueDate ?? r.endDate ?? '' },
    { key: 'assignee', label: 'Assignee', value: (r) => r.assignee ?? '' },
    { key: 'priority', label: 'Priority', value: (r) => r.priority ?? '' },
    { key: 'brand', label: 'Brand', value: (r) => r.brand },
    {
      key: 'project',
      label: 'Project',
      value: (r) => projectById.get(r.projectTag ?? '')?.name ?? r.projectNameFromDesc ?? r.projectTag ?? '',
      render: (r) => {
        const proj = projectById.get(r.projectTag ?? '')
        const name = proj?.name ?? r.projectNameFromDesc ?? r.projectTag ?? null
        if (!name) return <span className="text-slate-600">—</span>
        const colour = proj?.colour ?? '#94a3b8'
        return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: colour + '33', color: colour }}><span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: colour }} />{name}</span>
      },
    },
  ]

  const otherContactColumns: ColumnDef<Ticket>[] = [
    {
      key: 'key',
      label: 'Key',
      value: (r) => r.key,
      render: (r) => (
        <a href={r.url} target="_blank" rel="noreferrer" className="font-semibold text-cyan-300 underline">
          {r.key}
        </a>
      ),
    },
    { key: 'summary', label: 'Summary', value: (r) => r.summary, width: '30%' },
    { key: 'status', label: 'Status', value: (r) => r.status },
    {
      key: 'rag',
      label: 'RAG',
      value: (r) => r.rag,
      render: (r) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ragClass(r.rag)}`}>{r.rag}</span>,
    },
    { key: 'agingDays', label: 'Aging (days)', value: (r) => signedAgingDays(r.dueDate ?? r.endDate) ?? '' },
    { key: 'endDate', label: 'End (Due date)', value: (r) => r.dueDate ?? r.endDate ?? '' },
    { key: 'businessContact', label: 'Contact (Owner)', value: (r) => r.businessContact ?? '' },
    { key: 'priority', label: 'Priority', value: (r) => r.priority ?? '' },
    { key: 'brand', label: 'Brand', value: (r) => r.brand },
    {
      key: 'project',
      label: 'Project',
      value: (r) => projectById.get(r.projectTag ?? '')?.name ?? r.projectNameFromDesc ?? r.projectTag ?? '',
      render: (r) => {
        const proj = projectById.get(r.projectTag ?? '')
        const name = proj?.name ?? r.projectNameFromDesc ?? r.projectTag ?? null
        if (!name) return <span className="text-slate-600">—</span>
        const colour = proj?.colour ?? '#94a3b8'
        return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: colour + '33', color: colour }}><span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: colour }} />{name}</span>
      },
    },
  ]

  const decisionColumns: ColumnDef<Ticket>[] = [
    {
      key: 'key',
      label: 'Key',
      value: (r) => r.key,
      render: (r) => (
        <a href={r.url} target="_blank" rel="noreferrer" className="font-semibold text-violet-300 underline">
          {r.key}
        </a>
      ),
    },
    { key: 'summary', label: 'Decision', value: (r) => r.summary, width: '40%' },
    { key: 'businessContact', label: 'Owner', value: (r) => r.businessContact ?? '' },
    { key: 'startDate', label: 'Date Decided', value: (r) => r.startDate ?? '' },
    { key: 'projectNameFromDesc', label: 'Project', value: (r) => r.projectNameFromDesc ?? '' },
  ]

  const completedColumns: ColumnDef<Ticket>[] = [
    {
      key: 'key',
      label: 'Key',
      value: (r) => r.key,
      render: (r) => (
        <a href={r.url} target="_blank" rel="noreferrer" className="font-semibold text-cyan-300 underline">
          {r.key}
        </a>
      ),
    },
    { key: 'summary', label: 'Summary', value: (r) => r.summary, width: '30%' },
    { key: 'status', label: 'Status', value: (r) => r.status },
    {
      key: 'rag',
      label: 'RAG',
      value: (r) => r.rag,
      render: (r) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ragClass(r.rag)}`}>{r.rag}</span>,
    },
    { key: 'endDate', label: 'End (Due date)', value: (r) => r.dueDate ?? r.endDate ?? '' },
    { key: 'resolved', label: 'Resolved', value: (r) => r.resolved ?? '' },
    {
      key: 'deliveryOutcome',
      label: 'Delivered',
      value: (r) => deliveryOutcome(r.resolved, r.dueDate ?? r.endDate),
    },
    { key: 'assignee', label: 'Assignee', value: (r) => r.assignee ?? '' },
    { key: 'priority', label: 'Priority', value: (r) => r.priority ?? '' },
    { key: 'brand', label: 'Brand', value: (r) => r.brand },
  ]

  const spotlightData = useMemo((): { title: string; rows: Ticket[]; cols: ColumnDef<Ticket>[] } | null => {
    if (!spotlight) return null
    switch (spotlight) {
      case 'initiatives': return { title: 'Total Initiatives', rows: initiativeTickets, cols: columns }
      case 'overdue': return { title: 'Overdue Tickets', rows: overdueTickets, cols: columns }
      case 'completed': return { title: 'Completed Tickets', rows: completedTickets, cols: completedColumns }
      case 'active': return { title: 'Active Tickets', rows: myAllTickets, cols: columns }
      case 'all': return { title: 'All Tickets', rows: projectFilteredTickets, cols: columns }
      default: return null
    }
  }, [spotlight, projectFilteredTickets, initiativeTickets, overdueTickets, completedTickets, myAllTickets, columns, completedColumns])

  const onRefresh = async () => {
    setIsRefreshing(true)
    setRefreshError(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const latest = await refreshFromJira(reportData, {
        token,
        accountId: workspace?.jiraAccountId,
        defaultJql: workspace?.jiraDefaultJql,
        jiraInstanceUrl: workspace?.jiraInstanceUrl,
        brands: workspace?.brands,
      })
      setReportData(latest)
    } catch (err: any) {
      setRefreshError(err?.message || 'Failed to refresh')
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    // Reset dashboard state when workspace changes
    setReportData(data)
    setDecisionTickets([])
    setHasInitialLoadCompleted(false)
    setRefreshError(null)
    setSpotlight(null)
    setPieSpotlight(null)

    const runInitialRefresh = async () => {
      setIsRefreshing(true)
      try {
        const token = await getToken()
        if (!token) throw new Error('Not authenticated')
        const latest = await refreshFromJira(data, {
          token,
          accountId: workspace?.jiraAccountId,
          defaultJql: workspace?.jiraDefaultJql,
          jiraInstanceUrl: workspace?.jiraInstanceUrl,
          brands: workspace?.brands,
        })
        setReportData(latest)
      } catch (err: any) {
        setRefreshError(err?.message || 'Failed to refresh')
      } finally {
        setIsRefreshing(false)
        setHasInitialLoadCompleted(true)
      }
    }
    void runInitialRefresh()
    // Re-run when workspace changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,#0f2a5a_0%,#030b1f_40%,#020617_100%)] p-4 text-slate-100 md:p-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white">Personal Planning Dashboard</h1>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${activeTab === 'dashboard' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >Dashboard</button>
              <button
                onClick={() => setActiveTab('meetings')}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${activeTab === 'meetings' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >Meetings</button>
              <button
                onClick={() => setActiveTab('reference')}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${activeTab === 'reference' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >Reference Docs</button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${activeTab === 'settings' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >Settings</button>
            </div>
            {summary.scopeNote && <p className="mt-1 text-sm text-slate-400">{summary.scopeNote}</p>}
            <p className="mt-1 text-xs text-slate-500">
              Owner: {summary.owner.name} | Generated: {new Date(summary.generatedAt).toLocaleString()}
            </p>
            {refreshError ? <p className="mt-1 text-xs text-rose-300">Refresh failed: {refreshError}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {!hasInitialLoadCompleted ? (
              <span className="rounded-xl border border-amber-600/50 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200">
                {isRefreshing ? 'Loading latest Jira data...' : 'Starting data load...'}
              </span>
            ) : null}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="rounded-xl border border-cyan-700 bg-cyan-600/20 px-3 py-2 text-sm font-semibold text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <select
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
            >
              {options.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            {workspaces.length > 1 ? (
              <select
                value={workspace?.id || ''}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setShowNewWs(true)
                  } else {
                    switchWorkspace(e.target.value)
                  }
                }}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
                {isAdmin && <option value="__new__">+ New Workspace</option>}
              </select>
            ) : (
              <span className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                {workspace?.name || 'Workspace'}
              </span>
            )}
            {isAdmin && workspaces.length <= 1 && (
              <button
                onClick={() => setShowNewWs(true)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-400 hover:border-cyan-600 hover:text-slate-200"
              >
                + New
              </button>
            )}
            <UserButton afterSignOutUrl="/" />
          </div>
          {showNewWs && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                placeholder="New workspace name"
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setShowNewWs(false); setNewWsName('') }
                }}
              />
              <button
                onClick={async () => {
                  if (!newWsName.trim()) return
                  setCreatingWs(true)
                  try {
                    await createWorkspace(newWsName.trim())
                    setNewWsName('')
                    setShowNewWs(false)
                  } catch {}
                  finally { setCreatingWs(false) }
                }}
                disabled={creatingWs || !newWsName.trim()}
                className="rounded-xl border border-cyan-700 bg-cyan-600/20 px-3 py-2 text-sm font-semibold text-cyan-200 disabled:opacity-50"
              >
                {creatingWs ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => { setShowNewWs(false); setNewWsName('') }}
                className="rounded-lg px-2 py-1 text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
          )}
        </header>

        {activeTab === 'meetings' ? <MeetingsTab /> : null}
        {activeTab === 'reference' ? <ReferenceDocsTab /> : null}
        {activeTab === 'settings' ? <SettingsTab /> : null}

        {activeTab === 'dashboard' ? <><section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <button onClick={() => setSpotlight('all')} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-sky-700 hover:bg-slate-800/70">
            <p className="text-sm text-slate-400">All Tickets</p>
            <p className="mt-1 text-4xl font-bold text-sky-300">{projectFilteredTickets.length}</p>
            <p className="mt-1 text-xs text-slate-400">Active: {projectFilteredTickets.filter((t) => t.active).length} | Completed: {completedTickets.length}</p>
          </button>
          <button onClick={() => setSpotlight('completed')} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-emerald-700 hover:bg-slate-800/70"><p className="text-sm text-slate-400">Completed</p><p className="mt-1 text-4xl font-bold text-emerald-300">{completedTickets.length}</p></button>
          <button onClick={() => setSpotlight('overdue')} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-rose-700 hover:bg-slate-800/70"><p className="text-sm text-slate-400">Overdue</p><p className="mt-1 text-4xl font-bold text-rose-300">{overdue}</p></button>
          <button onClick={() => setSpotlight('active')} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-violet-700 hover:bg-slate-800/70"><p className="text-sm text-slate-400">Active</p><p className="mt-1 text-4xl font-bold text-violet-300">{projectFilteredTickets.filter((t) => t.active).length}</p></button>
        </section>

        {spotlightData ? (
          <SpotlightModal
            title={spotlightData.title}
            rows={spotlightData.rows}
            columns={spotlightData.cols}
            onClose={() => setSpotlight(null)}
          />
        ) : null}

        {pieSpotlight ? (
          <SpotlightModal
            title={pieSpotlight.title}
            rows={pieSpotlight.rows}
            columns={pieSpotlight.cols ?? columns}
            onClose={() => setPieSpotlight(null)}
          />
        ) : null}

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {dashTab === 'my' && <>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <h2 className="mb-3 text-lg font-semibold">Brand Scope</h2>
              <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={brandSplit} dataKey="value" nameKey="name" outerRadius={90} cursor="pointer" onClick={(e) => setPieSpotlight({ title: `Brand: ${e.name}`, rows: myAllTickets.filter((t) => t.brand === e.name) })}>{brandSplit.map((e, i) => <Cell key={e.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
              <ClickablePieLegend data={brandSplit} onSelect={(name) => setPieSpotlight({ title: `Brand: ${name}`, rows: myAllTickets.filter((t) => t.brand === name) })} />
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <h2 className="mb-3 text-lg font-semibold">Ticket Aging</h2>
              <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={agingSplit} dataKey="value" nameKey="name" outerRadius={90} cursor="pointer" onClick={(e) => setPieSpotlight({ title: `Aging: ${e.name}`, rows: myAllTickets.filter((t) => normalizeAgingBucket(t.agingBucket) === e.name) })}>{agingSplit.map((e, i) => <Cell key={e.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
              <ClickablePieLegend data={agingSplit} onSelect={(name) => setPieSpotlight({ title: `Aging: ${name}`, rows: myAllTickets.filter((t) => normalizeAgingBucket(t.agingBucket) === name) })} />
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <h2 className="mb-3 text-lg font-semibold">Project Area</h2>
              <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={projectTagSplit} dataKey="value" nameKey="name" outerRadius={90} cursor="pointer" onClick={(e) => setPieSpotlight({ title: `Project Area: ${e.name}`, rows: myAllTickets.filter((t) => (t.projectNameFromDesc || t.projectTag || 'Untagged') === e.name) })}>{projectTagSplit.map((e, i) => <Cell key={e.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
              <ClickablePieLegend data={projectTagSplit} onSelect={(name) => setPieSpotlight({ title: `Project Area: ${name}`, rows: myAllTickets.filter((t) => (t.projectNameFromDesc || t.projectTag || 'Untagged') === name) })} />
            </div>
          </>}
          {dashTab === 'stakeholder' && <>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <h2 className="mb-3 text-lg font-semibold">Brand Scope</h2>
              <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stakeholderBrandSplit} dataKey="value" nameKey="name" outerRadius={90} cursor="pointer" onClick={(e) => setPieSpotlight({ title: `Brand: ${e.name}`, rows: allStakeholderTickets.filter((t) => t.brand === e.name) })}>{stakeholderBrandSplit.map((e, i) => <Cell key={e.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
              <ClickablePieLegend data={stakeholderBrandSplit} onSelect={(name) => setPieSpotlight({ title: `Brand: ${name}`, rows: allStakeholderTickets.filter((t) => t.brand === name) })} />
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <h2 className="mb-3 text-lg font-semibold">Ticket Aging</h2>
              <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stakeholderAgingSplit} dataKey="value" nameKey="name" outerRadius={90} cursor="pointer" onClick={(e) => setPieSpotlight({ title: `Aging: ${e.name}`, rows: allStakeholderTickets.filter((t) => normalizeAgingBucket(t.agingBucket) === e.name) })}>{stakeholderAgingSplit.map((e, i) => <Cell key={e.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
              <ClickablePieLegend data={stakeholderAgingSplit} onSelect={(name) => setPieSpotlight({ title: `Aging: ${name}`, rows: allStakeholderTickets.filter((t) => normalizeAgingBucket(t.agingBucket) === name) })} />
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <h2 className="mb-3 text-lg font-semibold">Project Area</h2>
              <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stakeholderProjectAreaSplit} dataKey="value" nameKey="name" outerRadius={90} cursor="pointer" onClick={(e) => setPieSpotlight({ title: `Project Area: ${e.name}`, rows: allStakeholderTickets.filter((t) => (t.projectNameFromDesc || t.projectTag || 'Untagged') === e.name) })}>{stakeholderProjectAreaSplit.map((e, i) => <Cell key={e.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
              <ClickablePieLegend data={stakeholderProjectAreaSplit} onSelect={(name) => setPieSpotlight({ title: `Project Area: ${name}`, rows: allStakeholderTickets.filter((t) => (t.projectNameFromDesc || t.projectTag || 'Untagged') === name) })} />
            </div>
          </>}
          {dashTab === 'completed' && <>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <h2 className="mb-3 text-lg font-semibold">Brand Scope</h2>
              <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={completedBrandSplit} dataKey="value" nameKey="name" outerRadius={90} cursor="pointer" onClick={(e) => setPieSpotlight({ title: `Brand: ${e.name}`, rows: completedTickets.filter((t) => t.brand === e.name) })}>{completedBrandSplit.map((e, i) => <Cell key={e.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
              <ClickablePieLegend data={completedBrandSplit} onSelect={(name) => setPieSpotlight({ title: `Brand: ${name}`, rows: completedTickets.filter((t) => t.brand === name) })} />
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <h2 className="mb-3 text-lg font-semibold">Resolved By Month</h2>
              <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={completedResolutionSplit} dataKey="value" nameKey="name" outerRadius={90} cursor="pointer" onClick={(e) => setPieSpotlight({ title: `Resolved: ${e.name}`, rows: completedTickets.filter((t) => (t.resolved || '').slice(0, 7) === e.name) })}>{completedResolutionSplit.map((e, i) => <Cell key={e.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
              <ClickablePieLegend data={completedResolutionSplit} onSelect={(name) => setPieSpotlight({ title: `Resolved: ${name}`, rows: completedTickets.filter((t) => (t.resolved || '').slice(0, 7) === name) })} />
            </div>
          </>}
          {dashTab === 'decisions' && decisionTickets.length > 0 && (() => {
            const decByProject = groupCount(decisionTickets, (r) => r.projectNameFromDesc || r.projectTag || 'Untagged')
            return <>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <h2 className="mb-3 text-lg font-semibold">By Project</h2>
                <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={decByProject} dataKey="value" nameKey="name" outerRadius={90} cursor="pointer" onClick={(e) => setPieSpotlight({ title: `Project: ${e.name}`, rows: decisionTickets.filter((t) => (t.projectNameFromDesc || t.projectTag || 'Untagged') === e.name), cols: decisionColumns })}>{decByProject.map((e, i) => <Cell key={e.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
                <ClickablePieLegend data={decByProject} onSelect={(name) => setPieSpotlight({ title: `Project: ${name}`, rows: decisionTickets.filter((t) => (t.projectNameFromDesc || t.projectTag || 'Untagged') === name), cols: decisionColumns })} />
              </div>
            </>
          })()}
        </section>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70">
          <div className="flex border-b border-slate-800">
            {([['my', 'My Tickets'], ['stakeholder', 'Stakeholder'], ['completed', 'Completed'], ['decisions', 'Decisions']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setDashTab(key)}
                className={`px-6 py-3 text-sm font-medium transition-colors ${dashTab === key ? 'border-b-2 border-cyan-400 text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="p-4">
            {dashTab === 'my' && <>
              <SortableFilterableTable<Ticket>
                title="My Tickets"
                rows={myAllTickets}
                columns={columns}
                defaultSortKey="agingDays"
                defaultSortDir="desc"
              />
            </>}
            {dashTab === 'stakeholder' && <>
              <SortableFilterableTable<Ticket>
                title="Stakeholder Commitments"
                rows={[...projectOtherTickets, ...stakeholderNonProjectActive]}
                columns={otherContactColumns}
                defaultSortKey="agingDays"
                defaultSortDir="desc"
              />
              <SortableFilterableTable<Ticket>
                title="Completed"
                rows={stakeholderNonProjectCompleted}
                columns={completedColumns}
                defaultSortKey="resolved"
                defaultSortDir="desc"
              />
            </>}
            {dashTab === 'completed' && <SortableFilterableTable<Ticket>
              title="Completed Tickets"
              rows={completedTickets}
              columns={completedColumns}
              defaultSortKey="resolved"
              defaultSortDir="desc"
            />}
            {dashTab === 'decisions' && (
              decisionsLoading ? (
                <div className="flex items-center gap-2 py-8 text-slate-400">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-violet-400" />
                  Loading decisions from Jira...
                </div>
              ) : decisionsError ? (
                <div className="space-y-2 py-4">
                  <p className="text-sm text-rose-400">Failed to load decisions: {decisionsError}</p>
                  <button
                    onClick={() => { setDecisionTickets([]); setDecisionsError(null); setDashTab('my'); setTimeout(() => setDashTab('decisions'), 50) }}
                    className="text-xs text-violet-400 hover:text-violet-300"
                  >Retry</button>
                </div>
              ) : (
                <SortableFilterableTable<Ticket>
                  title="Decisions"
                  rows={decisionTickets}
                  columns={decisionColumns}
                  defaultSortKey="created"
                  defaultSortDir="desc"
                />
              )
            )}
          </div>
        </div></> : null}
      </div>
    </div>
  )
}

export default App

