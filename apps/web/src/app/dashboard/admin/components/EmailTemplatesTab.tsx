'use client';

import { useEffect, useState, useRef } from 'react';
import { Plus, Edit2, Trash, Mail, ChevronDown, ChevronUp, Copy, Eye, Code, Maximize2, Image, Sparkles, Loader2, X, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Modal } from './SharedUI';
import { toast } from '@/components/Toast';
import type { EmailTemplate } from './types';

interface EmailTemplateItem extends EmailTemplate {
  is_default?: boolean;
  is_modified?: boolean;
}

const ALL_VARIABLES = [
  'TICKET_ID', 'TICKET_TITLE', 'USER_NAME', 'AGENT_NAME', 'TICKET_URL',
  'PRIORITY', 'STATUS', 'REQUESTOR_NAME', 'ASSIGNED_TO_NAME', 'CREATED_AT',
  'DUE_DATE', 'CATEGORY', 'TICKET_TYPE', 'DESCRIPTION', 'PRIORITY_COLOR',
  'STATUS_COLOR', 'COMMENT_BODY', 'CLOSE_NOTES', 'RESOLVED_AT', 'PREVIOUS_ASSIGNEE'
];

export function EmailTemplatesTab({ showAlert, setConfirmModal }: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (modal: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
}) {
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplateItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', subject: '', body: '' });
  const [editForm, setEditForm] = useState({ subject: '', body: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addBodyTab, setAddBodyTab] = useState<'edit' | 'preview'>('edit');
  const [editBodyTab, setEditBodyTab] = useState<'edit' | 'preview'>('edit');
  const [fullPreviewTemplate, setFullPreviewTemplate] = useState<EmailTemplateItem | null>(null);
  const [fullPreviewShowSource, setFullPreviewShowSource] = useState(false);
  const [showAllVars, setShowAllVars] = useState(false);
  const [showImagePanel, setShowImagePanel] = useState<'add' | 'edit' | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<'create' | 'modify'>('create');
  const [aiModifyTarget, setAiModifyTarget] = useState<EmailTemplateItem | null>(null);
  const [aiSuccess, setAiSuccess] = useState(false);
  const [aiStep, setAiStep] = useState<'prompt' | 'generating' | 'preview' | 'saving' | 'complete'>('prompt');
  const [aiGeneratedContent, setAiGeneratedContent] = useState<{ name: string; subject: string; body: string } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const addTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const SAMPLE_VALUES: Record<string, string> = {
    '[TICKET_ID]': '1042',
    '[TICKET_TITLE]': 'Cannot access email on mobile device',
    '[USER_NAME]': 'Jane Smith',
    '[AGENT_NAME]': 'John Doe',
    '[TICKET_URL]': 'https://example.com/tickets/abc123',
    '[PRIORITY]': 'Medium',
    '[STATUS]': 'Open',
    '[REQUESTOR_NAME]': 'Jane Smith',
    '[ASSIGNED_TO_NAME]': 'John Doe',
    '[CREATED_AT]': '2024-03-15 10:30 AM',
    '[DUE_DATE]': '2024-03-18 10:30 AM',
    '[CATEGORY]': 'IT Support',
    '[TICKET_TYPE]': 'Incident',
    '[DESCRIPTION]': 'User cannot access email on mobile device after recent update.',
    '[PRIORITY_COLOR]': '#f59e0b',
    '[STATUS_COLOR]': '#3b82f6',
    '[COMMENT_BODY]': 'We have identified the issue and are working on a fix.',
    '[CLOSE_NOTES]': 'Issue resolved. Updated firewall rules.',
    '[RESOLVED_AT]': '2024-03-16 2:45 PM',
    '[PREVIOUS_ASSIGNEE]': 'Sarah Wilson',
  };

  function interpolate(text: string): string {
    let result = text;
    for (const [key, value] of Object.entries(SAMPLE_VALUES)) {
      result = result.split(key).join(value);
    }
    return result;
  }

  function AutoResizeIframe({ srcDoc, minHeight = 200, maxHeight: maxH = 600, title }: { srcDoc: string; minHeight?: number; maxHeight?: number; title: string }) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [height, setHeight] = useState(minHeight);

    const handleLoad = () => {
      const iframe = iframeRef.current;
      if (iframe && iframe.contentDocument) {
        const scrollHeight = iframe.contentDocument.body.scrollHeight;
        setHeight(Math.max(scrollHeight, minHeight));
      }
    };

    return (
      <div style={{ maxHeight: maxH, overflowY: 'auto' }}>
        <iframe
          ref={iframeRef}
          srcDoc={srcDoc}
          onLoad={handleLoad}
          style={{ width: '100%', height, border: 'none' }}
          title={title}
          sandbox=""
        />
      </div>
    );
  }

  function HTMLPreview({ body }: { body: string }) {
    const [showSource, setShowSource] = useState(false);
    const interpolated = interpolate(body);

    return (
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 10px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {showSource ? 'HTML Source' : 'Rendered Preview'}
          </span>
          <button
            type="button"
            onClick={() => setShowSource(!showSource)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 600,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--accent)', padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              transition: 'opacity 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.7'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            {showSource ? <Eye size={11} /> : <Code size={11} />}
            {showSource ? 'Preview' : 'View Source'}
          </button>
        </div>
        {showSource ? (
          <pre style={{
            margin: 0, padding: '12px 14px',
            fontSize: 12, fontFamily: 'monospace', lineHeight: 1.5,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            background: '#1e1e1e', color: '#d4d4d4',
            maxHeight: 300, overflowY: 'auto',
          }}>
            {body}
          </pre>
          ) : (
          <div style={{ background: '#fff', minHeight: 150 }}>
            {interpolated ? (
              <AutoResizeIframe srcDoc={interpolated} title="Email HTML preview" />
            ) : (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
                No content to preview
              </div>
            )}
          </div>
        )}
      </div>
    );
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
          <HTMLPreview body={body} />
        </div>
      </div>
    );
  }

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiStep('generating');
    setAiError(null);
    try {
      const body: any = {
        type: 'email_template',
        prompt: aiPrompt,
      };
      if (aiMode === 'modify' && aiModifyTarget) {
        body.existingTemplate = {
          name: aiModifyTarget.name,
          subject: aiModifyTarget.subject,
          body: aiModifyTarget.body,
        };
      }
      const res = await api.post<{ data: { name: string; subject: string; body: string } }>('/admin/ai/generate-template', body);

      const name = aiMode === 'modify' && aiModifyTarget
        ? aiModifyTarget.name
        : (aiPrompt.slice(0, 50).replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'AI Generated Template');

      setAiGeneratedContent({
        name,
        subject: res.data.subject,
        body: res.data.body,
      });
      setAiStep('preview');
    } catch (err: any) {
      setAiError(err?.message || 'AI generation failed');
      setAiStep('prompt');
      showAlert(err?.message || 'AI generation failed', 'error');
    }
  };

  const handleAiSave = async () => {
    if (!aiGeneratedContent) return;
    setAiStep('saving');
    try {
      if (aiMode === 'modify' && aiModifyTarget) {
        await api.patch(`/admin/email-templates/${aiModifyTarget.id}`, {
          subject: aiGeneratedContent.subject,
          body: aiGeneratedContent.body,
        });
        showAlert('Template updated by AI');
      } else {
        await api.post('/admin/email-templates', {
          name: aiGeneratedContent.name,
          subject: aiGeneratedContent.subject,
          body: aiGeneratedContent.body,
        });
        showAlert('Template created by AI');
      }
      loadTemplates();
      setAiStep('complete');
      setTimeout(() => {
        setShowAiPanel(false);
        setAiPrompt('');
        setAiGeneratedContent(null);
        setAiStep('prompt');
        setAiError(null);
      }, 2000);
    } catch (err: any) {
      showAlert(err?.message || 'Failed to save template', 'error');
      setAiStep('preview');
    }
  };

  const handleAiEdit = () => {
    if (!aiGeneratedContent) return;
    if (aiMode === 'modify' && aiModifyTarget) {
      setEditingTemplate(aiModifyTarget);
      setEditForm({ subject: aiGeneratedContent.subject, body: aiGeneratedContent.body });
      setEditBodyTab('edit');
    } else {
      setAddForm({ name: aiGeneratedContent.name, subject: aiGeneratedContent.subject, body: aiGeneratedContent.body });
      setAddBodyTab('edit');
      setIsAdding(true);
    }
    setShowAiPanel(false);
    setAiPrompt('');
    setAiGeneratedContent(null);
    setAiStep('prompt');
    setAiError(null);
  };

  const handleAiRegenerate = () => {
    setAiGeneratedContent(null);
    setAiError(null);
    handleAiGenerate();
  };

  const handleAiCancel = () => {
    setShowAiPanel(false);
    setAiPrompt('');
    setAiGeneratedContent(null);
    setAiStep('prompt');
    setAiError(null);
  };

  function loadTemplates() {
    setTemplatesLoading(true);
    return Promise.all([
      api.get<{ data: EmailTemplateItem[] }>('/admin/email-templates').catch(() => ({ data: [] })),
      api.get<{ data: EmailTemplateItem[] }>('/admin/email-templates/defaults').catch(() => ({ data: [] })),
    ])
      .then(([templatesRes, defaultsRes]) => {
        const defaults = defaultsRes.data || [];
        const merged = (templatesRes.data || []).map(t => {
          const isDefault = defaults.some(d => d.id === t.id || d.name === t.name);
          if (!isDefault) return { ...t, is_default: false };
          const original = defaults.find(d => d.id === t.id || d.name === t.name);
          const isModified = original && (original.subject !== t.subject || original.body !== t.body);
          return { ...t, is_default: true, is_modified: !!isModified };
        });
        setTemplates(merged);
      })
      .catch((err) => toast.error('Failed to load templates', err instanceof Error ? err.message : 'Please try again'))
      .finally(() => setTemplatesLoading(false));
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (!fullPreviewTemplate) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullPreviewTemplate(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [fullPreviewTemplate]);

  const handleEdit = (t: EmailTemplateItem) => {
    setEditingTemplate(t);
    setEditForm({ subject: t.subject, body: t.body });
    setEditBodyTab('edit');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch(`/admin/email-templates/${editingTemplate!.id}`, editForm);
      setTemplates(prev => prev.map(t => t.id === editingTemplate!.id ? { ...t, ...editForm, is_modified: true } : t));
      showAlert('Email template saved successfully');
      setEditingTemplate(null);
    } catch {
      setTemplates(prev => prev.map(t => t.id === editingTemplate!.id ? { ...t, ...editForm, is_modified: true } : t));
      showAlert('Email template saved (local only)');
      setEditingTemplate(null);
    }
  };

  const handleDelete = (t: EmailTemplateItem) => {
    const isDefault = t.is_default;
    setConfirmModal({
      open: true,
      title: isDefault ? 'Reset Template' : 'Delete Template',
      message: isDefault
        ? 'This will reset the template to its default content. Any customizations will be lost.'
        : 'Are you sure you want to delete this email template?',
      onConfirm: async () => {
        setConfirmModal(null);
        try { await api.delete(`/admin/email-templates/${t.id}`); } catch {}
        loadTemplates();
        showAlert(isDefault ? 'Template reset to default' : 'Email template deleted');
      }
    });
  };

  const handleAddSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.subject.trim()) return;
    try {
      const res = await api.post<{ data: EmailTemplateItem }>('/admin/email-templates', addForm);
      setTemplates(prev => [...prev, { ...res.data, is_default: false }]);
      showAlert('Email template created successfully');
    } catch {
      const newTemplate: EmailTemplateItem = { id: String(Date.now()), name: addForm.name.trim(), subject: addForm.subject.trim(), body: addForm.body.trim(), is_default: false };
      setTemplates(prev => [...prev, newTemplate]);
      showAlert('Email template created (local only)');
    }
    setIsAdding(false);
    setAddForm({ name: '', subject: '', body: '' });
    setAddBodyTab('edit');
  };

  function TemplateBadge({ t }: { t: EmailTemplateItem }) {
    if (t.is_modified) {
      return <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: '#fef3c7', color: '#92400e', fontWeight: 600, whiteSpace: 'nowrap' }}>Modified</span>;
    }
    if (t.is_default) {
      return <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>Default</span>;
    }
    return <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-subtle)', color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>Custom</span>;
  }

  const insertAtCursor = (
    textareaRef: React.RefObject<HTMLTextAreaElement | null>,
    setForm: (body: string) => void,
    text: string
  ) => {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newValue = ta.value.substring(0, start) + text + ta.value.substring(end);
      setForm(newValue);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + text.length; ta.focus(); }, 0);
    }
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  function ImageInsertPanel({ target }: { target: 'add' | 'edit' }) {
    const textareaRef = target === 'add' ? addTextareaRef : editTextareaRef;
    const fileInputRef = target === 'add' ? addFileInputRef : editFileInputRef;
    const setter = (body: string) => {
      if (target === 'add') {
        setAddForm(prev => ({ ...prev, body }));
      } else {
        setEditForm(prev => ({ ...prev, body }));
      }
    };

    const handleInsert = () => {
      if (!imageUrl) return;
      const imgTag = `<img src="${imageUrl}" alt="" style="max-width:100%;height:auto;" />`;
      insertAtCursor(textareaRef, setter, imgTag);
      setImageUrl('');
      setShowImagePanel(null);
    };

    return (
      <div style={{
        marginTop: 8, padding: '8px 10px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <input
          type="text"
          placeholder="Image URL or data: URI..."
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          style={{
            flex: 1, fontSize: 12,
            padding: '4px 8px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: '#fff',
          }}
        />
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleImageFileUpload}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            fontSize: 11, fontWeight: 600, padding: '4px 8px',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
            cursor: 'pointer', background: 'transparent',
            color: 'var(--text-muted)', whiteSpace: 'nowrap',
          }}
        >
          Upload
        </button>
        <button
          type="button"
          onClick={handleInsert}
          disabled={!imageUrl}
          style={{
            fontSize: 11, fontWeight: 600, padding: '4px 8px',
            borderRadius: 'var(--radius-sm)', border: 'none',
            cursor: imageUrl ? 'pointer' : 'not-allowed',
            background: imageUrl ? 'var(--accent)' : 'var(--border)',
            color: imageUrl ? '#fff' : 'var(--text-muted)',
            whiteSpace: 'nowrap',
            opacity: imageUrl ? 1 : 0.6,
          }}
        >
          Insert
        </button>
      </div>
    );
  }

  if (templatesLoading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Loading templates...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{
          fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)',
          padding: '6px 12px', borderRadius: showAllVars ? 'var(--radius-lg)' : 'var(--radius-full)',
          border: '1px solid var(--border)', fontWeight: 500,
          cursor: 'pointer', userSelect: 'none', maxWidth: showAllVars ? 520 : 380,
        }} onClick={() => setShowAllVars(!showAllVars)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span>Variables:</span>
            {!showAllVars && ALL_VARIABLES.slice(0, 5).map(v => (
              <code key={v} style={{ background: 'var(--accent-subtle)', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>
                [{v}]
              </code>
            ))}
            {!showAllVars && ALL_VARIABLES.length > 5 && (
              <span style={{
                background: 'var(--accent)', color: '#fff', borderRadius: 10,
                padding: '0 6px', fontSize: 10, fontWeight: 700, lineHeight: '16px',
              }}>
                +{ALL_VARIABLES.length - 5} more
              </span>
            )}
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
              {showAllVars ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </span>
          </div>
          {showAllVars && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: 4, marginTop: 8, paddingTop: 8,
              borderTop: '1px solid var(--border-subtle)',
            }}>
              {ALL_VARIABLES.map(v => (
                <code key={v} style={{ background: 'var(--accent-subtle)', padding: '1px 5px', borderRadius: 3, fontSize: 10, textAlign: 'center' }}>
                  [{v}]
                </code>
              ))}
            </div>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => { setIsAdding(true); setAddBodyTab('edit'); }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Add Template
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => setShowAiPanel(!showAiPanel)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)' }}
        >
          <Sparkles size={14} /> AI Generate
        </button>
      </div>

      {showAiPanel && (
        <div className="card" style={{
          padding: 24,
          background: 'linear-gradient(135deg, var(--accent-subtle), var(--bg-secondary))',
          border: '1px solid var(--accent-border)',
          borderRadius: 'var(--radius-lg)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={16} color="#fff" />
              </div>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', display: 'block' }}>
                  AI Template Assistant
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {aiStep === 'prompt' && 'Describe what you need'}
                  {aiStep === 'generating' && 'Creating your template...'}
                  {aiStep === 'preview' && 'Review before saving'}
                  {aiStep === 'saving' && 'Saving your template...'}
                  {aiStep === 'complete' && 'All done!'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAiCancel}
              disabled={aiStep === 'generating' || aiStep === 'saving'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                border: 'none', cursor: aiStep === 'generating' || aiStep === 'saving' ? 'not-allowed' : 'pointer',
                background: 'transparent',
                color: 'var(--text-muted)', transition: 'all 0.12s',
                opacity: aiStep === 'generating' || aiStep === 'saving' ? 0.4 : 1,
              }}
              onMouseEnter={e => { if (!(aiStep === 'generating' || aiStep === 'saving')) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Progress Steps */}
          {aiStep !== 'complete' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, padding: '0 4px' }}>
              {['Prompt', 'Generate', 'Preview', 'Save'].map((label, i) => {
                const stepMap = { prompt: 0, generating: 1, preview: 2, saving: 3, complete: 4 };
                const current = stepMap[aiStep];
                const isActive = current >= i;
                const isCompleted = current > i;
                return (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: i === 3 ? 0 : 1 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: isActive ? 'var(--accent)' : 'var(--bg-tertiary)',
                      color: isActive ? '#fff' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                      border: `2px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      flexShrink: 0,
                    }}>
                      {isCompleted ? '✓' : i + 1}
                    </div>
                    <span style={{
                      fontSize: 12,
                      color: isActive ? 'var(--text)' : 'var(--text-muted)',
                      fontWeight: isActive ? 600 : 400,
                      transition: 'all 0.4s ease',
                      whiteSpace: 'nowrap',
                    }}>
                      {label}
                    </span>
                    {i < 3 && (
                      <div style={{
                        flex: 1, height: 2, minWidth: 12,
                        background: isCompleted ? 'var(--accent)' : 'var(--border)',
                        transition: 'all 0.4s ease',
                        marginLeft: 4, marginRight: 4,
                        borderRadius: 1,
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Error Message */}
          {aiError && aiStep === 'prompt' && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-sm)',
              background: '#fef2f2', border: '1px solid #fecaca',
              color: 'var(--danger)', fontSize: 13, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <X size={14} /> {aiError}
            </div>
          )}

          {/* Content Area */}
          <div style={{ transition: 'all 0.3s ease' }}>
            {/* Prompt State */}
            {aiStep === 'prompt' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: 3, border: '1px solid var(--border-subtle)' }}>
                    <button
                      type="button"
                      onClick={() => setAiMode('create')}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: '5px 12px',
                        borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                        background: aiMode === 'create' ? 'var(--accent)' : 'transparent',
                        color: aiMode === 'create' ? '#fff' : 'var(--text-muted)',
                        transition: 'all 0.15s',
                      }}
                    >
                      Create New
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiMode('modify')}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: '5px 12px',
                        borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                        background: aiMode === 'modify' ? 'var(--accent)' : 'transparent',
                        color: aiMode === 'modify' ? '#fff' : 'var(--text-muted)',
                        transition: 'all 0.15s',
                      }}
                    >
                      Modify Existing
                    </button>
                  </div>
                </div>

                {aiMode === 'modify' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Select Template to Modify
                    </label>
                    <select
                      value={aiModifyTarget?.id || ''}
                      onChange={e => {
                        const t = templates.find(t => t.id === e.target.value);
                        setAiModifyTarget(t || null);
                      }}
                      style={{
                        width: '100%', fontSize: 13,
                        padding: '8px 10px',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-elevated)',
                        color: 'var(--text)',
                      }}
                    >
                      <option value="">Select a template...</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {aiMode === 'create' ? 'Describe the template you want' : 'Describe the modification'}
                  </label>
                  <textarea
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder={aiMode === 'create'
                      ? "Describe the email template you want to create, e.g., 'A professional password reset email with a clear call-to-action button'"
                      : "Describe the changes, e.g., 'Update the Ticket Created template to include a priority badge'"
                    }
                    style={{
                      width: '100%', minHeight: 90, fontSize: 13, fontFamily: 'monospace',
                      padding: '10px 12px', boxSizing: 'border-box',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-elevated)',
                      color: 'var(--text)',
                      resize: 'vertical',
                      lineHeight: 1.5,
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={!aiPrompt.trim()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 700, padding: '8px 18px',
                      borderRadius: 'var(--radius-sm)', border: 'none',
                      cursor: aiPrompt.trim() ? 'pointer' : 'not-allowed',
                      background: aiPrompt.trim()
                        ? 'linear-gradient(135deg, var(--accent), #7c3aed)'
                        : 'var(--border)',
                      color: aiPrompt.trim() ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.15s',
                      opacity: aiPrompt.trim() ? 1 : 0.6,
                    }}
                  >
                    <Sparkles size={14} /> Generate
                  </button>
                </div>
              </div>
            )}

            {/* Generating State */}
            {aiStep === 'generating' && (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <div style={{ position: 'relative', width: 48, height: 48, margin: '0 auto 20px' }}>
                  <Loader2 size={48} style={{ color: 'var(--accent)', animation: 'spin 1.2s linear infinite' }} />
                  <div style={{
                    position: 'absolute', inset: -4,
                    borderRadius: '50%',
                    border: '2px solid var(--accent)',
                    opacity: 0.3,
                    animation: 'pulse-ring 1.5s ease-out infinite',
                  }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                  Generating your template...
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-dot 1.5s infinite' }} />
                    Sending prompt to AI...
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border)', animation: 'pulse-dot 1.5s infinite 0.5s' }} />
                    Generating content...
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border)', animation: 'pulse-dot 1.5s infinite 1s' }} />
                    Preparing preview...
                  </div>
                </div>
              </div>
            )}

            {/* Preview State */}
            {aiStep === 'preview' && aiGeneratedContent && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{
                  padding: 16, borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                    Generated Template Preview
                  </div>
                  <EmailPreview subject={aiGeneratedContent.subject} body={aiGeneratedContent.body} />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleAiCancel}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 600, padding: '8px 14px',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                      cursor: 'pointer', background: 'transparent',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <X size={14} /> Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAiRegenerate}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 600, padding: '8px 14px',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-border)',
                      cursor: 'pointer', background: 'var(--accent-subtle)',
                      color: 'var(--accent)',
                    }}
                  >
                    <Sparkles size={14} /> Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={handleAiEdit}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 600, padding: '8px 14px',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                      cursor: 'pointer', background: 'var(--bg-elevated)',
                      color: 'var(--text)',
                    }}
                  >
                    <Edit2 size={14} /> Edit Before Saving
                  </button>
                  <button
                    type="button"
                    onClick={handleAiSave}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 700, padding: '8px 18px',
                      borderRadius: 'var(--radius-sm)', border: 'none',
                      cursor: 'pointer',
                      background: 'linear-gradient(135deg, var(--accent), #7c3aed)',
                      color: '#fff',
                    }}
                  >
                    <CheckCircle size={14} /> {aiMode === 'modify' ? 'Update Template' : 'Save as New Template'}
                  </button>
                </div>
              </div>
            )}

            {/* Saving State */}
            {aiStep === 'saving' && (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <Loader2 size={40} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  Saving template...
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  Please wait while we save your {aiMode === 'modify' ? 'updated' : 'new'} template
                </div>
              </div>
            )}

            {/* Complete State */}
            {aiStep === 'complete' && (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: '#059669', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                  animation: 'scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}>
                  <CheckCircle size={28} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#059669', marginBottom: 4 }}>
                  {aiMode === 'modify' ? 'Template updated successfully!' : 'Template created successfully!'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {aiGeneratedContent?.name}
                </div>
              </div>
            )}
          </div>

          <style>{`
            @keyframes pulse-ring {
              0% { transform: scale(1); opacity: 0.3; }
              100% { transform: scale(1.5); opacity: 0; }
            }
            @keyframes pulse-dot {
              0%, 100% { opacity: 0.4; transform: scale(0.8); }
              50% { opacity: 1; transform: scale(1.2); }
            }
            @keyframes scale-in {
              0% { transform: scale(0); }
              100% { transform: scale(1); }
            }
          `}</style>
        </div>
      )}

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Body</label>
                <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => setAddBodyTab('edit')}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: addBodyTab === 'edit' ? 'var(--accent)' : 'transparent',
                      color: addBodyTab === 'edit' ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.12s',
                    }}
                  >Edit</button>
                  <button
                    type="button"
                    onClick={() => setAddBodyTab('preview')}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: addBodyTab === 'preview' ? 'var(--accent)' : 'transparent',
                      color: addBodyTab === 'preview' ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.12s',
                    }}
                  >Preview</button>
                  <button
                    type="button"
                    onClick={() => setShowImagePanel(showImagePanel === 'add' ? null : 'add')}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: showImagePanel === 'add' ? 'var(--accent)' : 'transparent',
                      color: showImagePanel === 'add' ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.12s',
                      display: 'flex', alignItems: 'center', gap: 3,
                    }}
                  ><Image size={13} /> Image</button>
                </div>
              </div>
              {showImagePanel === 'add' && <ImageInsertPanel target="add" />}
              {addBodyTab === 'edit' ? (
                <textarea
                  ref={addTextareaRef}
                  className="textarea"
                  value={addForm.body}
                  onChange={e => setAddForm({ ...addForm, body: e.target.value })}
                  style={{ minHeight: 300, fontSize: 13, fontFamily: 'monospace', width: '100%', boxSizing: 'border-box' }}
                  placeholder={'<!-- HTML email body -->\n\n<p>Hello [USER_NAME],</p>\n<p>Your message here.</p>\n<p>Best,<br/>Support Team</p>'}
                />
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  {addForm.body ? (
                    <AutoResizeIframe srcDoc={interpolate(addForm.body)} minHeight={300} title="Add form HTML preview" />
                  ) : (
                    <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13, background: '#fff' }}>
                      Enter HTML content to see a preview
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => { setIsAdding(false); setAddForm({ name: '', subject: '', body: '' }); setAddBodyTab('edit'); }}>Cancel</button>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t.name}</span>
                    <TemplateBadge t={t} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(t)} title="Edit"><Edit2 size={13} /></button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(t)} title={t.is_default ? 'Reset to default' : 'Delete'} style={{ color: 'var(--danger)' }}><Trash size={13} /></button>
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
                    <HTMLPreview body={t.body} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(t.body); showAlert('Body copied to clipboard'); }}>
                        <Copy size={12} style={{ marginRight: 4 }} /> Copy Body
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleEdit(t); }}>
                        <Edit2 size={12} style={{ marginRight: 4 }} /> Edit
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setFullPreviewTemplate(t); }}>
                        <Maximize2 size={12} style={{ marginRight: 4 }} /> Full Preview
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {templates.length === 0 && !templatesLoading && (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            No email templates yet. Click "Add Template" to create one.
          </div>
        )}
      </div>

      {editingTemplate && (
        <Modal title={`Edit: ${editingTemplate.name}`} onClose={() => setEditingTemplate(null)} maxWidth="680px">
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Subject Line</label>
              <input className="input" value={editForm.subject} onChange={e => setEditForm({ ...editForm, subject: e.target.value })} required style={{ fontSize: 14 }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Body Content</label>
                <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => setEditBodyTab('edit')}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: editBodyTab === 'edit' ? 'var(--accent)' : 'transparent',
                      color: editBodyTab === 'edit' ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.12s',
                    }}
                  >Edit</button>
                  <button
                    type="button"
                    onClick={() => setEditBodyTab('preview')}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: editBodyTab === 'preview' ? 'var(--accent)' : 'transparent',
                      color: editBodyTab === 'preview' ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.12s',
                    }}
                  >Preview</button>
                  <button
                    type="button"
                    onClick={() => setShowImagePanel(showImagePanel === 'edit' ? null : 'edit')}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: showImagePanel === 'edit' ? 'var(--accent)' : 'transparent',
                      color: showImagePanel === 'edit' ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.12s',
                      display: 'flex', alignItems: 'center', gap: 3,
                    }}
                  ><Image size={13} /> Image</button>
                </div>
              </div>
              {showImagePanel === 'edit' && <ImageInsertPanel target="edit" />}
              {editBodyTab === 'edit' ? (
                <textarea
                  ref={editTextareaRef}
                  className="textarea"
                  value={editForm.body}
                  onChange={e => setEditForm({ ...editForm, body: e.target.value })}
                  style={{ minHeight: 300, fontSize: 13, fontFamily: 'monospace', width: '100%', boxSizing: 'border-box' }}
                  required
                />
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  {editForm.body ? (
                    <AutoResizeIframe srcDoc={interpolate(editForm.body)} minHeight={300} title="Edit HTML preview" />
                  ) : (
                    <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13, background: '#fff' }}>
                      No content to preview
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditingTemplate(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-save">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {fullPreviewTemplate && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}
          onClick={() => setFullPreviewTemplate(null)}
        >
          <div
            style={{ height: 56, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderBottom: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              {fullPreviewTemplate.name} &mdash; {fullPreviewTemplate.subject}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => setFullPreviewShowSource(!fullPreviewShowSource)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 600,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--accent)', padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'opacity 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.7'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                {fullPreviewShowSource ? <Eye size={11} /> : <Code size={11} />}
                {fullPreviewShowSource ? 'View Preview' : 'View Source'}
              </button>
              <button
                type="button"
                onClick={() => setFullPreviewTemplate(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 13, fontWeight: 600,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'opacity 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.7'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                &times; Close
              </button>
            </div>
          </div>
          <div style={{ flex: 1, background: '#f4f4f4', overflow: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
            {fullPreviewShowSource ? (
              <pre style={{
                margin: 0, padding: '12px 14px',
                fontSize: 12, fontFamily: 'monospace', lineHeight: 1.5,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: '#1e1e1e', color: '#d4d4d4',
                borderRadius: 'var(--radius-sm)',
                maxHeight: 'calc(100vh - 120px)', overflow: 'auto',
              }}>
                {fullPreviewTemplate.body}
              </pre>
            ) : (
              <div style={{ maxWidth: 800, margin: '0 auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
                <iframe
                  srcDoc={interpolate(fullPreviewTemplate.body)}
                  style={{ width: '100%', height: 'calc(100vh - 120px)', border: 'none', display: 'block' }}
                  title="Full email preview"
                  sandbox=""
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
