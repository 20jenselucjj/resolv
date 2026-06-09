'use client';

import { useState } from 'react';
import { Plus, Edit2, Save, X, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import type { AutoReplyRule, FlatEmailTemplate, Category } from './types';
import {
  TICKET_TYPES, PRIORITIES, PRIORITY_COLORS,
  STATUSES, STATUS_LABELS, STATUS_COLORS,
  EVENTS, defaultFormData,
  inputStyle, labelStyle,
} from './types';

interface AutoReplyFormProps {
  showAlert: (m: string, t?: 'success' | 'error') => void;
  onSaved: () => void;
  onCancel: () => void;
  editingRule: AutoReplyRule | null;
  categories: Category[];
  templates: FlatEmailTemplate[];
}

export function AutoReplyForm({ showAlert, onSaved, onCancel, editingRule, categories, templates }: AutoReplyFormProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => {
    if (editingRule) {
      return {
        name: editingRule.name,
        description: editingRule.description,
        ticket_types: [...(editingRule.conditions.ticket_types || [])],
        priorities: [...(editingRule.conditions.priorities || [])],
        statuses: [...((editingRule.conditions.statuses || []))],
        category_id: editingRule.conditions.category_id || '',
        keyword: editingRule.conditions.keyword || '',
        template_id: editingRule.template_id || '',
        event: editingRule.event || 'any',
        reply_subject: editingRule.reply_subject,
        reply_body: editingRule.reply_body,
        send_to_requester: editingRule.send_to_requester,
        send_to_assignee: editingRule.send_to_assignee,
      };
    }
    return { ...defaultFormData };
  });

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
      const body: Record<string, unknown> = {
        name: form.name,
        description: form.description,
        event: form.event,
        conditions: {
          ticket_types: form.ticket_types,
          priorities: form.priorities,
          statuses: form.statuses,
          category_id: form.category_id || null,
          keyword: form.keyword || null,
        },
        template_id: form.template_id || '',
        reply_subject: form.template_id ? '' : form.reply_subject,
        reply_body: form.template_id ? '' : form.reply_body,
        send_to_requester: form.send_to_requester,
        send_to_assignee: form.send_to_assignee,
      };

      if (editingRule) {
        await api.patch(`/admin/auto-replies/${editingRule.id}`, body);
        showAlert('Auto-reply rule updated');
      } else {
        await api.post('/admin/auto-replies', body);
        showAlert('Auto-reply rule created');
      }
      onSaved();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to save auto-reply rule', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 'var(--radius-md)',
          background: 'var(--accent-subtle)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          {editingRule ? <Edit2 size={14} color="var(--accent)" /> : <Plus size={14} color="var(--accent)" />}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>
          {editingRule ? 'Edit Rule' : 'New Rule'}
        </div>
        <button
          onClick={onCancel}
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
            <input style={inputStyle} type="text" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Password Reset Reply" />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <input style={inputStyle} type="text" value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Brief description of this rule" />
          </div>
        </div>

        {/* Trigger Section */}
        <div style={{ padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderLeft: '3px solid var(--accent)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Trigger</div>
          <div>
            <label style={labelStyle}>Event</label>
            <select style={inputStyle} value={form.event}
              onChange={e => setForm(p => ({ ...p, event: e.target.value }))}>
              {EVENTS.map(ev => <option key={ev.value} value={ev.value}>{ev.label}</option>)}
            </select>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Send email when this event occurs and conditions match
            </div>
          </div>
        </div>

        {/* Conditions Section */}
        <div style={{ padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Conditions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Ticket Types */}
            <div>
              <label style={{ ...labelStyle, marginBottom: 6 }}>Ticket Types</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TICKET_TYPES.map(t => (
                  <label key={t} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', borderRadius: 'var(--radius-md)',
                    border: `1px solid ${form.ticket_types.includes(t) ? 'var(--accent)' : 'var(--border)'}`,
                    background: form.ticket_types.includes(t) ? 'var(--accent-subtle)' : 'var(--bg)',
                    cursor: 'pointer', fontSize: 12,
                    color: form.ticket_types.includes(t) ? 'var(--accent)' : 'var(--text-secondary)',
                    userSelect: 'none',
                  }}>
                    <input type="checkbox" checked={form.ticket_types.includes(t)}
                      onChange={() => setForm(p => ({ ...p, ticket_types: toggleArray(p.ticket_types, t) }))}
                      style={{ display: 'none' }} />
                    {form.ticket_types.includes(t) ? <CheckCircle size={12} /> : <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--border)' }} />}
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
                  <label key={p} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', borderRadius: 'var(--radius-md)',
                    border: `1px solid ${form.priorities.includes(p) ? PRIORITY_COLORS[p] : 'var(--border)'}`,
                    background: form.priorities.includes(p) ? `${PRIORITY_COLORS[p]}18` : 'var(--bg)',
                    cursor: 'pointer', fontSize: 12,
                    color: form.priorities.includes(p) ? PRIORITY_COLORS[p] : 'var(--text-secondary)',
                    userSelect: 'none',
                  }}>
                    <input type="checkbox" checked={form.priorities.includes(p)}
                      onChange={() => setForm(f => ({ ...f, priorities: toggleArray(f.priorities, p) }))}
                      style={{ display: 'none' }} />
                    {form.priorities.includes(p) ? <CheckCircle size={12} /> : <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--border)' }} />}
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            {/* Statuses */}
            <div>
              <label style={{ ...labelStyle, marginBottom: 6 }}>Statuses</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {STATUSES.map(s => (
                  <label key={s} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', borderRadius: 'var(--radius-md)',
                    border: `1px solid ${form.statuses.includes(s) ? STATUS_COLORS[s] : 'var(--border)'}`,
                    background: form.statuses.includes(s) ? `${STATUS_COLORS[s]}18` : 'var(--bg)',
                    cursor: 'pointer', fontSize: 12,
                    color: form.statuses.includes(s) ? STATUS_COLORS[s] : 'var(--text-secondary)',
                    userSelect: 'none',
                  }}>
                    <input type="checkbox" checked={form.statuses.includes(s)}
                      onChange={() => setForm(p => ({ ...p, statuses: toggleArray(p.statuses, s) }))}
                      style={{ display: 'none' }} />
                    {form.statuses.includes(s) ? <CheckCircle size={12} /> : <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--border)' }} />}
                    {STATUS_LABELS[s]}
                  </label>
                ))}
              </div>
            </div>

            {/* Category + Keyword */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Category</label>
                <select style={inputStyle} value={form.category_id}
                  onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}>
                  <option value="">Any Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Keyword</label>
                <input style={inputStyle} type="text" value={form.keyword}
                  onChange={e => setForm(p => ({ ...p, keyword: e.target.value }))}
                  placeholder="Match in title/description" />
              </div>
            </div>
          </div>
        </div>

        {/* Email Template */}
        <div style={{ padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Email Template</div>
          <div>
            <label style={labelStyle}>Template</label>
            <select style={inputStyle} value={form.template_id}
              onChange={e => setForm(p => ({ ...p, template_id: e.target.value }))}>
              <option value="">Use custom subject/body below</option>
              {templates.slice().sort((a, b) => (a.is_default === b.is_default ? 0 : a.is_default ? -1 : 1)).map(t => (
                <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (Default)' : ''}</option>
              ))}
            </select>
            {form.template_id && (() => {
              const sel = templates.find(t => t.id === form.template_id);
              return sel ? (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 'var(--radius-sm)', background: 'var(--bg)', border: '1px solid var(--border-subtle)', fontSize: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Template Preview</div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>
                    <span style={{ fontWeight: 600 }}>Subject:</span> {sel.subject}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', maxHeight: 80, overflowY: 'auto' }}>
                    <span style={{ fontWeight: 600 }}>Body:</span> {sel.body || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>(empty)</span>}
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        </div>

        {/* Reply Content */}
        <div style={{
          padding: 16, borderRadius: 'var(--radius-md)',
          background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
          opacity: form.template_id ? 0.5 : 1,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
            Reply Content {form.template_id && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>(using template — inline content ignored)</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Reply Subject</label>
              <input style={inputStyle} type="text" value={form.reply_subject}
                onChange={e => setForm(p => ({ ...p, reply_subject: e.target.value }))}
                placeholder="Re: Ticket #[TICKET_ID]" disabled={!!form.template_id} />
            </div>
            <div>
              <label style={labelStyle}>Reply Body</label>
              <textarea style={{ ...inputStyle, minHeight: 140, resize: 'vertical', fontFamily: 'inherit' }}
                value={form.reply_body}
                onChange={e => setForm(p => ({ ...p, reply_body: e.target.value }))}
                placeholder={`Hi [USER_NAME],\n\nThank you for contacting us regarding ticket #[TICKET_ID].\n\nWe are looking into this and will get back to you shortly.\n\nBest regards,\n[AGENT_NAME]`}
                disabled={!!form.template_id} />
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
            <input type="checkbox" checked={form.send_to_requester}
              onChange={e => setForm(p => ({ ...p, send_to_requester: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
            Send to Requester
          </label>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 'var(--radius-md)',
            border: `1px solid ${form.send_to_assignee ? 'var(--accent)' : 'var(--border)'}`,
            background: form.send_to_assignee ? 'var(--accent-subtle)' : 'var(--bg)',
            cursor: 'pointer', fontSize: 13, userSelect: 'none',
          }}>
            <input type="checkbox" checked={form.send_to_assignee}
              onChange={e => setForm(p => ({ ...p, send_to_assignee: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
            Send to Assignee
          </label>
        </div>

        {/* Save Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Save size={14} />
            {saving ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}
