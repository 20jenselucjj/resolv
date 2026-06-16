'use client';
import { useEffect, useState, useRef } from 'react';
import { useStore, Category, User, Ticket } from '@/lib/store';
import { api, API_BASE, getToken } from '@/lib/api';
import {
  X, Maximize2, Minimize2, AlertTriangle, Sparkles, CheckCircle,
  Paperclip, UploadCloud, Loader2, FileText, Trash2
} from 'lucide-react';
import { useStatusConfig } from '@/lib/StatusConfigContext';
import { UserSearchSelect } from '@/components/UserSearchSelect';
import { SelectSearch } from '@/components/SelectSearch';
import { CategoryTreeSelect } from '@/components/CategoryTreeSelect';
import { WYSIWYGEditor } from '@/components/WYSIWYGEditor';

const DRAFT_KEY = 'resolv_new_ticket_draft';

const TYPE_OPTIONS_DROPDOWN = [
  { value: 'incident',        label: 'Incident' },
  { value: 'service_request', label: 'Service Request' },
  { value: 'problem',         label: 'Problem' },
  { value: 'change',          label: 'Change' },
];

const USER_TYPE_OPTIONS_DROPDOWN = TYPE_OPTIONS_DROPDOWN.filter(t => t.value === 'incident' || t.value === 'service_request');

const PRIORITY_OPTIONS = [
  { value: 'low',      label: 'Low',      color: 'var(--priority-low)' },
  { value: 'medium',   label: 'Medium',   color: 'var(--priority-medium)' },
  { value: 'high',     label: 'High',     color: 'var(--priority-high)' },
  { value: 'critical', label: 'Critical', color: 'var(--priority-critical)' },
];

const panelLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
  marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em',
};

