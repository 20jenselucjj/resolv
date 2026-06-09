'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, RotateCcw, Zap, Edit3, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import type { AutomationRule } from './types';

export function AutomationTab({ showAlert, setConfirmModal }: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (modal: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
}) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', trigger: 'ticket_created', condition: '', action: 'change_status', actionValue: '' });
  const [conditionField, setConditionField] = useState('');
  const [conditionOp, setConditionOp] = useState('=');
  const [conditionValue, setConditionValue] = useState('');

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: AutomationRule[] }>('/admin/automation-rules');
      setRules(res.data.map(r => ({ ...r, actionValue: r.action_value })));
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to load automation rules', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    const timer = setTimeout(() => loadRules(), 0);
    return () => clearTimeout(timer);
  }, [loadRules]);

  const TRIGGERS = [
    { value: 'ticket_created', label: 'Ticket Created' },
    { value: 'ticket_updated', label: 'Ticket Updated' },
    { value: 'ticket_resolved', label: 'Ticket Resolved' },
    { value: 'sla_breach', label: 'SLA Breach' },
    { value: 'comment_added', label: 'Comment Added' },
    { value: 'ticket_overdue', label: 'Ticket Overdue' },
  ];

  const ACTIONS = [
    { value: 'change_status', label: 'Change Status' },
    { value: 'change_priority', label: 'Change Priority' },
    { value: 'assign_to_group', label: 'Assign to Group' },
    { value: 'send_notification', label: 'Send Notification' },
    { value: 'add_tag', label: 'Add Tag' },
    { value: 'send_email', label: 'Send Email' },
    { value: 'add_internal_note', label: 'Add Internal Note' },
  ];

  const handleToggle = async (id: string) => {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;
    try {
      await api.patch(`/admin/automation-rules/${id}`, { enabled: !rule.enabled });
      showAlert('Automation rule updated');
      loadRules();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to update rule', 'error');
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
        } catch (err: any) {
          showAlert(err?.serverError || err?.message || 'Failed to delete rule', 'error');
        }
      }
    });
  };

  const resetForm = () => {
    setForm({ name: '', trigger: 'ticket_created', condition: '', action: 'change_status', actionValue: '' });
    setConditionField('');
    setConditionOp('=');
    setConditionValue('');
    setEditingId(null);
    setIsAdding(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name,
        trigger: form.trigger,
        condition: [conditionField, conditionOp, conditionValue].filter(Boolean).join(' '),
        action: form.action,
        action_value: form.actionValue,
        enabled: true,
      };
      if (editingId) {
        await api.patch(`/admin/automation-rules/${editingId}`, payload);
        showAlert('Automation rule updated');
      } else {
        await api.post('/admin/automation-rules', payload);
        showAlert('Automation rule created');
      }
      resetForm();
      loadRules();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || (editingId ? 'Failed to update rule' : 'Failed to create rule'), 'error');
    }
  };

  const handleEdit = (rule: AutomationRule) => {
    setEditingId(rule.id);
    const parts = (rule.condition || '').split(' ');
    setConditionField(parts[0] || '');
    setConditionOp(parts[1] || '=');
    setConditionValue(parts.slice(2).join(' ') || '');
    setForm({ name: rule.name, trigger: rule.trigger, condition: rule.condition || '', action: rule.action, actionValue: rule.actionValue || rule.action_value || '' });
    setIsAdding(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Deprecation notice */}
      <div style={{
        padding: '12px 16px', borderRadius: 'var(--radius-lg)',
        background: '#fef3c7', border: '1px solid #f59e0b',
        display: 'flex', gap: '10px', alignItems: 'flex-start',
      }}>
        <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#92400e' }}>Deprecated: Use Visual Workflows Instead</span>
          <p style={{ fontSize: '12px', color: '#78350f', margin: '4px 0 0', lineHeight: 1.5 }}>
            These legacy automation rules are no longer wired to runtime execution. The <strong>Workflow Designer</strong> tab provides a more powerful visual workflow builder with richer triggers, conditions, and step types. Existing rules are shown here for reference only.
          </p>
        </div>
      </div>

      {/* Description card */}
      <div style={{
        padding: '16px 20px', borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={18} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>How Automation Rules Work</span>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          Automation rules let you define <strong>trigger → condition → action</strong> workflows that run automatically.
          When a trigger event occurs (e.g. a ticket is created or an SLA is breached), the rule checks its conditions
          and executes the specified action. For example: <em>"When a critical ticket is created, automatically assign it to the senior agent group."</em>
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
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
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Condition</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <select className="select" value={conditionField} onChange={e => setConditionField(e.target.value)} style={{ flex: 1 }}>
                      <option value="">Field...</option>
                      <option value="priority">Priority</option>
                      <option value="status">Status</option>
                      <option value="ticket_type">Type</option>
                      <option value="category">Category</option>
                      <option value="assigned_to">Assigned To</option>
                    </select>
                    <select className="select" value={conditionOp} onChange={e => setConditionOp(e.target.value)} style={{ width: 90 }}>
                      <option value="=">=</option>
                      <option value="!=">!=</option>
                      <option value="contains">contains</option>
                      <option value="starts_with">starts with</option>
                    </select>
                    <input className="input" value={conditionValue} onChange={e => setConditionValue(e.target.value)} placeholder="value" style={{ flex: 1 }} />
                  </div>
                </div>
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
              <button type="button" className="btn btn-ghost" onClick={resetForm}>Cancel</button>
              <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Create Rule'}</button>
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
                <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {rule.condition ? (() => {
                    const parts = rule.condition.split(' ');
                    return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{parts[0]}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{parts[1]}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{parts.slice(2).join(' ')}</span>
                      </span>
                    );
                  })() : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </td>
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
                  <button className="btn btn-ghost" style={{ padding: '4px', color: 'var(--accent)' }} onClick={() => handleEdit(rule)}><Edit3 size={14} /></button>
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
