'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, Bookmark, Check, ChevronDown, ChevronLeft, ChevronRight,
  Columns3,   Edit3, Filter, GripVertical, LayoutGrid,
  Monitor, MoreHorizontal, Plus, Search,
  Trash2, Wifi, WifiOff, X
} from 'lucide-react';

import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { SelectSearch } from '@/components/SelectSearch';
import {
  Asset, AssetFormState, AssetGroup, AssetListResponse, AssetGroupsResponse,
  ASSET_TYPE_LABELS, DEFAULT_VIEWS, EMPTY_FORM, PAGE_SIZE,
  RawStatsResponse, SavedView, StatsData,
  ColumnId, COLUMN_DEFINITIONS, COLUMN_CATEGORIES, DEFAULT_VISIBLE_COLUMNS
} from '@/lib/assets-types';
import {
  buildPayload, getAgentDotColor, getAgentLabel,
  getErrorMessage, getHardware, getNeedsAttentionCount,
  getStatusTone, getTypeIcon, getTypeLabel, normalizeStats, timeAgo, toEditForm,
  loadVisibleColumns, saveVisibleColumns, formatCost, formatDate
} from '@/components/assets-list-utils';
import { AssetFormModal } from '@/components/assets-form-modal';
import { Avatar, ProgressMini, StatCard } from '@/components/assets-list-ui';

