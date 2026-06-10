'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, Calendar, ChevronDown, CreditCard, CheckSquare, Download, Edit3, FileText,
  Key, MoreHorizontal, Plus, RefreshCw, Search, Shield, Square, Trash2, Upload, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import ImportModal from './ImportModal';

interface SoftwareLicense {
  id: string;
  name: string;
  publisher: string | null;
  version: string | null;
  license_type: string;
  license_key: string | null;
  total_seats: number;
  used_seats: number;
  available_seats: number;
  purchase_date: string | null;
  expiry_date: string | null;
  compliance_status: string;
  cost_per_seat: number | null;
  total_cost: number | null;
  currency: string;
  vendor: string | null;
  is_active: boolean;
  created_by_name: string | null;
  created_at: string;
}

interface ComplianceSummary {
  total: number;
  compliant: number;
  warning: number;
  non_compliant: number;
  expired: number;
}

interface LicenseListResponse {
  data: SoftwareLicense[];
  total: number;
  page: number;
  pageSize: number;
  compliance_summary: ComplianceSummary;
}

interface LicenseResponse {
  data: SoftwareLicense;
}

interface ComplianceOverview {
  total_licenses: number;
  compliant: number;
  warning: number;
  non_compliant: number;
  expired: number;
  total_cost: number;
  expiring_soon: any[];
  over_allocated: any[];
}

const LICENSE_TYPE_LABELS: Record<string, string> = {
  perpetual: 'Perpetual',
  subscription: 'Subscription',
  concurrent: 'Concurrent',
  freeware: 'Freeware',
  open_source: 'Open Source',
  trial: 'Trial',
};

const COMPLIANCE_LABELS: Record<string, string> = {
  compliant: 'Compliant',
  warning: 'Warning',
  non_compliant: 'Non-Compliant',
  expired: 'Expired',
};

const COMPLIANCE_COLORS: Record<string, string> = {
  compliant: '#22c55e',
  warning: '#f59e0b',
  non_compliant: '#ef4444',
  expired: '#6b7280',
};

