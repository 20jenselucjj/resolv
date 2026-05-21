'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore, Category, User, Ticket } from '@/lib/store';
import { api } from '@/lib/api';
import {
  Plus, Search, ChevronUp, ChevronDown, ChevronsUpDown,
  Filter, X, RefreshCw, ArrowUpRight, Download,
  Clock, Calendar, Users, Settings2, Ghost, LayoutGrid,
  AlertTriangle, Package, GitBranch, Book, Layers
} from 'lucide-react';
import { InlineSelect } from '@/components/InlineSelect';
import { UserSearchSelect } from '@/components/UserSearchSelect';
import { useClickOutside } from '@/hooks/useClickOutside';
import { NewTicketPanel } from '@/components/NewTicketPanel';

const STATUS_OPTIONS = ['all', 'open', 'in_progress', 'waiting', 'closed'];
const PRIORITY_OPTIONS = ['all', 'low', 'medium', 'high', 'critical'];
const TYPE_OPTIONS = ['all', 'incident', 'service_request', 'problem', 'change'];

const DATE_OPTIONS = [
  { value: 'all', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range...' },
];

const priorityColors: Record<string, string> = {
  low: 'var(--priority-low)',
  medium: 'var(--priority-medium)',
  high: 'var(--priority-high)',
  critical: 'var(--priority-critical)',
};

const statusConfig: Record<string, { label: string; badgeClass: string }> = {
  open:        { label: 'Open',        badgeClass: 'badge badge-open' },
  in_progress: { label: 'In Progress', badgeClass: 'badge badge-progress' },
  waiting:     { label: 'Waiting',     badgeClass: 'badge badge-waiting' },
  closed:      { label: 'Closed',      badgeClass: 'badge badge-resolved' },
  resolved:    { label: 'Closed',      badgeClass: 'badge badge-resolved' },
};

const TYPE_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  incident: { 
    label: 'Incident', 
    bg: 'var(--danger-bg)', 
    color: 'var(--danger)', 
    border: '1px solid var(--danger-border)' 
  },
  service_request: { 
    label: 'Service Request', 
    bg: 'var(--info-bg)', 
    color: 'var(--info)', 
    border: '1px solid var(--info-border)' 
  },
  problem: { 
    label: 'Problem', 
    bg: 'var(--warning-bg)', 
    color: 'var(--warning)', 
    border: '1px solid var(--warning-border)' 
  },
  change: { 
    label: 'Change', 
    bg: '#ede9fe', 
    color: '#7c3aed', 
    border: '1px solid #ddd6fe' 
  },
};

type SortField = 'number' | 'title' | 'status' | 'priority' | 'created_at' | 'ticket_type' | 'updated_at' | 'assignee' | 'reporter' | 'due_date';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const STATUS_ORDER: Record<string, number> = { open: 0, in_progress: 1, waiting: 2, closed: 3 };

const ALL_COLUMNS = [
  { id: 'number', label: '#', width: 60, minWidth: 40, sortable: true },
  { id: 'title', label: 'Title', width: undefined, minWidth: 100, sortable: true },
  { id: 'description', label: 'Description', width: 200, minWidth: 80, sortable: false },
  { id: 'ticket_type', label: 'Type', width: 110, minWidth: 80, sortable: true },
  { id: 'status', label: 'Status', width: 120, minWidth: 90, sortable: true },
  { id: 'priority', label: 'Priority', width: 110, minWidth: 80, sortable: true },
  { id: 'assignee', label: 'Assigned To', width: 140, minWidth: 100, sortable: true },
  { id: 'reporter', label: 'Reporter', width: 140, minWidth: 100, sortable: true },
  { id: 'due_date', label: 'Due Date', width: 110, minWidth: 80, sortable: true },
  { id: 'created_at', label: 'Created', width: 110, minWidth: 80, sortable: true },
  { id: 'updated_at', label: 'Updated', width: 110, minWidth: 80, sortable: true },
] as const;

const VIEWS = ['All', 'My Tickets', 'Unassigned', 'SLA Breached', 'Due Today'];

function getDueDateColor(dateStr?: string) {
  if (!dateStr) return 'var(--text-muted)';
  const due = new Date(dateStr);
  const now = new Date();
  const isToday = due.toDateString() === now.toDateString();
  const isOverdue = due < now && !isToday;
  if (isOverdue) return 'var(--danger)';
  if (isToday) return 'var(--warning)';
  return 'var(--text-secondary)';
}

const TICKET_TYPE_OPTIONS_PANEL = [
  { value: 'incident',        label: 'Incident',        icon: AlertTriangle, color: 'var(--danger)',   bg: 'var(--danger-bg)',   border: 'var(--danger-border)' },
  { value: 'service_request', label: 'Service Request', icon: Package,       color: 'var(--info)',     bg: 'var(--info-bg)',     border: 'var(--info-border)' },
  { value: 'problem',         label: 'Problem',         icon: Search,        color: 'var(--warning)',  bg: 'var(--warning-bg)',  border: 'var(--warning-border)' },
  { value: 'change',          label: 'Change',          icon: GitBranch,     color: '#7c3aed',         bg: '#ede9fe',            border: '#ddd6fe' },
];

