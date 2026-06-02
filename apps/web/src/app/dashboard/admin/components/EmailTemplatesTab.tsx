'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash, Mail, ChevronDown, ChevronUp, Copy, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { Modal } from './SharedUI';
import type { EmailTemplate } from './types';

export function EmailTemplatesTab({ showAlert, setConfirmModal }: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (modal: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
}) {
  const DEFAULT_TEMPLATES: EmailTemplate[] = [
    { id: '1', name: 'Ticket Created', subject: 'Your ticket #[TICKET_ID] has been created', body: 'Hello [USER_NAME],\n\nWe have received your request. Our team will review it shortly.\n\nBest,\nSupport Team' },
    { id: '2', name: 'Ticket Assigned', subject: 'Ticket #[TICKET_ID] has been assigned to [AGENT_NAME]', body: 'Hello [USER_NAME],\n\nYour ticket has been assigned and is being reviewed.\n\nBest,\nSupport Team' },
    { id: '3', name: 'SLA Breach Warning', subject: 'Warning: SLA breach imminent for Ticket #[TICKET_ID]', body: 'Team,\n\nTicket #[TICKET_ID] is about to breach its SLA in 1 hour. Please prioritize.' },
    { id: '4', name: 'Ticket Resolved', subject: 'Your ticket #[TICKET_ID] has been resolved', body: 'Hello [USER_NAME],\n\nWe consider this issue resolved. If you have any further questions, please reopen the ticket.\n\nBest,\nSupport Team' },
    { id: '5', name: 'Ticket Reopened', subject: 'Ticket #[TICKET_ID] has been reopened', body: 'Hello [USER_NAME],\n\nYour ticket has been reopened and our team will follow up shortly.\n\nBest,\nSupport Team' },
    { id: '6', name: 'Satisfaction Survey', subject: 'How did we do? Rate your experience for Ticket #[TICKET_ID]', body: 'Hello [USER_NAME],\n\nWe hope your issue was resolved to your satisfaction. Please take a moment to rate your experience.\n\nBest,\nSupport Team' },
  ];
  const [templates, setTemplates] = useState<EmailTemplate[]>(DEFAULT_TEMPLATES);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', subject: '', body: '' });
  const [editForm, setEditForm] = useState({ subject: '', body: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const SAMPLE_VALUES: Record<string, string> = {
    '[TICKET_ID]': '1042',
    '[TICKET_TITLE]': 'Cannot access email on mobile device',
    '[USER_NAME]': 'Jane Smith',
    '[AGENT_NAME]': 'John Doe',
    '[TICKET_URL]': 'https://example.com/tickets/abc123',
    '[PRIORITY]': 'Medium',
    '[STATUS]': 'Open',
    '[CLOSE_NOTES]': 'Issue resolved. Updated firewall rules.',
  };

  function interpolate(text: string): string {
    let result = text;
    for (const [key, value] of Object.entries(SAMPLE_VALUES)) {
      result = result.split(key).join(value);
    }
    return result;
  }

  function EmailPreview({ subject, body }: { subject: string; body: string }) {
    return (
      <div style={{
        marginTop: 16,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background: '#f0f2f5',
      }}>
        <div style={{
          padding: '10px 14px',
          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.04em',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-elevated)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Eye size={12} /> Preview
        </div>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', background: '#fafafa' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>SUBJECT</div>
          <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'system-ui, sans-serif', lineHeight: 1.4 }}>
            {interpolate(subject) || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>(empty)</span>}
          </div>
        </div>
        <div style={{ padding: '14px 16px', background: '#ffffff' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>BODY</div>
          <div style={{
            fontSize: 13, color: '#333',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            lineHeight: 1.6, fontFamily: 'Georgia, "Times New Roman", serif',
          }}>
            {interpolate(body) || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>(empty)</span>}
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    api.get<{ data: EmailTemplate[] }>('/admin/email-templates')
      .then(res => {
        if (res.data && res.data.length > 0) setTemplates(res.data);
      })
      .catch(() => {})
      .finally(() => setTemplatesLoading(false));
  }, []);

  const handleEdit = (t: EmailTemplate) => {
    setEditingTemplate(t);
    setEditForm({ subject: t.subject, body: t.body });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch(`/admin/email-templates/${editingTemplate!.id}`, editForm);
      setTemplates(prev => prev.map(t => t.id === editingTemplate!.id ? { ...t, ...editForm } : t));
      showAlert('Email template saved successfully');
      setEditingTemplate(null);
    } catch {
      setTemplates(prev => prev.map(t => t.id === editingTemplate!.id ? { ...t, ...editForm } : t));
      showAlert('Email template saved (local only)');
      setEditingTemplate(null);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmModal({
      open: true,
      title: 'Delete Template',
      message: 'Are you sure you want to delete this email template?',
      onConfirm: async () => {
        setConfirmModal(null);
        try { await api.delete(`/admin/email-templates/${id}`); } catch {}
        setTemplates(prev => prev.filter(t => t.id !== id));
        showAlert('Email template deleted');
      }
    });
  };

  const handleAddSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.subject.trim()) return;
    try {
      const res = await api.post<{ data: EmailTemplate }>('/admin/email-templates', addForm);
      setTemplates(prev => [...prev, res.data]);
      showAlert('Email template created successfully');
    } catch {
      const newTemplate: EmailTemplate = { id: String(Date.now()), name: addForm.name.trim(), subject: addForm.subject.trim(), body: addForm.body.trim() };
      setTemplates(prev => [...prev, newTemplate]);
      showAlert('Email template created (local only)');
    }
    setIsAdding(false);
    setAddForm({ name: '', subject: '', body: '' });
  };

  if (templatesLoading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Loading templates...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', fontWeight: 500 }}>
          Variables: <code style={{ background: 'var(--accent-subtle)', padding: '1px 6px', borderRadius: 3, margin: '0 2px', fontSize: 11 }}>[TICKET_ID]</code> <code style={{ background: 'var(--accent-subtle)', padding: '1px 6px', borderRadius: 3, margin: '0 2px', fontSize: 11 }}>[USER_NAME]</code> <code style={{ background: 'var(--accent-subtle)', padding: '1px 6px', borderRadius: 3, margin: '0 2px', fontSize: 11 }}>[AGENT_NAME]</code>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Add Template
        </button>
      </div>

      {isAdding && (
        <div className="card" style={{ padding: 24, background: 'var(--bg-secondary)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 18, color: 'var(--text)' }}>New Email Template</div>
          <form onSubmit={handleAddSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Template Name</label>
              <input className="input" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} placeholder="e.g. Password Reset Notification" required style={{ fontSize: 14 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Subject Line</label>
              <input className="input" value={addForm.subject} onChange={e => setAddForm({ ...addForm, subject: e.target.value })} placeholder="e.g. Your password has been reset — Ticket #[TICKET_ID]" required style={{ fontSize: 14 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Body</label>
              <textarea className="textarea" value={addForm.body} onChange={e => setAddForm({ ...addForm, body: e.target.value })} rows={6} style={{ minHeight: 140, fontSize: 13, fontFamily: 'monospace' }} placeholder={'Hello [USER_NAME],\n\nYour message here.\n\nBest,\nSupport Team'} />
            </div>
            <EmailPreview subject={addForm.subject} body={addForm.body} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => { setIsAdding(false); setAddForm({ name: '', subject: '', body: '' }); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={!addForm.name.trim() || !addForm.subject.trim()}>Create Template</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {templates.map(t => {
          const isExpanded = expandedId === t.id;
          return (
            <div key={t.id} style={{
              background: 'var(--bg-elevated)',
              border: `1px solid ${isExpanded ? 'var(--accent-border)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              boxShadow: isExpanded ? 'var(--shadow-sm)' : 'none',
            }}>
              <div
                onClick={() => setExpandedId(isExpanded ? null : t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 18px', cursor: 'pointer',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--accent-subtle)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Mail size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(t)} title="Edit"><Edit2 size={13} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(t.id)} title="Delete" style={{ color: 'var(--danger)' }}><Trash size={13} /></button>
                </div>
                <div style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ paddingTop: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Subject</div>
                    <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: 13, color: 'var(--text)', marginBottom: 14 }}>
                      {t.subject}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Body Preview</div>
                    <pre style={{
                      margin: 0, padding: '14px 16px', background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
                      fontSize: 12, color: 'var(--text)', whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word', fontFamily: 'monospace',
                      lineHeight: 1.6, maxHeight: 200, overflowY: 'auto'
                    }}>
                      {t.body}
                    </pre>
                    <EmailPreview subject={t.subject} body={t.body} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(t.body); showAlert('Body copied to clipboard'); }}>
                        <Copy size={12} style={{ marginRight: 4 }} /> Copy Body
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleEdit(t); }}>
                        <Edit2 size={12} style={{ marginRight: 4 }} /> Edit
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editingTemplate && (
        <Modal title={`Edit: ${editingTemplate.name}`} onClose={() => setEditingTemplate(null)} maxWidth="620px">
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Subject Line</label>
              <input className="input" value={editForm.subject} onChange={e => setEditForm({ ...editForm, subject: e.target.value })} required style={{ fontSize: 14 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Body Content</label>
              <textarea className="textarea" value={editForm.body} onChange={e => setEditForm({ ...editForm, body: e.target.value })} rows={8} style={{ minHeight: 180, fontSize: 13, fontFamily: 'monospace' }} required />
            </div>
            <EmailPreview subject={editForm.subject} body={editForm.body} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditingTemplate(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
