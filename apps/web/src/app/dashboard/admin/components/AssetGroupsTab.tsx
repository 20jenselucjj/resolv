'use client';

import { useState } from 'react';
import { Layers, Plus, Edit2, Trash2, Hash } from 'lucide-react';
import { api } from '@/lib/api';

interface AssetGroup {
  id: string;
  name: string;
  description: string;
  color: string;
  asset_count?: number;
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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/asset-groups', form);
      showAlert('Asset group created successfully');
      setIsAdding(false);
      setForm({ name: '', description: '', color: '#6366F1' });
      onRefresh();
    } catch {
      showAlert('Failed to create asset group', 'error');
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
    } catch {
      showAlert('Failed to update asset group', 'error');
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
        } catch {
          showAlert('Failed to delete asset group', 'error');
        }
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Asset Groups</h3>
        <button onClick={() => setIsAdding(true)} className="btn btn-primary"><Plus size={14} /> Add Group</button>
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
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {groups.map((g) => (
            <div key={g.id} className="card" style={{ padding: '16px' }}>
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
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
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
                          padding: '1px 8px',
                        }}>
                          {g.asset_count}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>{g.description || 'No description'}</div>
                  </div>
                  <button className="btn btn-ghost" style={{ padding: '4px', flexShrink: 0 }} onClick={() => { setEditingId(g.id); setEditForm({ name: g.name, description: g.description, color: g.color }); }}><Edit2 size={14} /></button>
                  <button className="btn btn-ghost" style={{ padding: '4px', color: 'var(--danger)', flexShrink: 0 }} onClick={() => handleDelete(g.id)}><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