export default function AssetsPage() {
  const router = useRouter();
  const { user } = useStore();
  const canManage = ['admin', 'agent'].includes(user?.role || '');
  const isAdmin = user?.role === 'admin';

  const [assets, setAssets] = useState<Asset[]>([]);
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [form, setForm] = useState<AssetFormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [filters, setFilters] = useState({
    asset_type: '',
    status: '',
    group_id: '',
    agent_status: ''
  });
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    try {
      const stored = localStorage.getItem('resolv_asset_views');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [showSaveView, setShowSaveView] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnId>>(() =>
    loadVisibleColumns(DEFAULT_VISIBLE_COLUMNS as unknown as Set<string>) as Set<ColumnId>
  );
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageSize = PAGE_SIZE;

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
      setMenuPos(null);
      // Close column picker if clicking outside
      if (showColumnPicker && columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false);
      }
    }
    if (!menuOpenId && !showColumnPicker) return;
    document.addEventListener('click', handleClose);
    return () => document.removeEventListener('click', handleClose);
  }, [menuOpenId, showColumnPicker]);

  const fetchAssets = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pageSize)
        });

        if (debouncedSearch) params.set('search', debouncedSearch);
        if (filters.asset_type) params.set('asset_type', filters.asset_type);
        if (filters.status) params.set('status', filters.status);
        if (filters.group_id) params.set('group_id', filters.group_id);
        if (filters.agent_status) params.set('agent_status', filters.agent_status);

        const response = await api.get<AssetListResponse>(`/assets?${params.toString()}`);
        const rows = response.assets || response.data || [];

        setAssets(rows);
        setTotal(Number(response.total || rows.length || 0));
      } catch {
        setAssets([]);
        setTotal(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, pageSize, debouncedSearch, filters]
  );

  const fetchMeta = useCallback(async () => {
    try {
      const [groupsResponse, statsResponse] = await Promise.all([
        api.get<AssetGroupsResponse>('/asset-groups'),
        api.get<RawStatsResponse>('/assets/stats')
      ]);

      setGroups(groupsResponse.groups || groupsResponse.data || []);
      setStats(normalizeStats(statsResponse));
    } catch {
      setGroups([]);
      setStats(null);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchAssets();
    });
  }, [fetchAssets]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchMeta();
    });
  }, [fetchMeta]);

  async function refreshAll(): Promise<void> {
    await Promise.all([fetchAssets(true), fetchMeta()]);
  }

  function openAddModal(): void {
    setModalMode('add');
    setEditingAssetId(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  }

  function openEditModal(asset: Asset): void {
    setModalMode('edit');
    setEditingAssetId(asset.id);
    setForm(toEditForm(asset));
    setShowModal(true);
  }

  async function handleSave(): Promise<void> {
    if (!form.name.trim()) return;

    setSaving(true);

    try {
      const payload = buildPayload(form);

      if (modalMode === 'edit' && editingAssetId) {
        await api.patch(`/assets/${editingAssetId}`, payload);
      } else {
        await api.post('/assets', payload);
      }

      setShowModal(false);
      setEditingAssetId(null);
      setForm({ ...EMPTY_FORM });
      await refreshAll();
    } catch (error: unknown) {
      setToast({ message: getErrorMessage(error, 'Unable to save asset.'), type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAsset(assetId: string): Promise<void> {
    const asset = assets.find((item) => item.id === assetId);
    if (!window.confirm(`Delete ${asset?.name || 'this asset'}? This cannot be undone.`)) return;

    try {
      await api.delete(`/assets/${assetId}`);
      setMenuOpenId(null);
      setSelected((previous) => {
        const next = new Set(previous);
        next.delete(assetId);
        return next;
      });
      await refreshAll();
    } catch (error: unknown) {
      setToast({ message: getErrorMessage(error, 'Unable to delete asset.'), type: 'error' });
    }
  }

  async function handleBulkDelete(): Promise<void> {
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} asset(s)? This cannot be undone.`)) return;

    setDeleting(true);

    try {
      await Promise.all(Array.from(selected).map((id) => api.delete(`/assets/${id}`)));
      setSelected(new Set());
      await refreshAll();
    } catch (error: unknown) {
      setToast({ message: getErrorMessage(error, 'Unable to delete selected assets.'), type: 'error' });
    } finally {
      setDeleting(false);
    }
  }

  function handleSearchChange(value: string): void {
    setPage(1);
    setSearch(value);
  }

  function handleFilterChange<K extends keyof typeof filters>(key: K, value: (typeof filters)[K]): void {
    setPage(1);
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function clearFilters(): void {
    setPage(1);
    setFilters({ asset_type: '', status: '', group_id: '', agent_status: '' });
  }

  function applyView(view: SavedView): void {
    setPage(1);
    setSearch(view.search);
    setFilters({ ...view.filters });
  }

  function saveView(): void {
    if (!newViewName.trim()) return;
    const view: SavedView = { name: newViewName.trim(), filters: { ...filters }, search };
    const updated = [...savedViews.filter(v => v.name !== view.name), view];
    setSavedViews(updated);
    localStorage.setItem('resolv_asset_views', JSON.stringify(updated));
    setNewViewName('');
    setShowSaveView(false);
  }

  function deleteView(name: string): void {
    const updated = savedViews.filter(v => v.name !== name);
    setSavedViews(updated);
    localStorage.setItem('resolv_asset_views', JSON.stringify(updated));
  }

  function toggleColumn(colId: ColumnId): void {
    const col = COLUMN_DEFINITIONS.find(c => c.id === colId);
    if (col?.pinned) return;
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      saveVisibleColumns(next as unknown as Set<string>);
      return next;
    });
  }

  function resetColumns(): void {
    setVisibleColumns(new Set(DEFAULT_VISIBLE_COLUMNS));
    saveVisibleColumns(DEFAULT_VISIBLE_COLUMNS as unknown as Set<string>);
  }

  function showAllColumns(): void {
    const all = new Set(COLUMN_DEFINITIONS.map(c => c.id));
    setVisibleColumns(all);
    saveVisibleColumns(all as unknown as Set<string>);
  }

  const isColumnVisible = (id: ColumnId) => visibleColumns.has(id);

  function toggleSelect(id: string): void {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(): void {
    if (selected.size === assets.length) {
      setSelected(new Set());
      return;
    }

    setSelected(new Set(assets.map((asset) => asset.id)));
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const onlineCount = stats?.online || 0;
  const offlineCount = stats?.offline || 0;
  const needsAttentionCount = getNeedsAttentionCount(stats);

  const filterCount = useMemo(() => Object.values(filters).filter(Boolean).length, [filters]);

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box'
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
    boxShadow: 'var(--shadow-sm)'
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg)',
        color: 'var(--text)'
      }}
    >
      <div
        style={{
          padding: '24px 24px 18px',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(180deg, var(--bg-elevated), var(--bg-secondary))',
          flexShrink: 0
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 18,
            flexWrap: 'wrap'
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>Assets</h1>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>
              Inventory, monitor, and manage every endpoint in one operational view.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {selected.size > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--accent-border)',
                  background: 'var(--accent-subtle)',
                  color: 'var(--accent)',
                  fontSize: 13,
                  fontWeight: 700
                }}
              >
                <span>{selected.size} selected</span>
                {isAdmin && (
                  <button
                    onClick={handleBulkDelete}
                    disabled={deleting}
                    style={{
                      ...controlButtonStyle,
                      padding: '8px 10px',
                      background: 'var(--danger)',
                      border: '1px solid var(--danger)',
                      color: 'var(--text-inverse)',
                      boxShadow: 'none'
                    }}
                  >
                    <Trash2 size={14} />
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                )}
                <button
                  onClick={() => setSelected(new Set())}
                  style={{
                    width: 30,
                    height: 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--accent-border)',
                    background: 'var(--bg)',
                    color: 'var(--accent)',
                    cursor: 'pointer'
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div ref={columnPickerRef} style={{ position: 'relative' }}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowColumnPicker(p => !p); }}
                style={{
                  ...controlButtonStyle,
                  background: showColumnPicker ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                  color: showColumnPicker ? 'var(--accent)' : 'var(--text)',
                }}
                title="Customize columns"
              >
                <Columns3 size={15} />
                Columns
              </button>

              {showColumnPicker && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 6,
                    width: 320,
                    maxHeight: 480,
                    overflowY: 'auto',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-elevated)',
                    boxShadow: 'var(--shadow-xl)',
                    zIndex: 1200,
                    padding: '8px 0',
                  }}
                >
                  <div style={{ padding: '8px 14px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Customize Columns</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={showAllColumns}
                        style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Show All
                      </button>
                      <span style={{ color: 'var(--border)' }}>|</span>
                      <button
                        onClick={resetColumns}
                        style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {COLUMN_CATEGORIES.map(cat => {
                    const cols = COLUMN_DEFINITIONS.filter(c => c.category === cat.id);
                    return (
                      <div key={cat.id} style={{ padding: '6px 0' }}>
                        <div style={{ padding: '4px 14px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {cat.label}
                        </div>
                        {cols.map(col => (
                          <button
                            key={col.id}
                            onClick={() => toggleColumn(col.id)}
                            disabled={col.pinned}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '7px 14px',
                              border: 'none',
                              background: 'transparent',
                              color: col.pinned ? 'var(--text-muted)' : 'var(--text)',
                              cursor: col.pinned ? 'default' : 'pointer',
                              fontSize: 13,
                              textAlign: 'left',
                              opacity: col.pinned ? 0.7 : 1,
                            }}
                            onMouseEnter={e => { if (!col.pinned) (e.currentTarget.style.background = 'var(--bg-secondary)'); }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <span
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 4,
                                border: `1.5px solid ${visibleColumns.has(col.id) ? 'var(--accent)' : 'var(--border)'}`,
                                background: visibleColumns.has(col.id) ? 'var(--accent)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                transition: 'all 0.15s',
                              }}
                            >
                              {visibleColumns.has(col.id) && <Check size={12} color="var(--text-inverse)" strokeWidth={3} />}
                            </span>
                            <span style={{ flex: 1 }}>{col.label}</span>
                            {col.pinned && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Pinned</span>}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {canManage && (
              <button
                onClick={openAddModal}
                style={{
                  ...controlButtonStyle,
                  background: 'var(--accent)',
                  border: '1px solid var(--accent)',
                  color: 'var(--text-inverse)'
                }}
              >
                <Plus size={15} />
                Add Asset
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
          <StatCard icon={Monitor} label="Total Assets" value={stats?.total || total} tone="var(--accent)" />
          <StatCard icon={Wifi} label="Online" value={onlineCount} tone="var(--success)" />
          <StatCard icon={WifiOff} label="Offline" value={offlineCount} tone="var(--text-muted)" />
          <StatCard icon={AlertTriangle} label="Needs Attention" value={needsAttentionCount} tone="var(--warning)" />
        </div>

        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-elevated)',
            boxShadow: 'var(--shadow-sm)',
            padding: 14
          }}
        >
          {/* Saved Views */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Views</span>
            {[...DEFAULT_VIEWS, ...savedViews].map(view => (
              <button
                key={view.name}
                onClick={() => applyView(view)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 999,
                  border: '1px solid var(--border)',
                  background: filters.asset_type === view.filters.asset_type &&
                    filters.status === view.filters.status &&
                    filters.agent_status === view.filters.agent_status
                    ? 'var(--accent-subtle)' : 'var(--bg)',
                  color: filters.asset_type === view.filters.asset_type &&
                    filters.status === view.filters.status &&
                    filters.agent_status === view.filters.agent_status
                    ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {view.name}
                {savedViews.some(v => v.name === view.name) && (
                  <span
                    onClick={(e) => { e.stopPropagation(); deleteView(view.name); }}
                    style={{ display: 'flex', color: 'var(--text-muted)', marginLeft: 2 }}
                    title="Remove saved view"
                  >
                    <X size={10} />
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => setShowSaveView(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 999,
                border: '1px dashed var(--border)',
                background: 'transparent', color: 'var(--text-muted)',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              title="Save current view"
            >
              <Bookmark size={11} /> Save
            </button>
          </div>

          {/* Save View Modal */}
          {showSaveView && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 1100,
              background: 'rgba(0,0,0,0.3)', display: 'flex',
              alignItems: 'center', justifyContent: 'center'
            }} onClick={() => setShowSaveView(false)}>
              <div style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: 24, maxWidth: 360, width: '90%',
                boxShadow: 'var(--shadow-xl)'
              }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Save Current View</h3>
                <input
                  autoFocus
                  value={newViewName}
                  onChange={e => setNewViewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveView(); }}
                  placeholder="View name (e.g. Production Servers)..."
                  className="input"
                  style={{ width: '100%', marginBottom: 16, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setShowSaveView(false); setNewViewName(''); }} className="btn btn-ghost btn-sm">Cancel</button>
                  <button onClick={saveView} disabled={!newViewName.trim()} className="btn btn-primary btn-sm">Save</button>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', minWidth: 280, flex: '1 1 320px' }}>
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Search assets, hostname, IP, serial, model..."
                style={{ ...inputStyle, paddingLeft: 36 }}
              />
            </div>

            <div style={{ width: 170 }}>
              <SelectSearch
                options={Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => ({
                  value,
                  label
                }))}
                value={filters.asset_type || null}
                onChange={(val) => handleFilterChange('asset_type', val || '')}
                placeholder="All Types"
                allowClear
              />
            </div>

            <div style={{ width: 170 }}>
              <SelectSearch
                options={['active', 'inactive', 'retired', 'maintenance', 'disposed'].map((status) => ({
                  value: status,
                  label: status.charAt(0).toUpperCase() + status.slice(1)
                }))}
                value={filters.status || null}
                onChange={(val) => handleFilterChange('status', val || '')}
                placeholder="All Statuses"
                allowClear
              />
            </div>

            <div style={{ width: 170 }}>
              <SelectSearch
                options={groups.map((group) => ({
                  value: group.id,
                  label: group.name
                }))}
                value={filters.group_id || null}
                onChange={(val) => handleFilterChange('group_id', val || '')}
                placeholder="All Groups"
                allowClear
              />
            </div>

            <button
              onClick={() => setShowFilters((previous) => !previous)}
              style={{
                ...controlButtonStyle,
                background: showFilters ? 'var(--accent-subtle)' : 'var(--bg)',
                color: showFilters ? 'var(--accent)' : 'var(--text)'
              }}
            >
              <Filter size={15} />
              Filters
              {filterCount > 0 ? (
                <span
                  style={{
                    minWidth: 18,
                    height: 18,
                    borderRadius: 999,
                    padding: '0 5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--accent)',
                    color: 'var(--text-inverse)',
                    fontSize: 11,
                    fontWeight: 700
                  }}
                >
                  {filterCount}
                </span>
              ) : null}
              <ChevronDown size={14} />
            </button>
          </div>

          {showFilters && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                alignItems: 'center'
              }}
            >
              <div style={{ width: 170 }}>
                <SelectSearch
                  options={[
                    { value: 'online', label: 'Online' },
                    { value: 'offline', label: 'Offline' },
                    { value: 'unknown', label: 'Unknown' }
                  ]}
                  value={filters.agent_status || null}
                  onChange={(val) => handleFilterChange('agent_status', val || '')}
                  placeholder="All Agent States"
                  allowClear
                />
              </div>

              {filterCount > 0 && (
                <button
                  onClick={clearFilters}
                  style={{ ...controlButtonStyle, color: 'var(--danger)' }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: '16px 24px 24px', overflow: 'auto' }}>
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-elevated)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'visible',
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {loading ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: 14,
                padding: 48
              }}
            >
              Loading assets…
            </div>
          ) : assets.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                padding: 48,
                textAlign: 'center'
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)'
                }}
              >
                <Monitor size={34} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>No assets found</div>
              <div style={{ maxWidth: 420, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {filterCount > 0 || search
                  ? 'Try adjusting your search or filters to find matching assets.'
                  : 'Add your first asset or deploy the agent to start building a live inventory.'}
              </div>
              {canManage && !filterCount && !search ? (
                <button
                  onClick={openAddModal}
                  style={{
                    ...controlButtonStyle,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'var(--accent)',
                    border: '1px solid var(--accent)',
                    color: 'var(--text-inverse)'
                  }}
                >
                  <Plus size={15} />
                  Add Asset
                </button>
              ) : null}
            </div>
          ) : (
                        <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ width: 42, padding: '14px 12px' }}>
                        <input
                          type="checkbox"
                          checked={assets.length > 0 && selected.size === assets.length}
                          onChange={toggleAll}
                        />
                      </th>
                      {COLUMN_DEFINITIONS.filter(c => isColumnVisible(c.id)).map(col => (
                        <th key={col.id} style={{ padding: '14px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', userSelect: 'none' }}>
                          {col.label}
                        </th>
                      ))}
                      <th style={{ width: 52, padding: '14px 12px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset) => {
                      const TypeIcon = getTypeIcon(asset.asset_type);
                      const statusTone = getStatusTone(asset.status);
                      const hasSerial = Boolean(asset.serial_number);
                      const isSelected = selected.has(asset.id);
                      const diskPercent = asset.disk_total_gb && asset.disk_used_gb != null
                        ? Math.max(0, Math.min(100, (asset.disk_used_gb / asset.disk_total_gb) * 100))
                        : null;

                      return (
                        <tr
                          key={asset.id}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={(event) => {
                            if (!isSelected) event.currentTarget.style.background = 'var(--bg-secondary)';
                          }}
                          onMouseLeave={(event) => {
                            event.currentTarget.style.background = isSelected ? 'var(--accent-subtle)' : 'transparent';
                          }}
                          onClick={() => router.push(`/dashboard/assets/${asset.id}`)}
                        >
                          <td style={{ padding: '12px 12px' }} onClick={(event) => event.stopPropagation()}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(asset.id)} />
                          </td>

                          {COLUMN_DEFINITIONS.filter(c => isColumnVisible(c.id)).map(col => {
                            switch (col.id) {
                              case 'asset':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px', minWidth: 220 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                      <span style={{ width: 9, height: 9, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: getAgentDotColor(asset.agent_status), boxShadow: asset.agent_status === 'online' ? '0 0 0 3px color-mix(in srgb, var(--success) 20%, transparent)' : 'none' }} />
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{asset.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                          {asset.display_name || [asset.manufacturer, asset.model].filter(Boolean).join(' ') || getAgentLabel(asset)}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                );

                              case 'status':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px' }}>
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 6,
                                      padding: '4px 10px', borderRadius: 999,
                                      background: statusTone.background, border: `1px solid ${statusTone.border}`,
                                      color: statusTone.color, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                                    }}>
                                      {asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}
                                    </span>
                                  </td>
                                );

                              case 'type':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px' }}>
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 5,
                                      padding: '4px 10px', borderRadius: 999,
                                      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                      color: 'var(--text)', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                                    }}>
                                      <TypeIcon size={12} />
                                      {getTypeLabel(asset.asset_type)}
                                    </span>
                                  </td>
                                );

                              case 'location':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px', minWidth: 110 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{asset.location || '-'}</div>
                                    {asset.department && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{asset.department}</div>}
                                  </td>
                                );

                              case 'network':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px', minWidth: 130 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>{asset.ip_address || '-'}</div>
                                    {(asset.hostname || asset.serial_number) && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{asset.hostname || asset.serial_number}</div>}
                                  </td>
                                );

                              case 'os':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px', minWidth: 100 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{asset.os_name || '-'}</div>
                                  </td>
                                );

                              case 'os_version':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px', minWidth: 100 }}>
                                    <div style={{ fontSize: 12, color: 'var(--text)' }}>{asset.os_version || '-'}</div>
                                    {asset.os_arch && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{asset.os_arch}</div>}
                                  </td>
                                );

                              case 'serial_number':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px' }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: 'monospace' }}>{asset.serial_number || '-'}</div>
                                  </td>
                                );

                              case 'cpu':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                                  </td>
                                );

                              case 'ram':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                                  </td>
                                );

                              case 'disk':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px' }}>
                                    <ProgressMini value={diskPercent} tone="var(--success)" />
                                    {asset.disk_total_gb != null && (
                                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{asset.disk_used_gb ?? 0} / {asset.disk_total_gb} GB</div>
                                    )}
                                  </td>
                                );

                              case 'serial_number':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px' }}>
                                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text)' }}>{asset.serial_number || '-'}</span>
                                  </td>
                                );

                              case 'manufacturer':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px' }}>
                                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{asset.manufacturer || '-'}</span>
                                  </td>
                                );

                              case 'model':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px' }}>
                                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{asset.model || '-'}</span>
                                  </td>
                                );

                              case 'hostname':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px' }}>
                                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text)' }}>{asset.hostname || '-'}</span>
                                  </td>
                                );

                              case 'mac_address':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px' }}>
                                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text)' }}>{asset.mac_address || '-'}</span>
                                  </td>
                                );

                              case 'domain':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px' }}>
                                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{asset.domain || '-'}</span>
                                  </td>
                                );

                              case 'department':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px' }}>
                                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{asset.department || '-'}</span>
                                  </td>
                                );

                              case 'company':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px' }}>
                                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{asset.company || '-'}</span>
                                  </td>
                                );

                              case 'owner':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <Avatar name={asset.assigned_to_name} avatarUrl={asset.assigned_to_avatar} />
                                      <span style={{ fontSize: 12, color: 'var(--text)' }}>{asset.assigned_to_name || 'Unassigned'}</span>
                                    </div>
                                  </td>
                                );

                              case 'group':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px' }}>
                                    {asset.group_name ? (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        padding: '4px 10px', borderRadius: 999,
                                        background: asset.group_color ? `color-mix(in srgb, ${asset.group_color} 14%, var(--bg-secondary))` : 'var(--accent-subtle)',
                                        border: `1px solid ${asset.group_color || 'var(--accent-border)'}`,
                                        color: asset.group_color || 'var(--accent)', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                                      }}>
                                        {asset.group_name}
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>
                                    )}
                                  </td>
                                );

                              case 'vendor':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px' }}>
                                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{asset.vendor || '-'}</span>
                                  </td>
                                );

                              case 'purchase_date':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px', whiteSpace: 'nowrap' }}>
                                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{formatDate(asset.purchase_date)}</span>
                                  </td>
                                );

                              case 'warranty_expiry':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px', whiteSpace: 'nowrap' }}>
                                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{formatDate(asset.warranty_expiry)}</span>
                                  </td>
                                );

                              case 'purchase_cost':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px', whiteSpace: 'nowrap' }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{formatCost(asset.purchase_cost)}</span>
                                  </td>
                                );

                              case 'agent_status':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px' }}>
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 6,
                                      fontSize: 12, fontWeight: 600,
                                      color: asset.agent_status === 'online' ? 'var(--success)' : asset.agent_status === 'offline' ? 'var(--text-muted)' : 'var(--warning)',
                                    }}>
                                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: getAgentDotColor(asset.agent_status) }} />
                                      {asset.agent_status ? asset.agent_status.charAt(0).toUpperCase() + asset.agent_status.slice(1) : 'Unknown'}
                                    </span>
                                  </td>
                                );

                              case 'agent_version':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px' }}>
                                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text)' }}>{asset.agent_version || '-'}</span>
                                  </td>
                                );

                              case 'tags':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px', maxWidth: 200 }}>
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                      {(asset.tags || []).slice(0, 3).map(tag => (
                                        <span key={tag} style={{
                                          padding: '2px 8px', borderRadius: 999,
                                          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                          fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)',
                                        }}>{tag}</span>
                                      ))}
                                      {(asset.tags || []).length > 3 && (
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 4px' }}>+{asset.tags!.length - 3}</span>
                                      )}
                                      {(!asset.tags || asset.tags.length === 0) && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>}
                                    </div>
                                  </td>
                                );

                              case 'last_seen':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 12 }}>
                                    {timeAgo(asset.agent_last_seen)}
                                  </td>
                                );

                              case 'created_at':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px', whiteSpace: 'nowrap' }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(asset.created_at)}</span>
                                  </td>
                                );

                              case 'updated_at':
                                return (
                                  <td key={col.id} style={{ padding: '12px 12px', whiteSpace: 'nowrap' }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(asset.updated_at)}</span>
                                  </td>
                                );

                              default:
                                return <td key={col.id} style={{ padding: '12px 12px' }}><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span></td>;
                            }
                          })}

                          <td style={{ padding: '12px 12px' }} onClick={(event) => event.stopPropagation()}>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                const rect = event.currentTarget.getBoundingClientRect();
                                const rightEdge = window.innerWidth - rect.right;
                                setMenuPos({ top: rect.bottom + 6, right: Math.max(8, rightEdge) });
                                setMenuOpenId((current) => (current === asset.id ? null : asset.id));
                              }}
                              style={{
                                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                                background: 'var(--bg)', color: 'var(--text-muted)', cursor: 'pointer',
                              }}
                            >
                              <MoreHorizontal size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '14px 18px',
                  borderTop: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} assets
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                    disabled={page === 1}
                    style={{
                      ...controlButtonStyle,
                      opacity: page === 1 ? 0.5 : 1,
                      cursor: page === 1 ? 'default' : 'pointer'
                    }}
                  >
                    <ChevronLeft size={14} />
                    Prev
                  </button>

                  <button
                    onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
                    disabled={page === totalPages}
                    style={{
                      ...controlButtonStyle,
                      opacity: page === totalPages ? 0.5 : 1,
                      cursor: page === totalPages ? 'default' : 'pointer'
                    }}
                  >
                    Next
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Portal-rendered action menu — outside overflow container so it's never clipped */}
      {menuOpenId && menuPos ? createPortal(
        <div
          style={{
            position: 'fixed',
            top: menuPos.top,
            right: menuPos.right,
            minWidth: 170,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            boxShadow: 'var(--shadow-md)',
            padding: 6,
            zIndex: 1100,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {(() => {
            const asset = assets.find((a) => a.id === menuOpenId);
            if (!asset) return null;
            return (
              <>
                {canManage ? (
                  <button
                    onClick={() => { setMenuOpenId(null); openEditModal(asset); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
                      background: 'transparent', color: 'var(--text)', cursor: 'pointer',
                      fontSize: 13, textAlign: 'left'
                    }}
                  >
                    <Edit3 size={14} />
                    Edit
                  </button>
                ) : null}

                {canManage ? (
                  <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
                ) : null}

                {canManage ? (
                  <button
                    onClick={() => { setMenuOpenId(null); void handleDeleteAsset(asset.id); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
                      background: 'transparent', color: 'var(--danger)', cursor: 'pointer',
                      fontSize: 13, textAlign: 'left'
                    }}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                ) : null}
              </>
            );
          })()}
        </div>,
        document.body
      ) : null}

      {showModal ? <AssetFormModal
        modalMode={modalMode}
        form={form}
        setForm={setForm}
        groups={groups}
        saving={saving}
        inputStyle={inputStyle}
        controlButtonStyle={controlButtonStyle}
        onClose={() => setShowModal(false)}
        onSave={() => void handleSave()}
      /> : null}

      {toast && (
        <div
          role="alert"
          onClick={() => setToast(null)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            maxWidth: 420,
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: toast.type === 'error' ? 'var(--danger-bg, #fef2f2)' : 'var(--success-bg, #f0fdf4)',
            border: `1px solid ${toast.type === 'error' ? 'var(--danger-border, #fecaca)' : 'var(--success-border, #bbf7d0)'}`,
            color: toast.type === 'error' ? 'var(--danger, #dc2626)' : 'var(--success, #16a34a)',
            fontSize: 13,
            fontWeight: 500,
            boxShadow: 'var(--shadow-md)',
            zIndex: 2000,
            cursor: 'pointer',
            animation: 'slideUp 0.3s ease'
          }}
        >
          {toast.message}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes slideUp {
          from { transform: translateY(12px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
