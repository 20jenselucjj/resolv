'use client';

import { useState, useEffect, useCallback } from 'react';
import { Layers, Plus, Edit2, Trash2, Monitor, Search, ArrowUpDown, Settings, DollarSign, Save } from 'lucide-react';
import { api } from '@/lib/api';

interface AutoJoinCondition {
  field: string;
  operator: string;
  value: string;
}

interface AutoJoinRule {
  match: 'all' | 'any';
  conditions: AutoJoinCondition[];
}

interface AssetGroup {
  id: string;
  name: string;
  description: string;
  color: string;
  asset_count?: number;
  default_department?: string;
  default_company?: string;
  default_assigned_to_id?: string;
  auto_join_rules?: AutoJoinRule[];
  auto_join_enabled?: boolean;
}

export function AssetGroupsTab({ groups, onRefresh, showAlert, setConfirmModal }: {
  groups: AssetGroup[];
  onRefresh: () => void;
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (modal: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', color: '#6366F1' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', color: '#6366F1' });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'asset_count' | 'newest'>('name');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [expandedDefaults, setExpandedDefaults] = useState<string | null>(null);
  const [defaultsForm, setDefaultsForm] = useState<Record<string, any>>({});
  const [savingDefaults, setSavingDefaults] = useState(false);

  // ─── License Config State ─────────────────────────────────────────────────
  const [licenseSettings, setLicenseSettings] = useState<Record<string, string>>({
    license_default_alert_threshold: '90',
    license_default_renewal_days: '30',
    license_default_currency: 'USD',
    license_categories: '',
  });
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [savingLicense, setSavingLicense] = useState<string | null>(null);

  const filteredGroups = groups
    .filter(g =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'asset_count') return (b.asset_count || 0) - (a.asset_count || 0);
      return 0;
    });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/asset-groups', form);
      showAlert('Asset group created successfully');
      setIsAdding(false);
      setForm({ name: '', description: '', color: '#6366F1' });
      onRefresh();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to create asset group', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch(`/asset-groups/${editingId}`, editForm);
      showAlert('Asset group updated');
      setEditingId(null);
      onRefresh();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to update asset group', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      open: true,
      title: 'Delete Asset Group',
      message: 'Are you sure you want to delete this asset group? Assets in this group will be ungrouped but not deleted.',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.delete(`/asset-groups/${id}`);
          showAlert('Asset group deleted');
          onRefresh();
        } catch (err: any) {
          showAlert(err?.serverError || err?.message || 'Failed to delete asset group', 'error');
        }
      }
    });
  };

  const toggleDefaultsPanel = (g: AssetGroup) => {
    if (expandedDefaults === g.id) {
      setExpandedDefaults(null);
    } else {
      setExpandedDefaults(g.id);
      setDefaultsForm({
        [`${g.id}_dept`]: g.default_department || '',
        [`${g.id}_company`]: g.default_company || '',
        [`${g.id}_assigned`]: g.default_assigned_to_id || '',
        [`${g.id}_rules`]: g.auto_join_rules || [],
        [`${g.id}_enabled`]: g.auto_join_enabled || false,
      });
    }
  };

  const handleSaveDefaults = (groupId: string) => async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDefaults(true);
    try {
      await api.patch(`/asset-groups/${groupId}`, {
        default_department: defaultsForm[`${groupId}_dept`] || null,
        default_company: defaultsForm[`${groupId}_company`] || null,
        default_assigned_to_id: defaultsForm[`${groupId}_assigned`] || null,
        auto_join_rules: defaultsForm[`${groupId}_rules`] || [],
        auto_join_enabled: defaultsForm[`${groupId}_enabled`] || false,
      });
      showAlert('Group defaults saved');
      onRefresh();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to save defaults', 'error');
    } finally {
      setSavingDefaults(false);
    }
  };

  // ─── License Config ──────────────────────────────────────────────────────

  const loadLicenseSettings = useCallback(async () => {
    setLicenseLoading(true);
    try {
      const res = await api.get<{ data: Array<{ key: string; value: string }> }>('/admin/settings');
      if (res.data) {
        const keys = ['license_default_alert_threshold', 'license_default_renewal_days', 'license_default_currency', 'license_categories'];
        const loaded: Record<string, string> = { ...licenseSettings };
        for (const item of res.data) {
          if (keys.includes(item.key)) {
            loaded[item.key] = item.value;
          }
        }
        setLicenseSettings(loaded);
      }
    } catch {
      // Settings endpoint may not be available
    } finally {
      setLicenseLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLicenseSettings();
  }, [loadLicenseSettings]);

  const handleSaveLicense = async (key: string) => {
    setSavingLicense(key);
    try {
      await api.patch('/admin/settings', { key, value: licenseSettings[key] });
      showAlert('License setting saved');
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to save license setting', 'error');
    } finally {
      setSavingLicense(null);
    }
  };

  const sectionStyle: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px',
  };

  const sectionDesc: React.CSSProperties = {
    fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', fontSize: '13px',
    background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', color: 'var(--text)', outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 600,
    color: 'var(--text-secondary)', marginBottom: '4px',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle, cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toolbar: search, sort, group count, add button */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search groups by name or description..."
            style={{ width: '100%', paddingLeft: 30, fontSize: 13 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ArrowUpDown size={14} color="var(--text-muted)" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'name' | 'asset_count' | 'newest')}
            style={{
              fontSize: 13, padding: '4px 8px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            <option value="name">Name</option>
            <option value="asset_count">Asset Count</option>
            <option value="newest">Newest</option>
          </select>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {filteredGroups.length} {filteredGroups.length === 1 ? 'group' : 'groups'}
        </span>
        <button onClick={() => setIsAdding(true)} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}><Plus size={14} /> Add Group</button>
      </div>

      {isAdding && (
        <div className="card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-border)' }}>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Name *</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Workstations" required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Description</label>
              <input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={{ width: 40, height: 34, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', padding: 2 }} />
                <input className="input" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={{ flex: 1 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setIsAdding(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {groups.length === 0 && !isAdding ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <Layers size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No asset groups yet</div>
          <div style={{ fontSize: 13, marginBottom: 16 }}>Create groups to organize your assets</div>
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}><Plus size={14} /> Add First Group</button>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <Search size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No groups match your search</div>
          <div style={{ fontSize: 13, marginBottom: 16 }}>Try a different search term or clear the filter</div>
          <button className="btn btn-ghost" onClick={() => setSearchQuery('')}>Clear Search</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {filteredGroups.map((g) => (
            <div
              key={g.id}
              className="card"
              onMouseEnter={() => setHoveredId(g.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                padding: '16px',
                transition: 'box-shadow 0.15s ease, transform 0.15s ease',
                boxShadow: hoveredId === g.id ? '0 4px 12px rgba(0,0,0,0.12)' : undefined,
                transform: hoveredId === g.id ? 'translateY(-1px)' : undefined,
              }}
            >
              {editingId === g.id ? (
                <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Name *</label>
                    <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Description</label>
                    <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Color</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="color" value={editForm.color} onChange={e => setEditForm({ ...editForm, color: e.target.value })} style={{ width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', padding: 2 }} />
                      <input className="input" style={{ padding: '6px 10px', fontSize: 13, flex: 1 }} value={editForm.color} onChange={e => setEditForm({ ...editForm, color: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button type="submit" className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 12 }}>Save</button>
                    <button type="button" className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <><div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  {/* Color swatch */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: g.color,
                    flexShrink: 0,
                    border: '2px solid var(--border)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{g.name}</span>
                      {typeof g.asset_count === 'number' && (
                        <span style={{
                          fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
                          background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)',
                          padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          <Monitor size={11} /> {g.asset_count}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>{g.description || 'No description'}</div>
                  </div>
                  <button className="btn btn-ghost" style={{ padding: '4px', flexShrink: 0, color: expandedDefaults === g.id ? 'var(--accent)' : 'var(--text-muted)' }}
                    onClick={(e) => { e.stopPropagation(); toggleDefaultsPanel(g); }}>
                    <Settings size={14} />
                  </button>
                  <button className="btn btn-ghost" style={{ padding: '4px', flexShrink: 0 }} onClick={() => { setEditingId(g.id); setEditForm({ name: g.name, description: g.description, color: g.color }); }}><Edit2 size={14} /></button>
                  <button className="btn btn-ghost" style={{ padding: '4px', color: 'var(--danger)', flexShrink: 0 }} onClick={() => handleDelete(g.id)}><Trash2 size={14} /></button>
                </div>
                {expandedDefaults === g.id && (
                  <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                    <form onSubmit={handleSaveDefaults(g.id)} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Auto-Fill Defaults
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                        When an asset joins this group, these values auto-fill if the asset's fields are empty.
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Default Department</label>
                          <input className="input" style={{ padding: '6px 10px', fontSize: 13 }}
                            value={defaultsForm[`${g.id}_dept`] || ''}
                            onChange={e => setDefaultsForm({ ...defaultsForm, [`${g.id}_dept`]: e.target.value })}
                            placeholder="e.g. Engineering" />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Default Company</label>
                          <input className="input" style={{ padding: '6px 10px', fontSize: 13 }}
                            value={defaultsForm[`${g.id}_company`] || ''}
                            onChange={e => setDefaultsForm({ ...defaultsForm, [`${g.id}_company`]: e.target.value })}
                            placeholder="e.g. Acme Corp" />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Default Assigned To</label>
                        <input className="input" style={{ padding: '6px 10px', fontSize: 13 }}
                          value={defaultsForm[`${g.id}_assigned`] || ''}
                          onChange={e => setDefaultsForm({ ...defaultsForm, [`${g.id}_assigned`]: e.target.value })}
                          placeholder="User UUID or leave blank" />
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Enter a user's UUID to auto-assign assets in this group.</div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                          Auto-Join Rules
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                          <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={defaultsForm[`${g.id}_enabled`] === true}
                              onChange={e => setDefaultsForm({ ...defaultsForm, [`${g.id}_enabled`]: e.target.checked })} />
                            Enable auto-join
                          </label>
                        </div>

                        {(defaultsForm[`${g.id}_rules`] || []).map((rule: any, ri: number) => (
                          <div key={ri} style={{ padding: '8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <select value={rule.match || 'all'} onChange={e => {
                                const rules = [...(defaultsForm[`${g.id}_rules`] || [])];
                                rules[ri] = { ...rules[ri], match: e.target.value };
                                setDefaultsForm({ ...defaultsForm, [`${g.id}_rules`]: rules });
                              }} style={{ fontSize: '12px', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)' }}>
                                <option value="all">Match ALL conditions</option>
                                <option value="any">Match ANY condition</option>
                              </select>
                              <button type="button" onClick={() => {
                                const rules = [...(defaultsForm[`${g.id}_rules`] || [])];
                                rules.splice(ri, 1);
                                setDefaultsForm({ ...defaultsForm, [`${g.id}_rules`]: rules });
                              }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
                            </div>
                            {rule.conditions.map((cond: any, ci: number) => (
                              <div key={ci} style={{ display: 'flex', gap: '6px', marginBottom: '4px', alignItems: 'center' }}>
                                <select value={cond.field} onChange={e => {
                                  const rules = [...(defaultsForm[`${g.id}_rules`] || [])];
                                  rules[ri].conditions[ci] = { ...rules[ri].conditions[ci], field: e.target.value };
                                  setDefaultsForm({ ...defaultsForm, [`${g.id}_rules`]: rules });
                                }} style={{ flex: 1, fontSize: '12px', padding: '4px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)' }}>
                                  <option value="asset_type">Asset Type</option>
                                  <option value="manufacturer">Manufacturer</option>
                                  <option value="model">Model</option>
                                  <option value="hostname">Hostname</option>
                                  <option value="os_name">OS Name</option>
                                  <option value="department">Department</option>
                                  <option value="company">Company</option>
                                  <option value="serial_number">Serial Number</option>
                                  <option value="domain">Domain</option>
                                </select>
                                <select value={cond.operator} onChange={e => {
                                  const rules = [...(defaultsForm[`${g.id}_rules`] || [])];
                                  rules[ri].conditions[ci] = { ...rules[ri].conditions[ci], operator: e.target.value };
                                  setDefaultsForm({ ...defaultsForm, [`${g.id}_rules`]: rules });
                                }} style={{ flex: 1, fontSize: '12px', padding: '4px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)' }}>
                                  <option value="equals">equals</option>
                                  <option value="not_equals">not equals</option>
                                  <option value="contains">contains</option>
                                  <option value="starts_with">starts with</option>
                                  <option value="ends_with">ends with</option>
                                  <option value="in">is one of (comma-sep)</option>
                                  <option value="not_in">is not one of</option>
                                </select>
                                <input value={cond.value} onChange={e => {
                                  const rules = [...(defaultsForm[`${g.id}_rules`] || [])];
                                  rules[ri].conditions[ci] = { ...rules[ri].conditions[ci], value: e.target.value };
                                  setDefaultsForm({ ...defaultsForm, [`${g.id}_rules`]: rules });
                                }} placeholder="Value" style={{ flex: 1, fontSize: '12px', padding: '4px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                                <button type="button" onClick={() => {
                                  const rules = [...(defaultsForm[`${g.id}_rules`] || [])];
                                  rules[ri].conditions.splice(ci, 1);
                                  setDefaultsForm({ ...defaultsForm, [`${g.id}_rules`]: rules });
                                }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '14px' }}>×</button>
                              </div>
                            ))}
                            <button type="button" onClick={() => {
                              const rules = [...(defaultsForm[`${g.id}_rules`] || [])];
                              rules[ri].conditions.push({ field: 'asset_type', operator: 'equals', value: '' });
                              setDefaultsForm({ ...defaultsForm, [`${g.id}_rules`]: rules });
                            }} style={{ fontSize: '11px', padding: '3px 8px', background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)', marginTop: '4px' }}>+ Add Condition</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => {
                          const rules = [...(defaultsForm[`${g.id}_rules`] || []), { match: 'all', conditions: [{ field: 'asset_type', operator: 'equals', value: '' }] }];
                          setDefaultsForm({ ...defaultsForm, [`${g.id}_rules`]: rules });
                        }} style={{ fontSize: '12px', padding: '6px 12px', background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-muted)', width: '100%' }}>+ Add Rule</button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                        <button type="submit" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 12 }} disabled={savingDefaults}>
                          {savingDefaults ? 'Saving...' : 'Save Defaults & Rules'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </>)}
            </div>
          ))}
        </div>
      )}

      {/* ─── Software License Defaults ───────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--radius-md)',
            background: 'rgba(34,197,94,0.12)', color: '#22c55e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <DollarSign size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={sectionTitle}>Software License Defaults</h3>
            <p style={sectionDesc}>
              Configure default settings for software license management. These values are used
              as presets when creating new license records.
            </p>

            {licenseLoading ? (
              <div className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-md)' }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Compliance Alert Threshold (%)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={licenseSettings.license_default_alert_threshold}
                      onChange={e => setLicenseSettings({ ...licenseSettings, license_default_alert_threshold: e.target.value })}
                      style={inputStyle}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      When license usage reaches this percentage, a compliance alert is triggered.
                    </div>
                    <button
                      onClick={() => handleSaveLicense('license_default_alert_threshold')}
                      className="btn btn-ghost"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 'var(--radius-md)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        color: 'var(--accent)', marginTop: 8,
                      }}
                      disabled={savingLicense === 'license_default_alert_threshold'}
                    >
                      <Save size={14} />
                      {savingLicense === 'license_default_alert_threshold' ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <div>
                    <label style={labelStyle}>Default Renewal Notice (days)</label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={licenseSettings.license_default_renewal_days}
                      onChange={e => setLicenseSettings({ ...licenseSettings, license_default_renewal_days: e.target.value })}
                      style={inputStyle}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Number of days before a license expires to send a renewal notice.
                    </div>
                    <button
                      onClick={() => handleSaveLicense('license_default_renewal_days')}
                      className="btn btn-ghost"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 'var(--radius-md)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        color: 'var(--accent)', marginTop: 8,
                      }}
                      disabled={savingLicense === 'license_default_renewal_days'}
                    >
                      <Save size={14} />
                      {savingLicense === 'license_default_renewal_days' ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Default Currency</label>
                    <select
                      value={licenseSettings.license_default_currency}
                      onChange={e => setLicenseSettings({ ...licenseSettings, license_default_currency: e.target.value })}
                      style={selectStyle}
                    >
                      <option value="USD">USD — US Dollar</option>
                      <option value="EUR">EUR — Euro</option>
                      <option value="GBP">GBP — British Pound</option>
                      <option value="CAD">CAD — Canadian Dollar</option>
                      <option value="AUD">AUD — Australian Dollar</option>
                    </select>
                    <button
                      onClick={() => handleSaveLicense('license_default_currency')}
                      className="btn btn-ghost"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 'var(--radius-md)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        color: 'var(--accent)', marginTop: 8,
                      }}
                      disabled={savingLicense === 'license_default_currency'}
                    >
                      <Save size={14} />
                      {savingLicense === 'license_default_currency' ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <div>
                    <label style={labelStyle}>License Categories</label>
                    <textarea
                      value={licenseSettings.license_categories}
                      onChange={e => setLicenseSettings({ ...licenseSettings, license_categories: e.target.value })}
                      style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                      placeholder="e.g. SaaS, Perpetual, Subscription, OEM, Volume Licensing"
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Comma-separated list of default license categories for new licenses.
                    </div>
                    <button
                      onClick={() => handleSaveLicense('license_categories')}
                      className="btn btn-ghost"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 'var(--radius-md)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        color: 'var(--accent)', marginTop: 8,
                      }}
                      disabled={savingLicense === 'license_categories'}
                    >
                      <Save size={14} />
                      {savingLicense === 'license_categories' ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