function getDefaultForm() {
  const due = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    title: '',
    description: '',
    priority: 'medium',
    ticket_type: 'incident',
    category_id: '',
    assigned_to_id: '',
    created_by_id: '',
    due_date: `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}T${pad(due.getHours())}:${pad(due.getMinutes())}`,
    status: 'open',
  };
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NewTicketPanel({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user, addTicket } = useStore();
  const { statusOptions } = useStatusConfig();
  const [minimized, setMinimized] = useState(false);
  const [form, setForm] = useState(getDefaultForm);
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
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const objectUrls = useRef<Map<number, string>>(new Map());
  const [draftRestored, setDraftRestored] = useState<{ timestamp: number } | null>(null);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      setAttachedFiles(prev => [...prev, ...files]);
    }
  }

  // Fetch data on mount / user change
  useEffect(() => {
    const promises: Promise<void>[] = [
      api.get<{ data: Category[] }>('/categories').then(res => setCategories(res.data)).catch(() => {}),
    ];
    if (user?.role !== 'user') {
      promises.push(
        api.get<{ data: User[] }>('/users').then(res => {
          setAllUsersList(res.data);
          setAgents(res.data.filter((u: User) => u.role === 'admin' || u.role === 'agent'));
        }).catch(() => {})
      );
    }
    if (user?.role === 'admin' || user?.role === 'agent') {
      promises.push(
        api.get<{ data: any[] }>('/templates').then(res => setTemplates(res.data)).catch(() => {})
      );
    }
    Promise.all(promises).catch(() => {});
  }, [user]);

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.form && parsed.timestamp) {
          const restoredForm = parsed.form;
          setForm(restoredForm);
          setDraftRestored({ timestamp: parsed.timestamp });
        }
      }
    } catch (e) {
      // Ignore corrupted drafts
    }
  }, []);

  // Clear draft on unmount (intentional close). On crash/refresh the
  // cleanup never runs so the draft persists for recovery.
  useEffect(() => {
    return () => {
      try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
    };
  }, []);

  // Ensure ticket_type is valid for the current user role
  useEffect(() => {
    const allowedTypes = user?.role === 'user' ? ['incident', 'service_request'] : ['incident', 'service_request', 'problem', 'change'];
    if (!allowedTypes.includes(form.ticket_type)) {
      setForm(f => ({ ...f, ticket_type: 'incident' }));
    }
  }, [user?.role]);

  // Debounced draft auto-save
  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, timestamp: Date.now() }));
      } catch (e) {
        // localStorage might be full
      }
    }, 500);
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [form]);

  // Clean up object URLs when attachment list changes
  useEffect(() => {
    const oldMap = objectUrls.current;
    const newMap = new Map<number, string>();
    attachedFiles.forEach((file, i) => {
      if (file.type.startsWith('image/')) {
        newMap.set(i, URL.createObjectURL(file));
      }
    });
    objectUrls.current = newMap;
    oldMap.forEach(url => URL.revokeObjectURL(url));
    return () => {
      newMap.forEach(url => URL.revokeObjectURL(url));
    };
  }, [attachedFiles]);

  // Escape to close + Ctrl/Cmd+Enter to submit
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !(e.target as HTMLElement).matches('input,textarea,select')) {
        onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (!minimized) {
          e.preventDefault();
          formRef.current?.requestSubmit();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, minimized]);

  // Close template dropdown on outside click
  useEffect(() => {
    if (!showTemplateDropdown) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowTemplateDropdown(false);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showTemplateDropdown]);

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

  async function handleDeleteTemplate(templateId: string, templateName: string) {
    if (!window.confirm(`Delete template "${templateName}"?`)) return;
    try {
      await api.delete(`/templates/${templateId}`);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      if (selectedTemplate === templateId) {
        setSelectedTemplate('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    }
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
      const payload: Record<string, any> = {
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
        const token = getToken();
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

      // Clear draft on successful creation
      try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }

      addTicket(created);
      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket');
      setLoading(false);
    }
  }

  function handleDiscardDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
    setDraftRestored(null);
    setForm(getDefaultForm());
  }

  const typeOptions = user?.role === 'user' ? USER_TYPE_OPTIONS_DROPDOWN : TYPE_OPTIONS_DROPDOWN;

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
        {/* Header */}
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
              {/* Template dropdown — agents+ only */}
              {user?.role !== 'user' && templates.length > 0 && (
                <div ref={dropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Template</span>
                  <button
                    type="button"
                    className="select"
                    onClick={(e) => { e.stopPropagation(); setShowTemplateDropdown(d => !d); }}
                    style={{ height: 28, fontSize: 12, padding: '0 24px 0 8px', minWidth: 140, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedTemplate
                        ? (templates.find(t => t.id === selectedTemplate)?.name || 'Select Template')
                        : `Standard ${TYPE_OPTIONS_DROPDOWN.find(t => t.value === form.ticket_type)?.label || 'Incident'}`}
                    </span>
                    <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>▾</span>
                  </button>
                  {showTemplateDropdown && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                      marginTop: 2, background: 'var(--card)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                      overflow: 'hidden',
                    }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleTemplateChange(''); setShowTemplateDropdown(false); }}
                        style={{
                          width: '100%', padding: '6px 8px', fontSize: 11, textAlign: 'left',
                          border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text)',
                        }}
                      >
                        Standard {TYPE_OPTIONS_DROPDOWN.find(t => t.value === form.ticket_type)?.label || 'Incident'}
                      </button>
                      {templates.map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleTemplateChange(t.id); setShowTemplateDropdown(false); }}
                            style={{
                              flex: 1, padding: '6px 8px', fontSize: 11, textAlign: 'left',
                              border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text)',
                            }}
                          >{t.name}</button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id, t.name); }}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                              padding: '6px 8px', display: 'flex', alignItems: 'center', borderRadius: 0,
                            }}
                            title={`Delete "${t.name}"`}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Save template button — agents+ only */}
              {user?.role !== 'user' && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowSaveTemplate(true); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 4 }}
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

          {/* Spacer pushes controls to the right */}
          {!minimized && <div style={{ flex: 1 }} />}

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
            <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Draft restore banner */}
              {draftRestored && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px',
                  background: 'var(--accent-subtle)',
                  border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 11,
                  fontWeight: 500,
                }}>
                  <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📝</span>
                    <span>Draft restored from <strong>{formatRelativeTime(draftRestored.timestamp)}</strong>. Create?</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setDraftRestored(null)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', padding: '4px 8px', display: 'flex',
                      fontSize: 11, fontWeight: 600, borderRadius: 4,
                    }}
                    title="Keep draft"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardDraft}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', padding: 2, display: 'flex',
                    }}
                    title="Discard draft"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Type + Title — inline row */}
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8 }}>
                <div>
                  <label style={panelLabelStyle}>Type</label>
                  <select
                    className="select"
                    value={form.ticket_type}
                    onChange={e => setForm(f => ({ ...f, ticket_type: e.target.value }))}
                    style={{ width: '100%', fontSize: 11, height: 32 }}
                  >
                    {typeOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={panelLabelStyle}>Title <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    autoFocus
                    className="input"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Brief description of the issue"
                    style={{ fontSize: 13, height: 32, fontWeight: 500 }}
                  />
                </div>
              </div>

              {/* Description — Rich Text Editor */}
              <div>
                <label style={panelLabelStyle}>Description</label>
                <WYSIWYGEditor
                  value={form.description}
                  onChange={(val) => setForm(f => ({ ...f, description: val }))}
                  height={240}
                  placeholder="Describe the issue in detail..."
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
                      {statusOptions.filter(s => s.value !== 'all').map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
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
                    <CategoryTreeSelect
                      categories={categories}
                      value={form.category_id || null}
                      onChange={val => setForm(f => ({ ...f, category_id: val || '' }))}
                      placeholder="Select..."
                      allowClear
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

              {/* Due Date + Attachments row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={panelLabelStyle}>Due Date</label>
                  <input type="datetime-local" className="input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={{ fontSize: 12, width: '100%' }} />
                </div>
                <div
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  style={{ position: 'relative' }}
                >
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
                      {attachedFiles.map((file, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '5px 8px', borderRadius: 6,
                          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                          fontSize: 11
                        }}>
                          {file.type.startsWith('image/') && objectUrls.current.has(i) ? (
                            <img
                              src={objectUrls.current.get(i)}
                              alt=""
                              width={24}
                              height={24}
                              loading="lazy"
                              style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                            />
                          ) : (
                            <FileText size={11} color="var(--text-muted)" />
                          )}
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)', fontSize: 11 }}>{file.name}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>{(file.size / 1024).toFixed(0)} KB</span>
                          <button type="button" onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
                            <Trash2 size={10} />
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
                      padding: '7px 10px', borderRadius: 'var(--radius-md)',
                      border: `1px dashed ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
                      background: isDragging ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                      color: isDragging ? 'var(--accent)' : 'var(--text-muted)',
                      cursor: 'pointer', fontSize: 11, width: '100%', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}
                  >
                    {isDragging ? <UploadCloud size={14} /> : <Paperclip size={12} />}
                    {isDragging ? 'Drop files here' : attachedFiles.length > 0 ? `${attachedFiles.length} file(s)` : 'Add files'}
                  </button>

                  {/* Drag overlay */}
                  {isDragging && (
                    <div style={{
                      position: 'absolute', inset: 0, borderRadius: 'var(--radius-md)',
                      border: '2px dashed var(--accent)', pointerEvents: 'none',
                      background: 'rgba(59,130,246,0.06)', zIndex: 1,
                    }} />
                  )}
                </div>
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
