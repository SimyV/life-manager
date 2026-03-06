import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import report from './data/reportData.json'
import MeetingsTab from './MeetingsTab'

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
  priority: string | null
  agingDays: number | null
  agingBucket: string
  isDone: boolean
  isOverdue: boolean
  stream: 'Demand' | 'Delivery'
  category: 'Strategic' | 'Tactical' | 'Ad hoc'
  brand: string
  active: boolean
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
}

type PeriodOption = {
  key: string
  label: string
  kind: 'all' | 'quarter' | 'annual'
  year: number
  quarter?: number
}

const data = report as ReportShape
const USER_ID = (import.meta as any).env?.VITE_USER_ID || ''
const GOOGLE_SIGN_IN_URL = (import.meta as any).env?.VITE_GOOGLE_SIGN_IN_URL || ''
const JIRA_PROXY_BASE = ((import.meta as any).env?.VITE_JIRA_PROXY_BASE || '/api/proxy/jira').replace(/\/$/, '')
const PIE_COLORS = ['#38bdf8', '#22c55e', '#f59e0b', '#ef4444', '#a78bfa', '#14b8a6', '#f43f5e', '#8b5cf6']
const PROJECT_TYPE_OPTIONS = ['All Project Types', 'AI', 'Not yet classified', 'Operational/Tactical', 'Regulatory/Compliance', 'Strategic']

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

function isWithinLast24Hours(value: string | null): boolean {
  const d = toDate(value)
  if (!d) return false
  const now = Date.now()
  const ageMs = now - d.getTime()
  return ageMs >= 0 && ageMs <= 24 * 60 * 60 * 1000
}

function deriveBrand(labels: string[], brands: string[]): string {
  const hay = [...labels, ...brands].join(' ').toLowerCase()
  if (hay.includes('selleys')) return 'Selleys'
  if (hay.includes('yates')) return 'Yates'
  return 'Other'
}

async function fetchJiraSearch(jql: string, maxResults: number, nextPageToken?: string): Promise<any> {
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
    'customfield_11588',
    'customfield_11768',
    'customfield_12577',
  ].join(',')
  const qs = new URLSearchParams({
    jql,
    maxResults: String(maxResults),
    fields,
  })
  if (nextPageToken) qs.set('nextPageToken', nextPageToken)

  const baseUrl = (import.meta as any).env?.BASE_URL || '/'
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const proxyBases = Array.from(
    new Set([JIRA_PROXY_BASE, `${normalizedBase}/proxy/jira`, '/proxy/jira', '/api/proxy/jira'].filter(Boolean)),
  )
  const candidates = proxyBases.map(
    (proxyBase) => new URL(`${proxyBase}/rest/api/3/search/jql?${qs.toString()}`, window.location.origin).toString(),
  )
  const errors: string[] = []

  for (const url of candidates) {
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      }
      if (USER_ID) headers['X-User-ID'] = USER_ID

      const res = await fetch(url, {
        headers,
        credentials: 'include',
      })
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const body = await res.json()
        if (!res.ok) {
          const msg = body?.message || body?.error || `HTTP ${res.status}`
          throw new Error(String(msg))
        }
        return body
      }
      const text = await res.text()
      if (text.includes('Sign In Required')) {
        throw new Error('Session expired in preview, please refresh page and sign in again.')
      }
      throw new Error(`Non-JSON response (HTTP ${res.status})`)
    } catch (err: any) {
      errors.push(`${url}: ${err?.message || 'request failed'}`)
    }
  }

  throw new Error(errors.join(' | '))
}

function mapIssueToTicket(issue: any): Ticket {
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
    url: `https://duluxgroup.atlassian.net/browse/${issue.key}`,
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
    priority: f.priority?.name || null,
    agingDays: age,
    agingBucket: bucketFromSignedAgingDays(age),
    isDone,
    isOverdue: age !== null && age > 0,
    stream: 'Demand',
    category,
    brand: deriveBrand(labels, allBrandTokens),
    active: !isDone,
  }
}

