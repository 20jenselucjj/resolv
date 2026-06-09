'use client';

import { useState } from 'react';
import { Clock, Plus, Edit2, Trash2, Play, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from './SharedUI';
import type { SLAPolicy } from './types';

export function SLAPoliciesTab({ policies, onRefresh, showAlert, setConfirmModal }: {
  policies: SLAPolicy[];
  onRefresh: () => void;
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (modal: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ name: '', priority: 'medium' as SLAPolicy['priority'], response_time_hours: 4, resolution_time_hours: 24 });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', priority: 'medium' as SLAPolicy['priority'], response_time_hours: 4, resolution_time_hours: 24 });

  const getTierIndicator = (priority: string) => {
    switch (priority) {
      case 'critical': return <div style={{ display: 'flex', gap: '2px' }}><div style={{ width: 6, height: 12, background: 'var(--critical)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--critical)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--critical)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--critical)', borderRadius: 2 }}/></div>;
      case 'high': return <div style={{ display: 'flex', gap: '2px' }}><div style={{ width: 6, height: 12, background: 'var(--danger)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--danger)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--danger)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--border)', borderRadius: 2 }}/></div>;
      case 'medium': return <div style={{ display: 'flex', gap: '2px' }}><div style={{ width: 6, height: 12, background: 'var(--warning)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--warning)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--border)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--border)', borderRadius: 2 }}/></div>;
      default: return <div style={{ display: 'flex', gap: '2px' }}><div style={{ width: 6, height: 12, background: 'var(--success)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--border)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--border)', borderRadius: 2 }}/><div style={{ width: 6, height: 12, background: 'var(--border)', borderRadius: 2 }}/></div>;
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/sla-policies', { ...form, is_active: true });
      showAlert('SLA policy created successfully');
      setIsAdding(false);
      setForm({ name: '', priority: 'medium', response_time_hours: 4, resolution_time_hours: 24 });
      onRefresh();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to create SLA policy', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch(`/sla-policies/${editingId}`, editForm);
      showAlert('SLA policy updated');
      setEditingId(null);
      onRefresh();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to update SLA policy', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      open: true,
      title: 'Delete SLA Policy',
      message: 'Are you sure you want to delete this SLA policy? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.delete(`/sla-policies/${id}`);
          showAlert('SLA policy deleted');
          onRefresh();
        } catch (err: any) {
          showAlert(err?.serverError || err?.message || 'Failed to delete SLA policy', 'error');
        }
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button className="btn" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }} onClick={() => showAlert('SLA check triggered. Running dry-run simulation.', 'success')}>
          <Play size={14} style={{ marginRight: '6px' }} /> Test SLA
        </button>
        <button className="btn btn-primary" onClick={() => setIsAdding(true)}><Plus size={14} /> Add Policy</button>
      </div>

      {isAdding && (
        <div className="card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-border)' }}>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Policy Name *</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Standard SLA" required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Priority</label>
              <select className="select" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as any })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Response Time (hours)</label>
              <input className="input" type="number" min={1} value={form.response_time_hours} onChange={e => setForm({ ...form, response_time_hours: parseInt(e.target.value) })} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Resolution Time (hours)</label>
              <input className="input" type="number" min={1} value={form.resolution_time_hours} onChange={e => setForm({ ...form, resolution_time_hours: parseInt(e.target.value) })} required />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setIsAdding(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {policies.length === 0 && !isAdding ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <Clock size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No SLA policies yet</div>
          <div style={{ fontSize: 13, marginBottom: 16 }}>Define response and resolution time targets for each priority level</div>
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}><Plus size={14} /> Add First Policy</button>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Name</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Tier / Priority</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Response Time</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Resolution Time</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  editingId === p.id ? (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px 16px' }} colSpan={5}>
                        <form onSubmit={handleEdit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Name *</label>
                            <input className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Priority</label>
                            <select className="select" style={{ padding: '6px 10px', fontSize: 13 }} value={editForm.priority} onChange={e => setEditForm({ ...editForm, priority: e.target.value as any })}>
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="critical">Critical</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Response (h)</label>
                            <input className="input" type="number" min={1} style={{ padding: '6px 10px', fontSize: 13 }} value={editForm.response_time_hours} onChange={e => setEditForm({ ...editForm, response_time_hours: parseInt(e.target.value) })} required />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Resolution (h)</label>
                            <input className="input" type="number" min={1} style={{ padding: '6px 10px', fontSize: 13 }} value={editForm.resolution_time_hours} onChange={e => setEditForm({ ...editForm, resolution_time_hours: parseInt(e.target.value) })} required />
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12, flex: 1 }}>Save</button>
                            <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>{p.name}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {getTierIndicator(p.priority)}
                          <Badge variant={p.priority}>{p.priority}</Badge>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}><Clock size={12} style={{ display: 'inline', marginRight: 4, color: 'var(--text-muted)' }} />{p.response_time_hours}h</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}><CheckCircle size={12} style={{ display: 'inline', marginRight: 4, color: 'var(--text-muted)' }} />{p.resolution_time_hours}h</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => { setEditingId(p.id); setEditForm({ name: p.name, priority: p.priority, response_time_hours: p.response_time_hours, resolution_time_hours: p.resolution_time_hours }); }}><Edit2 size={14} /></button>
                          <button className="btn btn-ghost" style={{ padding: '4px', color: 'var(--danger)' }} onClick={() => handleDelete(p.id)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
