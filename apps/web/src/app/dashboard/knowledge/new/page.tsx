'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { WYSIWYGEditor } from '@/components/WYSIWYGEditor';
import { 
  ArrowLeft, AlertTriangle, FileText, 
  Type, Layout, Globe, Save, Link as LinkIcon, Clock, Check
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
    category_id: '',
    status: 'published' as 'published' | 'draft',
  });
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
  }, [form.title, form.body]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.body.trim()) { setError('Body is required'); return; }
    if (!form.category_id) { setError('Category is required'); return; }

    setLoading(true);
    setError('');
    try {
      const { category_id, status } = form;
      const payload = { title: form.title, body: form.body, category_id, status };
      const res = await api.post<{ data: { id: string; slug: string } }>('/knowledge', payload);
      router.push(`/dashboard/knowledge/${res.data.slug}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create article');
      setLoading(false);
    }
  }

  const isValid = form.title.trim() && form.body.trim() && form.category_id;

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
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="select"
                style={{ height: 48, fontSize: 15 }}
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div style={{ background: 'var(--card)', padding: 24, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <label style={labelStyle}>
                <Globe size={14} />
                Access
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'published' | 'draft' })}
                className="select"
                style={{ height: 48, fontSize: 15 }}
              >
                <option value="published">All users — published</option>
                <option value="draft">Agents &amp; admins — draft</option>
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
            <WYSIWYGEditor
              value={form.body}
              onChange={(val) => setForm({ ...form, body: val })}
              height={450}
              placeholder="Write your article content here..."
            />
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
