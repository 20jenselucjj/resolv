'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import type { AutomationRule } from './types';

export function AutomationTab({ showAlert, setConfirmModal }: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (modal: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
}) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ name: '', trigger: 'ticket_created', condition: '', action: 'change_status', actionValue: '' });

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: AutomationRule[] }>('/admin/automation-rules');
      setRules(res.data.map(r => ({ ...r, actionValue: r.action_value })));
    } catch {
      showAlert('Failed to load automation rules', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const TRIGGERS = [
    { value: 'ticket_created', label: 'Ticket Created' },
    { value: 'ticket_updated', label: 'Ticket Updated' },
    { value: 'ticket_resolved', label: 'Ticket Resolved' },
    { value: 'sla_breach', label: 'SLA Breach' },
    { value: 'comment_added', label: 'Comment Added' },
  ];

  const ACTIONS = [
    { value: 'change_status', label: 'Change Status' },
    { value: 'change_priority', label: 'Change Priority' },
    { value: 'assign_to_group', label: 'Assign to Group' },
    { value: 'send_notification', label: 'Send Notification' },
    { value: 'add_tag', label: 'Add Tag' },
  ];

  const handleToggle = async (id: string) => {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;
    try {
      await api.patch(`/admin/automation-rules/${id}`, { enabled: !rule.enabled });
      showAlert('Automation rule updated');
      loadRules();
    } catch {
      showAlert('Failed to update rule', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      open: true,
      title: 'Delete Automation Rule',
      message: 'Are you sure you want to delete this automation rule? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.delete(`/admin/automation-rules/${id}`);
          showAlert('Automation rule deleted');
          loadRules();
        } catch {
          showAlert('Failed to delete rule', 'error');
        }
      }
    });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/automation-rules', {
        name: form.name,
        trigger: form.trigger,
        condition: form.condition,
        action: form.action,
        action_value: form.actionValue,
        enabled: true
      });
      showAlert('Automation rule created');
      setIsAdding(false);
      setForm({ name: '', trigger: 'ticket_created', condition: '', action: 'change_status', actionValue: '' });
      loadRules();
    } catch {
      showAlert('Failed to create rule', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>Automation Rules</h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Automatically route, escalate, and manage tickets based on conditions.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAdding(true)}><Plus size={14} /> Add Rule</button>
      </div>

      {isAdding && (
        <div className="card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-border)' }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Rule Name *</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Auto-escalate critical" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Trigger</label>
                <select className="select" value={form.trigger} onChange={e => setForm({ ...form, trigger: e.target.value })}>
                  {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Condition</label>
                <input className="input" value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })} placeholder="e.g. priority = critical" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Action</label>
                <select className="select" value={form.action} onChange={e => setForm({ ...form, action: e.target.value })}>
                  {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Action Value</label>
                <input className="input" value={form.actionValue} onChange={e => setForm({ ...form, actionValue: e.target.value })} placeholder="e.g. closed, critical, admin@..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setIsAdding(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create Rule</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden', position: 'relative', minHeight: '100px' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
            <RotateCcw className="spin" size={24} />
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Rule</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Trigger</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Condition</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Action</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map(rule => (
              <tr key={rule.id} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: rule.enabled ? 1 : 0.6 }}>
                <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>{rule.name}</td>
                <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)' }}>
                    {TRIGGERS.find(t => t.value === rule.trigger)?.label || rule.trigger}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{rule.condition || '—'}</td>
                <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {ACTIONS.find(a => a.value === rule.action)?.label}: <strong>{rule.actionValue}</strong>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button
                    onClick={() => handleToggle(rule.id)}
                    style={{
                      background: rule.enabled ? 'var(--success-bg)' : 'var(--bg-tertiary)',
                      color: rule.enabled ? 'var(--success)' : 'var(--text-muted)',
                      border: `1px solid ${rule.enabled ? 'var(--success-border)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-full)', padding: '3px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    {rule.enabled ? 'Active' : 'Disabled'}
                  </button>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <button className="btn btn-ghost" style={{ padding: '4px', color: 'var(--danger)' }} onClick={() => handleDelete(rule.id)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {!loading && rules.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No automation rules configured</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
