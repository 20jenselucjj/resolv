'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { SelectSearch } from '@/components/SelectSearch';
import {
  Plus, Search, Book, Eye, ThumbsUp, ThumbsDown,
  Calendar, Tag, ChevronRight, Filter, X, Clock,
  LayoutGrid, List, ArrowUpDown, TrendingUp, Star,
  FileText, SortAsc
} from 'lucide-react';

interface Article {
  id: string;
  slug: string;
  title: string;
  category: string;
  category_color?: string;
  author_name: string;
  views: number;
  helpful_count: number;
  not_helpful_count: number;
  status: 'published' | 'draft' | 'archived';
  created_at: string;
  tags: string[];
}

interface Category {
  id: string;
  name: string;
  color?: string;
}

type SortOption = 'newest' | 'most_viewed' | 'most_helpful' | 'recent_activity';
type ViewMode = 'grid' | 'list';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'most_viewed', label: 'Most Viewed' },
  { value: 'most_helpful', label: 'Most Helpful' },
  { value: 'recent_activity', label: 'Recent Activity' },
];

function getStatusStyle(status: Article['status']): { background: string; color: string; border: string } {
  switch (status) {
    case 'published':
      return { background: 'var(--success-bg)', color: 'var(--success)', border: 'var(--success)' };
    case 'draft':
      return { background: 'rgba(234,179,8,0.1)', color: '#ca8a04', border: '#ca8a04' };
    case 'archived':
      return { background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'var(--border)' };
  }
}

function sortArticles(articles: Article[], sort: SortOption): Article[] {
  const arr = [...articles];
  switch (sort) {
    case 'newest':
      return arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    case 'most_viewed':
      return arr.sort((a, b) => b.views - a.views);
    case 'most_helpful':
      return arr.sort((a, b) => b.helpful_count - a.helpful_count);
    case 'recent_activity':
      return arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    default:
      return arr;
  }
}

