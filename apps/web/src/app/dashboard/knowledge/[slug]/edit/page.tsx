'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api, API_BASE, getToken } from '@/lib/api';
import { useStore } from '@/lib/store';
import {
  ArrowLeft, AlertTriangle, Tag, FileText,
  Type, X, Layout, Send, Save, History, Eye, Edit3,
  Paperclip, Upload, File, Image, Download
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

interface Attachment {
  id: string;
  filename: string;
  size: number;
  mime_type: string;
  url: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Article {
  id: string;
  slug: string;
  title: string;
  body: string;
  category: string;
  status: 'published' | 'draft' | 'archived';
  tags: string[];
}

export default function EditArticlePage() {
  const router = useRouter();
  const { slug } = useParams();
  const { user } = useStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    title: '',
    body: '',
    category: '',
    tags: [] as string[],
    status: 'published' as 'published' | 'draft' | 'archived',
  });
  const [articleId, setArticleId] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'agent') {
      router.push('/dashboard/knowledge');
    }
  }, [user, router]);

  const fetchArticle = useCallback(async () => {
    try {
      const res = await api.get<{ data: Article }>(`/knowledge/${slug}`);
      const data = res.data;
      setArticleId(data.id);
      setForm({
        title: data.title,
        body: data.body,
        category: data.category,
        tags: data.tags || [],
        status: data.status,
      });
    } catch {
      setError('Failed to load article');
    } finally {
      setFetching(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchArticle();
    api.get<{ data: Category[] }>('/categories').then(res => setCategories(res.data || [])).catch(console.error);
  }, [fetchArticle]);

  const fetchAttachments = useCallback(async (id: string) => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const res = await api.get<{ data: any[] }>(`/knowledge/${id}/attachments`);
      setAttachments((res.data || []).map((att: any) => ({
        id: att.id,
        filename: att.original_name || att.filename,
        size: att.size_bytes || att.size,
        mime_type: att.mime_type,
        url: `${apiBase}/knowledge/attachments/${att.id}/download`,
        created_at: att.created_at,
      })));
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    if (articleId) fetchAttachments(articleId);
  }, [articleId, fetchAttachments]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !articleId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = typeof window !== 'undefined' ? getToken() : null;
      const res = await fetch(`${API_BASE}/knowledge/${articleId}/attachments`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      await fetchAttachments(articleId);
    } catch {
      setError('Failed to upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function deleteAttachment(id: string) {
    try {
      await api.delete(`/knowledge/attachments/${id}`);
      setAttachments(prev => prev.filter(a => a.id !== id));
    } catch {
      setError('Failed to delete attachment');
    }
  }

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

  async function handleSubmit(e: React.FormEvent, overrideStatus?: 'published' | 'draft') {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.body.trim()) { setError('Body is required'); return; }
    if (!form.category) { setError('Category is required'); return; }

    setLoading(true);
    setError('');
    
    const payload = { ...form };
    if (overrideStatus) payload.status = overrideStatus;

    try {
      await api.patch(`/knowledge/${articleId}`, payload);
      router.push(`/dashboard/knowledge/${slug}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update article');
      setLoading(false);
    }
  }

  const isValid = form.title.trim() && form.body.trim() && form.category;

  const renderPreview = () => {
    if (!form.body) return <div style={{ color: 'var(--muted)' }}>Nothing to preview</div>;
    const lines = form.body.split('\n');
    return lines.map((line, i) => {
      const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
      let text = line;
      let elType = 'p';
      let style: any = { minHeight: '1.5em', marginBottom: '1em' };
      
      if (headingMatch) {
        const level = headingMatch[1].length;
        elType = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
        text = headingMatch[2];
        style = {
          fontSize: level === 1 ? '2em' : level === 2 ? '1.5em' : '1.25em',
          fontWeight: 700,
          marginTop: '1.5em',
          marginBottom: '0.75em',
          color: 'var(--foreground)'
        };
      } else if (line.startsWith('- ')) {
        style = { ...style, display: 'list-item', marginLeft: '1.5em' };
        text = line.substring(2);
      } else if (line.trim() === '') {
        return <br key={i} />;
      }
      return React.createElement(elType, { key: i, style }, text);
    });
  };

  if (fetching) {
    return (
      <div style={{ padding: '40px', maxWidth: 900, margin: '0 auto' }}>
        <div className="skeleton" style={{ height: 48, width: '60%', marginBottom: 32 }} />
        <div className="skeleton" style={{ height: 200, width: '100%', marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 400, width: '100%' }} />
      </div>
    );
  }

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
                Edit Article
              </h1>
              <p style={{ fontSize: 15, color: 'var(--muted)', margin: 0 }}>
                Update knowledge base content
              </p>
            </div>
          </div>

          
        </div>

        <form onSubmit={e => handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
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

            {/* Status (Readonly here mostly, controlled by buttons) */}
            <div style={{ background: 'var(--card)', padding: 24, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <label style={labelStyle}>
                <Send size={14} />
                Visibility
              </label>
              <div style={{ 
                height: 48, display: 'flex', alignItems: 'center', 
                fontSize: 15, fontWeight: 600, color: 'var(--foreground)',
                textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                <span style={{ 
                  display: 'inline-block', width: 8, height: 8, borderRadius: '50%', 
                  background: form.status === 'published' ? 'var(--success)' : form.status === 'draft' ? 'var(--warning)' : 'var(--muted)',
                  marginRight: 12
                }} />
                {form.status}
              </div>
            </div>
          </div>

          {/* Body with Preview Toggle */}
          <div style={{ background: 'var(--card)', padding: 32, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>
                <FileText size={14} />
                Article Content <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              
              <div style={{ display: 'flex', background: 'var(--background)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: 4 }}>
                <button 
                  type="button"
                  onClick={() => setViewMode('edit')}
                  className={`btn ${viewMode === 'edit' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ height: 32, padding: '0 16px', fontSize: 13, gap: 6 }}
                >
                  <Edit3 size={14} /> Edit
                </button>
                <button 
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className={`btn ${viewMode === 'preview' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ height: 32, padding: '0 16px', fontSize: 13, gap: 6 }}
                >
                  <Eye size={14} /> Preview
                </button>
              </div>
            </div>

            {viewMode === 'edit' ? (
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Write your article content here in Markdown..."
                className="textarea"
                style={{ fontSize: 16, lineHeight: 1.7, minHeight: 400, padding: 24, background: 'var(--background)', resize: 'vertical' }}
              />
            ) : (
              <div style={{ minHeight: 400, padding: 24, background: 'var(--background)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 16, lineHeight: 1.7 }}>
                {renderPreview()}
              </div>
            )}
          </div>

          {/* Attachments */}
          <div style={{ background: 'var(--card)', padding: 24, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <label style={labelStyle}>
              <Paperclip size={14} />
              Attachments
            </label>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn btn-ghost"
              style={{ height: 40, padding: '0 16px', fontSize: 14, gap: 8, border: '1px dashed var(--border)', width: '100%', justifyContent: 'center' }}
            >
              {uploading ? (
                <div style={{ width: 16, height: 16, border: '2px solid var(--muted)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <Upload size={16} />
              )}
              {uploading ? 'Uploading...' : 'Upload File'}
            </button>
            {attachments.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {attachments.map(att => (
                  <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                    {att.mime_type.startsWith('image/') ? (
                      <img src={att.url} alt={att.filename} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                    ) : (
                      <File size={20} style={{ flexShrink: 0, color: 'var(--muted)' }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatFileSize(att.size)}</div>
                    </div>
                    <a href={att.url} download={att.filename} style={{ display: 'flex', color: 'var(--muted)', padding: 4 }}>
                      <Download size={16} />
                    </a>
                    <button
                      type="button"
                      onClick={() => deleteAttachment(att.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 4 }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tags */}
          <div style={{ background: 'var(--card)', padding: 24, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <label style={labelStyle}>
              <Tag size={14} />
              Tags
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>Press Enter or comma to add</span>
            </label>
            <div
              style={{
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

          {/* Action Buttons */}
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
              Save Changes
            </button>

            {form.status === 'draft' && (
              <button
                type="button"
                onClick={(e) => handleSubmit(e, 'published')}
                disabled={loading || !isValid}
                className="btn btn-success"
                style={{ padding: '0 32px', height: 56, fontSize: 16, gap: 12 }}
              >
                <Send size={20} /> Publish Now
              </button>
            )}

            {form.status === 'published' && (
              <button
                type="button"
                onClick={(e) => handleSubmit(e, 'draft')}
                disabled={loading || !isValid}
                className="btn btn-ghost"
                style={{ padding: '0 32px', height: 56, fontSize: 16, gap: 12, color: 'var(--warning)' }}
              >
                Convert to Draft
              </button>
            )}

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