function formatDate(d: string | null): string {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function SoftwareLicensesPage() {
  const router = useRouter();
  const { user } = useStore();
  const isAdmin = user?.role === 'admin';

  const [licenses, setLicenses] = useState<SoftwareLicense[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [complianceSummary, setComplianceSummary] = useState<ComplianceSummary | null>(null);
  const [complianceOverview, setComplianceOverview] = useState<ComplianceOverview | null>(null);
  const [filters, setFilters] = useState({ license_type: '', compliance_status: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const [form, setForm] = useState({
    name: '',
    publisher: '',
    version: '',
    license_type: 'perpetual',
    license_key: '',
    total_seats: 1,
    purchase_date: '',
    expiry_date: '',
    cost_per_seat: '',
    total_cost: '',
    currency: 'USD',
    vendor: '',
    notes: '',
    match_pattern: '',
    category: '',
    alert_threshold: 10,
    auto_match: true,
  });

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageSize = 50;

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => {
      if (searchRef.current) clearTimeout(searchRef.current);
    };
  }, [search]);

  useEffect(() => {
    function handleClose(e: MouseEvent) {
      setMenuOpenId(null);
      setShowExport(false);
    }
    if (!menuOpenId && !showExport) return;
    document.addEventListener('click', handleClose);
    return () => document.removeEventListener('click', handleClose);
  }, [menuOpenId, showExport]);

  const fetchLicenses = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filters.license_type) params.set('license_type', filters.license_type);
      if (filters.compliance_status) params.set('compliance_status', filters.compliance_status);
      const response = await api.get<LicenseListResponse>(`/software-licenses?${params.toString()}`);
      setLicenses(response.data || []);
      setTotal(response.total || 0);
      if (response.compliance_summary) setComplianceSummary(response.compliance_summary);
    } catch {
      setLicenses([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, debouncedSearch, filters]);

  const fetchOverview = useCallback(async () => {
    try {
      const response = await api.get<{ data: ComplianceOverview }>('/software-licenses/compliance/overview');
      setComplianceOverview(response.data);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchLicenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchLicenses]);
  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function refreshAll() {
    await Promise.all([fetchLicenses(true), fetchOverview()]);
    setJustRefreshed(true);
    setTimeout(() => setJustRefreshed(false), 2000);
  }

  function openAddModal() {
    setModalMode('add');
    setEditingId(null);
    setForm({
      name: '', publisher: '', version: '', license_type: 'perpetual',
      license_key: '', total_seats: 1, purchase_date: '', expiry_date: '',
      cost_per_seat: '', total_cost: '', currency: 'USD', vendor: '',
      notes: '', match_pattern: '', category: '', alert_threshold: 10, auto_match: true,
    });
    setShowModal(true);
  }

  function openEditModal(lic: SoftwareLicense) {
    setModalMode('edit');
    setEditingId(lic.id);
    setForm({
      name: lic.name,
      publisher: lic.publisher || '',
      version: lic.version || '',
      license_type: lic.license_type,
      license_key: lic.license_key || '',
      total_seats: lic.total_seats,
      purchase_date: lic.purchase_date || '',
      expiry_date: lic.expiry_date || '',
      cost_per_seat: lic.cost_per_seat?.toString() || '',
      total_cost: lic.total_cost?.toString() || '',
      currency: lic.currency || 'USD',
      vendor: lic.vendor || '',
      notes: '',
      match_pattern: '',
      category: '',
      alert_threshold: 10,
      auto_match: true,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        publisher: form.publisher || null,
        version: form.version || null,
        license_type: form.license_type,
        license_key: form.license_key || null,
        total_seats: form.total_seats,
        purchase_date: form.purchase_date || null,
        expiry_date: form.expiry_date || null,
        cost_per_seat: form.cost_per_seat ? parseFloat(form.cost_per_seat) : null,
        total_cost: form.total_cost ? parseFloat(form.total_cost) : null,
        currency: form.currency,
        vendor: form.vendor || null,
        notes: form.notes || null,
        match_pattern: form.match_pattern || null,
        category: form.category || null,
        alert_threshold: form.alert_threshold,
        auto_match: form.auto_match,
      };

      if (modalMode === 'edit' && editingId) {
        await api.patch(`/software-licenses/${editingId}`, payload);
        setToast({ message: 'License updated', type: 'success' });
      } else {
        await api.post('/software-licenses', payload);
        setToast({ message: 'License created', type: 'success' });
      }

      setShowModal(false);
      await refreshAll();
    } catch (err: any) {
      setToast({ message: err.message || 'Unable to save license', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this license? This cannot be undone.')) return;
    try {
      await api.delete(`/software-licenses/${id}`);
      setMenuOpenId(null);
      setToast({ message: 'License deleted', type: 'success' });
      await refreshAll();
    } catch (err: any) {
      setToast({ message: err.message || 'Unable to delete license', type: 'error' });
    }
  }

  const allSelected = licenses.length > 0 && licenses.every(l => selected.has(l.id));
  const someSelected = selected.size > 0 && !allSelected;

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(licenses.map(l => l.id)));
    }
  }

  function clearSelection() { setSelected(new Set()); }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} license(s)? This cannot be undone.`)) return;
    try {
      await Promise.all(Array.from(selected).map(id => api.delete(`/software-licenses/${id}`)));
      setToast({ message: `${selected.size} license(s) deleted`, type: 'success' });
      clearSelection();
      await refreshAll();
    } catch (err: any) {
      setToast({ message: err.message || 'Bulk delete failed', type: 'error' });
    }
  }

  function exportLicenses(format: 'csv' | 'json') {
    const data = licenses.filter(l => selected.size === 0 || selected.has(l.id));
    if (data.length === 0) return;

    const rows = data.map(l => ({
      name: l.name,
      publisher: l.publisher || '',
      version: l.version || '',
      license_type: l.license_type,
      license_key: l.license_key || '',
      total_seats: l.total_seats,
      used_seats: l.used_seats,
      available_seats: l.available_seats,
      purchase_date: l.purchase_date || '',
      expiry_date: l.expiry_date || '',
      cost_per_seat: l.cost_per_seat ?? '',
      total_cost: l.total_cost ?? '',
      currency: l.currency,
      vendor: l.vendor || '',
      compliance_status: l.compliance_status,
    }));

    const filename = `licenses-export-${new Date().toISOString().slice(0, 10)}`;

    if (format === 'csv') {
      const headers = Object.keys(rows[0]);
      const csv = [
        headers.join(','),
        ...rows.map(r => headers.map(h => {
          const val = (r as any)[h];
          const str = String(val ?? '');
          return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${filename}.csv`; a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${filename}.json`; a.click();
      URL.revokeObjectURL(url);
    }

    setShowExport(false);
    setToast({ message: `Exported ${rows.length} license(s) as ${format.toUpperCase()}`, type: 'success' });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const filterCount = Object.values(filters).filter(Boolean).length;

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const controlButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    boxShadow: 'var(--shadow-sm)',
  };

  const labelStyle: CSSProperties = {
    fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block',
  };

  const selectStyle: CSSProperties = {
    ...inputStyle,
    appearance: 'none',
    cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 9999,
          padding: '12px 20px', borderRadius: 'var(--radius-md)',
          background: toast.type === 'error' ? '#ef4444' : '#22c55e',
          color: 'white', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {toast.message}
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '24px 24px 18px', borderBottom: '1px solid var(--border)',
        background: 'linear-gradient(180deg, var(--bg-elevated), var(--bg-secondary))',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>Software Licenses</h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>
              Track license compliance, manage seat allocations, and automate software matching.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => refreshAll()} style={{ ...controlButtonStyle, background: 'var(--bg-elevated)', gap: 6 }}>
              <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} />
              {justRefreshed ? 'Refreshed!' : 'Refresh'}
            </button>
            {isAdmin && (
              <button onClick={() => setShowImport(true)} style={{ ...controlButtonStyle, background: 'var(--bg-elevated)' }}>
                <Upload size={14} />
                Import
              </button>
            )}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowExport(!showExport)} style={{ ...controlButtonStyle, background: 'var(--bg-elevated)' }}>
                <Download size={14} />
                Export
                <ChevronDown size={12} />
              </button>
              {showExport && (
                <div style={{
                  position: 'absolute', right: 0, top: '100%', zIndex: 50, minWidth: 130, marginTop: 4,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', padding: 4,
                }}>
                  <button onClick={() => exportLicenses('csv')} style={menuItemStyle}>
                    <Download size={13} /> Export as CSV
                  </button>
                  <button onClick={() => exportLicenses('json')} style={menuItemStyle}>
                    <FileText size={13} /> Export as JSON
                  </button>
                </div>
              )}
            </div>
            {isAdmin && (
              <button onClick={openAddModal} style={{
                ...controlButtonStyle, background: 'var(--accent)', border: '1px solid var(--accent)', color: 'var(--text-inverse)',
              }}>
                <Plus size={15} />
                Add License
              </button>
            )}
          </div>
        </div>

        {/* Compliance Overview Cards */}
        {complianceOverview && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
            <StatCard icon={Key} label="Total Licenses" value={complianceOverview.total_licenses} color="#6366f1" />
            <StatCard icon={Shield} label="Compliant" value={complianceOverview.compliant} color="#22c55e" />
            <StatCard icon={AlertTriangle} label="Warning" value={complianceOverview.warning} color="#f59e0b" />
            <StatCard icon={X} label="Non-Compliant" value={complianceOverview.non_compliant} color="#ef4444" />
            <StatCard icon={Calendar} label="Expired" value={complianceOverview.expired} color="#6b7280" />
            <StatCard icon={CreditCard} label="Total Cost" value={`$${(complianceOverview.total_cost || 0).toLocaleString()}`} color="#10b981" />
          </div>
        )}

        {/* Search & Filters */}
        <div style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-elevated)', boxShadow: 'var(--shadow-sm)', padding: 14,
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px', position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                placeholder="Search licenses..."
                value={search}
                onChange={e => { setPage(1); setSearch(e.target.value); }}
                style={{ ...inputStyle, paddingLeft: 34 }}
              />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} style={{
              ...controlButtonStyle, position: 'relative',
              background: filterCount > 0 ? 'var(--accent-subtle)' : 'var(--bg)',
              border: filterCount > 0 ? '1px solid var(--accent-border)' : '1px solid var(--border)',
              color: filterCount > 0 ? 'var(--accent)' : 'var(--text)',
            }}>
              <FilterIcon size={14} />
              Filters{filterCount > 0 ? ` (${filterCount})` : ''}
            </button>
            {(filterCount > 0) && (
              <button onClick={() => { setPage(1); setFilters({ license_type: '', compliance_status: '' }); }} style={{
                ...controlButtonStyle, color: 'var(--text-muted)', fontSize: 12,
              }}>
                <X size={12} />
                Clear
              </button>
            )}
          </div>

          {showFilters && (
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={labelStyle}>License Type</label>
                <select
                  value={filters.license_type}
                  onChange={e => { setPage(1); setFilters(f => ({ ...f, license_type: e.target.value })); }}
                  style={selectStyle}
                >
                  <option value="">All Types</option>
                  {Object.entries(LICENSE_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label style={labelStyle}>Compliance Status</label>
                <select
                  value={filters.compliance_status}
                  onChange={e => { setPage(1); setFilters(f => ({ ...f, compliance_status: e.target.value })); }}
                  style={selectStyle}
                >
                  <option value="">All Statuses</option>
                  {Object.entries(COMPLIANCE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div style={{
          padding: '10px 24px', borderBottom: '1px solid var(--border)',
          background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', gap: 12,
          fontSize: 13, flexShrink: 0,
        }}>
          <CheckSquare size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600 }}>{selected.size} selected</span>
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <button onClick={() => exportLicenses('csv')} style={bulkActionBtnStyle}>
            <Download size={13} /> Export Selected
          </button>
          {isAdmin && (
            <button onClick={handleBulkDelete} style={{ ...bulkActionBtnStyle, color: '#ef4444' }}>
              <Trash2 size={13} /> Delete Selected
            </button>
          )}
          <button onClick={clearSelection} style={{ ...bulkActionBtnStyle, color: 'var(--text-muted)' }}>
            <X size={13} /> Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
            Loading licenses...
          </div>
        ) : licenses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
            {debouncedSearch || filterCount > 0
              ? 'No licenses match your search or filters.'
              : 'No software licenses yet. Click "Add License" to create one.'}
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ ...thStyle, width: 40 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button onClick={toggleSelectAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                        {allSelected ? <CheckSquare size={14} /> : someSelected ? <CheckSquare size={14} style={{ opacity: 0.5 }} /> : <Square size={14} />}
                      </button>
                    </div>
                  </th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Publisher</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Seats</th>
                  <th style={thStyle}>Compliance</th>
                  <th style={thStyle}>Expiry</th>
                  <th style={{ ...thStyle, width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {licenses.map(lic => (
                  <tr
                    key={lic.id}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                    onClick={() => router.push(`/dashboard/software-licenses/${lic.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...tdStyle, width: 40 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <button
                          onClick={e => { e.stopPropagation(); toggleSelect(lic.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: selected.has(lic.id) ? 'var(--accent)' : 'var(--text-muted)', padding: 0 }}
                        >
                          {selected.has(lic.id) ? <CheckSquare size={14} /> : <Square size={14} />}
                        </button>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{lic.name}</div>
                      {lic.version && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>v{lic.version}</div>}
                    </td>
                    <td style={tdStyle}>
                      {lic.publisher || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 12,
                        background: 'var(--bg-secondary)', fontSize: 11, fontWeight: 600,
                      }}>
                        {LICENSE_TYPE_LABELS[lic.license_type] || lic.license_type}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{lic.used_seats} / {lic.total_seats}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {lic.available_seats} available
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '3px 10px', borderRadius: 12,
                        background: COMPLIANCE_COLORS[lic.compliance_status] + '20',
                        color: COMPLIANCE_COLORS[lic.compliance_status],
                        fontWeight: 600, fontSize: 11,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: COMPLIANCE_COLORS[lic.compliance_status], flexShrink: 0 }} />
                        {COMPLIANCE_LABELS[lic.compliance_status] || lic.compliance_status}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {lic.expiry_date ? (
                        <span style={{
                          color: lic.compliance_status === 'expired' ? '#ef4444' : 'var(--text)',
                          fontWeight: lic.compliance_status === 'expired' ? 600 : 400,
                        }}>
                          {formatDate(lic.expiry_date)}
                        </span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={tdStyle}>
                      {isAdmin && (
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpenId === lic.id ? null : lic.id); }}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 6px', borderRadius: 'var(--radius-md)' }}
                          >
                            <MoreHorizontal size={14} />
                          </button>
                          {menuOpenId === lic.id && (
                            <div style={{
                              position: 'absolute', right: 0, top: '100%', zIndex: 50, minWidth: 140,
                              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                              padding: 4,
                            }}>
                              <button
                                onClick={e => { e.stopPropagation(); setMenuOpenId(null); openEditModal(lic); }}
                                style={menuItemStyle}
                              >
                                <Edit3 size={13} /> Edit
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); handleDelete(lic.id); }}
                                style={{ ...menuItemStyle, color: '#ef4444' }}
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 0' }}>
                <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={pageBtnStyle}>
                  Previous
                </button>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Page {page} of {totalPages}
                </span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={pageBtnStyle}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <ModalOverlay onClose={() => setShowModal(false)}>
          <div style={{
            background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
            width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto',
            boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)',
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {modalMode === 'edit' ? 'Edit License' : 'Add License'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="e.g. Microsoft Office 365" />
                </div>
                <div>
                  <label style={labelStyle}>Publisher</label>
                  <input value={form.publisher} onChange={e => setForm(f => ({ ...f, publisher: e.target.value }))} style={inputStyle} placeholder="e.g. Microsoft" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Version</label>
                  <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} style={inputStyle} placeholder="e.g. 2024" />
                </div>
                <div>
                  <label style={labelStyle}>License Type *</label>
                  <select value={form.license_type} onChange={e => setForm(f => ({ ...f, license_type: e.target.value }))} style={selectStyle}>
                    {Object.entries(LICENSE_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>License Key</label>
                <input value={form.license_key} onChange={e => setForm(f => ({ ...f, license_key: e.target.value }))} style={inputStyle} placeholder="Optional license key" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Total Seats *</label>
                  <input type="number" min={0} value={form.total_seats} onChange={e => setForm(f => ({ ...f, total_seats: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Category</label>
                  <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle} placeholder="e.g. Productivity" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Purchase Date</label>
                  <input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Expiry Date</label>
                  <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Cost Per Seat</label>
                  <input type="number" step="0.01" min={0} value={form.cost_per_seat} onChange={e => setForm(f => ({ ...f, cost_per_seat: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Total Cost</label>
                  <input type="number" step="0.01" min={0} value={form.total_cost} onChange={e => setForm(f => ({ ...f, total_cost: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Vendor</label>
                  <input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} style={inputStyle} placeholder="e.g. Microsoft Corp" />
                </div>
                <div>
                  <label style={labelStyle}>Auto-Match Pattern</label>
                  <input value={form.match_pattern} onChange={e => setForm(f => ({ ...f, match_pattern: e.target.value }))} style={inputStyle} placeholder="e.g. Office" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="auto_match" checked={form.auto_match} onChange={e => setForm(f => ({ ...f, auto_match: e.target.checked }))} />
                <label htmlFor="auto_match" style={{ fontSize: 13, color: 'var(--text)' }}>Auto-match to assets by pattern</label>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowModal(false)} style={{ ...controlButtonStyle }}>
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || saving}
                style={{
                  ...controlButtonStyle, background: 'var(--accent)', border: '1px solid var(--accent)',
                  color: 'var(--text-inverse)', opacity: (!form.name.trim() || saving) ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving...' : modalMode === 'edit' ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
      {/* Import Modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => refreshAll()}
        />
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)', background: 'var(--bg-elevated)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 'var(--radius-md)',
        background: color + '15', color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

function FilterIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function ModalOverlay({ children, onClose }: { children: any; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', padding: 20,
      }}
    >
      <div onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

const thStyle: CSSProperties = {
  textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 700,
  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
};

const tdStyle: CSSProperties = {
  padding: '12px', verticalAlign: 'middle',
};

const menuItemStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
  background: 'none', border: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 500,
  cursor: 'pointer', borderRadius: 'var(--radius-sm)', textAlign: 'left',
};

const bulkActionBtnStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px',
  borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
  background: 'var(--bg-elevated)', color: 'var(--text)', cursor: 'pointer',
  fontSize: 12, fontWeight: 600,
};

const pageBtnStyle: CSSProperties = {
  padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
