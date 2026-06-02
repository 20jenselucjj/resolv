'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { RichTextEditor } from '@/components/RichTextEditor';
import { 
  ArrowLeft, AlertTriangle, Tag, FileText, 
  Type, X, Layout, Send, Save, Link as LinkIcon, Clock, Check, Paperclip
} from 'lucide-react';

function ConfirmModal({ open, title, message, onConfirm, onCancel, danger = true }: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 24, maxWidth: 400, width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{title}</h3>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none',
            background: danger ? 'var(--danger)' : 'var(--accent)', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

interface Category {
  id: string;
  name: string;
}

const TEMPLATES = [
  {
    id: 'how-to',
    name: 'How-to Guide',
    body: '## Overview\nBriefly explain what this guide will help the user achieve.\n\n## Prerequisites\n- Item 1\n- Item 2\n\n## Steps\n1. First step\n2. Second step\n3. Third step\n\n## Troubleshooting\nCommon issues and how to resolve them.'
  },
  {
    id: 'troubleshooting',
    name: 'Troubleshooting',
    body: '## Issue\nDescribe the problem the user is experiencing.\n\n## Symptoms\n- Symptom 1\n- Symptom 2\n\n## Cause\nExplain why this happens.\n\n## Resolution\nProvide step-by-step instructions to fix the issue.'
  },
  {
    id: 'faq',
    name: 'FAQ',
    body: '## Question 1\nAnswer 1\n\n## Question 2\nAnswer 2\n\n## Question 3\nAnswer 3'
  },
  {
    id: 'policy',
    name: 'Policy / Guidelines',
    body: '## Purpose\nWhy does this policy exist?\n\n## Scope\nWho does this apply to?\n\n## Policy Details\nExplain the rules or guidelines here.\n\n## Exceptions\nList any exceptions to this policy.'
  }
];

export default function NewArticlePage() {
  const router = useRouter();
  const { user } = useStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    title: '',
    body: '',
    category: '',
    tags: [] as string[],
    status: 'published' as 'published' | 'draft',
  });
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Role check
  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'agent') {
      router.push('/dashboard/knowledge');
    }
  }, [user, router]);

  useEffect(() => {
    api.get<{ data: Category[] }>('/categories')
      .then(res => setCategories(res.data || []))
      .catch(console.error);
  }, []);

  // Draft saved indicator (local state only — not persisted to server)
  useEffect(() => {
    if (!form.title && !form.body) return;
    const timer = setTimeout(() => {
      setLastSaved(new Date());
    }, 2000);
    return () => clearTimeout(timer);
  }, [form.title, form.body, form.category, form.tags]);

  const applyTemplate = (templateId: string) => {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    
    setConfirmModal({
      open: true,
      title: 'Apply Template',
      message: `Apply "${template.name}" template? This will overwrite your current body content.`,
      onConfirm: () => {
        setConfirmModal(null);
        setForm(prev => ({ ...prev, body: template.body }));
      }
    });
  };

  const generatedSlug = useMemo(() => {
    return form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  }, [form.title]);

  const readingTime = useMemo(() => {
    const words = form.body.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
  }, [form.body]);

  function addTag(tag: string) {
    const t = tag.trim().toLowerCase();
    if (t && !form.tags.includes(t)) {
      setForm((f) => ({ ...f, tags: [...f.tags, t] }));
    }
    setTagInput('');
  }

  function removeTag(tag: string) {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.body.trim()) { setError('Body is required'); return; }
    if (!form.category) { setError('Category is required'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await api.post<{ data: { id: string; slug: string } }>('/knowledge', form);
      router.push(`/dashboard/knowledge/${res.data.slug}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create article');
      setLoading(false);
    }
  }

  const isValid = form.title.trim() && form.body.trim() && form.category;

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--background)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 40 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <button onClick={() => router.back()} className="btn btn-ghost btn-sm" style={{ padding: '0 8px', marginTop: 4 }}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 8px 0', color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
                Create Article
              </h1>
              <p style={{ fontSize: 15, color: 'var(--muted)', margin: 0 }}>
                Share knowledge with your team and customers
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {lastSaved && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
                <Check size={14} color="var(--success)" /> Unsaved draft — last edited {lastSaved.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </div>
            )}
            <select 
              className="select" 
              onChange={(e) => {
                if (e.target.value) applyTemplate(e.target.value);
                e.target.value = '';
              }}
              style={{ width: 180, height: 40, background: 'var(--card)' }}
            >
              <option value="">Start from template...</option>
              {TEMPLATES.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Title Area */}
          <div style={{ background: 'var(--card)', padding: 32, borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }}>
            <label style={labelStyle}>
              <Type size={14} />
              Title <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. How to reset your password"
              className="input"
              style={{ fontSize: 24, height: 64, fontWeight: 700, border: 'none', borderBottom: '2px solid var(--border)', borderRadius: 0, padding: '0 0 8px 0', background: 'transparent' }}
            />
            
            {/* Slug Preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 13, color: 'var(--muted)' }}>
              <LinkIcon size={14} />
              <span>resolv.app/knowledge/{generatedSlug || 'your-article-slug'}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Category */}
            <div style={{ background: 'var(--card)', padding: 24, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <label style={labelStyle}>
                <Layout size={14} />
                Category <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="select"
                style={{ height: 48, fontSize: 15 }}
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div style={{ background: 'var(--card)', padding: 24, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <label style={labelStyle}>
                <Send size={14} />
                Visibility
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'published' | 'draft' })}
                className="select"
                style={{ height: 48, fontSize: 15 }}
              >
                <option value="published">Published (Visible to everyone)</option>
                <option value="draft">Draft (Visible to agents only)</option>
              </select>
            </div>
          </div>

          {/* Body */}
          <div style={{ background: 'var(--card)', padding: 32, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>
                <FileText size={14} />
                Article Content <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
                <Clock size={14} /> ~{readingTime} min read
              </div>
            </div>
            <RichTextEditor
              value={form.body}
              onChange={(val) => setForm({ ...form, body: val })}
              height={450}
              placeholder="Write your article content here..."
              preview="live"
            />
          </div>

          {/* Attachments notice */}
          <div style={{ background: 'var(--card)', padding: 20, borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Paperclip size={18} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>Attachments</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>You can add attachments after creating the article.</div>
            </div>
          </div>

          {/* Tags */}
          <div style={{ background: 'var(--card)', padding: 24, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <label style={labelStyle}>
              <Tag size={14} />
              Tags
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>Press Enter or comma to add</span>
            </label>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
              padding: '12px 16px',
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              minHeight: 56,
              cursor: 'text',
              transition: 'border-color 0.2s',
            }}
            onClick={() => document.getElementById('tag-input')?.focus()}
            >
              {form.tags.map((tag) => (
                <span key={tag} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 13, padding: '4px 12px',
                  background: 'var(--accent)', color: 'var(--background)',
                  borderRadius: '99px', fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  {tag}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--background)', display: 'flex', padding: 0, opacity: 0.8 }}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
              <input
                id="tag-input"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); }
                  if (e.key === ',') { e.preventDefault(); addTag(tagInput); }
                  if (e.key === 'Backspace' && !tagInput && form.tags.length > 0) {
                    removeTag(form.tags[form.tags.length - 1]);
                  }
                }}
                placeholder={form.tags.length === 0 ? 'e.g. guide, tutorial, faq' : ''}
                style={{
                  border: 'none', outline: 'none', background: 'none',
                  fontSize: 15, color: 'var(--foreground)', flex: 1, minWidth: 200,
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          {error && (
            <div style={{
              padding: '16px 20px',
              background: 'var(--danger)',
              borderRadius: 'var(--radius)',
              fontSize: 15, color: 'var(--background)', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <AlertTriangle size={20} />
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
            <button
              type="submit"
              disabled={loading || !isValid}
              className="btn btn-primary"
              style={{ padding: '0 32px', height: 56, fontSize: 16, gap: 12, flex: 1 }}
            >
              {loading ? (
                <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <Save size={20} />
              )}
              {form.status === 'published' ? 'Publish Article' : 'Save Draft'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="btn btn-ghost"
              style={{ padding: '0 32px', height: 56, fontSize: 16 }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {confirmModal && (
        <ConfirmModal
          open={confirmModal.open}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--muted)',
  marginBottom: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
