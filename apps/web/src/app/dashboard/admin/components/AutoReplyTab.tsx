'use client';

import { useEffect, useState } from 'react';
import {
  Reply, Plus, Save, ChevronDown, ChevronRight,
  Edit2, Trash2, X, CheckCircle
} from 'lucide-react';
import { api } from '@/lib/api';

interface AutoReplyCondition {
  ticket_types: string[];
  priorities: string[];
  category_id: string;
  keyword: string;
}

interface AutoReplyRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: AutoReplyCondition;
  reply_subject: string;
  reply_body: string;
  send_to_requester: boolean;
  send_to_assignee: boolean;
}

interface Category {
  id: string;
  name: string;
}

const TICKET_TYPES = ['incident', 'service_request', 'problem', 'change'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

const PRIORITY_COLORS: Record<string, string> = {
  low: '#6b7280',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

const defaultFormData = {
  name: '',
  description: '',
  ticket_types: [] as string[],
  priorities: [] as string[],
  category_id: '',
  keyword: '',
  reply_subject: 'Re: Ticket #[TICKET_ID]',
  reply_body: '',
  send_to_requester: true,
  send_to_assignee: false,
};

export function AutoReplyTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ ...defaultFormData });

  const fetchRules = async () => {
    try {
      const res = await api.get<{ data: AutoReplyRule[] }>('/admin/auto-replies');
      setRules(res.data || []);
    } catch {
      showAlert('Failed to load auto-reply rules', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get<{ data: Category[] }>('/categories');
      setCategories(res.data || []);
    } catch {
      // non-critical
    }
  };

  useEffect(() => {
    Promise.all([fetchRules(), fetchCategories()]);
  }, []);

  const resetForm = () => {
    setForm({ ...defaultFormData });
    setEditingId(null);
    setShowForm(false);
  };

  const openEditForm = (rule: AutoReplyRule) => {
    setForm({
      name: rule.name,
      description: rule.description,
      ticket_types: [...rule.conditions.ticket_types],
      priorities: [...rule.conditions.priorities],
      category_id: rule.conditions.category_id || '',
      keyword: rule.conditions.keyword || '',
      reply_subject: rule.reply_subject,
      reply_body: rule.reply_body,
      send_to_requester: rule.send_to_requester,
      send_to_assignee: rule.send_to_assignee,
    });
    setEditingId(rule.id);
    setShowForm(true);
  };

  const toggleArray = (arr: string[], val: string): string[] => {
    if (arr.includes(val)) return arr.filter(v => v !== val);
    return [...arr, val];
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showAlert('Name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        description: form.description,
        conditions: {
          ticket_types: form.ticket_types,
          priorities: form.priorities,
          category_id: form.category_id || null,
          keyword: form.keyword || null,
        },
        reply_subject: form.reply_subject,
        reply_body: form.reply_body,
        send_to_requester: form.send_to_requester,
        send_to_assignee: form.send_to_assignee,
      };

      if (editingId) {
        await api.patch(`/admin/auto-replies/${editingId}`, body);
        showAlert('Auto-reply rule updated');
      } else {
        await api.post('/admin/auto-replies', body);
        showAlert('Auto-reply rule created');
      }
      resetForm();
      await fetchRules();
    } catch {
      showAlert('Failed to save auto-reply rule', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: AutoReplyRule) => {
    try {
      await api.patch(`/admin/auto-replies/${rule.id}/toggle`, {});
      setRules(prev =>
        prev.map(r => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
      );
      showAlert(`${rule.name} ${rule.enabled ? 'disabled' : 'enabled'}`);
    } catch {
      showAlert('Failed to toggle auto-reply rule', 'error');
    }
  };

  const handleDelete = async (rule: AutoReplyRule) => {
    try {
      await api.delete(`/admin/auto-replies/${rule.id}`);
      setRules(prev => prev.filter(r => r.id !== rule.id));
      if (expandedId === rule.id) setExpandedId(null);
      showAlert(`"${rule.name}" deleted`);
    } catch {
      showAlert('Failed to delete auto-reply rule', 'error');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const toggleStyle: React.CSSProperties = {
    width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', flexShrink: 0,
    position: 'relative', transition: 'background 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4,
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Auto Reply Rules</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Automatically reply to tickets that match defined conditions
          </div>
        </div>
        {!showForm && (
          <button
            className="btn btn-primary"
            onClick={() => { resetForm(); setShowForm(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <Plus size={14} />
            Add Rule
          </button>
        )}
      </div>

      {/* Variables Reference */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Available Variables</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['TICKET_ID', 'TICKET_TITLE', 'USER_NAME', 'AGENT_NAME', 'TICKET_URL', 'PRIORITY', 'STATUS'].map(v => (
            <code key={v} style={{
              padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
              color: 'var(--accent)',
            }}>
              [{v}]
            </code>
          ))}
        </div>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 'var(--radius-md)',
              background: 'var(--accent-subtle)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {editingId ? <Edit2 size={14} color="var(--accent)" /> : <Plus size={14} color="var(--accent)" />}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>
              {editingId ? 'Edit Rule' : 'New Rule'}
            </div>
            <button
              onClick={resetForm}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Name & Description */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input
                  style={inputStyle}
                  type="text"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Password Reset Reply"
                />
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <input
                  style={inputStyle}
                  type="text"
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this rule"
                />
              </div>
            </div>

            {/* Conditions Section */}
            <div style={{
              padding: 16, borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Conditions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Ticket Types */}
                <div>
                  <label style={{ ...labelStyle, marginBottom: 6 }}>Ticket Types</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {TICKET_TYPES.map(t => (
                      <label
                        key={t}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '5px 10px', borderRadius: 'var(--radius-md)',
                          border: `1px solid ${form.ticket_types.includes(t) ? 'var(--accent)' : 'var(--border)'}`,
                          background: form.ticket_types.includes(t) ? 'var(--accent-subtle)' : 'var(--bg)',
                          cursor: 'pointer', fontSize: 12,
                          color: form.ticket_types.includes(t) ? 'var(--accent)' : 'var(--text-secondary)',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={form.ticket_types.includes(t)}
                          onChange={() => setForm(prev => ({
                            ...prev,
                            ticket_types: toggleArray(prev.ticket_types, t),
                          }))}
                          style={{ display: 'none' }}
                        />
                        {form.ticket_types.includes(t) ? (
                          <CheckCircle size={12} />
                        ) : (
                          <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--border)' }} />
                        )}
                        {t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Priorities */}
                <div>
                  <label style={{ ...labelStyle, marginBottom: 6 }}>Priorities</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {PRIORITIES.map(p => (
                      <label
                        key={p}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '5px 10px', borderRadius: 'var(--radius-md)',
                          border: `1px solid ${form.priorities.includes(p) ? PRIORITY_COLORS[p] : 'var(--border)'}`,
                          background: form.priorities.includes(p)
                            ? `${PRIORITY_COLORS[p]}18`
                            : 'var(--bg)',
                          cursor: 'pointer', fontSize: 12,
                          color: form.priorities.includes(p) ? PRIORITY_COLORS[p] : 'var(--text-secondary)',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={form.priorities.includes(p)}
                          onChange={() => setForm(prev => ({
                            ...prev,
                            priorities: toggleArray(prev.priorities, p),
                          }))}
                          style={{ display: 'none' }}
                        />
                        {form.priorities.includes(p) ? (
                          <CheckCircle size={12} />
                        ) : (
                          <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--border)' }} />
                        )}
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Category + Keyword */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Category</label>
                    <select
                      style={inputStyle}
                      value={form.category_id}
                      onChange={e => setForm(prev => ({ ...prev, category_id: e.target.value }))}
                    >
                      <option value="">Any Category</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Keyword</label>
                    <input
                      style={inputStyle}
                      type="text"
                      value={form.keyword}
                      onChange={e => setForm(prev => ({ ...prev, keyword: e.target.value }))}
                      placeholder="Match in title/description"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Reply Content */}
            <div style={{
              padding: 16, borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Reply Content</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Reply Subject</label>
                  <input
                    style={inputStyle}
                    type="text"
                    value={form.reply_subject}
                    onChange={e => setForm(prev => ({ ...prev, reply_subject: e.target.value }))}
                    placeholder="Re: Ticket #[TICKET_ID]"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Reply Body</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: 140, resize: 'vertical', fontFamily: 'inherit' }}
                    value={form.reply_body}
                    onChange={e => setForm(prev => ({ ...prev, reply_body: e.target.value }))}
                    placeholder={`Hi [USER_NAME],\n\nThank you for contacting us regarding ticket #[TICKET_ID].\n\nWe are looking into this and will get back to you shortly.\n\nBest regards,\n[AGENT_NAME]`}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Use [TICKET_ID], [TICKET_TITLE], [USER_NAME], [AGENT_NAME], [TICKET_URL], [PRIORITY], [STATUS] as placeholders
                  </div>
                </div>
              </div>
            </div>

            {/* Send Options */}
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 'var(--radius-md)',
                border: `1px solid ${form.send_to_requester ? 'var(--accent)' : 'var(--border)'}`,
                background: form.send_to_requester ? 'var(--accent-subtle)' : 'var(--bg)',
                cursor: 'pointer', fontSize: 13, userSelect: 'none',
              }}>
                <input
                  type="checkbox"
                  checked={form.send_to_requester}
                  onChange={e => setForm(prev => ({ ...prev, send_to_requester: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                />
                Send to Requester
              </label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 'var(--radius-md)',
                border: `1px solid ${form.send_to_assignee ? 'var(--accent)' : 'var(--border)'}`,
                background: form.send_to_assignee ? 'var(--accent-subtle)' : 'var(--bg)',
                cursor: 'pointer', fontSize: 13, userSelect: 'none',
              }}>
                <input
                  type="checkbox"
                  checked={form.send_to_assignee}
                  onChange={e => setForm(prev => ({ ...prev, send_to_assignee: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                />
                Send to Assignee
              </label>
            </div>

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              >
                <Save size={14} />
                {saving ? 'Saving...' : editingId ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 && !showForm ? (
        <div style={{
          padding: 40, textAlign: 'center', color: 'var(--text-muted)',
          fontSize: 13,
        }}>
          No auto-reply rules configured yet. Click "Add Rule" to create one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rules.map(rule => {
            const isExpanded = expandedId === rule.id;
            const isEditing = editingId === rule.id && showForm;
            return (
              <div
                key={rule.id}
                className="card"
                style={{
                  padding: '14px 16px',
                  border: `1px solid ${rule.enabled ? 'var(--border)' : 'var(--border-subtle)'}`,
                  opacity: rule.enabled ? 1 : 0.6,
                }}
              >
                {/* Collapsed Row */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : rule.id)}
                >
                  {/* Expand icon */}
                  <div style={{ color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>

                  {/* Enabled toggle */}
                  <button
                    onClick={e => { e.stopPropagation(); handleToggle(rule); }}
                    style={{
                      ...toggleStyle,
                      background: rule.enabled ? 'var(--accent)' : 'var(--bg-tertiary)',
                    }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', background: 'var(--text-inverse)',
                      position: 'absolute', top: 3,
                      left: rule.enabled ? 25 : 3,
                      transition: 'left 0.2s ease',
                    }} />
                  </button>

                  {/* Name & description */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{rule.name}</div>
                    {rule.description && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rule.description}
                      </div>
                    )}
                  </div>

                  {/* Conditions summary badges */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {rule.conditions.ticket_types.length > 0 && rule.conditions.ticket_types.length < 4 && (
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                      }}>
                        {rule.conditions.ticket_types.map(t => t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())).join(', ')}
                      </span>
                    )}
                    {rule.conditions.priorities.length > 0 && (
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                      }}>
                        {rule.conditions.priorities.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={e => { e.stopPropagation(); openEditForm(rule); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 4, color: 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', borderRadius: 'var(--radius-sm)',
                      }}
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(rule); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 4, color: 'var(--danger)',
                        display: 'flex', alignItems: 'center', borderRadius: 'var(--radius-sm)',
                      }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && !isEditing && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                    {/* Conditions */}
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Conditions</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      {rule.conditions.ticket_types.map(t => (
                        <span key={t} style={{
                          padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11,
                          background: 'var(--accent-subtle)', color: 'var(--accent)',
                          border: '1px solid var(--accent)',
                        }}>
                          Type: {t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      ))}
                      {rule.conditions.priorities.map(p => (
                        <span key={p} style={{
                          padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11,
                          background: `${PRIORITY_COLORS[p]}18`, color: PRIORITY_COLORS[p],
                          border: `1px solid ${PRIORITY_COLORS[p]}`,
                        }}>
                          Priority: {p.charAt(0).toUpperCase() + p.slice(1)}
                        </span>
                      ))}
                      {rule.conditions.category_id && (
                        <span style={{
                          padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11,
                          background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                        }}>
                          Category: {categories.find(c => c.id === rule.conditions.category_id)?.name || rule.conditions.category_id}
                        </span>
                      )}
                      {rule.conditions.keyword && (
                        <span style={{
                          padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11,
                          background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                        }}>
                          Keyword: "{rule.conditions.keyword}"
                        </span>
                      )}
                      {rule.conditions.ticket_types.length === 0 && rule.conditions.priorities.length === 0 && !rule.conditions.category_id && !rule.conditions.keyword && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Applies to all tickets</span>
                      )}
                    </div>

                    {/* Reply Subject */}
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Reply Subject</div>
                    <div style={{
                      fontSize: 12, color: 'var(--text)', marginBottom: 12,
                      padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-tertiary)', fontFamily: 'monospace',
                    }}>
                      {rule.reply_subject}
                    </div>

                    {/* Reply Body Preview */}
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Reply Body</div>
                    <div style={{
                      fontSize: 12, color: 'var(--text)', marginBottom: 12,
                      padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-tertiary)',
                      whiteSpace: 'pre-wrap', fontFamily: 'monospace',
                      maxHeight: 120, overflowY: 'auto',
                    }}>
                      {rule.reply_body || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No body content</span>}
                    </div>

                    {/* Delivery Options */}
                    <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <span style={{
                        padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)',
                      }}>
                        {rule.send_to_requester ? 'Send to Requester' : 'No requester notification'}
                      </span>
                      <span style={{
                        padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)',
                      }}>
                        {rule.send_to_assignee ? 'Send to Assignee' : 'No assignee notification'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
