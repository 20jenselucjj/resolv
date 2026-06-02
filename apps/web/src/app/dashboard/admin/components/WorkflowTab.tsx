'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, GitBranch } from 'lucide-react';
import { api } from '@/lib/api';
import type { WorkflowTransition } from './types';

const STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];

export function WorkflowTab({ showAlert, setConfirmModal }: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (m: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
}) {
  const [transitions, setTransitions] = useState<WorkflowTransition[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ from_status: 'open', to_status: 'in_progress', required_fields: '' });

  const loadTransitions = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: WorkflowTransition[] }>('/admin/workflows');
      setTransitions(res.data);
    } catch {
      showAlert('Failed to load workflows', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTransitions(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/workflows', {
        from_status: form.from_status,
        to_status: form.to_status,
        required_fields: form.required_fields.split(',').map(s => s.trim()).filter(Boolean),
      });
      showAlert('Workflow transition created');
      setIsAdding(false);
      setForm({ from_status: 'open', to_status: 'in_progress', required_fields: '' });
      loadTransitions();
    } catch {
      showAlert('Failed to create transition', 'error');
    }
  };

  const handleDelete = (id: string) => {
    setConfirmModal({
      open: true, title: 'Delete Transition', message: 'Remove this workflow transition?',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.delete(`/admin/workflows/${id}`);
          showAlert('Transition deleted');
          loadTransitions();
        } catch {
          showAlert('Failed to delete transition', 'error');
        }
      }
    });
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={() => setIsAdding(true)}><Plus size={14} /> Add Transition</button>
      </div>

      {isAdding && (
        <div className="card" style={{ padding: 20, background: 'var(--bg-secondary)', border: '1px solid var(--accent-border)' }}>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>From Status</label>
              <select className="select" value={form.from_status} onChange={e => setForm({ ...form, from_status: e.target.value })} style={{ width: '100%' }}>
                {STATUSES.filter(s => s !== 'closed').map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>To Status</label>
              <select className="select" value={form.to_status} onChange={e => setForm({ ...form, to_status: e.target.value })} style={{ width: '100%' }}>
                {STATUSES.filter(s => s !== 'open').map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Required Fields (comma separated)</label>
              <input className="input" value={form.required_fields} onChange={e => setForm({ ...form, required_fields: e.target.value })} placeholder="e.g. close_notes, resolution" style={{ width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Create</button>
              <button type="button" className="btn btn-ghost" onClick={() => setIsAdding(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
              <th style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>From</th>
              <th style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>To</th>
              <th style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Required Fields</th>
              <th style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transitions.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{t.from_status.replace('_', ' ')}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <GitBranch size={14} color="var(--accent)" />
                    <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{t.to_status.replace('_', ' ')}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {t.required_fields && t.required_fields.length > 0 ? (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {t.required_fields.map(f => (
                        <span key={f} style={{ fontSize: 11, background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', fontFamily: 'monospace' }}>{f}</span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>None</span>
                  )}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <button className="btn btn-ghost" style={{ padding: 4, color: 'var(--danger)' }} onClick={() => handleDelete(t.id)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {transitions.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No workflow transitions defined. All transitions are currently allowed.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
