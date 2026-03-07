import React, { useState, useEffect, useRef, useMemo } from 'react';
import { unzipSync } from 'fflate';
import { useWorkspace } from './WorkspaceContext';
import { useAuthToken } from './AuthContext';

// ── Constants ──────────────────────────────────────────────────────────────────
const R2_URL = ((import.meta as any).env?.VITE_R2_URL || 'https://r2.bashai.io').replace(/\/$/, '');
const OUTLOOK_BRIDGE_URL = ((import.meta as any).env?.VITE_OUTLOOK_BRIDGE_URL || 'https://outlook-bridge.bashai.io').replace(/\/$/, '');
const OUTLOOK_API_KEY = (import.meta as any).env?.VITE_OUTLOOK_API_KEY || 'my-secret-key-123';
const PROJECT_COLORS = ['#38bdf8', '#22c55e', '#f59e0b', '#a78bfa', '#f43f5e', '#14b8a6', '#fb923c', '#e879f9'];

// ── Types ──────────────────────────────────────────────────────────────────────
type Contact = { name: string; email: string };
type Project = { id: string; name: string; colour: string };
type ActionItem = { description: string; owner: string; dueDate: string; isSimon: boolean };
type MeetingData = {
  id?: string;
  title: string;
  date: string;
  participants: string[];
  keyPoints: string[];
  decisions: string[];
  actionItems: ActionItem[];
  nextSteps: string[];
  rawText?: string;
  parsedAt?: string;
  emailBody?: string;
  uploadedAt?: string;
  sourceFile?: string;
  jiraTickets?: Record<string, string>;
  decisionJiraTickets?: Record<string, string>;
  decisionItems?: { description: string; owner: string }[];
  docxKey?: string;
  projectId?: string;
};
type RefDoc = {
  key: string;
  fileName: string;
  displayName: string;
  category: string;
  size: number;
  parsed: boolean;
  uploadedAt?: string;
};
type PendingFile = { id: string; file: File; category: string };
type BoardRecord = {
  boardId: string;
  title: string;
  viewLink: string;
  prompt?: string;
  generatedAt?: string;
  meetingTitle?: string;
  meetingDate?: string;
  nodeCount?: number;
  aiNodeCount?: number;
  edgeCount?: number;
  aiEdgeCount?: number;
  nodeErrors?: any[];
  edgeErrors?: any[];
};
type PriorityOption = {
  label: string;
  jiraPriority: string;
  prioritisation: string;
  tshirt: string;
  urgency: string;
};

// ── Option arrays ──────────────────────────────────────────────────────────────
const SBU_OPTIONS = ['B&D', 'DGL International', 'Dulux Paint & Coating', 'DuluxGroup Corporate', 'Lincoln Sentry', 'Selleys', 'Yates'];

const PRIORITY_OPTIONS: PriorityOption[] = [
  { label: 'P1 — Critical', jiraPriority: 'Critical', prioritisation: 'P1', tshirt: 'S = ($20-60k 1-3 months)', urgency: 'Critical' },
  { label: 'P2 — High', jiraPriority: 'High', prioritisation: 'P2', tshirt: 'S = ($20-60k 1-3 months)', urgency: 'High' },
  { label: 'P3 — Medium', jiraPriority: 'Medium', prioritisation: 'P3', tshirt: 'Xs = <1Month', urgency: 'Medium' },
  { label: 'P4 — Low', jiraPriority: 'Low', prioritisation: 'P4', tshirt: 'Xs = <1Month', urgency: 'Low' },
];

const DOC_CATEGORIES = ['UML', 'Enterprise Architecture', 'Solution Architecture', 'Service Design', 'Code Development', 'Business Analysis', 'Data Architecture', 'Infrastructure', 'Process & Workflow', 'Other'];

const MIRO_EXAMPLES = [
  'C4 L1 context diagram showing how LeanIX integrates with ServiceNow and SAP',
  'Process map of the order fulfilment flow with swim lanes for warehouse, dispatch and customer',
  'UML sequence diagram of the OAuth 2.0 auth flow between client, MuleSoft and SAP',
  'UML class diagram of the core domain entities: Product, Order, Customer, Inventory',
  'EA capability map across the five domains with colour coding by maturity',
];

// ── Utility functions ──────────────────────────────────────────────────────────
async function loadProjects(): Promise<Project[]> {
  try {
    const res = await r2Fetch('/config/projects.json');
    return res.ok ? res.json() : [];
  } catch { return []; }
}

async function saveProjects(projects: Project[]) {
  await r2Fetch('/config/projects.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(projects),
  });
}

async function loadContacts(): Promise<Contact[]> {
  try {
    const res = await r2Fetch('/config/contacts.json');
    return res.ok ? (await res.json()).sort((a: Contact, b: Contact) => a.name.localeCompare(b.name)) : [];
  } catch { return []; }
}

async function saveContacts(contacts: Contact[]) {
  const sorted = [...contacts].sort((a, b) => a.name.localeCompare(b.name));
  await r2Fetch('/config/contacts.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sorted),
  });
}

function projectLabelSlug(id: string) {
  return `project-${id.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
}

// Module-level token getter — set by component on mount via useAuthToken
let _getToken: () => Promise<string> = async () => '';

export function _setTokenGetter(fn: () => Promise<string>) {
  _getToken = fn;
}

async function r2Fetch(path: string, opts: RequestInit = {}) {
  const token = await _getToken();
  return fetch(`${R2_URL}${path}`, {
    ...opts,
    credentials: 'omit',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
}

async function extractDocx(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const unzipped = unzipSync(new Uint8Array(buf));
  const docXml = unzipped['word/document.xml'];
  if (!docXml) throw new Error('Not a valid DOCX file (word/document.xml not found)');
  const text = new TextDecoder('utf-8').decode(docXml);
  const paragraphs: string[] = [];
  const matches = text.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
  for (const p of matches) {
    const runs = (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map(r => r.replace(/<[^>]*>/g, '')).join('');
    if (runs.trim()) paragraphs.push(runs.trim());
  }
  return paragraphs.join('\n').slice(0, 20000);
}

async function parseMeetingWithAI(text: string, fileName: string): Promise<MeetingData> {
  const res = await r2Fetch('/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, fileName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Parse failed: HTTP ${res.status}`);
  }
  return res.json();
}

async function saveJsonToR2(data: any, key: string) {
  const res = await r2Fetch(`/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to save JSON to R2: HTTP ${res.status}`);
}

async function saveDocxToR2(file: File, key: string) {
  const buf = await file.arrayBuffer();
  const res = await r2Fetch(`/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    body: buf,
  });
  if (!res.ok) throw new Error(`Failed to save DOCX to R2: HTTP ${res.status}`);
}

// ── ADF helper ─────────────────────────────────────────────────────────────────
function adfDoc(text: string) {
  return {
    type: 'doc',
    version: 1,
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

// ── Jira ticket creation ───────────────────────────────────────────────────────
async function createJiraActionTicket(
  action: ActionItem, meetingTitle: string, meetingDate: string,
  sbu: string, priority: PriorityOption, jiraProjectKey: string, jiraAccountId: string, ownerName: string,
  projectId?: string, projectName?: string
): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const res = await r2Fetch('/jira/rest/api/3/issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        project: { key: jiraProjectKey },
        summary: action.description,
        issuetype: { name: 'Task' },
        assignee: { accountId: jiraAccountId },
        ...(projectName ? { description: adfDoc(projectName) } : {}),
        priority: { name: priority.jiraPriority },
        customfield_11588: [{ value: 'AI' }],
        customfield_11767: [{ value: sbu }],
        customfield_11741: { value: priority.prioritisation },
        customfield_11578: { value: 'Green' },
        customfield_11581: { value: priority.tshirt },
        customfield_12407: { value: priority.urgency },
        customfield_11685: [{ value: 'No' }],
        customfield_11813: [{ value: 'N/A' }],
        customfield_11579: [{ value: 'BA Competency' }],
        customfield_11576: ownerName,
        customfield_11580: ownerName,
        customfield_11683: adfDoc(`Action raised from meeting: ${meetingTitle}. Owner: ${action.owner}.`),
        customfield_11684: adfDoc(action.description),
        customfield_11651: adfDoc('Completes an action item identified in a meeting, driving forward project delivery.'),
        customfield_11649: adfDoc(`Action completed by ${action.owner}${action.dueDate ? ` by ${action.dueDate}` : ''}.`),
        customfield_11582: adfDoc(`Source meeting: ${meetingTitle} (${meetingDate}). Uploaded via Meeting Intelligence tab.`),
        customfield_11589: today,
        customfield_11342: today,
        customfield_11398: action.dueDate || today,
        duedate: action.dueDate || today,
        ...(projectId ? { labels: [projectLabelSlug(projectId)] } : {}),
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || `Jira create failed: HTTP ${res.status}`);
  }
  const { key } = await res.json();
  await r2Fetch(`/jira/rest/api/3/issue/${key}/transitions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transition: { id: '111' } }),
  });
  return key;
}

