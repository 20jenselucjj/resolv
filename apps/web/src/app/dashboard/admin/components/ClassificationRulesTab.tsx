'use client';

import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, X, RefreshCw, AlertTriangle, Settings } from 'lucide-react';
import { api } from '@/lib/api';
import { ConfirmModal } from './SharedUI';
import { ToggleSwitch } from './ToggleSwitch';

interface ClassificationRule {
  id: string;
  name: string;
  match_type: 'any' | 'all';
  keywords: string[];
  ticket_type: 'incident' | 'service_request' | 'problem' | 'change';
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const TICKET_TYPE_LABELS: Record<string, string> = {
  incident: 'Incident',
  service_request: 'Service Request',
  problem: 'Problem',
  change: 'Change',
};

const TICKET_TYPE_COLORS: Record<string, string> = {
  incident: '#ef4444',
  service_request: '#3b82f6',
  problem: '#f59e0b',
  change: '#7c3aed',
};

const defaultForm: {
  name: string;
  match_type: 'any' | 'all';
  keywords: string;
  ticket_type: 'incident' | 'service_request' | 'problem' | 'change';
  priority: number;
  is_active: boolean;
} = {
  name: '',
  match_type: 'any',
  keywords: '',
  ticket_type: 'incident',
  priority: 0,
  is_active: true,
};

export function ClassificationRulesTab({ showAlert }: { showAlert: (msg: string, type?: 'success' | 'error') => void }) {
  const [rules, setRules] = useState<ClassificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: ClassificationRule[] }>('/admin/classification-rules');
      setRules(res.data || []);
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to load classification rules', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadRules(), 0);
    return () => clearTimeout(timer);
  }, []);

  const handleSave = async () => {
    if (!form.name.trim() || !form.keywords.trim()) {
      showAlert('Name and keywords are required', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        match_type: form.match_type,
        keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean),
        ticket_type: form.ticket_type,
        priority: form.priority,
        is_active: form.is_active,
      };

      if (editingId) {
        await api.patch(`/admin/classification-rules/${editingId}`, payload);
        showAlert('Rule updated successfully');
      } else {
        await api.post('/admin/classification-rules', payload);
        showAlert('Rule created successfully');
      }

      setShowForm(false);
      setEditingId(null);
      setForm(defaultForm);
      await loadRules();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to save rule', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (rule: ClassificationRule) => {
    setForm({
      name: rule.name,
      match_type: rule.match_type,
      keywords: (rule.keywords || []).join(', '),
      ticket_type: rule.ticket_type,
      priority: rule.priority,
      is_active: rule.is_active,
    });
    setEditingId(rule.id);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/admin/classification-rules/${deleteConfirm.id}`);
      showAlert('Rule deleted');
      setDeleteConfirm(null);
      await loadRules();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to delete rule', 'error');
    }
  };

  const handleToggleActive = async (rule: ClassificationRule) => {
    try {
      await api.patch(`/admin/classification-rules/${rule.id}`, { is_active: !rule.is_active });
      await loadRules();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to toggle rule', 'error');
    }
  };

  const openCreateForm = () => {
    setForm(defaultForm);
    setEditingId(null);
    setShowForm(true);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Ticket Classification Rules</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Define keyword-based rules to automatically determine if a ticket should be an incident, service request, problem, or change.
            These rules are used by both the AI assistant and as a deterministic pre-check when creating tickets.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreateForm} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', fontSize: '13px', fontWeight: 600 }}>
          <Plus size={15} /> Add Rule
        </button>
      </div>

      {/* Info Box */}
      <div style={{ padding: '14px 18px', background: 'var(--info-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--info-border)', display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '20px' }}>
        <Settings size={16} color="var(--info)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '12px', color: 'var(--text)', lineHeight: '1.6' }}>
          <strong>How it works:</strong> When a user reports an issue, the system checks their message against these rules (in priority order).
          If keywords match, the ticket type is pre-determined. The AI also sees these rules as guidelines. Rules with higher priority numbers are checked first.
        </div>
      </div>

      {/* Rules Table */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '14px' }}>Loading rules...</div>
        </div>
      ) : rules.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)' }}>
          <AlertTriangle size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px', opacity: 0.4 }} />
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>No classification rules yet</div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>Add rules to help the system automatically determine ticket types based on keywords.</p>
          <button className="btn btn-primary" onClick={openCreateForm} style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', fontSize: '13px' }}>
            <Plus size={15} /> Create your first rule
          </button>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Match</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Keywords</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Maps To</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Priority</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, i) => (
                <tr key={rule.id} style={{ borderBottom: i < rules.length - 1 ? '1px solid var(--border-subtle)' : 'none', background: rule.is_active ? 'transparent' : 'var(--bg-secondary)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <ToggleSwitch
                      enabled={rule.is_active}
                      onChange={() => handleToggleActive(rule)}
                      small
                    />
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: rule.is_active ? 'var(--text)' : 'var(--text-muted)' }}>
                    {rule.name}
                    {!rule.is_active && <span style={{ marginLeft: '8px', fontSize: '10px', padding: '2px 6px', borderRadius: 'var(--radius-full)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>disabled</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      {rule.match_type === 'all' ? 'ALL' : 'ANY'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: '280px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {(rule.keywords || []).slice(0, 6).map(kw => (
                        <span key={kw} style={{ fontSize: '11px', padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                          {kw}
                        </span>
                      ))}
                      {(rule.keywords || []).length > 6 && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>+{rule.keywords.length - 6} more</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: `${TICKET_TYPE_COLORS[rule.ticket_type]}15`, color: TICKET_TYPE_COLORS[rule.ticket_type], border: `1px solid ${TICKET_TYPE_COLORS[rule.ticket_type]}30` }}>
                      {TICKET_TYPE_LABELS[rule.ticket_type]}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>
                    {rule.priority}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                      <button onClick={() => handleEdit(rule)} style={{ padding: '6px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 500 }}>Edit</button>
                      <button onClick={() => setDeleteConfirm({ id: rule.id, name: rule.name })} style={{ padding: '6px 10px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--danger)', fontSize: '11px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '560px', boxShadow: '0 25px 50px rgba(0,0,0,0.15)', border: '1px solid var(--border)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                {editingId ? 'Edit Classification Rule' : 'Add Classification Rule'}
              </h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Rule Name <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Broken / Not Working" style={{ fontSize: '13px' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Match Type
                  </label>
                  <select className="select" value={form.match_type} onChange={e => setForm(f => ({ ...f, match_type: e.target.value as 'any' | 'all' }))} style={{ fontSize: '12px' }}>
                    <option value="any">ANY keyword matches</option>
                    <option value="all">ALL keywords must match</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Maps To <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <select className="select" value={form.ticket_type} onChange={e => setForm(f => ({ ...f, ticket_type: e.target.value as any }))} style={{ fontSize: '12px' }}>
                    <option value="incident">Incident</option>
                    <option value="service_request">Service Request</option>
                    <option value="problem">Problem</option>
                    <option value="change">Change</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Keywords <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input className="input" value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} placeholder="broken, not working, error, crash (comma-separated)" style={{ fontSize: '13px' }} />
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0' }}>Comma-separated keywords or phrases. Matched against the user's message (case-insensitive).</p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Priority (higher = checked first)
                </label>
                <input className="input" type="number" min={0} max={9999} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} style={{ fontSize: '13px', width: '120px' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ cursor: 'pointer' }} />
                <label htmlFor="is_active" style={{ fontSize: '13px', color: 'var(--text)', cursor: 'pointer' }}>Rule is active</label>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-ghost" onClick={() => { setShowForm(false); setEditingId(null); }} style={{ padding: '10px 20px', fontSize: '13px' }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 24px', fontSize: '13px', fontWeight: 600 }}>
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                {editingId ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ConfirmModal
          open={true}
          title="Delete Classification Rule"
          message={`Are you sure you want to delete "${deleteConfirm.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
