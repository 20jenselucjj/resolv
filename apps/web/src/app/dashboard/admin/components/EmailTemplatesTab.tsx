'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash } from 'lucide-react';
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
        try {
          await api.delete(`/admin/email-templates/${id}`);
        } catch {}
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

  if (templatesLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading templates...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Email Templates</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)' }}>
            Variables: [TICKET_ID] [USER_NAME] [AGENT_NAME] [TICKET_TITLE]
          </div>
          <button className="btn btn-primary" onClick={() => setIsAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Add Template
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="card" style={{ padding: '20px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-border)' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>New Email Template</div>
          <form onSubmit={handleAddSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Template Name *</label>
              <input className="input" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} placeholder="e.g. Password Reset Notification" required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Subject Line *</label>
              <input className="input" value={addForm.subject} onChange={e => setAddForm({ ...addForm, subject: e.target.value })} placeholder="e.g. Your password has been reset for Ticket #[TICKET_ID]" required />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Available variables: [TICKET_ID], [USER_NAME], [AGENT_NAME], [TICKET_TITLE]</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Body Content</label>
              <textarea className="textarea" value={addForm.body} onChange={e => setAddForm({ ...addForm, body: e.target.value })} rows={6} style={{ minHeight: '120px', padding: '12px' }} placeholder={'Hello [USER_NAME],\n\nYour message here.\n\nBest,\nSupport Team'} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => { setIsAdding(false); setAddForm({ name: '', subject: '', body: '' }); }}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create Template</button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Template Type</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Subject Line</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>{t.name}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{t.subject}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: '12px', border: '1px solid var(--border)' }} onClick={() => handleEdit(t)}>
                      <Edit2 size={12} style={{ marginRight: 6 }} /> Edit
                    </button>
                    <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--danger)' }} onClick={() => handleDelete(t.id)}>
                      <Trash size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingTemplate && (
        <Modal title={`Edit Template: ${editingTemplate.name}`} onClose={() => setEditingTemplate(null)} maxWidth="600px">
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Subject Line</label>
              <input className="input" value={editForm.subject} onChange={e => setEditForm({ ...editForm, subject: e.target.value })} required />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Available variables: [TICKET_ID], [USER_NAME], [AGENT_NAME], [TICKET_TITLE]</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Body Content</label>
              <textarea className="textarea" value={editForm.body} onChange={e => setEditForm({ ...editForm, body: e.target.value })} rows={8} style={{ minHeight: '150px', padding: '12px' }} required />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditingTemplate(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Template</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