async function createJiraDecisionTicket(
  decision: { description: string; owner: string },
  meetingTitle: string, meetingDate: string,
  sbu: string, jiraProjectKey: string, jiraAccountId: string, ownerName: string,
  projectId?: string, projectName?: string
): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const words = decision.description.split(/\s+/);
  const summary = words.length > 8 ? words.slice(0, 8).join(' ') : decision.description;
  const res = await r2Fetch('/jira/rest/api/3/issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        project: { key: jiraProjectKey },
        summary,
        issuetype: { name: 'Task' },
        assignee: { accountId: jiraAccountId },
        ...(projectName ? { description: adfDoc(projectName) } : {}),
        priority: { name: 'High' },
        customfield_11588: [{ value: 'AI' }],
        customfield_11767: [{ value: sbu }],
        customfield_11741: { value: 'P2' },
        customfield_11578: { value: 'Green' },
        customfield_11581: { value: 'Xs = <1Month' },
        customfield_12407: { value: 'Medium' },
        customfield_11685: [{ value: 'No' }],
        customfield_11813: [{ value: 'N/A' }],
        customfield_11579: [{ value: 'BA Competency' }],
        customfield_11576: ownerName,
        customfield_11580: decision.owner || ownerName,
        customfield_11683: adfDoc(`Decision made in meeting: ${meetingTitle} on ${meetingDate}. Owner: ${decision.owner || ownerName}.`),
        customfield_11684: adfDoc(decision.description),
        customfield_11651: adfDoc('Tracks a decision made in a meeting, ensuring accountability and follow-through.'),
        customfield_11649: adfDoc(`Decision by ${decision.owner || ownerName} confirmed and actioned. Made on ${meetingDate}.`),
        customfield_11582: adfDoc(`Source meeting: ${meetingTitle} (${meetingDate}). Decision uploaded via Meeting Intelligence tab.`),
        customfield_11589: today,
        customfield_11342: today,
        customfield_11398: today,
        duedate: today,
        labels: ['decision', ...(projectId ? [projectLabelSlug(projectId)] : [])],
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || `Jira create failed: HTTP ${res.status}`);
  }
  const { key } = await res.json();
  await r2Fetch(`/jira/rest/api/3/issue/${key}/transitions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transition: { id: '111' } }),
  });
  return key;
}

// ── ProjectSelector component ──────────────────────────────────────────────────
function ProjectSelector({ projects, value, onChange, onProjectsChange, disabled }: {
  projects: Project[]; value: string; onChange: (v: string) => void;
  onProjectsChange: (p: Project[]) => void; disabled?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const colour = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
    const updated = [...projects, { id, name, colour }];
    await saveProjects(updated);
    onProjectsChange(updated);
    onChange(id);
    setNewName('');
    setAdding(false);
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-400">Project</label>
      {adding ? (
        <div className="flex items-center gap-1.5">
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
            placeholder="Project name..."
            className="w-36 rounded-lg border border-cyan-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-400" />
          <button onClick={handleAdd} disabled={saving || !newName.trim()}
            className="rounded-lg bg-cyan-700 px-2 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600 disabled:opacity-40">
            {saving ? '...' : 'Add'}
          </button>
          <button onClick={() => { setAdding(false); setNewName(''); }}
            className="rounded-lg border border-slate-600 px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500 disabled:opacity-50">
            <option value="">— None —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={() => setAdding(true)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-400 hover:border-cyan-600 hover:text-cyan-300"
            title="New project">+ New</button>
        </div>
      )}
    </div>
  );
}

// ── ContactsPicker component ───────────────────────────────────────────────────
function ContactsPicker({ contacts, selected, onChange, onContactsChange }: {
  contacts: Contact[]; selected: Contact[];
  onChange: (c: Contact[]) => void; onContactsChange: (c: Contact[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    return !selected.some(s => s.email === c.email) && (c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  });

  const addContact = (c: Contact) => {
    onChange([...selected, c]);
    setSearch('');
    inputRef.current?.focus();
  };

  const removeContact = (email: string) => {
    onChange(selected.filter(c => c.email !== email));
  };

  const handleAddNew = async () => {
    const name = newName.trim();
    const email = newEmail.trim().toLowerCase();
    if (!name || !email) return;
    setSaving(true);
    const contact: Contact = { name, email };
    const updated = [...contacts, contact];
    await saveContacts(updated);
    onContactsChange(updated.sort((a, b) => a.name.localeCompare(b.name)));
    onChange([...selected, contact]);
    setNewName(''); setNewEmail(''); setAddingNew(false); setSaving(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(c => (
            <span key={c.email} className="flex items-center gap-1 rounded-full bg-cyan-900/50 px-2.5 py-1 text-xs font-medium text-cyan-200">
              {c.name}
              <button onClick={() => removeContact(c.email)} className="ml-0.5 rounded-full text-cyan-400 hover:text-white" title="Remove">&times;</button>
            </span>
          ))}
        </div>
      )}
      <div ref={wrapRef} className="relative">
        <input ref={inputRef} type="text" value={search}
          onChange={e => { setSearch(e.target.value); setDropdownOpen(true); }}
          onFocus={() => setDropdownOpen(true)}
          placeholder="Search contacts..."
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500" />
        {dropdownOpen && (search || filtered.length > 0) && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 shadow-xl max-h-64 overflow-y-auto">
            {filtered.map(c => (
              <button key={c.email} onMouseDown={e => { e.preventDefault(); addContact(c); }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-800">
                <span className="text-slate-200">{c.name}</span>
                <span className="text-xs text-slate-500">{c.email}</span>
              </button>
            ))}
            {filtered.length === 0 && search && !addingNew && (
              <div className="px-3 py-2">
                <button onMouseDown={e => { e.preventDefault(); setAddingNew(true); setNewName(search); setDropdownOpen(false); }}
                  className="text-sm text-cyan-400 hover:text-cyan-300">
                  + Add "{search}" as new contact
                </button>
              </div>
            )}
            {filtered.length === 0 && !search && (
              <div className="px-3 py-2 text-xs text-slate-500">All contacts selected or type to search</div>
            )}
          </div>
        )}
      </div>
      {addingNew && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 p-2">
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name"
            className="flex-1 min-w-32 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500" />
          <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddNew(); }}
            placeholder="email@company.com" type="email"
            className="flex-1 min-w-48 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500" />
          <button onClick={handleAddNew} disabled={saving || !newName.trim() || !newEmail.trim()}
            className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600 disabled:opacity-40">
            {saving ? '...' : 'Add'}
          </button>
          <button onClick={() => { setAddingNew(false); setNewName(''); setNewEmail(''); }}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
        </div>
      )}
    </div>
  );
}

// ── ContactsManager component ──────────────────────────────────────────────────
function ContactsManager({ contacts, onContactsChange, onClose }: {
  contacts: Contact[]; onContactsChange: (c: Contact[]) => void; onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleAdd = async () => {
    const name = newName.trim();
    const email = newEmail.trim().toLowerCase();
    if (!name || !email) return;
    setSaving(true);
    const updated = [...contacts, { name, email }];
    await saveContacts(updated);
    onContactsChange(updated.sort((a, b) => a.name.localeCompare(b.name)));
    setNewName(''); setNewEmail(''); setAdding(false); setSaving(false);
  };

  const handleDelete = async (email: string) => {
    const updated = contacts.filter(c => c.email !== email);
    await saveContacts(updated);
    onContactsChange(updated);
    setConfirmDelete(null);
  };

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-200">Manage Contacts</h3>
        <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-300">Close</button>
      </div>
      <div className="max-h-64 overflow-y-auto space-y-1">
        {contacts.map(c => (
          <div key={c.email} className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2 text-sm">
            <div>
              <span className="text-slate-200">{c.name}</span>
              <span className="ml-2 text-xs text-slate-500">{c.email}</span>
            </div>
            {confirmDelete === c.email ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Remove?</span>
                <button onClick={() => handleDelete(c.email)}
                  className="rounded bg-rose-700 px-2 py-0.5 text-xs font-semibold text-white hover:bg-rose-600">Yes</button>
                <button onClick={() => setConfirmDelete(null)}
                  className="rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(c.email)}
                className="rounded bg-rose-900/50 px-2 py-0.5 text-xs text-rose-400 hover:bg-rose-700 hover:text-white">Remove</button>
            )}
          </div>
        ))}
        {contacts.length === 0 && <p className="text-sm text-slate-500">No contacts yet.</p>}
      </div>
      {adding ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 p-2">
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name"
            className="flex-1 min-w-32 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500" />
          <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="email@company.com" type="email"
            className="flex-1 min-w-48 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500" />
          <button onClick={handleAdd} disabled={saving || !newName.trim() || !newEmail.trim()}
            className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600 disabled:opacity-40">
            {saving ? '...' : 'Add'}
          </button>
          <button onClick={() => { setAdding(false); setNewName(''); setNewEmail(''); }}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-cyan-600 hover:text-cyan-300">+ Add Contact</button>
      )}
    </div>
  );
}

// ── Email generation ───────────────────────────────────────────────────────────
async function generateEmail(meeting: MeetingData): Promise<string> {
  const res = await r2Fetch('/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meeting }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Email generation failed: HTTP ${res.status}`);
  }
  return (await res.json()).body;
}