async function refreshFromJira(prev: ReportShape): Promise<ReportShape> {
  const jqlPrimary = [
    '(assignee = currentUser() OR reporter = currentUser())',
    'OR (project in (EPM, DLWLC) AND statusCategory != Done AND ("Brands/Function" ~ "Selleys" OR "Brands/Function" ~ "Yates"))',
    'OR ("Project Type" = "AI")',
  ].join(' ')
  const owner = prev.summary.owner.name || ''
  const jqlFallback = owner
    ? [
        `(assignee = "${owner}" OR reporter = "${owner}")`,
        'OR (project in (EPM, DLWLC) AND statusCategory != Done AND ("Brands/Function" ~ "Selleys" OR "Brands/Function" ~ "Yates"))',
        'OR ("Project Type" = "AI")',
      ].join(' ')
    : jqlPrimary

  const runQuery = async (jql: string): Promise<any[]> => {
    const allIssues: any[] = []
    const maxResults = 100
    let nextPageToken: string | undefined

    while (true) {
      const page = await fetchJiraSearch(jql, maxResults, nextPageToken)
      const issues = Array.isArray(page?.issues) ? page.issues : Array.isArray(page) ? page : []
      allIssues.push(...issues)
      if (issues.length === 0 || page?.isLast) break
      nextPageToken = page?.nextPageToken
      if (!nextPageToken) break
    }

    return allIssues
  }

  let allIssues = await runQuery(jqlPrimary)
  if (allIssues.length === 0) {
    allIssues = await runQuery(jqlFallback)
  }

  if (allIssues.length === 0) {
    throw new Error('Refresh returned zero tickets; keeping previous dashboard data.')
  }

  const refreshedTickets = allIssues.map(mapIssueToTicket)
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

function PieLegendList({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
      {data.map((row, idx) => (
        <div key={row.name} className="flex items-center justify-between rounded bg-slate-950/60 px-2 py-1 text-slate-200">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
            />
            <span className="truncate">{row.name}</span>
          </div>
          <span className="ml-2 font-semibold text-slate-100">{row.value}</span>
        </div>
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
        <table className="min-w-full text-sm">
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
                  <td key={col.key} className="whitespace-nowrap px-2 py-2 align-top">
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

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'meetings'>('dashboard')
  const [reportData, setReportData] = useState<ReportShape>(data)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [hasInitialLoadCompleted, setHasInitialLoadCompleted] = useState(false)
  const { summary, tickets } = reportData
  const options = useMemo(periodOptions, [])
  const [periodKey, setPeriodKey] = useState<string>('ALL')
  const [selectedProjectType, setSelectedProjectType] = useState<string>('All Project Types')

  const selected = options.find((o) => o.key === periodKey) || options[0]

  const periodTickets = useMemo(() => {
    if (selected.kind === 'all') return tickets
    return tickets.filter((t) => {
      const ref = toDate(t.startDate) || toDate(t.created)
      if (!ref) return false
      const y = ref.getFullYear()
      const q = quarterOf(ref)
      if (selected.kind === 'annual') return y === selected.year
      return y === selected.year && q === selected.quarter
    })
  }, [tickets, selected])

  const projectFilteredTickets = useMemo(() => {
    if (selectedProjectType === 'All Project Types') return periodTickets
    return periodTickets.filter((t) => (t.projectTypeValue || 'Not yet classified') === selectedProjectType)
  }, [periodTickets, selectedProjectType])

  const activeTickets = projectFilteredTickets.filter((t) => t.active)
  const completedTickets = projectFilteredTickets.filter((t) => t.isDone)

  const projectTypeSplit = groupCount(projectFilteredTickets, (r) => r.projectTypeValue || 'Not yet classified')
  const brandSplit = groupCount(projectFilteredTickets, (r) => r.brand)
  const agingSplit = sortAgingBuckets(groupCount(activeTickets, (r) => r.agingBucket))

  const totalInitiatives = projectFilteredTickets.filter((t) => ['Initiative', 'Epic', 'Capability'].includes(t.issueType) || t.category === 'Strategic').length
  const overdue = projectFilteredTickets.filter((t) => t.isOverdue).length
  const completed = projectFilteredTickets.filter((t) => t.isDone).length
  const newTicketsLast24h = projectFilteredTickets.filter((t) => isWithinLast24Hours(t.created))

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
    { key: 'summary', label: 'Summary', value: (r) => r.summary },
    { key: 'status', label: 'Status', value: (r) => r.status },
    {
      key: 'rag',
      label: 'RAG',
      value: (r) => r.rag,
      render: (r) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ragClass(r.rag)}`}>{r.rag}</span>,
    },
    { key: 'agingDays', label: 'Aging (days)', value: (r) => signedAgingDays(r.dueDate ?? r.endDate) ?? '' },
    { key: 'agingBucket', label: 'Aging Bucket', value: (r) => r.agingBucket },
    { key: 'startDate', label: 'Start', value: (r) => r.startDate ?? '' },
    { key: 'endDate', label: 'End (Due date)', value: (r) => r.dueDate ?? r.endDate ?? '' },
    { key: 'assignee', label: 'Assignee', value: (r) => r.assignee ?? '' },
    { key: 'reporter', label: 'Reporter', value: (r) => r.reporter ?? '' },
    { key: 'priority', label: 'Priority', value: (r) => r.priority ?? '' },
    { key: 'issueType', label: 'Type', value: (r) => r.issueType },
    { key: 'category', label: 'Category', value: (r) => r.category },
    { key: 'stream', label: 'Demand/Delivery', value: (r) => r.stream },
    { key: 'brand', label: 'Brand', value: (r) => r.brand },
    { key: 'projectKey', label: 'Project', value: (r) => r.projectKey },
    { key: 'projectType', label: 'Project Type', value: (r) => r.projectTypeValue || 'Not yet classified' },
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
    { key: 'summary', label: 'Summary', value: (r) => r.summary },
    { key: 'status', label: 'Status', value: (r) => r.status },
    { key: 'startDate', label: 'Start', value: (r) => r.startDate ?? '' },
    { key: 'dueDate', label: 'Due Date', value: (r) => r.dueDate ?? r.endDate ?? '' },
    { key: 'resolved', label: 'Resolved', value: (r) => r.resolved ?? '' },
    {
      key: 'deliveryOutcome',
      label: 'Delivered',
      value: (r) => deliveryOutcome(r.resolved, r.dueDate ?? r.endDate),
    },
    { key: 'assignee', label: 'Assignee', value: (r) => r.assignee ?? '' },
    { key: 'reporter', label: 'Reporter', value: (r) => r.reporter ?? '' },
    { key: 'issueType', label: 'Type', value: (r) => r.issueType },
    { key: 'category', label: 'Category', value: (r) => r.category },
    { key: 'brand', label: 'Brand', value: (r) => r.brand },
    { key: 'projectKey', label: 'Project', value: (r) => r.projectKey },
    { key: 'projectType', label: 'Project Type', value: (r) => r.projectTypeValue || 'Not yet classified' },
  ]

  const newTicketColumns: ColumnDef<Ticket>[] = [
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
    { key: 'summary', label: 'Summary', value: (r) => r.summary },
    { key: 'status', label: 'Status', value: (r) => r.status },
    {
      key: 'created',
      label: 'Created',
      value: (r) => (r.created ? new Date(r.created).toLocaleString() : ''),
    },
    { key: 'assignee', label: 'Assignee', value: (r) => r.assignee ?? '' },
    { key: 'issueType', label: 'Type', value: (r) => r.issueType },
    { key: 'projectKey', label: 'Project', value: (r) => r.projectKey },
  ]

  const onRefresh = async () => {
    setIsRefreshing(true)
    setRefreshError(null)
    try {
      const latest = await refreshFromJira(reportData)
      setReportData(latest)
    } catch (err: any) {
      setRefreshError(err?.message || 'Failed to refresh')
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    const runInitialRefresh = async () => {
      await onRefresh()
      setHasInitialLoadCompleted(true)
    }
    void runInitialRefresh()
    // Run once on initial page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,#0f2a5a_0%,#030b1f_40%,#020617_100%)] p-4 text-slate-100 md:p-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        {/* Tab switcher */}
        <div className="flex gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'dashboard' ? 'bg-cyan-600/30 text-cyan-200 border border-cyan-700' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Jira Dashboard
          </button>
          <button
            onClick={() => setActiveTab('meetings')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'meetings' ? 'bg-cyan-600/30 text-cyan-200 border border-cyan-700' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Meeting Intelligence
          </button>
        </div>

        {/* Meetings tab */}
        {activeTab === 'meetings' && (
          <div>
            <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
              <h1 className="text-4xl font-bold tracking-tight text-white">Meeting Intelligence</h1>
              <p className="mt-1 text-sm text-slate-400">Upload a Copilot meeting extract to extract actions, create Jira tickets, and draft follow-up emails.</p>
            </div>
            <MeetingsTab />
          </div>
        )}

        {/* Dashboard tab */}
        {activeTab === 'dashboard' && <>
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white">Jira Work Intelligence</h1>
            <p className="mt-1 text-sm text-slate-400">{summary.scopeNote}</p>
            <p className="mt-1 text-xs text-slate-500">
              Owner: {summary.owner.name} | Generated: {new Date(summary.generatedAt).toLocaleString()}
            </p>
            {!USER_ID ? (
              <p className="mt-1 text-xs text-amber-300">Setup hint: set `VITE_USER_ID` to use authenticated Jira proxy requests.</p>
            ) : null}
            {refreshError ? <p className="mt-1 text-xs text-rose-300">Refresh failed: {refreshError}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            {GOOGLE_SIGN_IN_URL ? (
              <a
                href={GOOGLE_SIGN_IN_URL}
                className="rounded-xl border border-emerald-700 bg-emerald-600/20 px-3 py-2 text-sm font-semibold text-emerald-200"
              >
                Sign in with Google
              </a>
            ) : null}
            <select
              value={selectedProjectType}
              onChange={(e) => setSelectedProjectType(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
            >
              {PROJECT_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
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
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><p className="text-sm text-slate-400">Total Initiatives</p><p className="mt-1 text-4xl font-bold text-cyan-300">{totalInitiatives}</p></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><p className="text-sm text-slate-400">Overdue</p><p className="mt-1 text-4xl font-bold text-rose-300">{overdue}</p></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><p className="text-sm text-slate-400">Completed</p><p className="mt-1 text-4xl font-bold text-emerald-300">{completed}</p></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><p className="text-sm text-slate-400">Active</p><p className="mt-1 text-4xl font-bold text-violet-300">{activeTickets.length}</p></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><p className="text-sm text-slate-400">New (24h)</p><p className="mt-1 text-4xl font-bold text-amber-300">{newTicketsLast24h.length}</p></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-sm text-slate-400">All Tickets</p>
            <p className="mt-1 text-4xl font-bold text-sky-300">{projectFilteredTickets.length}</p>
            <p className="mt-1 text-xs text-slate-400">Active: {activeTickets.length} | Completed: {completed}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><p className="text-sm text-slate-400">View</p><p className="mt-1 text-2xl font-bold text-amber-300">{selected.label}</p><p className="text-xs text-slate-400">{selectedProjectType}</p></div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="mb-3 text-lg font-semibold">Project Type Split</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={projectTypeSplit} dataKey="value" nameKey="name" outerRadius={90}>
                    {projectTypeSplit.map((entry, idx) => (
                      <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <PieLegendList data={projectTypeSplit} />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="mb-3 text-lg font-semibold">Brand Split</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={brandSplit} dataKey="value" nameKey="name" outerRadius={90}>
                    {brandSplit.map((entry, idx) => (
                      <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <PieLegendList data={brandSplit} />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="mb-3 text-lg font-semibold">Aging Split (Pie)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={agingSplit} dataKey="value" nameKey="name" outerRadius={90}>
                    {agingSplit.map((entry, idx) => (
                      <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <PieLegendList data={agingSplit} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="mb-3 text-lg font-semibold">Aging (Active Tickets)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingSplit}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#cbd5e1" />
                <YAxis allowDecimals={false} stroke="#cbd5e1" />
                <Tooltip />
                <Bar dataKey="value" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <SortableFilterableTable<Ticket>
          title="New Tickets (Last 24 Hours)"
          rows={newTicketsLast24h}
          columns={newTicketColumns}
          defaultSortKey="created"
          defaultSortDir="desc"
        />

        <SortableFilterableTable<Ticket>
          title="Active Tickets / Initiatives"
          rows={activeTickets}
          columns={columns}
          defaultSortKey="agingDays"
          defaultSortDir="desc"
        />
        <SortableFilterableTable<Ticket>
          title="Completed Tickets"
          rows={completedTickets}
          columns={completedColumns}
          defaultSortKey="resolved"
          defaultSortDir="desc"
        />
        </>}
      </div>
    </div>
  )
}

export default App
