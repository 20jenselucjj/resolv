'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore, Category, User, Ticket } from '@/lib/store';
import { api } from '@/lib/api';
import {
  Search, ChevronsUpDown,
  Filter, X,
  Clock, Settings2,
  Book, Layers, Trash2,
} from 'lucide-react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { NewTicketPanel } from '@/components/NewTicketPanel';
import {
  STATUS_OPTIONS, PRIORITY_OPTIONS, TYPE_OPTIONS, DATE_OPTIONS,
  priorityColors, statusConfig, TYPE_CONFIG, PRIORITY_ORDER, STATUS_ORDER,
  ALL_COLUMNS,
  getDueDateColor,
  BulkAssignModal,
  BulkCloseModal,
  BulkPriorityModal,
  TicketHeader,
  TicketViewsBar,
  TicketTable,
  BulkActionToolbar,
  BulkDeleteModal,
  InlineCloseModal,
  SaveFilterModal,
  UserTicketView,
} from './components';
import type { SortField, SortDir } from './components';

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
  const [search, setSearch] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return localStorage.getItem('resolv_ticket_search') || ''; } catch { return ''; }
    }
    return '';
  });
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
  
  const initialSort = useMemo(() => {
    if (typeof window === 'undefined') return { field: 'number' as SortField, dir: 'desc' as SortDir };
    try {
      const saved = localStorage.getItem('resolv_ticket_sort');
      return saved ? JSON.parse(saved) : { field: 'number', dir: 'desc' };
    } catch {
      return { field: 'number', dir: 'desc' };
    }
  }, []);

  const [sortField, setSortField] = useState<SortField>(initialSort.field);
  const [sortDir, setSortDir] = useState<SortDir>(initialSort.dir);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const initialVisibleCols = useMemo<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set(ALL_COLUMNS.map(c => c.id));
    try {
      const saved = localStorage.getItem('resolv_ticket_visible_cols');
      if (saved) return new Set(JSON.parse(saved));
      return new Set(ALL_COLUMNS.map(c => c.id));
    } catch {
      return new Set(ALL_COLUMNS.map(c => c.id));
    }
  }, []);

  // New features state
  const [currentView, setCurrentView] = useState(initialFilters.currentView || 'All');
  const [assigneeFilter, setAssigneeFilter] = useState(initialFilters.assigneeFilter || 'all');
  const [dateFilter, setDateFilter] = useState(initialFilters.dateFilter || 'all');
  const [visibleCols, setVisibleCols] = useState<Set<string>>(initialVisibleCols);
  const [showColToggle, setShowColToggle] = useState(false);
  const colToggleRef = useRef<HTMLDivElement>(null);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [showBulkClose, setShowBulkClose] = useState(false);
  const [bulkCloseNote, setBulkCloseNote] = useState('');
  const [inlineCloseTicket, setInlineCloseTicket] = useState<{ id: string; title: string } | null>(null);
  const [inlineCloseNote, setInlineCloseNote] = useState('');
  const [showBulkPriority, setShowBulkPriority] = useState(false);
  const [showBulkMerge, setShowBulkMerge] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
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
    if (typeof window === 'undefined') {
      const initial: Record<string, number> = {};
      ALL_COLUMNS.forEach(c => { if (c.width) initial[c.id] = c.width; });
      return initial;
    }
    try {
      const saved = localStorage.getItem('resolv_ticket_col_widths');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
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
  const isUser = user?.role === 'user';

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

  // Auto-save all filter, sort, search, and column state to localStorage
  useEffect(() => {
    const filters = { status, priority, type, currentView, assigneeFilter, dateFilter };
    localStorage.setItem('resolv_ticket_filters', JSON.stringify(filters));
  }, [status, priority, type, currentView, assigneeFilter, dateFilter]);

  useEffect(() => {
    if (search) localStorage.setItem('resolv_ticket_search', search);
    else localStorage.removeItem('resolv_ticket_search');
  }, [search]);

  useEffect(() => {
    localStorage.setItem('resolv_ticket_sort', JSON.stringify({ field: sortField, dir: sortDir }));
  }, [sortField, sortDir]);

  useEffect(() => {
    localStorage.setItem('resolv_ticket_visible_cols', JSON.stringify([...visibleCols]));
  }, [visibleCols]);

  useEffect(() => {
    localStorage.setItem('resolv_ticket_col_widths', JSON.stringify(colWidths));
  }, [colWidths]);

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

  const handleBulkDelete = async () => {
    try {
      await api.post('/tickets/bulk-delete', { ids: [...selectedIds] });
      setSelectedIds(new Set());
      fetchTickets();
    } catch (err) {
      console.error('Bulk delete failed', err);
    }
  };

  const handleDeleteAll = async () => {
    try {
      await api.delete('/tickets');
      fetchTickets();
    } catch (err) {
      console.error('Delete all failed', err);
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

  const clearFilters = useCallback(() => {
    localStorage.removeItem('resolv_ticket_filters');
    setStatus('all');
    setPriority('all');
    setType('all');
    setSearch('');
    setAssigneeFilter('all');
    setDateFilter('all');
    setCurrentView('All');
  }, []);

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

  const hasFilters = status !== 'all' || priority !== 'all' || type !== 'all' || !!search || assigneeFilter !== 'all' || dateFilter !== 'all' || currentView !== 'All';

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

  // ── Simplified user ticket view ──
  if (isUser) {
    return (
      <UserTicketView
        sorted={sorted}
        user={user}
        showNewTicketPanel={showNewTicketPanel}
        setShowNewTicketPanel={setShowNewTicketPanel}
        fetchTickets={fetchTickets}
      />
    );
  }

  // ── Agent/Admin ticket view ──
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

      <TicketHeader
        sorted={sorted}
        total={total}
        exportCSV={exportCSV}
        fetchTickets={fetchTickets}
        setShowNewTicketPanel={setShowNewTicketPanel}
      />

      <TicketViewsBar
        currentView={currentView}
        setCurrentView={setCurrentView}
        viewCounts={viewCounts}
      />

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
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, transition: 'color 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
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
              onClick={clearFilters}
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

          {user?.role === 'admin' && (
            <>
              <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
              <button
                onClick={() => setShowDeleteAll(true)}
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 500, gap: 4 }}
                title="Delete all tickets"
              >
                <Trash2 size={12} /> Delete All
              </button>
            </>
          )}

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

      <TicketTable
        loading={loading}
        sorted={sorted}
        selectedIds={selectedIds}
        toggleSelectAll={toggleSelectAll}
        toggleSelect={toggleSelect}
        visibleCols={visibleCols}
        colWidths={colWidths}
        sortField={sortField}
        sortDir={sortDir}
        toggleSort={toggleSort}
        resizeRef={resizeRef}
        rowPad={rowPad}
        hasFilters={hasFilters}
        setShowNewTicketPanel={setShowNewTicketPanel}
        handleInlineUpdate={handleInlineUpdate}
        isAdminOrAgent={isAdminOrAgent}
        user={user}
        allUsers={allUsers}
        clearFilters={clearFilters}
      />

      {selectedIds.size > 0 && (
        <BulkActionToolbar
          selectedIds={selectedIds}
          isAdminOrAgent={isAdminOrAgent}
          setShowBulkAssign={setShowBulkAssign}
          setShowBulkPriority={setShowBulkPriority}
          setShowBulkMerge={setShowBulkMerge}
          setShowBulkClose={setShowBulkClose}
          setBulkCloseNote={setBulkCloseNote}
          setShowBulkDelete={setShowBulkDelete}
          setSelectedIds={setSelectedIds}
        />
      )}

      {showBulkAssign && (
        <BulkAssignModal
          selectedIds={selectedIds}
          allUsers={allUsers}
          handleBulkUpdate={handleBulkUpdate}
          onClose={() => setShowBulkAssign(false)}
        />
      )}

      {showBulkPriority && (
        <BulkPriorityModal
          selectedIds={selectedIds}
          handleBulkUpdate={handleBulkUpdate}
          onClose={() => setShowBulkPriority(false)}
        />
      )}

      {showBulkDelete && (
        <BulkDeleteModal
          selectedIds={selectedIds}
          handleBulkDelete={handleBulkDelete}
          onClose={() => setShowBulkDelete(false)}
        />
      )}

      {showDeleteAll && (
        <BulkDeleteModal
          selectedIds={new Set()}
          handleBulkDelete={handleDeleteAll}
          onClose={() => setShowDeleteAll(false)}
          isDeleteAll
        />
      )}

      {showBulkClose && (
        <BulkCloseModal
          selectedIds={selectedIds}
          bulkCloseNote={bulkCloseNote}
          setBulkCloseNote={setBulkCloseNote}
          handleBulkUpdate={handleBulkUpdate}
          onClose={() => { setShowBulkClose(false); setBulkCloseNote(''); }}
        />
      )}

      <InlineCloseModal
        inlineCloseTicket={inlineCloseTicket}
        setInlineCloseTicket={setInlineCloseTicket}
        inlineCloseNote={inlineCloseNote}
        setInlineCloseNote={setInlineCloseNote}
        sorted={sorted}
        fetchTickets={fetchTickets}
      />

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
              <button className="btn btn-ghost" onClick={() => setShowBulkMerge(false)} style={{ transition: 'all 0.15s ease' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
              >Cancel</button>
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

      {showSaveFilter && (
        <SaveFilterModal
          showSaveFilter={showSaveFilter}
          setShowSaveFilter={setShowSaveFilter}
          handleSaveFilter={handleSaveFilter}
          filterName={filterName}
          setFilterName={setFilterName}
        />
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
