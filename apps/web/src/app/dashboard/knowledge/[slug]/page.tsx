'use client';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { RichTextEditor } from '@/components/RichTextEditor';
import {
  ArrowLeft, Eye, ThumbsUp, ThumbsDown, 
  Calendar, Edit3, Trash2, Tag, BookOpen,
  CheckCircle2, AlertCircle, Clock, Link as LinkIcon, Printer, Search,
  ChevronRight, Home, Upload, Paperclip, File, Image, Download, BrainCircuit,
  X, Save, FileText, FileImage, FileArchive, ZoomIn, ExternalLink
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

interface Article {
  id: string;
  slug: string;
  title: string;
  body: string;
  category: string;
  category_color?: string;
  author_name: string;
  author_id: string;
  views: number;
  helpful_count: number;
  not_helpful_count: number;
  status: 'published' | 'draft' | 'archived';
  created_at: string;
  updated_at?: string;
  tags: string[];
}

interface Attachment {
  id: string;
  filename: string;
  size: number;
  mime_type: string;
  url: string;
  viewUrl: string;
  uploaded_by?: string;
  created_at: string;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export default function ArticleDetailPage() {
  const router = useRouter();
  const { slug } = useParams();
  const { user } = useStore();
  
  const [article, setArticle] = useState<Article | null>(null);
  const [related, setRelated] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackSent, setFeedbackSent] = useState<boolean | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string>('');

  // Inline edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{ title: string; body: string; tags: string[] }>({ title: '', body: '', tags: [] });
  const [editTagInput, setEditTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI sync
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Reading progress
  const [readProgress, setReadProgress] = useState(0);

  const isAdminOrAgent = user?.role === 'admin' || user?.role === 'agent';
  const isAdmin = user?.role === 'admin';

  const fetchArticle = useCallback(async () => {
    setLoading(prev => prev ? prev : true);
    try {
      const res = await api.get<{ data: Article }>(`/knowledge/${slug}`);
      const data = res.data;
      setArticle(data);
      
      // Fetch related
      try {
        const relData = await api.get<{ data: Article[] }>(`/knowledge?limit=20`);
        const allArticles = relData.data.filter(a => a.id !== data.id);
        const sameCategory = allArticles.filter(a => a.category === data.category);
        const otherCategory = allArticles.filter(a => a.category !== data.category);
        setRelated([...sameCategory, ...otherCategory].slice(0, 3));
      } catch {
        // ignore
      }

      // Fetch attachments
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        const token = typeof window !== 'undefined' ? (localStorage.getItem('resolv_token') || localStorage.getItem('token')) : null;
        const tokenParam = token ? `?token=${token}` : '';
        const attRes = await api.get<{ data: any[] }>(`/knowledge/${data.id}/attachments`);
        setAttachments((attRes.data || []).map((att: any) => ({
          id: att.id,
          filename: att.original_name || att.filename,
          size: att.size_bytes || att.size,
          mime_type: att.mime_type,
          created_at: att.created_at,
          uploaded_by: att.uploaded_by,
          url: `${apiBase}/knowledge/attachments/${att.id}/download`,
          viewUrl: `${apiBase}/knowledge/attachments/${att.id}/view${tokenParam}`,
        })));
      } catch {
        // ignore if endpoint doesn't exist yet
      }
    } catch (error) {
      console.error('Failed to fetch article:', error);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => document.getElementById('article-search')?.focus(), 10);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reading progress scroll listener
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      setReadProgress(Math.min(100, Math.max(0, progress)));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleFeedback = async (helpful: boolean) => {
    if (!article || feedbackSent !== null) return;
    try {
      await api.post(`/knowledge/${article.id}/helpful`, { helpful });
      setFeedbackSent(helpful);
      setArticle(prev => prev ? {
        ...prev,
        helpful_count: helpful ? prev.helpful_count + 1 : prev.helpful_count,
        not_helpful_count: !helpful ? prev.not_helpful_count + 1 : prev.not_helpful_count
      } : null);
    } catch (error) {
      console.error('Failed to send feedback:', error);
    }
  };

  const handleDelete = async () => {
    if (!article) return;
    setConfirmModal({
      open: true,
      title: 'Archive Article',
      message: 'Are you sure you want to archive this article?',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.patch(`/knowledge/${article.id}`, { status: 'archived' });
          router.push('/dashboard/knowledge');
        } catch (error) {
          console.error('Failed to delete article:', error);
        }
      }
    });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Inline edit handlers
  const handleStartEdit = () => {
    if (!article) return;
    setEditForm({ title: article.title, body: article.body, tags: [...(article.tags || [])] });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({ title: '', body: '', tags: [] });
    setEditTagInput('');
  };

  const handleSaveEdit = async () => {
    if (!article) return;
    setSaving(true);
    try {
      await api.patch(`/knowledge/${article.id}`, editForm);
      setIsEditing(false);
      setEditTagInput('');
      await fetchArticle();
    } catch (error) {
      console.error('Failed to save article:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = () => {
    const tag = editTagInput.trim();
    if (tag && !editForm.tags.includes(tag)) {
      setEditForm(prev => ({ ...prev, tags: [...prev.tags, tag] }));
    }
    setEditTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setEditForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  // File upload handler
  const handleFileUpload = async (file: File) => {
    if (!article) return;
    setUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = typeof window !== 'undefined' ? (localStorage.getItem('resolv_token') || localStorage.getItem('token')) : null;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const res = await fetch(`${apiBase}/knowledge/${article.id}/attachments`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setAttachments(prev => [...prev, data.data || data]);
    } catch (err) {
      setUploadError('Upload failed. Please try again.');
      console.error('File upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  // Delete attachment handler
  const handleDeleteAttachment = async (attId: string) => {
    try {
      await api.delete(`/knowledge/attachments/${attId}`);
      setAttachments(prev => prev.filter(a => a.id !== attId));
    } catch {
      console.error('Failed to delete attachment');
    }
  };

  // AI sync handler
  const handleSyncAI = async () => {
    if (!article) return;
    setSyncing(true);
    setSyncStatus('idle');
    try {
      await api.post(`/knowledge/${article.id}/sync-ai`, {});
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to sync AI:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } finally {
      setSyncing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <FileImage size={18} />;
    if (mimeType === 'application/pdf') return <FileText size={18} />;
    if (mimeType.startsWith('text/')) return <FileText size={18} />;
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('7z'))
      return <FileArchive size={18} />;
    return <File size={18} />;
  };

  const canPreview = (mimeType: string) => {
    return mimeType.startsWith('image/') || mimeType === 'application/pdf' || mimeType.startsWith('text/');
  };

  const readingTime = useMemo(() => {
    if (!article?.body) return 1;
    const words = article.body.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
  }, [article?.body]);

  const toc = useMemo(() => {
    if (!article?.body) return [];
    const lines = article.body.split('\n');
    const items: TocItem[] = [];
    lines.forEach((line, i) => {
      const match = line.match(/^(#{2,3})\s+(.*)/);
      if (match) {
        items.push({
          id: `heading-${i}`,
          level: match[1].length,
          text: match[2]
        });
      }
    });
    return items;
  }, [article?.body]);

  const renderBody = () => {
    if (!article?.body) return null;
    const lines = article.body.split('\n');

    const parseInline = (textStr: string) => {
      const tokens: { type: string; content: string; extra?: string }[] = [];
      let index = 0;
      const regex = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g;
      let match;
      while ((match = regex.exec(textStr)) !== null) {
        if (match.index > index) {
          tokens.push({ type: 'text', content: textStr.substring(index, match.index) });
        }
        if (match[1]) {
          tokens.push({ type: 'link', content: match[2], extra: match[3] });
        } else if (match[4]) {
          tokens.push({ type: 'bold', content: match[5] });
        } else if (match[6]) {
          tokens.push({ type: 'italic', content: match[7] });
        } else if (match[8]) {
          tokens.push({ type: 'code', content: match[9] });
        }
        index = regex.lastIndex;
      }
      if (index < textStr.length) {
        tokens.push({ type: 'text', content: textStr.substring(index) });
      }
      return tokens;
    };

    const renderTextWithHighlight = (str: string, key: string): React.ReactNode => {
      if (!searchQuery.trim() || searchQuery.trim().length <= 1) {
        return str;
      }
      const cleanQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${cleanQuery})`, 'gi');
      const parts = str.split(regex);
      return parts.map((part, index) => {
        const isMatch = !!part.match(regex);
        if (isMatch) {
          return (
            <mark key={`${key}-${index}`} style={{ background: 'var(--warning)', color: '#000', padding: '0 2px', borderRadius: 2 }}>
              {part}
            </mark>
          );
        }
        return part;
      });
    };

    // Resolve image URLs: if relative, prepend the API origin
    const resolveImageUrl = (url: string) => {
      if (url.startsWith('http')) return url;
      if (url.startsWith('/')) {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        const origin = apiBase.replace(/\/api\/?$/, '');
        return origin + url;
      }
      return url;
    };

    const renderInline = (textStr: string, keyPrefix: string) => {
      const tokens = parseInline(textStr);
      return tokens.map((token, j) => {
        const key = `${keyPrefix}-${j}`;
        if (token.type === 'bold') {
          return <strong key={key} style={{ fontWeight: 700 }}>{renderTextWithHighlight(token.content, key)}</strong>;
        } else if (token.type === 'italic') {
          return <em key={key} style={{ fontStyle: 'italic' }}>{renderTextWithHighlight(token.content, key)}</em>;
        } else if (token.type === 'code') {
          return <code key={key} style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', fontSize: '0.9em', fontFamily: 'monospace' }}>{token.content}</code>;
        } else if (token.type === 'link') {
          return (
            <a key={key} href={token.extra} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
              {renderTextWithHighlight(token.content, key)}
            </a>
          );
        } else {
          return <React.Fragment key={key}>{renderTextWithHighlight(token.content, key)}</React.Fragment>;
        }
      });
    };

    return lines.map((line, i) => {
      const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      const headingMatch = line.match(/^(#{2,3})\s+(.*)/);
      const blockquoteMatch = line.match(/^>\s+(.*)/);
      const isHr = line.trim() === '---';
      const numberedMatch = line.match(/^(\d+)\.\s+(.*)/);
      const bulletMatch = line.match(/^[-*]\s+(.*)/);
      
      let text = line;
      let elType = 'p';
      let style: React.CSSProperties = { minHeight: '1.5em', marginBottom: '1em' };
      let extraProps: Record<string, any> = {};

      if (imageMatch) {
        elType = 'img';
        text = '';
        style = { maxWidth: '100%', height: 'auto', borderRadius: 'var(--radius)', margin: '1.5em 0', display: 'block' };
        extraProps = { src: resolveImageUrl(imageMatch[2]), alt: imageMatch[1] || '' };
      } else if (headingMatch) {
        elType = headingMatch[1].length === 2 ? 'h2' : 'h3';
        text = headingMatch[2];
        style = {
          fontSize: elType === 'h2' ? '1.75em' : '1.35em',
          fontWeight: 700,
          marginTop: '1.5em',
          marginBottom: '0.75em',
          color: 'var(--foreground)'
        };
      } else if (blockquoteMatch) {
        elType = 'blockquote';
        text = blockquoteMatch[1];
        style = {
          borderLeft: '4px solid var(--accent)',
          paddingLeft: '1em',
          color: 'var(--muted)',
          fontStyle: 'italic',
          margin: '1.5em 0',
          lineHeight: 1.6
        };
      } else if (isHr) {
        elType = 'hr';
        text = '';
        style = {
          border: 'none',
          borderTop: '1px solid var(--border)',
          margin: '2em 0'
        };
      } else if (numberedMatch) {
        elType = 'li';
        style = { ...style, display: 'list-item', marginLeft: '1.5em', listStyleType: 'decimal' };
        text = numberedMatch[2];
      } else if (bulletMatch) {
        elType = 'li';
        style = { ...style, display: 'list-item', marginLeft: '1.5em', listStyleType: 'disc' };
        text = bulletMatch[1];
      } else if (line.trim() === '') {
        return <br key={i} />;
      }

      return React.createElement(elType, { key: i, id: `heading-${i}`, style, ...extraProps }, elType === 'img' ? null : renderInline(text, `line-${i}`));
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', maxWidth: 800, margin: '0 auto' }}>
        <div className="skeleton" style={{ height: 32, width: '60%', marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 20, width: '40%', marginBottom: 40 }} />
        <div className="skeleton" style={{ height: 200, width: '100%' }} />
      </div>
    );
  }

  if (!article) {
    return (
      <div style={{ padding: '80px', textAlign: 'center' }}>
        <AlertCircle size={48} color="var(--danger)" style={{ marginBottom: 16, opacity: 0.5, display: 'inline-block' }} />
        <h2 style={{ color: 'var(--foreground)', marginBottom: 16 }}>Article not found</h2>
        <button onClick={() => router.push('/dashboard/knowledge')} className="btn btn-ghost">
          <ArrowLeft size={14} style={{ marginRight: 6 }} /> Back to Knowledge Base
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--background)', overflow: 'auto' }}>
      
      {/* Reading Progress Bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 3,
        background: 'var(--border)', zIndex: 9998
      }}>
        <div style={{
          height: '100%', background: 'var(--accent)',
          width: `${readProgress}%`, transition: 'width 0.1s linear'
        }} />
      </div>

      {/* Top Bar */}
      <div style={{
        padding: '12px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--card)',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/dashboard/knowledge')} className="btn btn-ghost btn-sm" style={{ padding: '0 8px' }}>
            <ArrowLeft size={16} />
          </button>
          
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)', flexWrap: 'wrap' }}>
            <Home size={13} />
            <ChevronRight size={13} />
            <span>Knowledge Base</span>
            <ChevronRight size={13} />
            <span style={{ 
              background: article.category_color ? `${article.category_color}15` : 'transparent',
              color: article.category_color || 'var(--muted)',
              padding: article.category_color ? '2px 8px' : '0',
              borderRadius: 4,
              fontWeight: 500 
            }}>{article.category}</span>
            <ChevronRight size={13} />
            <span style={{ color: 'var(--foreground)', fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {article.title}
            </span>
          </div>

          {/* Estimated reading time badge */}
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 10px',
            background: 'var(--accent)15',
            color: 'var(--accent)',
            borderRadius: '99px',
            marginLeft: 8,
            whiteSpace: 'nowrap'
          }}>
            <Clock size={12} /> {readingTime} min read
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!isEditing && (
            <>
              <button 
                onClick={() => setShowSearch(!showSearch)}
                className="btn btn-ghost btn-sm"
                title="Search in article (Ctrl+F)"
              >
                <Search size={14} style={{ marginRight: 6 }} /> Find
              </button>
              <button onClick={handleCopyLink} className="btn btn-ghost btn-sm">
                {copied ? <CheckCircle2 size={14} style={{ marginRight: 6, color: 'var(--success)' }} /> : <LinkIcon size={14} style={{ marginRight: 6 }} />}
                {copied ? 'Copied!' : 'Share'}
              </button>
              <button onClick={() => window.print()} className="btn btn-ghost btn-sm">
                <Printer size={14} style={{ marginRight: 6 }} /> Print
              </button>
            </>
          )}
          
          <div style={{ width: 1, background: 'var(--border)', margin: '0 8px' }} />
          
          {/* AI Sync button (admin only) */}
          {isAdmin && !isEditing && (
            <button
              onClick={handleSyncAI}
              disabled={syncing}
              className="btn btn-ghost btn-sm"
              style={{
                gap: 6,
                color: syncStatus === 'success' ? 'var(--success)' : syncStatus === 'error' ? 'var(--danger)' : undefined
              }}
              title="Sync article to AI training"
            >
              <BrainCircuit size={14} />
              {syncing ? 'Syncing…' : syncStatus === 'success' ? 'Synced!' : syncStatus === 'error' ? 'Failed' : 'Sync AI'}
            </button>
          )}

          {/* Edit / Save / Cancel */}
          {isAdminOrAgent && !isEditing && (
            <button onClick={handleStartEdit} className="btn btn-ghost btn-sm" style={{ gap: 6 }}>
              <Edit3 size={14} /> Edit
            </button>
          )}
          {isEditing && (
            <>
              <button onClick={handleCancelEdit} className="btn btn-ghost btn-sm" style={{ gap: 6 }}>
                <X size={14} /> Cancel
              </button>
              <button onClick={handleSaveEdit} disabled={saving} className="btn btn-sm" style={{ gap: 6, background: 'var(--accent)', color: '#fff', border: 'none' }}>
                <Save size={14} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}

          {isAdmin && !isEditing && (
            <button onClick={handleDelete} className="btn btn-ghost btn-sm" style={{ gap: 6, color: 'var(--danger)' }}>
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        
        {/* Main Content */}
        <div style={{ flex: 1, padding: '40px 24px', maxWidth: 840, margin: '0 auto', width: '100%' }}>
          
          {showSearch && !isEditing && (
            <div style={{ 
              position: 'sticky', top: 24, zIndex: 5, marginBottom: 24,
              background: 'var(--card)', padding: '8px 16px', borderRadius: 'var(--radius)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 12
            }}>
              <Search size={16} color="var(--muted)" />
              <input
                id="article-search"
                autoFocus
                type="text"
                placeholder="Find in article..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 14 }}
              />
              <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                <ArrowLeft size={16} style={{ transform: 'rotate(45deg)' }} />
              </button>
            </div>
          )}

          {/* Category & Status */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '4px 12px',
              borderRadius: '99px',
              background: article.category_color ? `${article.category_color}20` : 'var(--accent)',
              color: article.category_color || 'var(--background)',
              textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              {article.category}
            </span>
            {article.status !== 'published' && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '4px 12px',
                borderRadius: '99px',
                background: 'var(--card)', color: 'var(--muted)',
                border: '1px solid var(--border)',
                textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                {article.status}
              </span>
            )}
          </div>

          {/* Title — editable or static */}
          {isEditing ? (
            <input
              type="text"
              value={editForm.title}
              onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
              style={{
                width: '100%', fontSize: 36, fontWeight: 800, color: 'var(--foreground)',
                background: 'var(--card)', border: '2px solid var(--accent)',
                borderRadius: 'var(--radius)', padding: '10px 16px',
                outline: 'none', marginBottom: 24, boxSizing: 'border-box',
                letterSpacing: '-0.02em'
              }}
            />
          ) : (
            <h1 style={{ 
              fontSize: 48, fontWeight: 800, color: 'var(--foreground)', 
              margin: '0 0 24px 0', lineHeight: 1.1, letterSpacing: '-0.03em',
              fontFamily: 'var(--font-display, inherit)'
            }}>
              {article.title}
            </h1>
          )}

          {/* Meta */}
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: 24, paddingBottom: 32,
            borderBottom: '1px solid var(--border)', marginBottom: 40
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ 
                width: 44, height: 44, borderRadius: '50%', 
                background: 'var(--accent)', color: 'var(--background)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                fontSize: 18, fontWeight: 700 
              }}>
                {article.author_name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)' }}>{article.author_name}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Author</div>
              </div>
            </div>

            <div style={{ height: 32, width: 1, background: 'var(--border)' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
                <Calendar size={14} /> Published {new Date(article.created_at).toLocaleDateString()}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: 'var(--muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Eye size={14} /> {article.views} views</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={14} /> {readingTime} min read</span>
              </div>
            </div>
          </div>

          {/* Body — editable or rendered */}
          {isEditing ? (
            <div style={{ marginBottom: 32 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
                Article Body
              </label>
              <RichTextEditor
                value={editForm.body}
                onChange={(val) => setEditForm(prev => ({ ...prev, body: val }))}
                height={500}
                preview="live"
              />
            </div>
          ) : (
            <div className="print-body" style={{ 
              fontSize: 17, lineHeight: 1.8, color: 'var(--foreground)', 
              marginBottom: 48, fontFamily: 'var(--font-body, inherit)'
            }}>
              {renderBody()}
            </div>
          )}

          {/* Tags — editable or static */}
          {isEditing ? (
            <div style={{ marginBottom: 32 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
                Tags
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {editForm.tags.map(tag => (
                  <span key={tag} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 12px', background: 'var(--accent)15',
                    border: '1px solid var(--accent)40', borderRadius: '99px',
                    fontSize: 13, color: 'var(--accent)', fontWeight: 500
                  }}>
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'var(--accent)' }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Add tag..."
                  value={editTagInput}
                  onChange={e => setEditTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                  style={{
                    flex: 1, padding: '8px 12px', fontSize: 14,
                    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    background: 'var(--card)', color: 'var(--foreground)', outline: 'none'
                  }}
                />
                <button onClick={handleAddTag} className="btn btn-ghost btn-sm">
                  Add
                </button>
              </div>
            </div>
          ) : (
            article.tags && article.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 48 }}>
                {article.tags.map(tag => (
                  <span key={tag} style={{ 
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 16px', background: 'var(--card)', 
                    border: '1px solid var(--border)', borderRadius: '99px',
                    fontSize: 13, color: 'var(--muted)', fontWeight: 500
                  }}>
                    <Tag size={12} /> {tag}
                  </span>
                ))}
              </div>
            )
          )}

          {/* File Attachments Section */}
          {!isEditing && isAdminOrAgent && (
            <div style={{
              marginBottom: 48, background: 'var(--card)', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', padding: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Paperclip size={16} /> Attachments {attachments.length > 0 && `(${attachments.length})`}
                </h3>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="btn btn-ghost btn-sm"
                  style={{ gap: 6 }}
                >
                  <Upload size={14} /> {uploading ? 'Uploading…' : 'Attach file'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                    e.target.value = '';
                  }}
                />
              </div>

              {uploadError && (
                <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={14} /> {uploadError}
                </div>
              )}

              {attachments.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--border)', borderRadius: 'var(--radius)',
                    padding: '32px', textAlign: 'center', cursor: 'pointer',
                    color: 'var(--muted)', fontSize: 14, transition: 'border-color 0.2s'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <Upload size={24} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.5 }} />
                  Drop files here or click to upload
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {attachments.map(att => {
                    const canDelete = user?.role === 'admin' || user?.role === 'agent' || att.uploaded_by === user?.id;
                    return (
                      <div key={att.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', background: 'var(--background)',
                        border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                        fontSize: 14
                      }}>
                        {/* Preview thumbnail for images */}
                        {att.mime_type.startsWith('image/') && (
                          <img
                            src={att.viewUrl}
                            alt={att.filename}
                            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0, cursor: 'pointer' }}
                            onClick={() => { setPreviewUrl(att.viewUrl); setPreviewType(att.mime_type); }}
                          />
                        )}
                        {!att.mime_type.startsWith('image/') && (
                          <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{getFileIcon(att.mime_type)}</span>
                        )}
                        <span style={{ flex: 1, color: 'var(--foreground)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                          onClick={() => { setPreviewUrl(att.viewUrl); setPreviewType(att.mime_type); }}
                        >
                          {att.filename}
                        </span>
                        <span style={{ color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {formatFileSize(att.size)}
                        </span>
                        <button
                          onClick={() => { setPreviewUrl(att.viewUrl); setPreviewType(att.mime_type); }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: 13, padding: 0
                          }}
                        >
                          <ZoomIn size={14} />
                        </button>
                        <a
                          href={att.url}
                          download={att.filename}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, textDecoration: 'none' }}
                        >
                          <Download size={14} />
                        </a>
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteAttachment(att.id)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--danger)', display: 'flex', padding: 0, opacity: 0.6,
                            }}
                            title="Delete attachment"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Preview lightbox */}
              {previewUrl && (
                <div
                  style={{
                    position: 'fixed', inset: 0, zIndex: 10000,
                    background: 'rgba(0,0,0,0.85)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    padding: 40, cursor: 'pointer',
                  }}
                  onClick={() => { setPreviewUrl(null); setPreviewType(''); }}
                >
                  <button
                    onClick={() => { setPreviewUrl(null); setPreviewType(''); }}
                    style={{
                      position: 'absolute', top: 20, right: 20,
                      background: 'rgba(255,255,255,0.15)', border: 'none',
                      color: '#fff', width: 40, height: 40, borderRadius: '50%',
                      fontSize: 22, cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <X size={22} />
                  </button>
                  {previewType.startsWith('image/') ? (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      style={{ maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : previewType === 'application/pdf' ? (
                    <iframe
                      src={previewUrl}
                      style={{ width: '90vw', height: '90vh', border: 'none', borderRadius: 8 }}
                      title="PDF Preview"
                    />
                  ) : (
                    <iframe
                      src={previewUrl}
                      style={{ width: '90vw', height: '90vh', border: 'none', borderRadius: 8 }}
                      title="File Preview"
                    />
                  )}
                  <div style={{ position: 'absolute', bottom: 24, display: 'flex', gap: 12 }}>
                    <a
                      href={previewUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: 'var(--accent)', color: '#fff',
                        padding: '12px 24px', borderRadius: 8,
                        textDecoration: 'none', fontSize: 15, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                      onClick={e => e.stopPropagation()}
                    >
                      <Download size={18} /> Download
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Feedback Section */}
          {!isEditing && (
            <div style={{ 
              background: 'var(--card)', borderRadius: 'var(--radius)', 
              padding: '32px', textAlign: 'center', border: '1px solid var(--border)'
            }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}>
                Was this article helpful?
              </h3>
              <p style={{ margin: '0 0 24px 0', fontSize: 14, color: 'var(--muted)' }}>
                Your feedback helps us improve our knowledge base.
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                <button
                  onClick={() => handleFeedback(true)}
                  disabled={feedbackSent !== null}
                  className={`btn ${feedbackSent === true ? 'btn-success' : 'btn-ghost'}`}
                  style={{ 
                    minWidth: 120, height: 44, gap: 8,
                    background: feedbackSent === true ? 'var(--success)' : undefined,
                    color: feedbackSent === true ? 'var(--background)' : undefined,
                    border: feedbackSent === true ? 'none' : '1px solid var(--border)',
                  }}
                >
                  <ThumbsUp size={16} /> Yes ({article.helpful_count})
                </button>
                <button
                  onClick={() => handleFeedback(false)}
                  disabled={feedbackSent !== null}
                  className={`btn ${feedbackSent === false ? 'btn-danger' : 'btn-ghost'}`}
                  style={{ 
                    minWidth: 120, height: 44, gap: 8,
                    background: feedbackSent === false ? 'var(--danger)' : undefined,
                    color: feedbackSent === false ? 'var(--background)' : undefined,
                    border: feedbackSent === false ? 'none' : '1px solid var(--border)',
                  }}
                >
                  <ThumbsDown size={16} /> No ({article.not_helpful_count})
                </button>
              </div>

              {feedbackSent !== null && (
                <div style={{ 
                  marginTop: 20, fontSize: 14, color: 'var(--success)', fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 
                }}>
                  <CheckCircle2 size={16} /> Thank you for your feedback!
                </div>
              )}
            </div>
          )}

          {/* Related Articles */}
          {!isEditing && related.length > 0 && (
            <div style={{ marginTop: 48, paddingTop: 48, borderTop: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 24px 0', fontSize: 24, fontWeight: 700, color: 'var(--foreground)' }}>
                Related Articles
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                {related.map(rel => (
                  <div key={rel.id} 
                    onClick={() => router.push(`/dashboard/knowledge/${rel.slug}`)}
                    style={{
                      padding: 24, background: 'var(--card)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.1)';
                      e.currentTarget.style.borderColor = 'var(--accent)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                  >
                    <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {rel.category}
                    </div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: 18, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.3 }}>
                      {rel.title}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
                      <Eye size={13} /> {rel.views} views
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* TOC Sidebar */}
        {toc.length > 0 && !isEditing && (
          <div style={{ 
            width: 280, padding: '40px 24px', borderLeft: '1px solid var(--border)',
            display: 'none', // hide on small screens
            position: 'sticky', top: 60, height: 'calc(100vh - 60px)', overflowY: 'auto'
          }} className="toc-sidebar">
            <h4 style={{ 
              margin: '0 0 20px 0', fontSize: 12, fontWeight: 700, 
              color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              <BookOpen size={14} /> On this page
            </h4>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {toc.map(item => (
                <li key={item.id} style={{ paddingLeft: (item.level - 2) * 12 }}>
                  <a 
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    style={{ 
                      textDecoration: 'none', fontSize: 14, color: 'var(--muted)', fontWeight: 500,
                      display: 'block', lineHeight: 1.4, transition: 'color 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media (min-width: 1024px) {
          .toc-sidebar { display: block !important; }
        }
        @media print {
          .toc-sidebar, .btn, [style*="sticky"] { display: none !important; }
          .print-body { color: #000 !important; }
          * { background: transparent !important; box-shadow: none !important; }
        }
      `}} />

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