export default function KnowledgeBasePage() {
  const router = useRouter();
  const { user } = useStore();
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const isAdminOrAgent = user?.role === 'admin' || user?.role === 'agent';

  const fetchData = useCallback(async () => {
    setLoading(prev => prev ? prev : true);
    try {
      const [articlesRes, categoriesRes] = await Promise.all([
        api.get<{ data: Article[] }>(`/knowledge?category=${selectedCategory === 'all' ? '' : selectedCategory}&search=${encodeURIComponent(search)}`),
        api.get<{ data: Category[] }>('/categories')
      ]);
      setArticles(articlesRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Failed to fetch knowledge base data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sorted = sortArticles(articles, sortBy);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* Header with gradient */}
      <div style={{
        background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 70%, #6366f1) 100%)',
        padding: '24px 28px 20px',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 80, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, position: 'relative' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Book size={16} color="#fff" />
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#fff' }}>Knowledge Base</h1>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              {articles.length > 0 ? `${articles.length} article${articles.length !== 1 ? 's' : ''} available` : 'Browse and search articles'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* View toggle */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 3, gap: 2 }}>
              <button
                onClick={() => setViewMode('grid')}
                title="Grid view"
                style={{
                  width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: viewMode === 'grid' ? 'rgba(255,255,255,0.3)' : 'transparent',
                  color: '#fff', transition: 'background 0.2s',
                }}
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                title="List view"
                style={{
                  width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: viewMode === 'list' ? 'rgba(255,255,255,0.3)' : 'transparent',
                  color: '#fff', transition: 'background 0.2s',
                }}
              >
                <List size={13} />
              </button>
            </div>

            {isAdminOrAgent && (
              <button
                onClick={() => router.push('/dashboard/knowledge/new')}
                style={{
                  height: 34, padding: '0 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6,
                  backdropFilter: 'blur(4px)',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
              >
                <Plus size={14} />
                New Article
              </button>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div style={{ position: 'relative', maxWidth: 480 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.6)', pointerEvents: 'none' }} />
          <input
            placeholder="Search articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', height: 38, paddingLeft: 36, paddingRight: search ? 36 : 12,
              border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, fontSize: 13,
              background: 'rgba(255,255,255,0.15)', color: '#fff', outline: 'none',
              backdropFilter: 'blur(4px)', boxSizing: 'border-box',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Category Filter + Sort */}
      <div style={{
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 6, flex: 1, overflowX: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
          <button
            onClick={() => setSelectedCategory('all')}
            style={{
              padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', border: '1px solid', whiteSpace: 'nowrap', transition: 'all 0.15s',
              background: selectedCategory === 'all' ? 'var(--accent)' : 'transparent',
              color: selectedCategory === 'all' ? '#fff' : 'var(--text-secondary)',
              borderColor: selectedCategory === 'all' ? 'var(--accent)' : 'var(--border)',
            }}
          >
            All Articles
          </button>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.name;
            const color = cat.color || 'var(--accent)';
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                style={{
                  padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', border: '1px solid', whiteSpace: 'nowrap', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: isSelected ? `${color}20` : 'transparent',
                  color: isSelected ? color : 'var(--text-secondary)',
                  borderColor: isSelected ? color : 'var(--border)',
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Clear filter + Sort */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {selectedCategory !== 'all' && (
            <button
              onClick={() => setSelectedCategory('all')}
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <X size={11} />
              Clear
            </button>
          )}
          <div style={{ width: 150 }}>
            <SelectSearch
              options={SORT_OPTIONS}
              value={sortBy}
              onChange={(val) => setSortBy((val || 'newest') as SortOption)}
              placeholder="Sort by"
            />
          </div>
        </div>
      </div>

      {/* Articles */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {loading ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(320px, 1fr))' : '1fr',
            gap: 14,
          }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: viewMode === 'grid' ? 200 : 90, borderRadius: 'var(--radius-lg)' }} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '80px 20px', color: 'var(--text-muted)', textAlign: 'center',
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20, background: 'var(--bg-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
              border: '2px dashed var(--border)',
            }}>
              <FileText size={32} style={{ opacity: 0.35 }} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
              {search || selectedCategory !== 'all' ? 'No matching articles' : 'No articles yet'}
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)', maxWidth: 320, lineHeight: 1.5 }}>
              {search || selectedCategory !== 'all'
                ? 'Try adjusting your search or clearing the category filter.'
                : 'The knowledge base is empty. Create your first article to get started.'}
            </p>
            {(search || selectedCategory !== 'all') ? (
              <button
                onClick={() => { setSearch(''); setSelectedCategory('all'); }}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 13,
                  fontWeight: 500, cursor: 'pointer',
                }}
              >
                Clear filters
              </button>
            ) : isAdminOrAgent ? (
              <button
                onClick={() => router.push('/dashboard/knowledge/new')}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: 'var(--accent)', color: '#fff', fontSize: 13,
                  fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Plus size={14} />
                Create First Article
              </button>
            ) : null}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(320px, 1fr))' : '1fr',
            gap: 14,
          }}>
            {sorted.map((article) => {
              const statusStyle = getStatusStyle(article.status);
              const catColor = article.category_color || 'var(--accent)';
              return viewMode === 'grid' ? (
                /* Grid Card */
                <div
                  key={article.id}
                  onClick={() => router.push(`/dashboard/knowledge/${article.slug}`)}
                  style={{
                    padding: '18px 20px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 12,
                    cursor: 'pointer',
                    transition: 'transform 0.18s, box-shadow 0.18s, border-color 0.18s',
                    display: 'flex', flexDirection: 'column', gap: 10,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    borderLeft: `3px solid ${catColor}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                    e.currentTarget.style.borderColor = catColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.borderLeftColor = catColor;
                  }}
                >
                  {/* Top row: category badge + status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      background: `${catColor}18`, color: catColor,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: catColor }} />
                      {article.category}
                    </span>
                    {isAdminOrAgent && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: statusStyle.background, color: statusStyle.color,
                        border: `1px solid ${statusStyle.border}30`,
                        textTransform: 'capitalize',
                      }}>
                        {article.status}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 style={{
                    margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)',
                    lineHeight: 1.45, letterSpacing: '-0.01em',
                  }}>
                    {article.title}
                  </h3>

                  {/* Author + date + reading time */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: 'var(--accent)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 800, flexShrink: 0,
                      }}>
                        {article.author_name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <span>{article.author_name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={12} />
                      <span>{new Date(article.created_at).toLocaleDateString()}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} />
                      <span>1 min read</span>
                    </div>
                  </div>

                  {/* Tags */}
                  {article.tags && article.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {article.tags.slice(0, 3).map(tag => (
                        <span key={tag} style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 5,
                          background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                          border: '1px solid var(--border-subtle)',
                        }}>
                          #{tag}
                        </span>
                      ))}
                      {article.tags.length > 3 && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{article.tags.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Stats footer */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    paddingTop: 10, borderTop: '1px solid var(--border-subtle)', marginTop: 2,
                  }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                        <Eye size={12} />
                        <span>{article.views}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                        <ThumbsUp size={11} color="var(--success)" />
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>{article.helpful_count}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                        <ThumbsDown size={11} color="var(--danger)" />
                        <span style={{ color: 'var(--danger)' }}>{article.not_helpful_count}</span>
                      </div>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                  </div>
                </div>
              ) : (
                /* List Row */
                <div
                  key={article.id}
                  onClick={() => router.push(`/dashboard/knowledge/${article.slug}`)}
                  style={{
                    padding: '14px 18px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 14,
                    transition: 'box-shadow 0.18s, border-color 0.18s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    borderLeft: `3px solid ${catColor}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.09)';
                    e.currentTarget.style.borderColor = catColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.borderLeftColor = catColor;
                  }}
                >
                  {/* Category dot */}
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: catColor, flexShrink: 0 }} />

                  {/* Title area */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 7px',
                        borderRadius: 'var(--radius-full)', background: `${catColor}18`, color: catColor,
                        textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
                      }}>
                        {article.category}
                      </span>
                      {isAdminOrAgent && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '1px 7px',
                          borderRadius: 'var(--radius-full)',
                          background: statusStyle.background, color: statusStyle.color,
                          border: `1px solid ${statusStyle.border}30`,
                          textTransform: 'capitalize', flexShrink: 0,
                        }}>
                          {article.status}
                        </span>
                      )}
                    </div>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {article.title}
                    </h3>
                  </div>

                  {/* Meta */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800,
                      }}>
                        {article.author_name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <span>{article.author_name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={12} />
                      <span>{new Date(article.created_at).toLocaleDateString()}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Eye size={12} />
                      <span>{article.views}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ThumbsUp size={11} color="var(--success)" />
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>{article.helpful_count}</span>
                    </div>
                    <ChevronRight size={14} style={{ opacity: 0.4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
