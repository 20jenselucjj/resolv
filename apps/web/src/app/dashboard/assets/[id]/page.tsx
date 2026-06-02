'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowLeft, Building2, Calendar, Circle, Clock3, Cpu, Database, Edit3, Globe, HardDrive, LoaderCircle, MemoryStick, Monitor, Package, RefreshCw, Save, Search, Trash2, Wifi } from 'lucide-react';

import { api, API_BASE } from '@/lib/api';
import { connectSocket, createSocket } from '@/lib/socket';
import { useStore } from '@/lib/store';

import type { AssetDetail, AssetResponse, AssetSoftware, TabId, NoticeTone } from '@/lib/asset-detail-types';
import { BODY_FONT, DISPLAY_FONT, TABS } from '@/lib/asset-detail-types';
import { useSocketConnection, useCompactLayout, formatDate, formatDateTime, timeAgo, formatCurrency, formatGb, clampPercent, normalizeDns, getAssetIcon, getActivityMeta, toneColor, getDiskSummary } from '@/components/asset-detail-utils';
import { Panel, DetailGrid, ProgressBar, Pill, ActionButton, EmptyState, EditAssetModal } from '@/components/asset-detail-ui';
import { AssetDetailSidebar } from '@/components/asset-detail-sidebar';

export default function AssetDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}): React.JSX.Element {
  const { id } = React.use(params);
  const router = useRouter();
  const socket = useSocketConnection();
  const compactLayout = useCompactLayout();
  const user = useStore((state) => state.user);

  const [asset, setAsset] = React.useState<AssetDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<TabId>('overview');
  const [softwareQuery, setSoftwareQuery] = React.useState('');
  const [software, setSoftware] = React.useState<AssetSoftware[]>([]);
  const [notes, setNotes] = React.useState('');
  const [savingNotes, setSavingNotes] = React.useState(false);

  const [deleting, setDeleting] = React.useState(false);
  const [resyncing, setResyncing] = React.useState(false);
  const [notice, setNotice] = React.useState<{ tone: NoticeTone; text: string } | null>(null);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [editingPanel, setEditingPanel] = React.useState<'organization' | 'lifecycle' | null>(null);
  const [panelForm, setPanelForm] = React.useState({
    assigned_to_name: '',
    department: '',
    location: '',
    company: '',
    vendor: '',
    purchase_date: '',
    warranty_expiry: '',
    purchase_cost: ''
  });
  const [savingPanel, setSavingPanel] = React.useState(false);

  const fetchAsset = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get<AssetResponse>(`/assets/${id}`);
      setAsset(response.data);
      setNotes(response.data.notes || '');
    } catch (err: any) {
      setError(err.message || 'Unable to load asset');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchSoftware = React.useCallback(async () => {
    try {
      const response = await api.get<{ data: AssetSoftware[] }>(`/assets/${id}/software`);
      setSoftware(response.data || []);
    } catch {
      // software is non-critical
    }
  }, [id]);

  React.useEffect(() => {
    fetchAsset();
    fetchSoftware();
  }, [fetchAsset, fetchSoftware]);

  React.useEffect(() => {
    if (!notice) return;

    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const users = React.useMemo(() => {
    const raw = asset?.users || asset?.logged_users || [];
    const seen = new Set<string>();
    const sessions = new Map<string, { session: any; count: number }>();
    for (const s of raw) {
      const key = s.username || s.user_id || s.display_name || s.user_email || '';
      const existing = sessions.get(key);
      if (existing) {
        existing.count += 1;
        if (s.is_current) existing.session = s;
      } else {
        sessions.set(key, { session: s, count: 1 });
      }
    }
    return Array.from(sessions.values()).map(({ session, count }) => ({
      ...session,
      session_count: count > 1 ? count : undefined
    }));
  }, [asset?.users, asset?.logged_users]);
  const activity = React.useMemo(() => {
    const entries = [...(asset?.activity || [])];

    return entries.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [asset?.activity]);

  const filteredSoftware = React.useMemo(() => {
    const source = software || [];
    const query = softwareQuery.trim().toLowerCase();

    if (!query) return source;

    return source.filter((app) => {
      const haystack = [app.name, app.version, app.publisher]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [software, softwareQuery]);

  const primaryName = asset?.name || asset?.hostname || 'Untitled asset';
  const secondaryName = asset?.display_name || [asset?.manufacturer, asset?.model].filter(Boolean).join(' ');
  const isOnline = asset?.agent_status === 'online';
  const lastSeen = asset?.agent_last_seen;
  const AssetIcon = getAssetIcon(asset?.asset_type);

  const hardware = asset?.hardware || null;
  const cpuPercent = clampPercent(hardware?.cpu_usage_percent);
  const memoryUsed = Number(hardware?.ram_used_gb || 0);
  const memoryTotal = Number(hardware?.ram_total_gb || 0);
  const memoryFree = hardware?.ram_free_gb != null
    ? Number(hardware.ram_free_gb)
    : Math.max(memoryTotal - memoryUsed, 0);
  const memoryPercent = memoryTotal > 0 ? clampPercent((memoryUsed / memoryTotal) * 100) : 0;
  const diskSummary = getDiskSummary(hardware);
  const diskPercent = diskSummary.total > 0 ? clampPercent((diskSummary.used / diskSummary.total) * 100) : 0;

  const updateAsset = (next: AssetDetail) => {
    setAsset(next);
    setNotes(next.notes || '');
  };

  const patchAsset = async (payload: Partial<AssetDetail>, successMessage: string) => {
    if (!asset) return;

    const response = await api.patch<AssetResponse | undefined>(`/assets/${asset.id}`, payload);
    const nextAsset = response?.data || { ...asset, ...payload };
    updateAsset(nextAsset);
    setNotice({ tone: 'success', text: successMessage });
  };

  const saveNotes = async () => {
    if (!asset) return;

    setSavingNotes(true);

    try {
      await patchAsset({ notes }, 'Notes saved');
    } catch (err: any) {
      setNotice({ tone: 'danger', text: err.message || 'Unable to save notes' });
    } finally {
      setSavingNotes(false);
    }
  };

  const canManage = user?.role === 'admin' || user?.role === 'agent';

  const deleteAsset = async () => {
    if (!asset) return;

    const confirmed = window.confirm(`Delete ${primaryName}? This cannot be undone.`);
    if (!confirmed) return;

    setDeleting(true);

    try {
      await api.delete(`/assets/${asset.id}`);
      router.push('/dashboard/assets');
    } catch (err: any) {
      setDeleting(false);
      setNotice({ tone: 'danger', text: err.message || 'Unable to delete asset' });
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          color: 'var(--text)',
          fontFamily: BODY_FONT
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, fontWeight: 700 }}>
          <LoaderCircle size={18} />
          Loading asset detail\u2026
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          color: 'var(--text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: BODY_FONT
        }}
      >
        <div style={{ maxWidth: 560, width: '100%' }}>
          <EmptyState
            icon={Monitor}
            title="Asset not found"
            description={error || 'This asset could not be loaded or may have been removed.'}
          />
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
            <ActionButton icon={ArrowLeft} onClick={() => router.push('/dashboard/assets')}>
              Back to assets
            </ActionButton>
          </div>
        </div>
      </div>
    );
  }

  const layoutColumns = compactLayout ? '1fr' : 'minmax(0, 2fr) minmax(320px, 1fr)';
  const twoUp = compactLayout ? '1fr' : 'repeat(2, minmax(0, 1fr))';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: BODY_FONT
      }}
    >
      <div style={{ maxWidth: 1480, margin: '0 auto', padding: compactLayout ? 16 : 24 }}>
        <div
          style={{
            background: 'linear-gradient(180deg, var(--bg-elevated), var(--bg-secondary))',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
            marginBottom: 24
          }}
        >
          <div style={{ padding: compactLayout ? 16 : 24, borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => router.push('/dashboard/assets')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                border: 'none',
                background: 'none',
                color: 'var(--text-muted)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0
              }}
            >
              <ArrowLeft size={15} />
              Assets
            </button>
          </div>

          <div
            style={{
              padding: compactLayout ? 16 : 24,
              display: 'flex',
              alignItems: compactLayout ? 'flex-start' : 'center',
              justifyContent: 'space-between',
              gap: 24,
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, minWidth: 0 }}>
              <div
                style={{
                  width: compactLayout ? 64 : 76,
                  height: compactLayout ? 64 : 76,
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'var(--shadow-sm)',
                  flexShrink: 0
                }}
              >
                <AssetIcon size={compactLayout ? 26 : 30} color="var(--accent)" />
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  <Pill tone={isOnline ? 'success' : 'warning'}>
                    <Circle size={8} fill={isOnline ? 'var(--success)' : 'var(--text-muted)'} color={isOnline ? 'var(--success)' : 'var(--text-muted)'} />
                    {isOnline ? 'Online' : 'Offline'}
                  </Pill>
                  <Pill>{asset.asset_type.replace(/_/g, ' ')}</Pill>
                  {asset.os_name && <Pill>{`${asset.os_name} ${asset.os_version || ''}`.trim()}</Pill>}
                </div>

                <h1
                  style={{
                    fontFamily: DISPLAY_FONT,
                    fontSize: compactLayout ? 34 : 44,
                    lineHeight: 1,
                    letterSpacing: '-0.04em',
                    color: 'var(--text)',
                    margin: '0 0 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14
                  }}
                >
                  {primaryName}
                  <button
                    onClick={async () => {
                      if (resyncing) return;
                      setResyncing(true);
                      try {
                        if (isOnline && socket) {
                          socket.emit('agent:request-checkin', { assetId: id });
                          setNotice({ tone: 'success', text: 'Agent notified \u2014 refreshing data\u2026' });
                          await new Promise((r) => setTimeout(r, 3000));
                        } else {
                          setNotice({ tone: 'warning', text: 'Agent is offline \u2014 can only reload cached data' });
                        }
                        await Promise.all([fetchAsset(), fetchSoftware()]);
                        if (isOnline && socket) {
                          setNotice({ tone: 'success', text: 'Asset data refreshed' });
                        }
                      } finally {
                        setResyncing(false);
                      }
                    }}
                    title="Refresh asset data"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: 8,
                      borderRadius: 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.15s, background 0.15s',
                      fontSize: 20,
                      opacity: resyncing ? 0.6 : 1
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}
                  >
                    <RefreshCw size={22} style={{ animation: resyncing ? 'spin 1s linear infinite' : undefined }} />
                  </button>
                </h1>

                <div style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 14 }}>
                  {secondaryName || 'No display name provided'}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                    <Clock3 size={14} />
                    Last seen {timeAgo(lastSeen)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                    <Globe size={14} />
                    {asset.hostname || asset.ip_address || 'No hostname'}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {canManage && <ActionButton icon={Edit3} onClick={() => setShowEditModal(true)}>Edit</ActionButton>}
              {canManage && (
                <ActionButton icon={Trash2} tone="danger" disabled={deleting} onClick={deleteAsset}>
                  {deleting ? 'Deleting\u2026' : 'Delete'}
                </ActionButton>
              )}
            </div>
          </div>
        </div>

        {notice && (
          <div
            style={{
              marginBottom: 16,
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: toneColor(notice.tone),
              fontSize: 13,
              fontWeight: 700,
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            {notice.text}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: layoutColumns, gap: 24, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                padding: 8,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {TABS.map(({ id: tabId, label, icon: Icon }) => {
                const active = activeTab === tabId;

                return (
                  <button
                    key={tabId}
                    onClick={() => setActiveTab(tabId)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      height: 40,
                      padding: '0 14px',
                      borderRadius: 'var(--radius-md)',
                      border: active ? '1px solid var(--accent)' : '1px solid transparent',
                      background: active ? 'var(--accent-subtle)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--text-muted)',
                      fontSize: 13,
                      fontWeight: active ? 700 : 600,
                      cursor: 'pointer',
                      transition: 'all 140ms ease'
                    }}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                );
              })}
            </div>

            {activeTab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: twoUp, gap: 20 }}>
                <Panel title="Asset identity" subtitle="Core serial and platform details" icon={Monitor}>
                  <DetailGrid
                    items={[
                      { label: 'Type', value: asset.asset_type.replace(/_/g, ' ') },
                      { label: 'Serial number', value: asset.serial_number },
                      { label: 'Manufacturer', value: asset.manufacturer },
                      { label: 'Model', value: asset.model },
                      { label: 'OS', value: `${asset.os_name || ''} ${asset.os_version || ''}`.trim() || '\u2014' },
                      { label: 'Primary name', value: primaryName, accent: true }
                    ]}
                  />
                </Panel>

                <Panel title="Network info" subtitle="Primary network identifiers" icon={Globe}>
                  <DetailGrid
                    items={[
                      { label: 'IP address', value: asset.ip_address },
                      { label: 'Hostname', value: asset.hostname },
                      { label: 'MAC', value: asset.mac_address },
                      { label: 'Domain', value: asset.domain }
                    ]}
                  />
                </Panel>

                <Panel
                  title="Organization"
                  subtitle="Ownership and organizational context"
                  icon={Building2}
                  actions={
                    canManage ? (
                      editingPanel === 'organization' ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <ActionButton
                            icon={Save}
                            tone="primary"
                            disabled={savingPanel}
                            onClick={async () => {
                              setSavingPanel(true);
                              try {
                                await patchAsset({
                                  assigned_to_name: panelForm.assigned_to_name,
                                  department: panelForm.department,
                                  location: panelForm.location,
                                  company: panelForm.company
                                }, 'Organization saved');
                                setEditingPanel(null);
                              } catch (err: any) {
                                setNotice({ tone: 'danger', text: err.message || 'Unable to save' });
                              } finally {
                                setSavingPanel(false);
                              }
                            }}
                          >
                            {savingPanel ? 'Saving\u2026' : 'Save'}
                          </ActionButton>
                          <ActionButton onClick={() => setEditingPanel(null)}>Cancel</ActionButton>
                        </div>
                      ) : (
                        <ActionButton
                          icon={Edit3}
                          onClick={() => {
                            setPanelForm((f) => ({
                              ...f,
                              assigned_to_name: asset.assigned_to_name || '',
                              department: asset.department || '',
                              location: asset.location || '',
                              company: asset.company || ''
                            }));
                            setEditingPanel('organization');
                          }}
                        >
                          Edit
                        </ActionButton>
                      )
                    ) : undefined
                  }
                >
                  {editingPanel === 'organization' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700 }}>Group</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{asset.group_name ? <Pill>{asset.group_name}</Pill> : '\u2014'}</div>
                      </div>
                      {(['assigned_to_name', 'department', 'location', 'company'] as const).map((field) => (
                        <div key={field} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700 }}>
                            {field === 'assigned_to_name' ? 'Assigned to' : field.charAt(0).toUpperCase() + field.slice(1)}
                          </div>
                          <input
                            type="text"
                            value={panelForm[field]}
                            onChange={(e) => setPanelForm((f) => ({ ...f, [field]: e.target.value }))}
                            style={{
                              width: '100%',
                              height: 34,
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                              background: 'var(--bg-elevated)',
                              color: 'var(--text)',
                              padding: '0 10px',
                              fontSize: 13,
                              fontFamily: BODY_FONT,
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <DetailGrid
                      items={[
                        {
                          label: 'Group',
                          value: asset.group_name ? <Pill>{asset.group_name}</Pill> : '\u2014'
                        },
                        { label: 'Assigned to', value: users[0]?.display_name || users[0]?.username || asset.assigned_to_name || asset.owner_name },
                        { label: 'Department', value: asset.department },
                        { label: 'Location', value: asset.location },
                        { label: 'Company', value: asset.company }
                      ]}
                    />
                  )}
                </Panel>

                <Panel
                  title="Lifecycle"
                  subtitle="Procurement and warranty history"
                  icon={Calendar}
                  actions={
                    canManage ? (
                      editingPanel === 'lifecycle' ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <ActionButton
                            icon={Save}
                            tone="primary"
                            disabled={savingPanel}
                            onClick={async () => {
                              setSavingPanel(true);
                              try {
                                await patchAsset({
                                  vendor: panelForm.vendor,
                                  purchase_date: panelForm.purchase_date || null,
                                  warranty_expiry: panelForm.warranty_expiry || null,
                                  purchase_cost: panelForm.purchase_cost ? Number(panelForm.purchase_cost) : null
                                } as Partial<AssetDetail>, 'Lifecycle saved');
                                setEditingPanel(null);
                              } catch (err: any) {
                                setNotice({ tone: 'danger', text: err.message || 'Unable to save' });
                              } finally {
                                setSavingPanel(false);
                              }
                            }}
                          >
                            {savingPanel ? 'Saving\u2026' : 'Save'}
                          </ActionButton>
                          <ActionButton onClick={() => setEditingPanel(null)}>Cancel</ActionButton>
                        </div>
                      ) : (
                        <ActionButton
                          icon={Edit3}
                          onClick={() => {
                            setPanelForm((f) => ({
                              ...f,
                              vendor: asset.vendor || '',
                              purchase_date: asset.purchase_date ? asset.purchase_date.split('T')[0] : '',
                              warranty_expiry: asset.warranty_expiry ? asset.warranty_expiry.split('T')[0] : '',
                              purchase_cost: asset.purchase_cost != null ? String(asset.purchase_cost) : ''
                            }));
                            setEditingPanel('lifecycle');
                          }}
                        >
                          Edit
                        </ActionButton>
                      )
                    ) : undefined
                  }
                >
                  {editingPanel === 'lifecycle' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                      {([
                        { field: 'purchase_date', label: 'Purchase date', type: 'date' },
                        { field: 'warranty_expiry', label: 'Warranty expiry', type: 'date' },
                        { field: 'purchase_cost', label: 'Purchase cost', type: 'number' },
                        { field: 'vendor', label: 'Vendor', type: 'text' }
                      ] as { field: keyof typeof panelForm; label: string; type: string }[]).map(({ field, label, type }) => (
                        <div key={field} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700 }}>{label}</div>
                          <input
                            type={type}
                            value={panelForm[field]}
                            onChange={(e) => setPanelForm((f) => ({ ...f, [field]: e.target.value }))}
                            style={{
                              width: '100%',
                              height: 34,
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                              background: 'var(--bg-elevated)',
                              color: 'var(--text)',
                              padding: '0 10px',
                              fontSize: 13,
                              fontFamily: BODY_FONT,
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <DetailGrid
                      items={[
                        { label: 'Purchase date', value: formatDate(asset.purchase_date) },
                        { label: 'Warranty expiry', value: formatDate(asset.warranty_expiry) },
                        { label: 'Purchase cost', value: formatCurrency(asset.purchase_cost) },
                        { label: 'Vendor', value: asset.vendor }
                      ]}
                    />
                  )}
                </Panel>
              </div>
            )}

            {activeTab === 'hardware' && (
              hardware ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: twoUp, gap: 20 }}>
                    <Panel title="CPU" subtitle="Processor profile and live usage" icon={Cpu}>
                      <div style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
                          {hardware.cpu_model || '\u2014'}
                        </div>
                        <DetailGrid
                          columns={2}
                          items={[
                            { label: 'Cores', value: hardware.cpu_cores },
                            { label: 'Threads', value: hardware.cpu_threads },
                            {
                              label: 'Speed',
                              value: hardware.cpu_speed_mhz != null
                                ? `${(Number(hardware.cpu_speed_mhz) / 1000).toFixed(2)} GHz`
                                : '\u2014'
                            },
                            { label: 'Usage', value: `${cpuPercent.toFixed(1)}%` }
                          ]}
                        />
                      </div>
                      <ProgressBar percent={cpuPercent} color="var(--accent)" label="CPU usage" />
                    </Panel>

                    <Panel title="Memory" subtitle="Installed and available RAM" icon={MemoryStick}>
                      <div style={{ marginBottom: 18 }}>
                        <DetailGrid
                          columns={3}
                          items={[
                            { label: 'Total', value: formatGb(memoryTotal) },
                            { label: 'Used', value: formatGb(memoryUsed) },
                            { label: 'Free', value: formatGb(memoryFree) }
                          ]}
                        />
                      </div>
                      <ProgressBar
                        percent={memoryPercent}
                        color="var(--success)"
                        label="RAM usage"
                        meta={`${memoryPercent.toFixed(1)}%`}
                      />
                    </Panel>
                  </div>

                  <Panel title="Disk" subtitle="Capacity across all attached storage" icon={HardDrive}>
                    <div style={{ marginBottom: 18 }}>
                      <DetailGrid
                        columns={3}
                        items={[
                          { label: 'Total', value: formatGb(diskSummary.total) },
                          { label: 'Used', value: formatGb(diskSummary.used) },
                          { label: 'Free', value: formatGb(diskSummary.free) }
                        ]}
                      />
                    </div>
                    <ProgressBar percent={diskPercent} color="var(--warning)" label="Disk usage" meta={`${diskPercent.toFixed(1)}%`} />
                  </Panel>

                  <div style={{ display: 'grid', gridTemplateColumns: twoUp, gap: 20 }}>
                    <Panel title="GPU" subtitle="Graphics hardware" icon={Monitor}>
                      <DetailGrid
                        items={[
                          { label: 'Model', value: hardware.gpu_model },
                          { label: 'VRAM', value: formatGb(hardware.gpu_vram_gb) }
                        ]}
                      />
                    </Panel>

                    <Panel title="Motherboard & BIOS" subtitle="Platform firmware details" icon={Database}>
                      <DetailGrid
                        items={[
                          { label: 'Motherboard', value: hardware.motherboard_manufacturer },
                          { label: 'BIOS version', value: hardware.bios_version },
                          { label: 'BIOS date', value: formatDate(hardware.bios_release_date) }
                        ]}
                      />
                    </Panel>
                  </div>

                  <Panel title="Disks" subtitle={`${(hardware.disks || []).length} physical or logical volumes`} icon={HardDrive}>
                    {(hardware.disks || []).length === 0 ? (
                      <EmptyState icon={HardDrive} title="No disks reported" description="The agent has not returned detailed disk metadata yet." />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                         {(hardware.disks || []).map((disk, index) => {
                          const total = disk.size ? Number(disk.size) / (1024 * 1024 * 1024) : 0;
                          const used = diskSummary.total > 0 ? (diskSummary.used / diskSummary.total) * total : 0;
                          const free = total > 0 ? total - used : 0;
                          const percent = total > 0 ? clampPercent((used / total) * 100) : 0;

                          return (
                            <div
                              key={`${disk.name || 'disk'}-${index}`}
                              style={{
                                padding: 16,
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                background: 'var(--bg)'
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  justifyContent: 'space-between',
                                  gap: 16,
                                  marginBottom: 12,
                                  flexWrap: 'wrap'
                                }}
                              >
                                <div>
                                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                                    {disk.name || `Disk ${index + 1}`}
                                  </div>
                                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                    {[disk.type, disk.mount, disk.serial_number].filter(Boolean).join(' \u2022 ') || 'Storage device'}
                                  </div>
                                </div>
                                <Pill tone="warning">{percent.toFixed(1)}% used</Pill>
                              </div>
                              <ProgressBar percent={percent} color="var(--warning)" label="Capacity" meta={`${formatGb(used)} of ${formatGb(total)}`} />
                              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                                Free space: {formatGb(free)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Panel>

                    {(hardware.displays || []).length > 0 && (
                    <Panel title="Displays" subtitle={`${(hardware.displays || []).length} connected display panels`} icon={Monitor}>
                      {(hardware.displays || []).map((display, index) => (
                          <div
                            key={`${display.name || 'display'}-${index}`}
                            style={{
                              padding: 16,
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                              background: 'var(--bg)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                              <div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                                  {display.name || `Display ${index + 1}`}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                  {[display.manufacturer, display.model].filter(Boolean).join(' \u2022 ') || 'Monitor'}
                                </div>
                              </div>
                              {display.is_primary && <Pill tone="success">Primary</Pill>}
                            </div>
                            <DetailGrid
                              columns={2}
                              items={[
                                { label: 'Resolution', value: display.resolution },
                                {
                                  label: 'Refresh rate',
                                  value: display.refresh_rate_hz != null ? `${display.refresh_rate_hz} Hz` : '\u2014'
                                }
                              ]}
                            />
                          </div>
                        ))}
                    </Panel>
                    )}
                </div>
              ) : (
                <EmptyState
                  icon={Cpu}
                  title="No hardware telemetry"
                  description="Hardware details will appear here when the asset agent next reports inventory data."
                />
              )
            )}

            {activeTab === 'software' && (
              <Panel
                title="Installed software"
                subtitle={`${filteredSoftware.length} applications shown${softwareQuery ? ` \u2022 filtered from ${software.length}` : ''}`}
                icon={Package}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      flexWrap: 'wrap',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ position: 'relative', flex: '1 1 320px', minWidth: 240 }}>
                      <Search
                        size={15}
                        color="var(--text-muted)"
                        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                      />
                      <input
                        value={softwareQuery}
                        onChange={(event) => setSoftwareQuery(event.target.value)}
                        placeholder="Search installed software"
                        style={{
                          width: '100%',
                          height: 44,
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border)',
                          background: 'var(--bg)',
                          color: 'var(--text)',
                          caretColor: 'var(--text)',
                          padding: '0 14px 0 38px',
                          fontSize: 13,
                          boxSizing: 'border-box',
                          outline: 'none'
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                      />
                    </div>
                    <Pill>{software.length} applications installed</Pill>
                  </div>

                  {software.length === 0 ? (
                    <EmptyState
                      icon={Package}
                      title="No software inventory"
                      description="Installed applications will appear after the next inventory sync."
                    />
                  ) : filteredSoftware.length === 0 ? (
                    <EmptyState
                      icon={Search}
                      title="No matches"
                      description="Try a different software name, publisher, or version search."
                    />
                  ) : (
                    <div
                      style={{
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        overflow: 'hidden',
                        background: 'var(--bg)'
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(200px, 2fr) minmax(120px, 1fr) minmax(160px, 1.2fr) minmax(140px, 1fr) minmax(100px, 0.8fr)',
                          gap: 0,
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--border)',
                          background: 'var(--bg-secondary)',
                          fontSize: 11,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          color: 'var(--text-muted)',
                          fontWeight: 700
                        }}
                      >
                        <div>Name</div>
                        <div>Version</div>
                        <div>Publisher</div>
                        <div>Install date</div>
                        <div>Size</div>
                      </div>

                      {filteredSoftware.map((sw, index) => (
                        <div
                          key={sw.id || `${sw.name}-${index}`}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(200px, 2fr) minmax(120px, 1fr) minmax(160px, 1.2fr) minmax(140px, 1fr) minmax(100px, 0.8fr)',
                            padding: '14px 16px',
                            borderBottom: index === filteredSoftware.length - 1 ? 'none' : '1px solid var(--border)',
                            fontSize: 13,
                            alignItems: 'center',
                            color: 'var(--text)'
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{sw.name}</div>
                          <div style={{ color: 'var(--text-muted)' }}>{sw.version || '\u2014'}</div>
                          <div style={{ color: 'var(--text-muted)' }}>{sw.publisher || '\u2014'}</div>
                          <div style={{ color: 'var(--text-muted)' }}>{formatDate(sw.install_date)}</div>
                          <div style={{ color: 'var(--text-muted)' }}>
                            {sw.size_mb != null ? `${Number(sw.size_mb).toFixed(1)} MB` : '\u2014'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Panel>
            )}

            {activeTab === 'network' && (
              (asset.network_adapters || []).length === 0 ? (
                <EmptyState
                  icon={Wifi}
                  title="No adapters reported"
                  description="Network adapter inventory will appear here when the endpoint reports connectivity details."
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: twoUp, gap: 20 }}>
                  {(asset.network_adapters || []).map((adapter, index) => {
                    const dns = normalizeDns(adapter.dns_servers);

                    return (
                      <Panel
                        key={adapter.id || `${adapter.adapter_name || adapter.name || 'adapter'}-${index}`}
                        title={adapter.adapter_name || adapter.name || `Adapter ${index + 1}`}
                        subtitle={[adapter.adapter_type, adapter.speed_mbps ? `${adapter.speed_mbps} Mbps` : null].filter(Boolean).join(' \u2022 ') || 'Network adapter'}
                        icon={Wifi}
                        actions={
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {adapter.is_active && <Pill tone="success">Active</Pill>}
                            {adapter.is_virtual && <Pill tone="warning">Virtual</Pill>}
                          </div>
                        }
                      >
                        <DetailGrid
                          items={[
                            { label: 'IP', value: adapter.ip_address },
                            { label: 'MAC', value: adapter.mac_address },
                            { label: 'Subnet', value: adapter.subnet || adapter.subnet_mask },
                            { label: 'Gateway', value: adapter.gateway },
                            { label: 'DNS', value: dns.length > 0 ? dns.join(', ') : '\u2014' },
                            { label: 'Type', value: adapter.adapter_type }
                          ]}
                        />
                      </Panel>
                    );
                  })}
                </div>
              )
            )}

            {activeTab === 'activity' && (
              activity.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No recent activity"
                  description="Activity will populate as changes, syncs, and remote actions occur on this asset."
                />
              ) : (
                <Panel title="Activity log" subtitle="Reverse-chronological system and operator events" icon={Activity}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {activity.map((entry, index) => {
                      const meta = getActivityMeta(entry.action);
                      const Icon = meta.icon;
                      const action = entry.action.toLowerCase();
                      const isSystemEvent = action.includes('checkin') || action.includes('heartbeat') || action.includes('sync') || action.includes('agent') || action.includes('scan') || !entry.actor_name;
                      const categoryLabel = isSystemEvent ? 'System' : 'Change';
                      const categoryColor = isSystemEvent ? 'var(--text-muted)' : 'var(--accent)';
                      const categoryBg = isSystemEvent ? 'var(--bg-secondary)' : 'var(--accent-subtle)';
                      const categoryBorder = isSystemEvent ? 'var(--border)' : 'var(--accent)';

                      return (
                        <div
                          key={entry.id || `${entry.action}-${index}`}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '44px minmax(0, 1fr)',
                            gap: 14,
                            paddingBottom: index === activity.length - 1 ? 0 : 18,
                            marginBottom: index === activity.length - 1 ? 0 : 18,
                            borderBottom: index === activity.length - 1 ? 'none' : '1px solid var(--border)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                background: 'var(--bg)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Icon size={16} color={toneColor(meta.tone)} />
                            </div>
                          </div>

                          <div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: 16,
                                flexWrap: 'wrap',
                                marginBottom: 6
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{entry.action}</div>
                                  <span style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '2px 7px',
                                    borderRadius: 999,
                                    border: `1px solid ${categoryBorder}`,
                                    background: categoryBg,
                                    color: categoryColor,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.06em'
                                  }}>
                                    {categoryLabel}
                                  </span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                  {entry.actor_name || 'System'}
                                </div>
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
                                {formatDateTime(entry.created_at)}
                              </div>
                            </div>
                            {entry.details && (
                              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{entry.details}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              )
            )}
          </div>

          <AssetDetailSidebar
            asset={asset}
            compactLayout={compactLayout}
            isOnline={isOnline}
            lastSeen={lastSeen}
            notes={notes}
            setNotes={setNotes}
            savingNotes={savingNotes}
            saveNotes={saveNotes}
            users={users}
            software={software}
            activity={activity}
          />
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {showEditModal && (
        <EditAssetModal asset={asset} onClose={() => setShowEditModal(false)} onSaved={updateAsset} />
      )}
    </div>
  );
}