// ── EmailPreview component ─────────────────────────────────────────────────────
function EmailPreview({ subject, onSubjectChange, body, onBodyChange, recipients, onSend, onDraft, bridgeAvailable, sendStatus }: {
  subject: string; onSubjectChange: (s: string) => void;
  body: string; onBodyChange: (b: string) => void;
  recipients: Contact[]; onSend: () => void; onDraft: () => void;
  bridgeAvailable: boolean;
  sendStatus: { state: string; message: string; isDraft?: boolean };
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold shrink-0">Subject:</span>
          <input type="text" value={subject} onChange={e => onSubjectChange(e.target.value)}
            className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-200 outline-none focus:border-sky-500" />
        </div>
        <p className="text-xs text-slate-400">
          To: <span className="text-slate-300 font-normal">
            {recipients.map(r => `${r.name} <${r.email}>`).join(', ') || '\u2014'}
          </span>
        </p>
        <hr className="border-slate-700" />
        <textarea value={body} onChange={e => onBodyChange(e.target.value)} rows={16}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-300 outline-none focus:border-cyan-600 leading-relaxed resize-y"
          spellCheck={false} />
      </div>
      <div className="flex items-center gap-3">
        {(() => {
          const sent = sendStatus.state === 'done' && !sendStatus.isDraft;
          const sending = sendStatus.state === 'sending' && !sendStatus.isDraft;
          const disabled = recipients.length === 0 || !bridgeAvailable || sending || sent;
          return (
            <button onClick={sent ? undefined : onSend} disabled={disabled}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-40"
              title={bridgeAvailable ? (recipients.length === 0 ? 'Add at least one recipient' : '') : 'Outlook bridge not configured'}>
              {sent ? 'Sent' : sending ? 'Sending...' : 'Send via Outlook'}
            </button>
          );
        })()}
        <button onClick={onDraft}
          disabled={!bridgeAvailable || (sendStatus.state === 'sending' && !!sendStatus.isDraft)}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          title={bridgeAvailable ? '' : 'Outlook bridge not configured'}>
          {sendStatus.state === 'done' && sendStatus.isDraft ? 'Saved' : 'Save as Draft'}
        </button>
        {!bridgeAvailable && <span className="text-xs text-amber-400">Outlook bridge not configured</span>}
      </div>
    </div>
  );
}

// ── SendMinutesPanel component ─────────────────────────────────────────────────
function SendMinutesPanel({ meeting, meetingKey, onMeetingUpdate, contacts, onContactsChange }: {
  meeting: MeetingData; meetingKey: string; onMeetingUpdate: (m: MeetingData) => void;
  contacts: Contact[]; onContactsChange: (c: Contact[]) => void;
}) {
  const [recipients, setRecipients] = useState<Contact[]>([]);
  const [sendStatus, setSendStatus] = useState<{ state: string; message: string; isDraft?: boolean }>({ state: 'idle', message: '' });
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showContacts, setShowContacts] = useState(false);
  const [subject, setSubject] = useState(() =>
    `Meeting Minutes - ${meeting.title} (${meeting.date})`
      .replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
  );
  const [emailBody, setEmailBody] = useState(meeting.emailBody || '');
  const [generating, setGenerating] = useState(!meeting.emailBody);
  const [genError, setGenError] = useState<string | null>(null);
  const bridgeAvailable = !!OUTLOOK_BRIDGE_URL;

  const doGenerate = () => {
    setGenerating(true);
    setGenError(null);
    generateEmail(meeting).then(async body => {
      setEmailBody(body);
      const updated = { ...meeting, emailBody: body };
      await saveJsonToR2(updated, meetingKey).catch(() => {});
      onMeetingUpdate(updated);
    }).catch(err => setGenError(err.message)).finally(() => setGenerating(false));
  };

  useEffect(() => {
    if (!meeting.emailBody) doGenerate();
  }, [meeting.title, meeting.date]);

  const doSend = async (draft: boolean) => {
    if (recipients.length === 0 && !draft) return;
    if (resetTimer.current) { clearTimeout(resetTimer.current); resetTimer.current = null; }
    setSendStatus({ state: 'sending', message: draft ? 'Saving draft...' : 'Sending...', isDraft: draft });
    try {
      const html = '<html><head><meta charset="utf-8"></head><body style="font-family:Aptos,Arial,sans-serif;font-size:14px;color:#000000;">'
        + emailBody.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/^(Next Steps|Actions|Decisions|Key Minutes)$/gm, '<b>$1</b>')
          .replace(/\n/g, '<br>')
        + '</body></html>';
      const res = await fetch(`${OUTLOOK_BRIDGE_URL}/send`, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': OUTLOOK_API_KEY, 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify({ to: recipients.map(r => r.email), subject, html, draft }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      setSendStatus({ state: 'done', message: draft ? 'Draft saved in Outlook.' : 'Email sent successfully.', isDraft: draft });
      if (draft) {
        resetTimer.current = setTimeout(() => { setSendStatus({ state: 'idle', message: '' }); resetTimer.current = null; }, 2000);
      }
    } catch (err: any) {
      setSendStatus({ state: 'error', message: err.message, isDraft: draft });
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sky-300">Send Meeting Minutes</h3>
        <button onClick={() => setShowContacts(v => !v)} className="text-xs text-slate-500 hover:text-slate-300" title="Manage contacts">
          &#9881; Contacts
        </button>
      </div>
      {showContacts && <ContactsManager contacts={contacts} onContactsChange={onContactsChange} onClose={() => setShowContacts(false)} />}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-400">Recipients</label>
        <ContactsPicker contacts={contacts} selected={recipients} onChange={setRecipients} onContactsChange={onContactsChange} />
      </div>
      {generating ? (
        <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-cyan-400" />
          Writing email with AI...
        </div>
      ) : genError ? (
        <div className="space-y-2">
          <p className="text-sm text-rose-400">Failed to generate email: {genError}</p>
          <button onClick={doGenerate} className="text-xs text-cyan-400 hover:text-cyan-300">Retry</button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-end">
            <button onClick={doGenerate} className="text-xs text-slate-500 hover:text-cyan-300">&#8635; Regenerate</button>
          </div>
          <EmailPreview subject={subject} onSubjectChange={setSubject} body={emailBody} onBodyChange={setEmailBody}
            recipients={recipients} onSend={() => doSend(false)} onDraft={() => doSend(true)}
            bridgeAvailable={bridgeAvailable} sendStatus={sendStatus} />
        </div>
      )}
      {sendStatus.state === 'error' && <p className="text-sm text-rose-400">Error: {sendStatus.message}</p>}
    </div>
  );
}

// ── fetchReferenceContext ──────────────────────────────────────────────────────
async function fetchReferenceContext(categories?: string[]): Promise<string> {
  try {
    const res = await r2Fetch('/reference-docs/');
    if (!res.ok) return '';
    const data = await res.json();
    const objects = data.objects || [];
    const files = objects.filter((o: any) => !o.key.endsWith('.parsed.json') && !o.key.endsWith('.meta.json'));
    const parsedSet = new Set(objects.filter((o: any) => o.key.endsWith('.parsed.json')).map((o: any) => o.key.replace('.parsed.json', '')));
    const filtered = categories ? files.filter((f: any) => categories.some(cat => f.key.startsWith(`reference-docs/${cat}/`))) : files;
    if (filtered.length === 0) return '';
    const contents = await Promise.all(filtered.map(async (f: any) => {
      if (parsedSet.has(f.key)) {
        const pRes = await r2Fetch(`/${f.key}.parsed.json`).catch(() => null);
        if (pRes?.ok) try { return JSON.stringify(await pRes.json()); } catch {}
      }
      return r2Fetch(`/${f.key}`).then(r => r.ok ? r.text() : '').catch(() => '');
    }));
    return filtered.map((f: any, i: number) => contents[i] ? `--- ${f.key.split('/').pop()} ---\n${contents[i]}` : '').filter(Boolean).join('\n\n');
  } catch { return ''; }
}

// ── Diagram pattern matching ───────────────────────────────────────────────────
const DIAGRAM_PATTERNS = [
  { patterns: [/app(lication)?\s+arch(itecture)?/i, /apps?\s+arch/i, /application\s+map/i],
    suggest: (_m: string) => 'Application architecture diagram for the discussed system' },
  { patterns: [/integrat(e|ion|ions?)/i, /connect(or|ing|ion)?\s+(to|with|between)/i, /api\s+(connect|integrat)/i],
    suggest: (_m: string, meeting: MeetingData) => `C4 L1 context diagram showing integrations discussed in the ${meeting.title} meeting` },
  { patterns: [/process\s+(map|flow|design|review|improvement)/i, /workflow/i, /end[\s-]to[\s-]end\s+flow/i],
    suggest: () => 'Process flow map with swim lanes for the discussed process' },
  { patterns: [/sequence\s+diagram/i, /auth(entication)?\s+flow/i, /login\s+flow/i, /oauth/i, /api\s+call\s+flow/i],
    suggest: () => 'UML sequence diagram of the authentication / API flow' },
  { patterns: [/class\s+diagram/i, /domain\s+model/i, /data\s+model/i, /entity/i, /erd/i],
    suggest: () => 'UML class / entity diagram of core domain entities mentioned in the meeting' },
  { patterns: [/capability\s+map/i, /capability\s+model/i, /business\s+capabilit/i],
    suggest: () => 'EA capability map covering the business capabilities discussed' },
  { patterns: [/c4\s+(model|diagram|l[0-9])/i, /context\s+diagram/i, /system\s+context/i],
    suggest: (_m: string, meeting: MeetingData) => `C4 context diagram for the ${meeting.title} system landscape` },
  { patterns: [/deploy(ment)?\s+(diagram|architecture|model)/i, /infrastructure/i, /cloud\s+arch(itecture)?/i, /aws|azure|gcp/i],
    suggest: () => 'Deployment / infrastructure architecture diagram for the discussed environment' },
  { patterns: [/swim\s*lane/i, /lane\s+diagram/i, /cross[\s-]functional/i],
    suggest: () => 'Swim lane process diagram with lanes for each team / stakeholder group discussed' },
  { patterns: [/roadmap/i, /timeline/i, /milestone/i, /release\s+plan/i],
    suggest: () => 'Roadmap / timeline diagram showing the milestones and phases discussed' },
  { patterns: [/mindmap/i, /mind\s+map/i, /brainstorm/i, /idea\s+map/i],
    suggest: (_m: string, meeting: MeetingData) => `Mind map of key themes and ideas from the ${meeting.title} session` },
  { patterns: [/user\s+journey/i, /customer\s+journey/i, /experience\s+map/i],
    suggest: () => 'User journey map showing touchpoints and pain points discussed' },
];

