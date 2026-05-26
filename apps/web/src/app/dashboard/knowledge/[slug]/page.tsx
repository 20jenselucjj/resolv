'use client';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import {
  ArrowLeft, Eye, ThumbsUp, ThumbsDown, 
  Calendar, Edit3, Trash2, Tag, BookOpen,
  CheckCircle2, AlertCircle, Clock, Link as LinkIcon, Printer, Search,
  ChevronRight, Home
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

  const isAdminOrAgent = user?.role === 'admin' || user?.role === 'agent';
  const isAdmin = user?.role === 'admin';

  const fetchArticle = useCallback(async () => {
    // Avoid synchronous state update if already loading
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
      const headingMatch = line.match(/^(#{2,3})\s+(.*)/);
      const blockquoteMatch = line.match(/^>\s+(.*)/);
      const isHr = line.trim() === '---';
      const numberedMatch = line.match(/^(\d+)\.\s+(.*)/);
      const bulletMatch = line.match(/^[-*]\s+(.*)/);
      
      let text = line;
      let elType = 'p';
      let style: React.CSSProperties = { minHeight: '1.5em', marginBottom: '1em' };
      
      if (headingMatch) {
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

      return React.createElement(elType, { key: i, id: `heading-${i}`, style }, renderInline(text, `line-${i}`));
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

        <div style={{ display: 'flex', gap: 8 }}>
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
          
          <div style={{ width: 1, background: 'var(--border)', margin: '0 8px' }} />
          
          {isAdminOrAgent && (
            <button onClick={() => router.push(`/dashboard/knowledge/${slug}/edit`)} className="btn btn-ghost btn-sm" style={{ gap: 6 }}>
              <Edit3 size={14} /> Edit
            </button>
          )}
          {isAdmin && (
            <button onClick={handleDelete} className="btn btn-ghost btn-sm" style={{ gap: 6, color: 'var(--danger)' }}>
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        
        {/* Main Content */}
        <div style={{ flex: 1, padding: '40px 24px', maxWidth: 840, margin: '0 auto', width: '100%' }}>
          
          {showSearch && (
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

          {/* Title */}
          <h1 style={{ 
            fontSize: 48, fontWeight: 800, color: 'var(--foreground)', 
            margin: '0 0 24px 0', lineHeight: 1.1, letterSpacing: '-0.03em',
            fontFamily: 'var(--font-display, inherit)'
          }}>
            {article.title}
          </h1>

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

          {/* Body */}
          <div className="print-body" style={{ 
            fontSize: 17, lineHeight: 1.8, color: 'var(--foreground)', 
            marginBottom: 48, fontFamily: 'var(--font-body, inherit)'
          }}>
            {renderBody()}
          </div>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
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
          )}

          {/* Feedback Section */}
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

          {/* Related Articles */}
          {related.length > 0 && (
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
        {toc.length > 0 && (
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
