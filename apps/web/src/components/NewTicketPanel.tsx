'use client';
import { useEffect, useState, useRef } from 'react';
import { useStore, Category, User, Ticket } from '@/lib/store';
import { api, API_BASE } from '@/lib/api';
import {
  X, Maximize2, Minimize2, AlertTriangle, Sparkles, CheckCircle,
  Paperclip, UploadCloud, Loader2, FileText, Trash2
} from 'lucide-react';
import { UserSearchSelect } from '@/components/UserSearchSelect';
import { SelectSearch } from '@/components/SelectSearch';

const TICKET_TYPE_OPTIONS = [
  { value: 'incident',        label: 'Incident' },
  { value: 'service_request', label: 'Service Request' },
  { value: 'problem',         label: 'Problem' },
  { value: 'change',          label: 'Change' },
];

const USER_TICKET_TYPE_OPTIONS = [
  { value: 'incident',        label: 'Incident' },
  { value: 'service_request', label: 'Request' },
];

const PRIORITY_OPTIONS = [
  { value: 'low',      label: 'Low',      color: 'var(--priority-low)' },
  { value: 'medium',   label: 'Medium',   color: 'var(--priority-medium)' },
  { value: 'high',     label: 'High',     color: 'var(--priority-high)' },
  { value: 'critical', label: 'Critical', color: 'var(--priority-critical)' },
];

const STATUS_OPTIONS = [
  { value: 'open',        label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting',     label: 'Waiting' },
  { value: 'closed',      label: 'Closed' },
];

const panelLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
  marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em',
};