function suggestDiagrams(meeting: MeetingData): string[] {
  const corpus = [...meeting.keyPoints, ...meeting.decisions, ...meeting.actionItems.map(a => a.description), ...meeting.nextSteps, meeting.title].join(' ');
  const suggestions: string[] = [];
  const seen = new Set<string>();
  for (const pattern of DIAGRAM_PATTERNS) {
    if (suggestions.length >= 5) break;
    for (const re of pattern.patterns) {
      const match = corpus.match(re);
      if (match) {
        const s = pattern.suggest(match[0], meeting);
        if (!seen.has(s)) { seen.add(s); suggestions.push(s); }
        break;
      }
    }
  }
  return suggestions;
}

// ── Upload modal (shared by ReferenceDocsTab and MiroSection) ──────────────────
function UploadModal({ files, onFilesChange, statuses, uploading, onUpload, onClose, fileInputRef }: {
  files: PendingFile[]; onFilesChange: (f: PendingFile[]) => void;
  statuses: Record<string, string>; uploading: boolean;
  onUpload: () => void; onClose: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-white">Upload Source Documents</h3>
            <p className="mt-0.5 text-xs text-slate-400">Drop multiple files at once. Select a document type for each file before uploading.</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">&#10005;</button>
        </div>
        <div className="mx-5 mt-4 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/50 p-6 text-center cursor-pointer hover:border-teal-600 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-teal-500'); }}
          onDragLeave={e => { e.currentTarget.classList.remove('border-teal-500'); }}
          onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-teal-500');
            if (e.dataTransfer.files) {
              const newFiles = Array.from(e.dataTransfer.files).map(f => ({ id: `${f.name}-${Date.now()}-${Math.random()}`, file: f, category: 'Other' }));
              onFilesChange([...files, ...newFiles]);
            }
          }}>
          <svg className="mx-auto h-8 w-8 text-teal-600 mb-2" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0-3 3m3-3 3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
          </svg>
          <p className="text-sm text-slate-300 font-medium">Add more files</p>
          <p className="text-xs text-slate-500">or click to browse</p>
          <p className="text-xs text-slate-600 mt-1">TXT, MD, DOCX, CSV, PDF, PNG, JPG</p>
        </div>
        <div className="px-5 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">{files.length} file{files.length !== 1 ? 's' : ''} selected</span>
            <button onClick={() => onFilesChange([])} className="text-xs text-slate-500 hover:text-slate-300">Clear all</button>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {files.map(f => (
              <div key={f.id} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
                <svg className="h-4 w-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs text-slate-200">{f.file.name}</p>
                  <p className="text-[10px] text-slate-600">{(f.file.size / 1024).toFixed(1)} KB</p>
                </div>
                {statuses[f.id] === 'done' && <span className="text-[10px] text-emerald-400">&#10003;</span>}
                {statuses[f.id] === 'error' && <span className="text-[10px] text-rose-400">&#10007;</span>}
                {statuses[f.id] === 'uploading' && <span className="inline-block h-3 w-3 animate-spin rounded-full border border-teal-400 border-t-transparent" />}
                <select value={f.category}
                  onChange={e => onFilesChange(files.map(x => x.id === f.id ? { ...x, category: e.target.value } : x))}
                  disabled={uploading}
                  className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-200 outline-none focus:border-teal-400 disabled:opacity-50">
                  {DOC_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <button onClick={() => onFilesChange(files.filter(x => x.id !== f.id))} disabled={uploading}
                  className="shrink-0 text-slate-500 hover:text-slate-300 disabled:opacity-40">&#10005;</button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-5 py-4">
          <button onClick={onClose} disabled={uploading}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40">Cancel</button>
          <button onClick={onUpload} disabled={uploading || files.length === 0}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-40">
            {uploading ? (
              <><span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal-200 border-t-white" />Uploading...</>
            ) : (
              <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0-3 3m3-3 3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
              </svg>Upload {files.length} File{files.length !== 1 ? 's' : ''}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Upload handler (shared logic) ──────────────────────────────────────────────
async function uploadRefDocs(
  files: PendingFile[],
  setStatuses: (fn: (s: Record<string, string>) => Record<string, string>) => void,
  onDocParsed?: (key: string) => void,
) {
  const st: Record<string, string> = {};
  files.forEach(f => { st[f.id] = 'pending'; });
  setStatuses(() => ({ ...st }));

  for (const f of files) {
    st[f.id] = 'uploading';
    setStatuses(() => ({ ...st }));
    try {
      const key = `reference-docs/${f.category}/${f.file.name}`;
      let body: ArrayBuffer | string;
      let contentType: string;
      if (f.file.name.endsWith('.docx') || f.file.name.endsWith('.doc')) {
        body = await f.file.arrayBuffer();
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else {
        body = await f.file.text();
        contentType = 'text/plain; charset=utf-8';
      }
      await r2Fetch(`/${key}`, { method: 'PUT', headers: { 'Content-Type': contentType }, body });
      st[f.id] = 'done';
      setStatuses(() => ({ ...st }));

      // Parse in background
      const textContent = body instanceof ArrayBuffer
        ? await (async () => { try { return await extractDocx(f.file); } catch { return ''; } })()
        : body;
      r2Fetch('/parse-artefact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: f.file.name, text: (textContent as string).slice(0, 20000), meetingTitle: `Reference: ${f.category}` }),
      }).then(async res => {
        if (!res.ok) return;
        const parsed = await res.json();
        await r2Fetch(`/${key}.parsed.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) });
        onDocParsed?.(key);
      }).catch(() => {});
    } catch {
      st[f.id] = 'error';
      setStatuses(() => ({ ...st }));
    }
  }
}

// ── ReferenceDocsTab component ─────────────────────────────────────────────────
export function ReferenceDocsTab() {
  const { getToken } = useAuthToken();
  _setTokenGetter(getToken);
  const [docs, setDocs] = useState<RefDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await r2Fetch('/reference-docs/');
      const data = res.ok ? await res.json() : { objects: [] };
      const objects = data.objects || [];
      const files = objects.filter((o: any) => !o.key.endsWith('.parsed.json') && !o.key.endsWith('.meta.json'));
      const parsedSet = new Set(objects.filter((o: any) => o.key.endsWith('.parsed.json')).map((o: any) => o.key.replace('.parsed.json', '')));
      const metaKeys = objects.filter((o: any) => o.key.endsWith('.meta.json')).map((o: any) => o.key);
      const metaMap: Record<string, any> = {};
      await Promise.all(metaKeys.map(async (k: string) => {
        try {
          const r = await r2Fetch(`/${k}`);
          if (r.ok) metaMap[k.replace('.meta.json', '')] = await r.json();
        } catch {}
      }));
      const docList: RefDoc[] = files.map((f: any) => {
        const parts = f.key.split('/');
        const category = parts[1] || 'Other';
        const fileName = parts.slice(2).join('/');
        return {
          key: f.key,
          fileName,
          displayName: metaMap[f.key]?.displayName || fileName,
          category: DOC_CATEGORIES.includes(category) ? category : 'Other',
          size: f.size,
          parsed: parsedSet.has(f.key),
          uploadedAt: f.uploaded,
        };
      });
      docList.sort((a, b) => a.category.localeCompare(b.category) || a.displayName.localeCompare(b.displayName));
      setDocs(docList);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles = Array.from(fileList).map(f => ({ id: `${f.name}-${Date.now()}-${Math.random()}`, file: f, category: 'Other' }));
    setPendingFiles(prev => [...prev, ...newFiles]);
    setShowUpload(true);
  };

  const doUpload = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    await uploadRefDocs(pendingFiles, setUploadStatuses, (key) => {
      setDocs(prev => prev.map(d => d.key === key ? { ...d, parsed: true } : d));
    });
    setUploading(false);
    setShowUpload(false);
    setPendingFiles([]);
    setUploadStatuses({});
    refresh();
  };

  const handleDelete = async (doc: RefDoc) => {
    setDeleting(doc.key);
    try {
      await Promise.all([
        r2Fetch(`/${doc.key}`, { method: 'DELETE' }),
        r2Fetch(`/${doc.key}.parsed.json`, { method: 'DELETE' }).catch(() => {}),
        r2Fetch(`/${doc.key}.meta.json`, { method: 'DELETE' }).catch(() => {}),
      ]);
      setDocs(prev => prev.filter(d => d.key !== doc.key));
    } catch (err: any) { alert(`Remove failed: ${err.message}`); }
    setDeleting(null);
  };

  const handleRename = async (doc: RefDoc) => {
    if (!renameValue.trim() || renameValue === doc.displayName) { setRenamingKey(null); return; }
    setRenameSaving(true);
    try {
      await r2Fetch(`/${doc.key}.meta.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: renameValue.trim() }),
      });
      setDocs(prev => prev.map(d => d.key === doc.key ? { ...d, displayName: renameValue.trim() } : d));
      setRenamingKey(null);
    } catch (err: any) { alert(`Rename failed: ${err.message}`); }
    setRenameSaving(false);
  };

  const grouped = useMemo(() => {
    const g: Record<string, RefDoc[]> = {};
    for (const d of docs) { if (!g[d.category]) g[d.category] = []; g[d.category].push(d); }
    return g;
  }, [docs]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Reference Documents</h2>
          <p className="mt-1 text-sm text-slate-400">Shared library used by all meetings for Miro diagram generation.</p>
        </div>
        <button onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 transition-colors">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0-3 3m3-3 3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
          </svg>Upload Documents
        </button>
        <input ref={fileInputRef} type="file" multiple accept=".txt,.md,.docx,.doc,.csv,.pdf,.png,.jpg,.jpeg,.zip"
          className="hidden" onChange={e => addFiles(e.target.files)} />
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-12 text-center">
          <svg className="mx-auto h-10 w-10 text-slate-700 mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-sm text-slate-500">No reference documents yet.</p>
          <p className="text-xs text-slate-600 mt-1">Upload capability maps, architecture diagrams, process docs to ground your Miro generation in real Dulux data.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, catDocs]) => (
            <div key={cat}>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                {cat}
                <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-normal normal-case tracking-normal text-slate-500">{catDocs.length}</span>
              </h3>
              <div className="space-y-1.5">
                {catDocs.map(doc => (
                  <div key={doc.key} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5">
                    {renamingKey === doc.key ? (
                      <div className="flex items-center gap-2">
                        <input className="flex-1 rounded border border-slate-500 bg-slate-700 px-2 py-1 text-xs text-slate-100 outline-none focus:border-teal-400"
                          value={renameValue} onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRename(doc); if (e.key === 'Escape') setRenamingKey(null); }}
                          autoFocus />
                        <button onClick={() => handleRename(doc)} disabled={renameSaving}
                          className="text-xs text-teal-400 hover:text-teal-300 disabled:opacity-40">{renameSaving ? '...' : 'Save'}</button>
                        <button onClick={() => setRenamingKey(null)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <svg className="h-3.5 w-3.5 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="flex-1 truncate text-sm text-slate-200">{doc.displayName}</span>
                        {doc.displayName !== doc.fileName && (
                          <span className="shrink-0 truncate text-xs text-slate-600 max-w-[120px]" title={doc.fileName}>{doc.fileName}</span>
                        )}
                        {doc.parsed ? (
                          <span className="shrink-0 rounded-full bg-emerald-900/60 border border-emerald-700/60 px-1.5 py-0.5 text-[10px] text-emerald-400">parsed</span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-amber-900/40 border border-amber-700/40 px-1.5 py-0.5 text-[10px] text-amber-500">parsing...</span>
                        )}
                        <span className="shrink-0 text-xs text-slate-600">{(doc.size / 1024).toFixed(1)} KB</span>
                        <button onClick={() => { setRenamingKey(doc.key); setRenameValue(doc.displayName); }}
                          className="shrink-0 text-xs text-slate-400 hover:text-teal-300 transition-colors">Rename</button>
                        <button onClick={() => handleDelete(doc)} disabled={deleting === doc.key}
                          className="shrink-0 text-xs text-rose-400 hover:text-rose-300 disabled:opacity-40">
                          {deleting === doc.key ? '...' : 'Remove'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal files={pendingFiles} onFilesChange={setPendingFiles} statuses={uploadStatuses}
          uploading={uploading} onUpload={doUpload}
          onClose={() => { setShowUpload(false); setPendingFiles([]); setUploadStatuses({}); }}
          fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>} />
      )}
    </div>
  );
}

// ── MiroSection component ──────────────────────────────────────────────────────
function MiroSection({ meeting, meetingKey }: { meeting: MeetingData; meetingKey: string }) {
  const { workspace } = useWorkspace();
  const miroTeamId = workspace?.miroTeamId || '';
  const [prompt, setPrompt] = useState('');
  const [genState, setGenState] = useState<'idle' | 'generating' | 'done' | 'error'>('idle');
  const [genError, setGenError] = useState<string | null>(null);
  const [boards, setBoards] = useState<BoardRecord[]>([]);
  const [boardsLoaded, setBoardsLoaded] = useState(false);
  const [refDocs, setRefDocs] = useState<RefDoc[]>([]);
  const [refDocsLoaded, setRefDocsLoaded] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, string>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const boardsPrefix = `miro-boards/${meetingKey.replace(/\.json$/, '')}/`;
  const suggestions = useMemo(() => suggestDiagrams(meeting), [meeting]);

  // Load boards
  useEffect(() => {
    r2Fetch(`/${boardsPrefix}`).then(r => r.ok ? r.json() : { objects: [] }).then(async data => {
      const jsonObjects = (data.objects || []).filter((o: any) => o.key.endsWith('.json'));
      if (jsonObjects.length === 0) { setBoardsLoaded(true); return; }
      const loaded = (await Promise.all(jsonObjects.map((o: any) =>
        r2Fetch(`/${o.key}`).then(r => r.ok ? r.json() : null).catch(() => null)
      ))).filter(Boolean) as BoardRecord[];
      loaded.sort((a, b) => (b.generatedAt ?? '').localeCompare(a.generatedAt ?? ''));
      setBoards(loaded);
      setBoardsLoaded(true);
    }).catch(() => setBoardsLoaded(true));
  }, [boardsPrefix]);

  // Load ref docs
  const loadRefDocs = async () => {
    setRefDocsLoaded(false);
    try {
      const res = await r2Fetch('/reference-docs/');
      const data = res.ok ? await res.json() : { objects: [] };
      const objects = data.objects || [];
      const files = objects.filter((o: any) => !o.key.endsWith('.parsed.json') && !o.key.endsWith('.meta.json'));
      const parsedSet = new Set(objects.filter((o: any) => o.key.endsWith('.parsed.json')).map((o: any) => o.key.replace('.parsed.json', '')));
      const docList: RefDoc[] = files.map((f: any) => {
        const parts = f.key.split('/');
        const cat = parts[1] || 'Other';
        const fileName = parts.slice(2).join('/');
        return { key: f.key, fileName, displayName: fileName, category: DOC_CATEGORIES.includes(cat) ? cat : 'Other', size: f.size, parsed: parsedSet.has(f.key) };
      });
      docList.sort((a, b) => a.category.localeCompare(b.category) || a.displayName.localeCompare(b.displayName));
      setRefDocs(docList);
    } catch {}
    setRefDocsLoaded(true);
  };
  useEffect(() => { loadRefDocs(); }, []);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles = Array.from(fileList).map(f => ({ id: `${f.name}-${Date.now()}-${Math.random()}`, file: f, category: 'Other' }));
    setPendingFiles(prev => [...prev, ...newFiles]);
    setShowUploadModal(true);
  };

  const doUpload = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    await uploadRefDocs(pendingFiles, setUploadStatuses, (key) => {
      setRefDocs(prev => prev.map(d => d.key === key ? { ...d, parsed: true } : d));
    });
    setUploading(false);
    setShowUploadModal(false);
    setPendingFiles([]);
    setUploadStatuses({});
    loadRefDocs();
  };

  const handleRenameBoard = async (board: BoardRecord) => {
    if (!renameValue.trim() || renameValue === board.title) { setRenamingId(null); return; }
    setRenameSaving(true);
    try {
      const key = `${boardsPrefix}${board.boardId}.json`;
      const updated = { ...board, title: renameValue.trim() };
      await r2Fetch(`/${key}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
      setBoards(prev => prev.map(b => b.boardId === board.boardId ? updated : b));
      setRenamingId(null);
    } catch (err: any) { alert(`Rename failed: ${err.message}`); }
    setRenameSaving(false);
  };

  const handleDeleteBoard = async (board: BoardRecord) => {
    setDeletingId(board.boardId);
    try {
      await r2Fetch(`/${boardsPrefix}${board.boardId}.json`, { method: 'DELETE' });
      setBoards(prev => prev.filter(b => b.boardId !== board.boardId));
    } catch (err: any) { alert(`Delete failed: ${err.message}`); }
    setDeletingId(null);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenState('generating');
    setGenError(null);
    try {
      const context = await fetchReferenceContext().catch(() => '');
      const res = await r2Fetch('/miro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting, prompt: prompt.trim(), context: context || undefined, teamId: miroTeamId || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      const record: BoardRecord = { ...result, prompt: prompt.trim(), generatedAt: new Date().toISOString(), meetingTitle: meeting.title, meetingDate: meeting.date };
      const key = `${boardsPrefix}${result.boardId}.json`;
      r2Fetch(`/${key}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) }).catch(() => {});
      setBoards(prev => [record, ...prev]);
      setGenState('done');
    } catch (err: any) {
      setGenError(err.message);
      setGenState('error');
    }
  };

  return (
    <div className="space-y-5">
      {/* Generate section */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
        <h3 className="font-semibold text-purple-300">Generate Miro Diagram</h3>
        {suggestions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-500">Suggested from this meeting</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => setPrompt(s)}
                  className="rounded-full border border-purple-800/60 bg-purple-950/50 px-3 py-1 text-xs text-purple-300 hover:bg-purple-900/60 hover:border-purple-600 transition-colors text-left">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-400">What do you want to create?</label>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
            placeholder={MIRO_EXAMPLES[Math.floor(Math.random() * MIRO_EXAMPLES.length)]}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-purple-500 resize-none placeholder:text-slate-600" />
          <p className="mt-1 text-xs text-slate-600">e.g. "C4 L1 context diagram", "process map with swim lanes", "UML class diagram of core entities"</p>
        </div>
        <button onClick={handleGenerate} disabled={genState === 'generating' || !prompt.trim()}
          className="w-full rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-600 disabled:opacity-40 flex items-center justify-center gap-2">
          {genState === 'generating' ? (
            <><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-purple-300 border-t-white" />Generating diagram...</>
          ) : 'Generate in Miro'}
        </button>
        {genState === 'error' && <p className="text-sm text-rose-400">Error: {genError}</p>}
      </div>

      {/* Inline ref docs */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sky-300">Reference Documents</h3>
            <p className="text-xs text-slate-600 mt-0.5">Global library — all docs auto-included in generation</p>
          </div>
          <button onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600 transition-colors">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0-3 3m3-3 3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
            </svg>Upload
          </button>
        </div>
        {!refDocsLoaded && <p className="text-xs text-slate-600">Loading...</p>}
        {refDocsLoaded && refDocs.length === 0 && <p className="text-xs text-slate-600">No reference documents yet. Upload docs to ground diagram generation in real Dulux data.</p>}
        {refDocsLoaded && refDocs.length > 0 && (
          <div className="space-y-1">
            {refDocs.map(d => (
              <div key={d.key} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5">
                <svg className="h-3 w-3 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="flex-1 truncate text-xs text-slate-300">{d.displayName}</span>
                <span className="shrink-0 text-[10px] text-slate-600">{d.category}</span>
                {d.parsed ? (
                  <span className="shrink-0 rounded-full bg-emerald-900/60 border border-emerald-700/60 px-1.5 py-0.5 text-[10px] text-emerald-400">parsed</span>
                ) : (
                  <span className="shrink-0 rounded-full bg-amber-900/40 border border-amber-700/40 px-1.5 py-0.5 text-[10px] text-amber-500">parsing...</span>
                )}
              </div>
            ))}
          </div>
        )}
        <input ref={fileInputRef} type="file" multiple accept=".txt,.md,.docx,.doc,.csv,.pdf,.png,.jpg,.jpeg,.zip"
          className="hidden" onChange={e => addFiles(e.target.files)} />
      </div>

      {showUploadModal && (
        <UploadModal files={pendingFiles} onFilesChange={setPendingFiles} statuses={uploadStatuses}
          uploading={uploading} onUpload={doUpload}
          onClose={() => { setShowUploadModal(false); setPendingFiles([]); setUploadStatuses({}); }}
          fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>} />
      )}

      {/* Board history */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
        <h3 className="font-semibold text-slate-300">Board History</h3>
        {!boardsLoaded && <p className="text-xs text-slate-600">Loading...</p>}
        {boardsLoaded && boards.length === 0 && <p className="text-xs text-slate-600">No boards generated yet for this meeting.</p>}
        {boards.map(b => (
          <div key={b.boardId} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 space-y-1.5">
            {renamingId === b.boardId ? (
              <div className="flex items-center gap-2">
                <input className="flex-1 rounded border border-slate-500 bg-slate-700 px-2 py-1 text-sm text-slate-100 outline-none focus:border-purple-400"
                  value={renameValue} onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRenameBoard(b); if (e.key === 'Escape') setRenamingId(null); }}
                  autoFocus />
                <button onClick={() => handleRenameBoard(b)} disabled={renameSaving}
                  className="text-xs text-purple-400 hover:text-purple-300 disabled:opacity-40">{renameSaving ? '...' : 'Save'}</button>
                <button onClick={() => setRenamingId(null)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200">{b.title}</p>
                  {b.prompt && <p className="text-xs text-slate-500 truncate">"{b.prompt}"</p>}
                  <p className="text-xs text-slate-600 mt-0.5">
                    {b.nodeCount}/{b.aiNodeCount ?? '?'} nodes · {b.edgeCount}/{b.aiEdgeCount ?? '?'} connectors
                    {b.generatedAt && ` · ${new Date(b.generatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                  {b.nodeErrors && b.nodeErrors.length > 0 && <p className="text-xs text-rose-400">&#9888; {b.nodeErrors.length} shape error(s)</p>}
                  {b.edgeErrors && b.edgeErrors.length > 0 && <p className="text-xs text-amber-400">&#9888; {b.edgeErrors.length} connector error(s)</p>}
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <a href={b.viewLink} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg border border-purple-600 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-900/40 whitespace-nowrap">
                    Open &#8599;
                  </a>
                  <button onClick={() => { setRenamingId(b.boardId); setRenameValue(b.title); }}
                    className="text-xs text-slate-400 hover:text-purple-300 transition-colors">Rename</button>
                  <button onClick={() => handleDeleteBoard(b)} disabled={deletingId === b.boardId}
                    className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-40">
                    {deletingId === b.boardId ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MeetingDetail component ────────────────────────────────────────────────────
function MeetingDetail({ meetingKey, onBack, projects, onProjectsChange, contacts, onContactsChange }: {
  meetingKey: string; onBack: () => void;
  projects: Project[]; onProjectsChange: (p: Project[]) => void;
  contacts: Contact[]; onContactsChange: (c: Contact[]) => void;
}) {
  const { workspace } = useWorkspace();
  const jiraInstanceUrl = workspace?.jiraInstanceUrl || 'duluxgroup.atlassian.net';
  const jiraBrowseUrl = `https://${jiraInstanceUrl}/browse`;
  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ActionItem & { jiraKey?: string }>({ description: '', owner: '', dueDate: '', isSimon: false });
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingProject, setSavingProject] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    r2Fetch(`/${meetingKey}`).then(r => r.text()).then(text => {
      const data = JSON.parse(text);
      // Migrate array-style jiraTickets to object
      if (Array.isArray(data.jiraTickets)) {
        const obj: Record<string, string> = {};
        data.jiraTickets.forEach((t: string, i: number) => {
          if (t && data.actionItems[i]) obj[data.actionItems[i].description] = t;
        });
        data.jiraTickets = obj;
      }
      setMeeting(data);
    }).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, [meetingKey]);

  const saveActions = async (actions: ActionItem[], tickets: Record<string, string>) => {
    if (!meeting) return;
    setSaving(true);
    const updated = { ...meeting, actionItems: actions, jiraTickets: tickets };
    await saveJsonToR2(updated, meetingKey);
    setMeeting(updated);
    setSaving(false);
  };

  const handleProjectChange = async (projectId: string) => {
    if (!meeting) return;
    setSavingProject(true);
    const updated = { ...meeting, projectId: projectId || undefined };
    await saveJsonToR2(updated, meetingKey);
    setMeeting(updated);

    // Update labels on existing Jira tickets
    const ticketKeys = Object.values(meeting.jiraTickets ?? {}).filter(k => k && !k.startsWith('Error'));
    const projectName = projects.find(p => p.id === projectId)?.name ?? null;
    const label = projectId ? projectLabelSlug(projectId) : null;
    for (const key of ticketKeys) {
      const issueRes = await r2Fetch(`/jira/rest/api/3/issue/${key}?fields=labels`).catch(() => null);
      if (!issueRes?.ok) continue;
      const issueData = await issueRes.json().catch(() => null);
      const existingLabels = (issueData?.fields?.labels ?? []).filter((l: string) => !l.startsWith('project-'));
      const fields: any = { labels: label ? [...existingLabels, label] : existingLabels };
      if (projectName) fields.description = adfDoc(projectName);
      await r2Fetch(`/jira/rest/api/3/issue/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      }).catch(() => {});
    }
    setSavingProject(false);
  };

  const handleSaveEdit = async (idx: number) => {
    if (!meeting) return;
    const oldDesc = meeting.actionItems[idx].description;
    const { jiraKey, ...actionData } = editForm;
    const newAction: ActionItem = { ...actionData, isSimon: editForm.owner.toLowerCase().includes('simon') };
    const newActions = meeting.actionItems.map((a, i) => i === idx ? newAction : a);
    const newTickets = { ...meeting.jiraTickets };
    // Handle description rename in tickets map
    if (oldDesc !== editForm.description && newTickets[oldDesc]) {
      newTickets[editForm.description] = newTickets[oldDesc];
      delete newTickets[oldDesc];
    }
    if (jiraKey) newTickets[newAction.description] = jiraKey;

    // Update due date in Jira if ticket exists
    const ticketKey = jiraKey || newTickets[newAction.description];
    if (ticketKey && !ticketKey.startsWith('Error') && newAction.dueDate) {
      await r2Fetch(`/jira/rest/api/3/issue/${ticketKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { duedate: newAction.dueDate, customfield_11398: newAction.dueDate } }),
      }).catch(() => {});
    }
    await saveActions(newActions, newTickets);
    setEditingIdx(null);
  };

  const handleDeleteAction = async (idx: number) => {
    if (!meeting) return;
    const desc = meeting.actionItems[idx].description;
    const newActions = meeting.actionItems.filter((_, i) => i !== idx);
    const newTickets = { ...meeting.jiraTickets };
    delete newTickets[desc];
    await saveActions(newActions, newTickets);
    setConfirmDeleteIdx(null);
  };

  if (loading) return <div className="py-16 text-center text-slate-400">Loading meeting...</div>;
  if (error || !meeting) return <div className="py-16 text-center text-rose-400">Failed to load: {error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button onClick={onBack} className="mb-2 text-xs text-slate-500 hover:text-slate-300">&larr; Back to meetings</button>
          <h2 className="text-2xl font-bold text-slate-100">{meeting.title}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {meeting.date} &middot; {meeting.participants.length} attendees &middot; Uploaded {new Date(meeting.uploadedAt!).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <ProjectSelector projects={projects} value={meeting.projectId ?? ''} onChange={handleProjectChange}
            onProjectsChange={onProjectsChange} disabled={savingProject} />
          {savingProject && <span className="mb-1.5 text-xs text-slate-500">Saving...</span>}
        </div>
      </div>

      {/* Attendees */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="mb-2 font-semibold text-cyan-300">Attendees</h3>
        <p className="text-sm text-slate-300">{meeting.participants.join(', ') || '\u2014'}</p>
      </div>

      {/* Actions */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="mb-3 font-semibold text-amber-300">Actions</h3>
        {meeting.actionItems.length === 0 ? (
          <p className="text-sm text-slate-500">No actions recorded.</p>
        ) : (
          <div className="space-y-2">
            {meeting.actionItems.map((action, idx) => {
              const ticket = meeting.jiraTickets?.[action.description];
              const isEditing = editingIdx === idx;
              const isDeleting = confirmDeleteIdx === idx;
              return (
                <div key={idx} className="rounded-lg bg-slate-950/60 px-3 py-2 text-sm">
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
                        rows={2} value={editForm.description}
                        onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" />
                      <div className="flex gap-2">
                        <input className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500"
                          value={editForm.owner} onChange={e => setEditForm(f => ({ ...f, owner: e.target.value }))} placeholder="Owner" />
                        <input type="date" className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500"
                          value={editForm.dueDate ?? ''} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} />
                        <input className="w-32 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500"
                          value={editForm.jiraKey ?? ''} onChange={e => setEditForm(f => ({ ...f, jiraKey: e.target.value.trim().toUpperCase() }))}
                          placeholder="PKPI2-123" />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingIdx(null)}
                          className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
                        <button onClick={() => handleSaveEdit(idx)} disabled={saving}
                          className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600 disabled:opacity-50">
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200">{action.description}</p>
                        <p className="mt-0.5 text-xs text-slate-500">Owner: {action.owner}{action.dueDate ? ` \u00b7 Due: ${action.dueDate}` : ''}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {ticket && !ticket.startsWith('Error') && (
                          <a href={`${jiraBrowseUrl}/${ticket}`} target="_blank" rel="noreferrer"
                            className="rounded-full bg-cyan-900/40 px-2 py-0.5 text-xs font-semibold text-cyan-300 hover:underline">{ticket}</a>
                        )}
                        {ticket?.startsWith('Error') && (
                          <span className="rounded-full bg-rose-900/40 px-2 py-0.5 text-xs text-rose-400" title={ticket}>Error</span>
                        )}
                        <button onClick={() => { setEditingIdx(idx); setEditForm({ ...action, jiraKey: ticket && !ticket.startsWith('Error') ? ticket : '' }); }}
                          className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200">Edit</button>
                        {isDeleting ? (
                          <>
                            <span className="text-xs text-slate-400">Delete?</span>
                            <button onClick={() => handleDeleteAction(idx)}
                              className="rounded-lg bg-rose-700 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-600">Yes</button>
                            <button onClick={() => setConfirmDeleteIdx(null)}
                              className="rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-400 hover:text-slate-200">No</button>
                          </>
                        ) : (
                          <button onClick={() => setConfirmDeleteIdx(idx)}
                            className="rounded-lg bg-rose-700 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-600">Delete</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Decisions */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="mb-3 font-semibold text-violet-300">Decisions</h3>
        {meeting.decisions.length === 0 ? (
          <p className="text-sm text-slate-500">No decisions recorded.</p>
        ) : (
          <div className="space-y-2">
            {meeting.decisions.map((dec, idx) => {
              const item = meeting.decisionItems?.[idx];
              const ticket = meeting.decisionJiraTickets?.[dec];
              return (
                <div key={idx} className="rounded-lg bg-slate-950/60 px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200">{dec}</p>
                      {item?.owner && <p className="mt-0.5 text-xs text-slate-500">Owner: {item.owner} &middot; Decided: {meeting.date}</p>}
                    </div>
                    {ticket && !ticket.startsWith('Error') && (
                      <a href={`${jiraBrowseUrl}/${ticket}`} target="_blank" rel="noreferrer"
                        className="shrink-0 rounded-full bg-violet-900/40 px-2 py-0.5 text-xs font-semibold text-violet-300 hover:underline">{ticket}</a>
                    )}
                    {ticket?.startsWith('Error') && (
                      <span className="shrink-0 rounded-full bg-rose-900/40 px-2 py-0.5 text-xs text-rose-400" title={ticket}>Error</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Key Points */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="mb-2 font-semibold text-emerald-300">Key Points</h3>
        {meeting.keyPoints.length === 0 ? (
          <p className="text-sm text-slate-500">None recorded.</p>
        ) : (
          <ul className="space-y-1">
            {meeting.keyPoints.map((kp, i) => <li key={i} className="text-sm text-slate-300">&bull; {kp}</li>)}
          </ul>
        )}
      </div>

      {/* Send Minutes */}
      <SendMinutesPanel meeting={meeting} meetingKey={meetingKey} onMeetingUpdate={setMeeting} contacts={contacts} onContactsChange={onContactsChange} />

      {/* Miro */}
      <MiroSection meeting={meeting} meetingKey={meetingKey} />
    </div>
  );
}

// ── MeetingsList component ─────────────────────────────────────────────────────
function MeetingsList({ onSelect, refresh, onRefresh }: {
  onSelect: (key: string) => void; refresh: number; onRefresh: () => void;
}) {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    r2Fetch('/meetings/').then(r => r.json()).then(data => {
      const jsonFiles = data.objects.filter((o: any) => o.key.endsWith('.json'));
      jsonFiles.sort((a: any, b: any) => b.uploaded.localeCompare(a.uploaded));
      setMeetings(jsonFiles);
    }).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, [refresh]);

  const handleDelete = async (key: string) => {
    setConfirmDelete(null);
    setDeleting(key);
    try {
      await r2Fetch(`/${key}`, { method: 'DELETE' });
      const docxKey = key.replace('.json', '.docx');
      await r2Fetch(`/${docxKey}`, { method: 'DELETE' }).catch(() => {});
      onRefresh();
    } catch (err: any) { alert(`Delete failed: ${err.message}`); }
    finally { setDeleting(null); }
  };

  if (loading) return <div className="py-8 text-center text-slate-400">Loading meetings...</div>;
  if (error) return <div className="py-8 text-center text-rose-400">Failed to load: {error}</div>;
  if (meetings.length === 0) return <div className="py-8 text-center text-slate-500">No meetings uploaded yet. Upload a DOCX above to get started.</div>;

  return (
    <div className="space-y-2">
      {meetings.map(m => {
        const parts = m.key.replace('meetings/', '').replace('.json', '').split('-');
        const date = parts.slice(0, 3).join('-');
        const title = parts.slice(3).join(' ').replace(/-/g, ' ');
        const isConfirming = confirmDelete === m.key;
        const isDeleting_ = deleting === m.key;
        return (
          <div key={m.key}
            className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 transition hover:border-cyan-700 hover:bg-slate-800/70">
            <button className="flex-1 text-left" onClick={() => onSelect(m.key)}>
              <p className="font-semibold capitalize text-slate-200">{title || m.key}</p>
              <p className="mt-0.5 text-xs text-slate-500">{date} &middot; {(m.size / 1024).toFixed(1)} KB</p>
            </button>
            <div className="flex items-center gap-2">
              {isConfirming ? (
                <>
                  <span className="text-xs text-slate-300">Are you sure you want to delete?</span>
                  <button onClick={() => handleDelete(m.key)}
                    className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 active:bg-rose-800">Yes</button>
                  <button onClick={() => setConfirmDelete(null)}
                    className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700">Cancel</button>
                </>
              ) : (
                <>
                  <span className="text-slate-600">&rarr;</span>
                  <button onClick={e => { e.stopPropagation(); setConfirmDelete(m.key); }} disabled={isDeleting_}
                    className="ml-2 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 active:bg-rose-800 disabled:opacity-40">
                    {isDeleting_ ? 'Deleting...' : 'Delete'}
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── MeetingsTab main component ─────────────────────────────────────────────────
export function MeetingsTab() {
  const { getToken } = useAuthToken();
  _setTokenGetter(getToken);
  const { workspace } = useWorkspace();
  const jiraProjectKey = workspace?.jiraProjectKey || 'PKPI2';
  const jiraAccountId = workspace?.jiraAccountId || '5f7a805b25fbdf00685e6cf8';
  const wsOwnerName = workspace?.ownerName || 'Simon Lobascher';

  const [status, setStatus] = useState<{ stage: string; message: string }>({ stage: 'idle', message: '' });
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [sbu, setSbu] = useState(workspace?.brands?.[0] || 'Selleys');
  const [pendingUpload, setPendingUpload] = useState<{ parsed: MeetingData; file: File; jsonKey: string; docxKey: string } | null>(null);
  const [priorities, setPriorities] = useState<number[]>([]);
  const [actionEnabled, setActionEnabled] = useState<boolean[]>([]);
  const [actionRemoved, setActionRemoved] = useState<boolean[]>([]);
  const [dueDates, setDueDates] = useState<string[]>([]);
  const [decisionOwners, setDecisionOwners] = useState<string[]>([]);
  const [decisionEnabled, setDecisionEnabled] = useState<boolean[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProjects().then(setProjects);
    loadContacts().then(setContacts);
  }, []);

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.docx')) {
      setStatus({ stage: 'error', message: 'Please upload a .docx file.' });
      return;
    }
    try {
      setStatus({ stage: 'extracting', message: 'Extracting text from DOCX...' });
      const text = await extractDocx(file);
      if (text.length < 50) throw new Error('Could not extract enough text. Please check the file.');
      setStatus({ stage: 'parsing', message: 'Parsing meeting with AI...' });
      const parsed = await parseMeetingWithAI(text, file.name);
      const slug = file.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const jsonKey = `meetings/${parsed.date}-${slug}.json`;
      const docxKey = `meetings/${parsed.date}-${slug}.docx`;
      setPriorities(parsed.actionItems.map(() => 1));
      setActionEnabled(parsed.actionItems.map(() => true));
      setActionRemoved(parsed.actionItems.map(() => false));
      setDueDates(parsed.actionItems.map(a => a.dueDate || ''));
      setDecisionOwners(parsed.decisions.map(() => ''));
      setDecisionEnabled(parsed.decisions.map(() => true));
      setPendingUpload({ parsed, file, jsonKey, docxKey });
      // Auto-detect project
      const titleLower = parsed.title.toLowerCase();
      const match = projects.find(p => titleLower.includes(p.name.toLowerCase()) || titleLower.includes(p.id.toLowerCase().replace(/-/g, ' ')));
      setSelectedProject(match?.id ?? '');
      setStatus({ stage: 'idle', message: '' });
    } catch (err: any) {
      setStatus({ stage: 'error', message: err.message || 'Something went wrong.' });
    }
  };

  const confirmUpload = async () => {
    if (!pendingUpload) return;
    const { parsed, file, jsonKey, docxKey } = pendingUpload;
    try {
      setStatus({ stage: 'saving', message: 'Saving transcript to R2...' });
      await saveDocxToR2(file, docxKey);
      const actionCount = parsed.actionItems.filter((_, i) => !actionRemoved[i] && actionEnabled[i]).length;
      const decisionCount = parsed.decisions.filter((_, i) => decisionEnabled[i]).length;
      setStatus({ stage: 'tickets', message: `Creating ${actionCount + decisionCount} Jira ticket(s)...` });

      const project = projects.find(p => p.id === selectedProject);
      const actionTickets: Record<string, string> = {};
      for (let i = 0; i < parsed.actionItems.length; i++) {
        if (actionRemoved[i] || !actionEnabled[i]) continue;
        const action = { ...parsed.actionItems[i], dueDate: dueDates[i] ?? parsed.actionItems[i].dueDate };
        try {
          actionTickets[action.description] = await createJiraActionTicket(
            action, parsed.title, parsed.date, sbu, PRIORITY_OPTIONS[priorities[i] ?? 1],
            jiraProjectKey, jiraAccountId, wsOwnerName, selectedProject || undefined, project?.name
          );
        } catch (err: any) {
          actionTickets[action.description] = `Error: ${err.message}`;
        }
      }

      const decisionTickets: Record<string, string> = {};
      for (let i = 0; i < parsed.decisions.length; i++) {
        if (!decisionEnabled[i]) continue;
        const decision = { description: parsed.decisions[i], owner: decisionOwners[i] || wsOwnerName };
        try {
          decisionTickets[decision.description] = await createJiraDecisionTicket(
            decision, parsed.title, parsed.date, sbu, jiraProjectKey, jiraAccountId, wsOwnerName, selectedProject || undefined, project?.name
          );
        } catch (err: any) {
          decisionTickets[decision.description] = `Error: ${err.message}`;
        }
      }

      const decisionItems = parsed.decisions.map((d, i) => ({ description: d, owner: decisionOwners[i] || wsOwnerName }));
      const finalData: MeetingData = {
        ...parsed,
        actionItems: parsed.actionItems.map((a, i) => ({ ...a, dueDate: dueDates[i] ?? a.dueDate })).filter((_, i) => !actionRemoved[i]),
        decisionItems,
        uploadedAt: new Date().toISOString(),
        sourceFile: file.name,
        jiraTickets: actionTickets,
        decisionJiraTickets: decisionTickets,
        docxKey,
        ...(selectedProject ? { projectId: selectedProject } : {}),
      };
      await saveJsonToR2(finalData, jsonKey);
      setPendingUpload(null);
      setStatus({ stage: 'done', message: 'Done!' });
      setRefreshCounter(c => c + 1);
      setSelectedMeeting(jsonKey);
    } catch (err: any) {
      setStatus({ stage: 'error', message: err.message || 'Something went wrong.' });
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const busy = ['extracting', 'parsing', 'saving', 'tickets'].includes(status.stage);

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      {busy && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
          <p className="text-slate-200">{status.message}</p>
        </div>
      )}

      {/* Review panel */}
      {!busy && pendingUpload && (
        <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-100">{pendingUpload.parsed.title}</h2>
              <p className="text-sm text-slate-400">{pendingUpload.parsed.date} &middot; {pendingUpload.parsed.participants.length} attendees</p>
            </div>
            <div className="flex gap-3">
              <ProjectSelector projects={projects} value={selectedProject} onChange={setSelectedProject} onProjectsChange={setProjects} />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-400">SBU</label>
                <select value={sbu} onChange={e => setSbu(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500">
                  {SBU_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Actions review */}
          <div>
            <h3 className="mb-2 font-semibold text-amber-300">Actions</h3>
            <div className="space-y-2">
              {pendingUpload.parsed.actionItems.map((action, idx) => {
                if (actionRemoved[idx]) return null;
                const enabled = actionEnabled[idx] ?? true;
                return (
                  <div key={idx} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 ${enabled ? 'bg-slate-950/60' : 'bg-slate-950/30 opacity-50'}`}>
                    <input type="checkbox" checked={enabled}
                      onChange={() => setActionEnabled(prev => { const n = [...prev]; n[idx] = !n[idx]; return n; })}
                      className="mt-0.5 shrink-0 accent-cyan-500 h-4 w-4 cursor-pointer" title="Create Jira ticket for this action" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200">{action.description}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-slate-500">Owner: {action.owner}</span>
                        <input type="date" value={dueDates[idx] ?? ''} disabled={!enabled}
                          onChange={e => setDueDates(prev => { const n = [...prev]; n[idx] = e.target.value; return n; })}
                          className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-300 outline-none focus:border-cyan-500 disabled:opacity-40"
                          title="Due date" />
                      </div>
                      {!enabled && <p className="mt-0.5 text-xs text-slate-600 italic">No Jira ticket will be created</p>}
                    </div>
                    <select value={priorities[idx] ?? 1} disabled={!enabled}
                      onChange={e => setPriorities(prev => { const n = [...prev]; n[idx] = Number(e.target.value); return n; })}
                      className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none focus:border-cyan-500 disabled:opacity-40">
                      {PRIORITY_OPTIONS.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}
                    </select>
                    <button onClick={() => setActionRemoved(prev => { const n = [...prev]; n[idx] = true; return n; })}
                      className="shrink-0 rounded-lg bg-rose-700 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-600"
                      title="Remove this action">&#10005;</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Decisions review */}
          {pendingUpload.parsed.decisions.length > 0 && (
            <div>
              <h3 className="mb-2 font-semibold text-violet-300">Decisions</h3>
              <p className="mb-2 text-xs text-slate-500">Assign an owner to each decision — a Jira ticket will be created to track accountability.</p>
              <div className="space-y-2">
                {pendingUpload.parsed.decisions.map((dec, idx) => {
                  const enabled = decisionEnabled[idx] ?? true;
                  return (
                    <div key={idx} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 ${enabled ? 'bg-slate-950/60' : 'bg-slate-950/30 opacity-50'}`}>
                      <input type="checkbox" checked={enabled}
                        onChange={() => setDecisionEnabled(prev => { const n = [...prev]; n[idx] = !n[idx]; return n; })}
                        className="mt-0.5 shrink-0 accent-violet-500 h-4 w-4 cursor-pointer" title="Create Jira ticket for this decision" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200">{dec}</p>
                        {!enabled && <p className="mt-0.5 text-xs text-slate-600 italic">No Jira ticket will be created</p>}
                      </div>
                      <input value={decisionOwners[idx] ?? ''} disabled={!enabled}
                        onChange={e => setDecisionOwners(prev => { const n = [...prev]; n[idx] = e.target.value; return n; })}
                        placeholder="Owner name"
                        className="w-40 shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none focus:border-violet-500 disabled:opacity-40" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={confirmUpload} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600">
              Confirm & Create Jira Tickets
            </button>
            <button onClick={() => { setPendingUpload(null); setStatus({ stage: 'idle', message: '' }); }}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
          </div>
        </div>
      )}

      {/* Upload drop zone */}
      {!busy && !pendingUpload && (
        <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/50 p-8 text-center transition hover:border-cyan-500 hover:bg-slate-800/50">
          <p className="text-xl text-slate-400">&#128196;</p>
          <p className="mt-1 font-semibold text-slate-200">Drop a meeting DOCX here to upload</p>
          <p className="text-sm text-slate-500">or click to browse</p>
          {status.stage === 'error' && <p className="mt-2 text-sm text-rose-400">{status.message}</p>}
          <input ref={fileInputRef} type="file" accept=".docx" className="hidden" onChange={handleFileInput} />
        </div>
      )}

      {/* Meeting detail or list */}
      {!busy && !pendingUpload && (
        selectedMeeting ? (
          <MeetingDetail meetingKey={selectedMeeting} onBack={() => setSelectedMeeting(null)}
            projects={projects} onProjectsChange={setProjects}
            contacts={contacts} onContactsChange={setContacts} />
        ) : (
          <div>
            <h3 className="mb-3 text-lg font-semibold text-slate-300">Uploaded Meetings</h3>
            <MeetingsList onSelect={setSelectedMeeting} refresh={refreshCounter}
              onRefresh={() => setRefreshCounter(c => c + 1)} />
          </div>
        )
      )}
    </div>
  );
}