const PRIORITY_OPTIONS_PANEL = [
  { value: 'low',      label: 'Low',      color: 'var(--priority-low)' },
  { value: 'medium',   label: 'Medium',   color: 'var(--priority-medium)' },
  { value: 'high',     label: 'High',     color: 'var(--priority-high)' },
  { value: 'critical', label: 'Critical', color: 'var(--priority-critical)' },
];

export default function TicketsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tickets, setTickets, density, user } = useStore();
  
  const [loading, setLoading] = useState(true);

  // Load initial filters from localStorage or searchParams
  const initialFilters = useMemo(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem('resolv_ticket_filters');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }, []);

  const [status, setStatus] = useState(searchParams.get('status') || initialFilters.status || 'all');
  const [priority, setPriority] = useState(searchParams.get('priority') || initialFilters.priority || 'all');
  const [type, setType] = useState(searchParams.get('type') || initialFilters.type || 'all');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [showNewTicketPanel, setShowNewTicketPanel] = useState(() => {
    if (typeof window !== 'undefined') {
      return searchParams.get('new') === '1';
    }
    return false;
  });
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try { return JSON.parse(localStorage.getItem('resolv_recent_searches') || '[]'); } catch { return []; }
    }
    return [];
  });
  const [showRecentSearch, setShowRecentSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  useClickOutside(searchRef as React.RefObject<HTMLElement>, () => setShowRecentSearch(false));
  
  const [sortField, setSortField] = useState<SortField>('number');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // New features state
  const [currentView, setCurrentView] = useState(initialFilters.currentView || 'All');
  const [assigneeFilter, setAssigneeFilter] = useState(initialFilters.assigneeFilter || 'all');
  const [dateFilter, setDateFilter] = useState(initialFilters.dateFilter || 'all');
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(ALL_COLUMNS.map(c => c.id)));
  const [showColToggle, setShowColToggle] = useState(false);
  const colToggleRef = useRef<HTMLDivElement>(null);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [showBulkClose, setShowBulkClose] = useState(false);
  const [bulkCloseNote, setBulkCloseNote] = useState('');
  const [inlineCloseTicket, setInlineCloseTicket] = useState<{ id: string; title: string } | null>(null);
  const [inlineCloseNote, setInlineCloseNote] = useState('');
  const [showBulkPriority, setShowBulkPriority] = useState(false);
  const [showBulkMerge, setShowBulkMerge] = useState(false);
  const [savedFilters, setSavedFilters] = useState<{ name: string; filters: Record<string, string> }[]>(() => {
    if (typeof window !== 'undefined') {
      try { return JSON.parse(localStorage.getItem('resolv_saved_filters') || '[]'); } catch { return []; }
    }
    return [];
  });
  const [showSaveFilter, setShowSaveFilter] = useState(false);
  const [showLoadFilter, setShowLoadFilter] = useState(false);
  const [filterName, setFilterName] = useState('');
  const loadFilterRef = useRef<HTMLDivElement>(null);
  
  useClickOutside(colToggleRef, () => setShowColToggle(false));
  useClickOutside(loadFilterRef as React.RefObject<HTMLElement>, () => setShowLoadFilter(false));

  // Column resizing

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    ALL_COLUMNS.forEach(c => { if (c.width) initial[c.id] = c.width; });
    return initial;
  });
  const [allUsers, setAllUsers] = useState<User[]>([]);

  useEffect(() => {
    api.get<{ data: User[] }>('/users').then(res => {
      setAllUsers(res.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => setShowNewTicketPanel(true);
    window.addEventListener('resolv:new-ticket', handler);
    return () => window.removeEventListener('resolv:new-ticket', handler);
  }, []);

  const resizeRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const resize = resizeRef.current;
      if (!resize) return;
      const diff = e.clientX - resize.startX;
      const col = ALL_COLUMNS.find(c => c.id === resize.colId);
      const newWidth = Math.max(col?.minWidth || 40, resize.startWidth + diff);
      setColWidths(prev => ({ ...prev, [resize.colId]: newWidth }));
    };
    const onMouseUp = () => { resizeRef.current = null; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
  }, []);

  const isAdminOrAgent = user?.role === 'admin' || user?.role === 'agent';

  const viewCounts = useMemo<Record<string, number>>(() => {
    return {
      'All': tickets.length,
      'My Tickets': tickets.filter(t => t.assigned_to_name === user?.name || t.requested_by_name === user?.name).length,
      'Unassigned': tickets.filter(t => !t.assigned_to_name).length,
      'SLA Breached': tickets.filter(t => t.sla_breached).length,
      'Due Today': tickets.filter(t => {
        if (!t.due_date) return false;
        const due = new Date(t.due_date);
        const today = new Date();
        return due.toDateString() === today.toDateString();
      }).length,
    };
  }, [tickets, user]);

  const assignees = useMemo(() => {
    const set = new Set<string>();
    allUsers.filter(u => u.role === 'admin' || u.role === 'agent').forEach(u => {
      if (u.name) set.add(u.name);
    });
    if (user?.role !== 'user') {
      const name = user?.name;
      if (name) set.add(name);
    }
    return Array.from(set).sort();
  }, [allUsers, user]);

  const assigneeNameToId = useMemo(() => {
    const map = new Map<string, string>();
    allUsers.forEach(u => {
      if (u.id && u.name) map.set(u.name, u.id);
    });
    return map;
  }, [allUsers]);

  const fetchTickets = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: '500' });
    if (status !== 'all') params.set('status', status);
    if (priority !== 'all') params.set('priority', priority);
    if (type !== 'all') params.set('type', type);
    if (search) params.set('search', search);
    
    api.get<{ data: Ticket[]; total: number }>(`/tickets?${params}`)
      .then((res) => { setTickets(res.data); setTotal(res.total); })
      .finally(() => setLoading(false));
  }, [status, priority, type, search, setTickets]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      router.replace('/dashboard/tickets');
    }
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'r' && !(e.target as HTMLElement).matches('input,textarea,select') && !e.metaKey && !e.ctrlKey) {
        fetchTickets();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fetchTickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const aName = t.assigned_to_name;
      const rName = t.requested_by_name;
      
      if (currentView === 'My Tickets' && aName !== user?.name && rName !== user?.name) return false;
      if (currentView === 'Unassigned' && aName) return false;
      if (currentView === 'SLA Breached' && !t.sla_breached) return false;
      if (currentView === 'Due Today') {
        if (!t.due_date) return false;
        const due = new Date(t.due_date);
        const today = new Date();
        if (due.toDateString() !== today.toDateString()) return false;
      }
      
      if (isAdminOrAgent && assigneeFilter !== 'all' && aName !== assigneeFilter) return false;
      
      if (dateFilter !== 'all' && dateFilter !== 'custom') {
        const created = new Date(t.created_at);
        const today = new Date();
        if (dateFilter === 'today' && created.toDateString() !== today.toDateString()) return false;
        if (dateFilter === '7d' && created < new Date(today.getTime() - 7 * 86400000)) return false;
        if (dateFilter === '30d' && created < new Date(today.getTime() - 30 * 86400000)) return false;
      }
      return true;
    });
  }, [tickets, currentView, assigneeFilter, dateFilter, user, isAdminOrAgent]);

  const sorted = useMemo(() => {
    return [...filteredTickets].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'number') cmp = a.number - b.number;
      else if (sortField === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortField === 'status') cmp = (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0);
      else if (sortField === 'priority') cmp = (PRIORITY_ORDER[a.priority] ?? 0) - (PRIORITY_ORDER[b.priority] ?? 0);
      else if (sortField === 'ticket_type') cmp = (a.ticket_type || '').localeCompare(b.ticket_type || '');
      else if (sortField === 'created_at') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortField === 'updated_at') cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      else if (sortField === 'due_date') {
        const da = a.due_date ? new Date(a.due_date).getTime() : 0;
        const db = b.due_date ? new Date(b.due_date).getTime() : 0;
        cmp = da - db;
      }
      else if (sortField === 'assignee') {
        const aa = a.assigned_to_name || '';
        const ab = b.assigned_to_name || '';
        cmp = aa.localeCompare(ab);
      }
      else if (sortField === 'reporter') {
        const ra = a.created_by_name || '';
        const rb = b.created_by_name || '';
        cmp = ra.localeCompare(rb);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredTickets, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === sorted.length && sorted.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(sorted.map((t) => t.id)));
  }

  const handleBulkUpdate = async (updates: Partial<Ticket>) => {
    try {
      await api.patch('/tickets/bulk', { ids: [...selectedIds], updates });
      setSelectedIds(new Set());
      fetchTickets();
    } catch (err) {
      console.error('Bulk update failed', err);
    }
  };

  const handleInlineUpdate = useCallback(async (ticketId: string, updates: Partial<Ticket>) => {
    if (updates.status === 'closed') {
      const ticket = sorted.find(t => t.id === ticketId);
      if (ticket) {
        setInlineCloseTicket({ id: ticketId, title: ticket.title });
        setInlineCloseNote('');
      }
      return;
    }
    try {
      await api.patch(`/tickets/${ticketId}`, updates);
      fetchTickets();
    } catch (err) {
      console.error('Inline update failed', err);
    }
  }, [fetchTickets, sorted]);

  const exportCSV = () => {
    if (sorted.length === 0) return;
    const headers = ['ID', 'Title', 'Type', 'Status', 'Priority', 'Assignee', 'Reporter', 'Created', 'Updated', 'Due Date', 'SLA Breached'];
    const rows = sorted.map(t => [
      t.number,
      `"${t.title.replace(/"/g, '""')}"`,
      t.ticket_type || '',
      t.status,
      t.priority,
      t.assigned_to_name || '',
      t.created_by_name || '',
      t.created_at,
      t.updated_at,
      t.due_date || '',
      t.sla_breached ? 'Yes' : 'No'
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const hasFilters = status !== 'all' || priority !== 'all' || type !== 'all' || search || assigneeFilter !== 'all' || dateFilter !== 'all' || currentView !== 'All';

  function getCurrentFilters() {
    return { status, priority, type, assigneeFilter, dateFilter, currentView };
  }

  function applyFilters(filters: Record<string, string>) {
    if (filters.status) setStatus(filters.status);
    if (filters.priority) setPriority(filters.priority);
    if (filters.type) setType(filters.type);
    if (filters.assigneeFilter) setAssigneeFilter(filters.assigneeFilter);
    if (filters.dateFilter) setDateFilter(filters.dateFilter);
    if (filters.currentView) setCurrentView(filters.currentView);
  }

  function handleSaveFilter() {
    if (!filterName.trim()) return;
    const newFilters = [...savedFilters, { name: filterName.trim(), filters: getCurrentFilters() }];
    setSavedFilters(newFilters);
    localStorage.setItem('resolv_saved_filters', JSON.stringify(newFilters));
    setFilterName('');
    setShowSaveFilter(false);
  }

  function handleLoadFilter(filter: { name: string; filters: Record<string, string> }) {
    applyFilters(filter.filters);
    setShowLoadFilter(false);
  }

  function handleDeleteFilter(name: string) {
    const newFilters = savedFilters.filter(f => f.name !== name);
    setSavedFilters(newFilters);
    localStorage.setItem('resolv_saved_filters', JSON.stringify(newFilters));
  }

  const rowPad = density === 'compact' ? '7px 16px' : '11px 16px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes slideUpPanel {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .row-animate {
          animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .ticket-row {
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s ease;
        }
        .ticket-row:hover {
          transform: translateX(2px);
        }
        .skeleton-shimmer {
          background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%);
          background-size: 200% 100%;
          animation: shimmer 2s infinite linear;
        }
        .ticket-view-tab:hover {
          color: var(--text) !important;
          background: var(--bg-tertiary) !important;
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 16,
        background: 'var(--bg-secondary)',
        flexShrink: 0,
      }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 4, height: 24, background: 'var(--accent)', borderRadius: 2 }} />
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--text)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center' }}>
            Tickets
            <span style={{ 
              color: 'var(--text-muted)', fontWeight: 600, fontSize: 12, marginLeft: 12, 
              padding: '2px 10px', background: 'var(--bg)', borderRadius: 'var(--radius-full)', 
              border: '1px solid var(--border)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
              {sorted.length > 0 ? sorted.length : total}
            </span>
          </h1>
        </div>

        <button
          onClick={exportCSV}
          className="btn btn-ghost"
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', gap: 8 }}
        >
          <Download size={15} />
          Export CSV
        </button>

        <button
          onClick={fetchTickets}
          data-tooltip="Refresh"
          className="btn btn-ghost btn-icon"
          style={{ borderRadius: 'var(--radius-md)' }}
        >
          <RefreshCw size={15} />
        </button>

        <button
          onClick={() => setShowNewTicketPanel(true)}
          className="btn btn-primary"
          style={{ 
            boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.25)',
            padding: '0 20px',
            height: 40,
            fontSize: 14,
            fontWeight: 600,
            gap: 8
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          New Ticket
        </button>
      </div>

      {/* Views Bar */}
      <div style={{ padding: '20px 24px 0 24px', background: 'var(--bg-secondary)' }}>
        <div style={{ 
          display: 'flex', gap: 6, background: 'var(--bg-tertiary)', 
          padding: 6, borderRadius: 'var(--radius-full)', width: 'fit-content', 
          border: '1px solid var(--border)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
        }}>
          {VIEWS.map(v => {
            const isActive = currentView === v;
            const count = viewCounts[v];
            return (
              <button
                key={v}
                onClick={() => setCurrentView(v)}
                style={{
                  background: isActive ? 'var(--card)' : 'transparent',
                  border: 'none',
                  boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' : 'none',
                  padding: '6px 16px', borderRadius: 'var(--radius-full)',
                  fontSize: 13, fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--text)' : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  display: 'flex', alignItems: 'center', gap: 8
                }}
                className="ticket-view-tab"
              >
                {v}
                {count > 0 && (
                  <span style={{ 
                    fontSize: 10, padding: '1px 6px', 
                    background: isActive ? 'var(--accent)' : 'var(--bg-secondary)', 
                    color: isActive ? '#fff' : 'var(--text-muted)', 
                    borderRadius: '10px', fontWeight: 700,
                    minWidth: 18, textAlign: 'center'
                  }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Filters */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0 }}>
          {/* Search */}
          <div ref={searchRef} style={{ position: 'relative', width: 300 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              placeholder="Search tickets by title, #ID, or tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.trim()) {
                  const updated = [search.trim(), ...recentSearches.filter(s => s !== search.trim())].slice(0, 8);
                  setRecentSearches(updated);
                  localStorage.setItem('resolv_recent_searches', JSON.stringify(updated));
                  setShowRecentSearch(false);
                }
              }}
              onFocus={() => { if (recentSearches.length > 0 && !search) setShowRecentSearch(true); }}
              className="input"
              style={{ 
                paddingLeft: 38, height: 36, fontSize: 13, width: '100%', 
                background: 'var(--bg)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
                <X size={14} />
              </button>
            )}
            {showRecentSearch && recentSearches.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                zIndex: 50, padding: 4, animation: 'popIn 0.15s ease-out'
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', padding: '4px 8px 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Searches</div>
                {recentSearches.map((s) => (
                  <div key={s}
                    onClick={() => { setSearch(s); setShowRecentSearch(false); }}
                    style={{ padding: '6px 8px', cursor: 'pointer', fontSize: 12, color: 'var(--text)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 8 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Clock size={11} color="var(--text-muted)" />
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ 
            display: 'flex', gap: 6, alignItems: 'center', 
            background: 'var(--bg-tertiary)', padding: '4px 8px', 
            borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px', color: 'var(--text-muted)' }}>
              <Filter size={14} />
            </div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="select"
              style={{ height: 28, fontSize: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 8px' }}
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t === 'all' ? 'All Types' : t.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="select"
              style={{ height: 28, fontSize: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 8px' }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s === 'all' ? 'All Status' : s.replace('_', ' ')}</option>
              ))}
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="select"
              style={{ height: 28, fontSize: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 8px' }}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p === 'all' ? 'All Priority' : p}</option>
              ))}
            </select>
            
            {isAdminOrAgent && (
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="select"
                style={{ height: 28, fontSize: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 8px' }}
              >
                <option value="all">All Assignees</option>
                {assignees.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
            
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="select"
              style={{ height: 28, fontSize: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 8px' }}
            >
              {DATE_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {hasFilters && (
            <button
              onClick={() => { localStorage.removeItem('resolv_ticket_filters'); setStatus('all'); setPriority('all'); setType('all'); setSearch(''); setAssigneeFilter('all'); setDateFilter('all'); setCurrentView('All'); }}
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 500 }}
            >
              <X size={12} /> Clear Filters
            </button>
          )}

          {/* Saved Filters */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              onClick={() => setShowSaveFilter(true)}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, fontWeight: 500, gap: 4 }}
              title="Save current filters"
            >
              <Book size={12} /> Save
            </button>
            <div style={{ position: 'relative' }} ref={loadFilterRef}>
              <button
                onClick={() => setShowLoadFilter(!showLoadFilter)}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, fontWeight: 500, gap: 4 }}
                title="Load saved filters"
              >
                <Layers size={12} /> Filters
                {savedFilters.length > 0 && (
                  <span style={{ background: 'var(--accent)', color: '#fff', padding: '1px 5px', borderRadius: 8, fontSize: 10, fontWeight: 700 }}>{savedFilters.length}</span>
                )}
              </button>
              {showLoadFilter && (
                <div style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: 8,
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '8px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)', zIndex: 50,
                  width: 240, animation: 'popIn 0.2s ease-out'
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, padding: '0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saved Filters</div>
                  {savedFilters.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 4px', textAlign: 'center' }}>No saved filters</div>
                  ) : (
                    savedFilters.map(f => (
                      <div key={f.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span onClick={() => handleLoadFilter(f)} style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, flex: 1 }}>{f.name}</span>
                        <button onClick={() => handleDeleteFilter(f.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

          {/* Column Toggle */}
          <div style={{ position: 'relative' }} ref={colToggleRef}>
            <button
              onClick={() => setShowColToggle(!showColToggle)}
              className="btn btn-ghost btn-icon"
              style={{ color: 'var(--text-muted)' }}
              title="Toggle columns"
            >
              <Settings2 size={16} />
            </button>
            {showColToggle && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 8,
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: '12px 8px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)', zIndex: 50,
                width: 200, animation: 'popIn 0.2s ease-out'
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, padding: '0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Columns</div>
                {ALL_COLUMNS.map(c => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px', cursor: 'pointer', borderRadius: 'var(--radius-sm)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <input
                      type="checkbox"
                      checked={visibleCols.has(c.id)}
                      onChange={() => {
                        const next = new Set(visibleCols);
                        if (next.has(c.id)) next.delete(c.id);
                        else next.add(c.id);
                        setVisibleCols(next);
                      }}
                      style={{ accentColor: 'var(--accent)', transform: 'scale(1.1)' }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{c.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[1,2,3,4,5,6,7,8].map((i) => (
              <div key={i} className="skeleton skeleton-shimmer" style={{ height: 52, borderRadius: 'var(--radius-lg)', opacity: 1 - (i * 0.1) }} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: '120px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ 
              width: 100, height: 100, borderRadius: '32px', background: 'var(--bg-tertiary)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
              color: 'var(--accent)', boxShadow: '0 8px 32px rgba(0,0,0,0.05)',
              border: '1px solid var(--border-subtle)',
              transform: 'rotate(-5deg)'
            }}>
              <Ghost size={48} strokeWidth={1.5} />
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 12, letterSpacing: '-0.02em' }}>No tickets found</h3>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.6, marginBottom: 32 }}>
              {hasFilters ? "We searched everywhere but couldn't find any tickets matching those filters. Try clearing some filters or searching for something else." : "Your ticket queue is currently empty. Create a new ticket to get started."}
            </p>
            {hasFilters ? (
              <button
                onClick={() => { localStorage.removeItem('resolv_ticket_filters'); setStatus('all'); setPriority('all'); setType('all'); setSearch(''); setAssigneeFilter('all'); setDateFilter('all'); setCurrentView('All'); }}
                className="btn btn-secondary"
                style={{ borderRadius: 'var(--radius-full)', padding: '0 24px' }}
              >
                <X size={16} /> Clear all filters
              </button>
            ) : (
              <button
                onClick={() => setShowNewTicketPanel(true)}
                className="btn btn-primary"
                style={{ borderRadius: 'var(--radius-full)', padding: '0 24px', boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.2)' }}
              >
                <Plus size={16} /> Create your first ticket
              </button>
            )}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', overflow: 'visible' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2, backdropFilter: 'blur(8px)', background: 'rgba(var(--bg-secondary-rgb), 0.9)' }}>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ width: 40, padding: '12px 16px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === sorted.length && sorted.length > 0}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', accentColor: 'var(--accent)', transform: 'scale(1.1)' }}
                  />
                </th>
                {ALL_COLUMNS.filter(c => visibleCols.has(c.id)).map(({ id, label, sortable, minWidth }) => {
                  const w = colWidths[id];
                  return (
                    <th
                      key={id}
                      style={{
                        padding: '12px', textAlign: 'left',
                        fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        width: w, minWidth, cursor: sortable ? 'pointer' : 'default',
                        userSelect: 'none', whiteSpace: 'nowrap',
                        position: 'relative',
                      }}
                      onClick={() => sortable && toggleSort(id as SortField)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {label}
                        {sortable && (
                          sortField === id
                            ? sortDir === 'asc'
                              ? <ChevronUp size={12} color="var(--accent)" strokeWidth={3} />
                              : <ChevronDown size={12} color="var(--accent)" strokeWidth={3} />
                            : <ChevronsUpDown size={12} style={{ opacity: 0.3, flexShrink: 0 }} />
                        )}
                      </div>
                      {/* Resize handle */}
                      <div
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          resizeRef.current = { colId: id, startX: e.clientX, startWidth: w || minWidth || 100 };
                          document.body.style.cursor = 'col-resize';
                          document.body.style.userSelect = 'none';
                        }}
                        style={{
                          position: 'absolute', right: 0, top: 0, bottom: 0,
                          width: 4, cursor: 'col-resize', zIndex: 3,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--accent)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      />
                    </th>
                  );
                })}
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((t, idx) => {
                const sc = statusConfig[t.status] || statusConfig.open;
                const tc = t.ticket_type ? TYPE_CONFIG[t.ticket_type] : null;
                const isSelected = selectedIds.has(t.id);
                const aName = t.assigned_to_name;
                const priorityColor = priorityColors[t.priority] || 'transparent';

                return (
                  <tr
                    key={t.id}
                    className="row-animate ticket-row"
                    style={{
                      animationDelay: `${Math.min(idx * 0.02, 0.2)}s`,
                      borderBottom: '1px solid var(--border-subtle)',
                      background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                      cursor: 'pointer',
                    }}
                    onClick={() => router.push(`/dashboard/tickets/${t.id}`)}
                  >
                    <td style={{ padding: rowPad, width: 40, borderLeft: `3px solid ${priorityColor}`, position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(t.id)}
                        style={{ cursor: 'pointer', accentColor: 'var(--accent)', transform: 'scale(1.1)' }}
                      />
                    </td>
                    
                    {visibleCols.has('number') && (
                      <td
                        style={{ padding: rowPad, fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 600 }}
                      >
                        #{t.number}
                      </td>
                    )}

                    {visibleCols.has('title') && (
                      <td
                        style={{ padding: rowPad, maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            title={t.title}
                            style={{
                              fontSize: 14, fontWeight: 600,
                              color: 'var(--text)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              cursor: 'pointer',
                              padding: '3px 6px', borderRadius: 'var(--radius-sm)',
                              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                              position: 'relative',
                            }}
                            onMouseEnter={e => { 
                              e.currentTarget.style.background = 'var(--accent-subtle)'; 
                              e.currentTarget.style.color = 'var(--accent)';
                              e.currentTarget.style.transform = 'translateX(2px)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(var(--accent-rgb), 0.15)';
                            }}
                            onMouseLeave={e => { 
                              e.currentTarget.style.background = 'transparent'; 
                              e.currentTarget.style.color = 'var(--text)';
                              e.currentTarget.style.transform = 'translateX(0)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            {t.title}
                          </div>
                          {t.sla_breached && (
                            <div data-tooltip="SLA Breached" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-full)', border: '1px solid var(--danger-border)', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                              <Clock size={10} strokeWidth={2.5} /> SLA
                            </div>
                          )}
                        </div>
                        {t.tags?.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 6, overflow: 'hidden' }}>
                            {t.tags.slice(0, 3).map((tag: string) => (
                              <span key={tag} style={{ fontSize: 11, padding: '2px 8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    )}

                    {visibleCols.has('description') && (
                      <td style={{ padding: rowPad, maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.description ? (
                          <div
                            title={t.description}
                            style={{
                              fontSize: 12,
                              color: 'var(--text-secondary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              cursor: 'pointer',
                              padding: '3px 6px', borderRadius: 'var(--radius-sm)',
                              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                              lineHeight: 1.5,
                            }}
                            onMouseEnter={e => { 
                              e.currentTarget.style.background = 'var(--bg-tertiary)'; 
                              e.currentTarget.style.color = 'var(--text)';
                              e.currentTarget.style.transform = 'translateX(2px)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                            }}
                            onMouseLeave={e => { 
                              e.currentTarget.style.background = 'transparent'; 
                              e.currentTarget.style.color = 'var(--text-secondary)';
                              e.currentTarget.style.transform = 'translateX(0)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            {t.description}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                    )}

                    {visibleCols.has('ticket_type') && (
                      <td style={{ padding: rowPad, whiteSpace: 'nowrap' }}>
                        {tc ? (
                          <span style={{ 
                            fontSize: 10, padding: '3px 8px', borderRadius: 'var(--radius-sm)', 
                            fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em',
                            background: tc.bg, color: tc.color, border: tc.border,
                            whiteSpace: 'nowrap',
                          }}>
                            {tc.label}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                    )}

                    {visibleCols.has('status') && (
                      <td style={{ padding: rowPad, position: 'relative', overflow: 'visible' }} onClick={(e) => { if (isAdminOrAgent) e.stopPropagation(); }}>
                        {isAdminOrAgent ? (
                          <InlineSelect
                            value={t.status}
                            options={STATUS_OPTIONS.filter(s => s !== 'all').map(s => ({ value: s, label: statusConfig[s]?.label || s }))}
                            onChange={(val) => handleInlineUpdate(t.id, { status: val as Ticket['status'] })}
                            renderValue={(val) => {
                              const sc2 = statusConfig[val] || statusConfig.open;
                              return <span className={sc2.badgeClass} style={{ padding: '4px 10px', fontSize: 11 }}>{sc2.label}</span>;
                            }}
                          />
                        ) : (
                          <span className={sc.badgeClass} style={{ padding: '4px 10px', fontSize: 11 }}>{sc.label}</span>
                        )}
                      </td>
                    )}

                    {visibleCols.has('priority') && (
                      <td style={{ padding: rowPad, position: 'relative', overflow: 'visible' }} onClick={(e) => { if (isAdminOrAgent) e.stopPropagation(); }}>
                        {isAdminOrAgent ? (
                          <InlineSelect
                            value={t.priority}
                            options={PRIORITY_OPTIONS.filter(p => p !== 'all').map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
                            onChange={(val) => handleInlineUpdate(t.id, { priority: val as Ticket['priority'] })}
                            renderValue={(val) => (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: priorityColors[val], flexShrink: 0, boxShadow: `0 0 8px ${priorityColors[val]}40` }} />
                                <span style={{ fontSize: 12, textTransform: 'capitalize', color: 'var(--text-secondary)', fontWeight: 500 }}>{val}</span>
                              </div>
                            )}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: priorityColors[t.priority], flexShrink: 0, boxShadow: `0 0 8px ${priorityColors[t.priority]}40` }} />
                            <span style={{ fontSize: 12, textTransform: 'capitalize', color: 'var(--text-secondary)', fontWeight: 500 }}>{t.priority}</span>
                          </div>
                        )}
                      </td>
                    )}

                    {visibleCols.has('assignee') && (
                      <td style={{ padding: rowPad, fontSize: 13, color: 'var(--text-secondary)', position: 'relative', overflow: 'visible' }} onClick={(e) => { if (isAdminOrAgent) e.stopPropagation(); }}>
                        {isAdminOrAgent ? (
                          <UserSearchSelect
                            users={allUsers.filter(u => u.role === 'admin' || u.role === 'agent')}
                            value={t.assigned_to_id}
                            onChange={(val) => handleInlineUpdate(t.id, { assigned_to_id: val })}
                            placeholder="Unassigned"
                          />
                        ) : aName ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                              {aName[0].toUpperCase()}
                            </div>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{aName}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 12 }}>Unassigned</span>
                        )}
                      </td>
                    )}

                    {visibleCols.has('reporter') && (
                      <td style={{ padding: rowPad, fontSize: 13, color: 'var(--text-secondary)', position: 'relative', overflow: 'visible' }} onClick={(e) => { if (isAdminOrAgent) e.stopPropagation(); }}>
                        {isAdminOrAgent ? (
                          <UserSearchSelect
                            users={allUsers}
                            value={t.created_by_id}
                            onChange={(val) => handleInlineUpdate(t.id, { created_by_id: val ?? undefined })}
                            placeholder="Select..."
                            hideClear
                          />
                        ) : t.created_by_name ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: `hsl(${(t.created_by_name.charCodeAt(0) * 37 || 200) % 360}, 55%, 45%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                              {t.created_by_name[0].toUpperCase()}
                            </div>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{t.created_by_name}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 12 }}>—</span>
                        )}
                      </td>
                    )}

                    {visibleCols.has('due_date') && (
                      <td style={{ padding: rowPad, fontSize: 12, whiteSpace: 'nowrap' }}>
                        {t.due_date ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: getDueDateColor(t.due_date), fontWeight: 600 }}>
                            <Calendar size={12} />
                            {new Date(t.due_date).toLocaleDateString()}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                    )}

                    {visibleCols.has('created_at') && (
                      <td style={{ padding: rowPad, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {timeAgo(t.created_at)}
                      </td>
                    )}

                    {visibleCols.has('updated_at') && (
                      <td style={{ padding: rowPad, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {timeAgo(t.updated_at)}
                      </td>
                    )}

                    <td style={{ padding: rowPad, width: 40 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/tickets/${t.id}`); }}
                        className="btn btn-ghost btn-icon btn-sm"
                        style={{ opacity: 0, transition: 'opacity 0.2s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
                        ref={(node) => { if (node && node.parentElement?.parentElement?.matches(':hover')) node.style.opacity = '0.5'; }}
                      >
                        <ArrowUpRight size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(30, 41, 59, 0.95)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', padding: '10px 16px', borderRadius: '16px',
          display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
          zIndex: 100, animation: 'fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: 'var(--accent)', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: 11 }}>
              {selectedIds.size}
            </div>
            selected
          </span>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            {isAdminOrAgent && (
              <>
                <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', fontWeight: 500 }} onClick={() => setShowBulkAssign(true)}>
                  <Users size={14} /> Assign
                </button>
                <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', fontWeight: 500 }} onClick={() => setShowBulkPriority(true)}>
                  <LayoutGrid size={14} /> Change Priority
                </button>
                <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', fontWeight: 500 }} onClick={() => setShowBulkMerge(true)} disabled={selectedIds.size < 2}>
                  <GitBranch size={14} /> Merge
                </button>
              </>
            )}
            <button onClick={() => { setShowBulkClose(true); setBulkCloseNote(''); }} className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontWeight: 500 }}>
              <X size={14} /> Close
            </button>
          </div>
          <button onClick={() => setSelectedIds(new Set())} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4, display: 'flex', marginLeft: 8 }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Bulk Assign Modal */}
      {showBulkAssign && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, minWidth: 320, boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Assign {selectedIds.size} ticket{selectedIds.size > 1 ? 's' : ''}</h3>
            <select className="select" style={{ width: '100%', marginBottom: 16 }} id="bulk-assign-select">
              <option value="">Unassigned</option>
              {allUsers.filter(u => u.role === 'admin' || u.role === 'agent').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowBulkAssign(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => {
                const sel = document.getElementById('bulk-assign-select') as HTMLSelectElement;
                handleBulkUpdate({ assigned_to_id: sel.value || null });
                setShowBulkAssign(false);
              }}>Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Priority Modal */}
      {showBulkPriority && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, minWidth: 320, boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Change Priority for {selectedIds.size} ticket{selectedIds.size > 1 ? 's' : ''}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {PRIORITY_OPTIONS.filter(p => p !== 'all').map(p => (
                <button key={p} className="btn btn-ghost" style={{ justifyContent: 'flex-start', gap: 10, textTransform: 'capitalize' }}
                  onClick={() => { handleBulkUpdate({ priority: p as Ticket['priority'] }); setShowBulkPriority(false); }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: priorityColors[p] }} />
                  {p}
                </button>
              ))}
            </div>
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setShowBulkPriority(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Bulk Close Modal */}
      {showBulkClose && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, minWidth: 360, boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Close {selectedIds.size} ticket{selectedIds.size > 1 ? 's' : ''}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>A closing note is required.</p>
            <textarea
              className="textarea"
              value={bulkCloseNote}
              onChange={e => setBulkCloseNote(e.target.value)}
              placeholder="Enter closing note..."
              rows={4}
              style={{ width: '100%', marginBottom: 16, resize: 'vertical' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowBulkClose(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!bulkCloseNote.trim()} onClick={() => {
                handleBulkUpdate({ status: 'closed', close_notes: bulkCloseNote });
                setShowBulkClose(false);
                setBulkCloseNote('');
              }}>Close Tickets</button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Close Modal */}
      {inlineCloseTicket && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setInlineCloseTicket(null)}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, minWidth: 360, boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Close Ticket</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>#{sorted.find(t => t.id === inlineCloseTicket.id)?.number} - {inlineCloseTicket.title}</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>A closing note is required.</p>
            <textarea
              className="textarea"
              value={inlineCloseNote}
              onChange={e => setInlineCloseNote(e.target.value)}
              placeholder="Enter closing note..."
              rows={4}
              style={{ width: '100%', marginBottom: 16, resize: 'vertical' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setInlineCloseTicket(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={!inlineCloseNote.trim()} onClick={async () => {
                try {
                  await api.patch(`/tickets/${inlineCloseTicket.id}`, { status: 'closed', close_notes: inlineCloseNote });
                  setInlineCloseTicket(null);
                  setInlineCloseNote('');
                  fetchTickets();
                } catch (err) {
                  console.error('Close failed', err);
                }
              }}>Close Ticket</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Merge Modal */}
      {showBulkMerge && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, minWidth: 360, boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Merge {selectedIds.size} tickets</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Select the primary ticket to merge into. All other selected tickets will be closed and linked to it.</p>
            <select className="select" style={{ width: '100%', marginBottom: 12 }} id="bulk-merge-select">
              {sorted.filter(t => selectedIds.has(t.id)).map(t => (
                <option key={t.id} value={t.id}>#{t.number} - {t.title}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowBulkMerge(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={async () => {
                const sel = document.getElementById('bulk-merge-select') as HTMLSelectElement;
                const primaryId = sel.value;
                const otherIds = [...selectedIds].filter(id => id !== primaryId);
                try {
                  await api.post(`/tickets/${primaryId}/merge`, { mergeIds: otherIds });
                  setSelectedIds(new Set());
                  setShowBulkMerge(false);
                  fetchTickets();
                } catch (err) {
                  console.error('Merge failed', err);
                }
              }}>Merge Tickets</button>
            </div>
          </div>
        </div>
      )}

      {/* Save Filter Modal */}
      {showSaveFilter && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, minWidth: 320, boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Save Filter</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Save your current filter combination for quick access later.</p>
            <input
              autoFocus
              className="input"
              value={filterName}
              onChange={e => setFilterName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveFilter(); if (e.key === 'Escape') setShowSaveFilter(false); }}
              placeholder="Filter name (e.g., High Priority Open)"
              style={{ width: '100%', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setShowSaveFilter(false); setFilterName(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveFilter} disabled={!filterName.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {!loading && sorted.length > 0 && (
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
            Showing {sorted.length} {sorted.length === 1 ? 'ticket' : 'tickets'}
          </span>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Click column headers to sort <ChevronsUpDown size={12} /></span>
          </div>
        </div>
      )}
      {/* New Ticket Panel */}
      {showNewTicketPanel && (
        <NewTicketPanel
          onClose={() => setShowNewTicketPanel(false)}
          onCreated={fetchTickets}
        />
      )}
    </div>
  );
}

function timeAgo(dateStr: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