export function NewTicketPanel({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user, addTicket } = useStore();
  const [minimized, setMinimized] = useState(false);
  const [form, setForm] = useState(() => {
    const due = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatted = `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}T${pad(due.getHours())}:${pad(due.getMinutes())}`;
    return {
      title: '',
      description: '',
      priority: 'medium',
      ticket_type: 'incident',
      category_id: '',
      assigned_to_id: '',
      created_by_id: '',
      due_date: formatted,
      status: 'open',
    };
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [allUsersList, setAllUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [showCloseNote, setShowCloseNote] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; name: string; title: string; description: string; ticket_type: string; priority: string; category_id: string | null }[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<{ data: Category[] }>('/categories').then(res => setCategories(res.data)).catch(() => {});
    if (user?.role !== 'user') {
      api.get<{ data: User[] }>('/users').then(res => {
        setAllUsersList(res.data);
        setAgents(res.data.filter((u: User) => u.role === 'admin' || u.role === 'agent'));
      }).catch(() => {});
    }
    if (user?.role === 'admin' || user?.role === 'agent') {
      api.get<{ data: any[] }>('/templates').then(res => setTemplates(res.data)).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !(e.target as HTMLElement).matches('input,textarea,select')) {
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleStatusChange(newStatus: string) {
    if (newStatus === 'closed') {
      setShowCloseNote(true);
      return;
    }
    setForm(f => ({ ...f, status: newStatus }));
  }

  function applyTemplate(t: any) {
    setForm(f => ({
      ...f,
      title: t.title || f.title,
      description: t.description || f.description,
      ticket_type: t.ticket_type || f.ticket_type,
      priority: t.priority || f.priority,
      category_id: t.category_id || f.category_id,
    }));
    setSelectedTemplate(t.id);
  }

  function handleTemplateChange(templateId: string) {
    if (!templateId) {
      setSelectedTemplate('');
      return;
    }
    const t = templates.find(tmpl => tmpl.id === templateId);
    if (t) applyTemplate(t);
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    try {
      await api.post('/templates', {
        name: templateName.trim(),
        title: form.title,
        description: form.description,
        ticket_type: form.ticket_type,
        priority: form.priority,
        category_id: form.category_id || null,
        is_public: true,
      });
      setShowSaveTemplate(false);
      setTemplateName('');
      const res = await api.get<{ data: any[] }>('/templates');
      setTemplates(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  }

  async function confirmClose() {
    if (!closeNote.trim()) return;
    setForm(f => ({ ...f, status: 'closed' }));
    setShowCloseNote(false);
    setCloseNote('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (form.status === 'closed' && !closeNote.trim()) {
      setShowCloseNote(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload: Record<string, string | undefined> = {
        title: form.title,
        description: form.description,
        priority: form.priority,
        ticket_type: form.ticket_type,
        category_id: form.category_id || undefined,
        assigned_to_id: form.assigned_to_id || undefined,
        created_by_id: form.created_by_id || undefined,
        due_date: form.due_date || undefined,
      };
      const res = await api.post<{ data: Ticket }>('/tickets', payload);
      const created = res.data;
      if (form.status === 'closed') {
        await api.patch(`/tickets/${created.id}`, { status: 'closed', close_notes: closeNote });
      }

      // Upload attached files
      if (attachedFiles.length > 0) {
        setUploadingFiles(true);
        const token = localStorage.getItem('resolv_token') || localStorage.getItem('token');
        const apiBase = API_BASE || 'http://localhost:3001/api';
        for (const file of attachedFiles) {
          const formData = new FormData();
          formData.append('file', file);
          await fetch(`${apiBase}/tickets/${created.id}/attachments`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          });
        }
        setUploadingFiles(false);
      }

      addTicket(created);
      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket');
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes slideUpPanel {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      {/* Backdrop - no blur when minimized */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 998,
          background: minimized ? 'transparent' : 'rgba(0,0,0,0.15)',
          backdropFilter: minimized ? 'none' : 'blur(1px)',
          pointerEvents: minimized ? 'none' : 'auto',
        }}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: minimized ? 320 : 520,
        maxHeight: minimized ? 44 : 'calc(100vh - 48px)',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: minimized ? '0 4px 12px rgba(0,0,0,0.15)' : '0 24px 64px -12px rgba(0,0,0,0.35)',
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.25s cubic-bezier(0.16,1,0.3,1), max-height 0.25s cubic-bezier(0.16,1,0.3,1)',
        animation: 'slideUpPanel 0.3s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Header - SysAid style */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: minimized ? '8px 12px' : '10px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
          cursor: minimized ? 'pointer' : 'default',
        }}
          onClick={minimized ? () => setMinimized(false) : undefined}
        >
          {!minimized && (
            <>
              {/* Type dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Type</span>
                <select
                  className="select"
                  value={form.ticket_type}
                  onChange={e => setForm(f => ({ ...f, ticket_type: e.target.value }))}
                  style={{ height: 28, fontSize: 12, padding: '0 24px 0 8px', minWidth: 130 }}
                  onClick={e => e.stopPropagation()}
                >
                  {(user?.role === 'user' ? USER_TICKET_TYPE_OPTIONS : TICKET_TYPE_OPTIONS).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {/* Template dropdown — agents+ only */}
              {user?.role !== 'user' && templates.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Template</span>
                  <select
                    className="select"
                    value={selectedTemplate}
                    onChange={e => handleTemplateChange(e.target.value)}
                    style={{ height: 28, fontSize: 12, padding: '0 24px 0 8px', minWidth: 140 }}
                    onClick={e => e.stopPropagation()}
                  >
                    <option value="">Standard {TICKET_TYPE_OPTIONS.find(t => t.value === form.ticket_type)?.label || 'Incident'}</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}

              {/* Save template button — agents+ only */}
              {user?.role !== 'user' && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowSaveTemplate(true); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 4, marginLeft: 'auto' }}
                  title="Save as Template"
                >
                  <Sparkles size={14} />
                </button>
              )}
            </>
          )}

          {minimized && (
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
              {form.title || 'New Ticket'}
            </span>
          )}

          {/* Window controls */}
          <button
            onClick={(e) => { e.stopPropagation(); setMinimized(m => !m); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 4 }}
            title={minimized ? 'Expand' : 'Minimize'}
          >
            {minimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 4 }}
            title="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        {!minimized && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Title */}
              <div>
                <label style={panelLabelStyle}>Title <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  autoFocus
                  className="input"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Brief description of the issue"
                  style={{ fontSize: 14, height: 38, fontWeight: 500 }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={panelLabelStyle}>Description</label>
                <textarea
                  className="textarea"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the issue in detail..."
                  rows={4}
                  style={{ fontSize: 12, resize: 'vertical', minHeight: 80 }}
                />
              </div>

              {/* Priority — agents+ only */}
              {user?.role !== 'user' && (
                <div>
                  <label style={panelLabelStyle}>Priority</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {PRIORITY_OPTIONS.map(p => (
                      <button key={p.value} type="button"
                        onClick={() => setForm(f => ({ ...f, priority: p.value }))}
                        style={{
                          flex: 1, padding: '5px 4px', borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${form.priority === p.value ? p.color : 'var(--border)'}`,
                          background: form.priority === p.value ? `${p.color}18` : 'var(--bg-secondary)',
                          cursor: 'pointer', fontSize: 11, fontWeight: 600,
                          color: form.priority === p.value ? p.color : 'var(--text-secondary)',
                          transition: 'all 0.15s',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        }}
                      >
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Status + Reporter row — agents+ only */}
              {user?.role !== 'user' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={panelLabelStyle}>Status</label>
                    <select
                      className="select"
                      value={form.status}
                      onChange={e => handleStatusChange(e.target.value)}
                      style={{ width: '100%', fontSize: 12, height: 34 }}
                    >
                      {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={panelLabelStyle}>Reporter</label>
                    <UserSearchSelect
                      users={allUsersList}
                      value={form.created_by_id || null}
                      onChange={val => setForm(f => ({ ...f, created_by_id: val || '' }))}
                      placeholder="Auto (you)"
                    />
                  </div>
                </div>
              )}

              {/* Category + Assignee row — hide category for users, whole row for agents+ */}
              {user?.role !== 'user' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={panelLabelStyle}>Category</label>
                    <SelectSearch
                      options={categories.map(c => ({ value: c.id, label: c.name }))}
                      value={form.category_id || null}
                      onChange={val => setForm(f => ({ ...f, category_id: val || '' }))}
                      placeholder="Select..."
                      hideClear={false}
                    />
                  </div>
                  <div>
                    <label style={panelLabelStyle}>Assignee</label>
                    <UserSearchSelect
                      users={agents}
                      value={form.assigned_to_id || null}
                      onChange={val => setForm(f => ({ ...f, assigned_to_id: val || '' }))}
                      placeholder="Auto-assign"
                    />
                  </div>
                </div>
              ) : null}

              {/* Due Date */}
              <div>
                <label style={panelLabelStyle}>Due Date</label>
                <input type="datetime-local" className="input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={{ fontSize: 12, maxWidth: 220 }} />
              </div>

              {/* Closing Note */}
              {showCloseNote && (
                <div style={{ padding: '10px 12px', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)' }}>
                  <label style={{ ...panelLabelStyle, color: 'var(--success)', marginBottom: 6 }}>
                    <CheckCircle size={12} style={{ marginRight: 4 }} /> Closing Note (required)
                  </label>
                  <textarea
                    className="textarea"
                    value={closeNote}
                    onChange={e => setCloseNote(e.target.value)}
                    placeholder="Add a closing note..."
                    rows={3}
                    style={{ fontSize: 12, resize: 'vertical', minHeight: 60, marginBottom: 8 }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowCloseNote(false); setCloseNote(''); }}>Cancel</button>
                    <button type="button" className="btn btn-primary btn-sm" disabled={!closeNote.trim()} onClick={confirmClose}>Confirm</button>
                  </div>
                </div>
              )}

              {error && (
                <div style={{ padding: '8px 12px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={12} /> {error}
                </div>
              )}

              {/* File Attachments */}
              <div>
                <label style={panelLabelStyle}>Attachments</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setAttachedFiles(prev => [...prev, ...files]);
                    if (e.target) e.target.value = '';
                  }}
                />
                {attachedFiles.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                    {attachedFiles.map((file, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 10px', borderRadius: 6,
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        fontSize: 12
                      }}>
                        <FileText size={13} color="var(--text-muted)" />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{file.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11, flexShrink: 0 }}>{(file.size / 1024).toFixed(0)} KB</span>
                        <button type="button" onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 12px', borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--border)', background: 'var(--bg-secondary)',
                    color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
                    width: '100%', justifyContent: 'center'
                  }}
                >
                  <Paperclip size={13} />
                  {attachedFiles.length > 0 ? `${attachedFiles.length} file(s) selected` : 'Attach files'}
                </button>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, paddingTop: 4, borderTop: '1px solid var(--border-subtle)', marginTop: 4 }}>
                <button type="submit" disabled={loading || !form.title.trim()} className="btn btn-primary" style={{ flex: 1, height: 36, fontSize: 13 }}>
                  {loading ? (
                    <><div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Creating...</>
                  ) : 'Create Ticket'}
                </button>
                <button type="button" onClick={onClose} className="btn btn-ghost" style={{ height: 36, fontSize: 13 }}>Cancel</button>
              </div>

            </form>
          </div>
        )}
      </div>

      {/* Save Template Modal */}
      {showSaveTemplate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowSaveTemplate(false)}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, maxWidth: 400, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Save as Template</h3>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>TEMPLATE NAME</label>
              <input className="input" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. VPN Issue, Software Request..." style={{ width: '100%' }} autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSaveTemplate(); }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSaveTemplate(false)} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveTemplate} disabled={savingTemplate || !templateName.trim()} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
                {savingTemplate ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
