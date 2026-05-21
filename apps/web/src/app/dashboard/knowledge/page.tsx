'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import {
  Plus, Search, Book, Eye, ThumbsUp, ThumbsDown, 
  Calendar, Tag, ChevronRight, Filter, X
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

export default function KnowledgeBasePage() {
  const router = useRouter();
  const { user } = useStore();
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--bg-secondary)',
        flexShrink: 0,
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Knowledge Base</h1>
        </div>

        <div style={{ position: 'relative', width: 280 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            placeholder="Search articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            style={{ paddingLeft: 30, height: 32, fontSize: 12 }}
          />
        </div>

        {isAdminOrAgent && (
          <button
            onClick={() => router.push('/dashboard/knowledge/new')}
            className="btn btn-primary"
            style={{ height: 32, padding: '0 12px' }}
          >
            <Plus size={14} />
            New Article
          </button>
        )}
      </div>

      {/* Category Filter Pills */}
      <div style={{
        padding: '12px 24px',
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border-subtle)',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
      }}>
        <button
          onClick={() => setSelectedCategory('all')}
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            border: '1px solid',
            transition: 'all var(--transition)',
            background: selectedCategory === 'all' ? 'var(--accent)' : 'var(--bg-secondary)',
            color: selectedCategory === 'all' ? '#fff' : 'var(--text-secondary)',
            borderColor: selectedCategory === 'all' ? 'var(--accent)' : 'var(--border)',
          }}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.name)}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              border: '1px solid',
              transition: 'all var(--transition)',
              background: selectedCategory === cat.name ? 'var(--accent)' : 'var(--bg-secondary)',
              color: selectedCategory === cat.name ? '#fff' : 'var(--text-secondary)',
              borderColor: selectedCategory === cat.name ? 'var(--accent)' : 'var(--border)',
            }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Articles Grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-lg)' }} />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '80px 0',
            color: 'var(--text-muted)'
          }}>
            <Book size={48} style={{ marginBottom: 16, opacity: 0.2 }} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>No articles found</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13 }}>
              {search || selectedCategory !== 'all' ? 'Try adjusting your filters' : 'Start by creating your first Knowledge Base article'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {articles.map((article) => (
              <div
                key={article.id}
                onClick={() => router.push(`/dashboard/knowledge/${article.slug}`)}
                style={{
                  padding: '20px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, border-color 0.2s, shadow 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-border)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: article.category_color ? `${article.category_color}20` : 'var(--accent-subtle)',
                    color: article.category_color || 'var(--accent)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em'
                  }}>
                    {article.category}
                  </span>
                  {isAdminOrAgent && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      background: article.status === 'published' ? 'var(--success-bg)' : 'var(--bg-tertiary)',
                      color: article.status === 'published' ? 'var(--success)' : 'var(--text-muted)',
                      border: `1px solid ${article.status === 'published' ? 'var(--success)' : 'var(--border)'}20`
                    }}>
                      {article.status}
                    </span>
                  )}
                </div>

                <h3 style={{ 
                  margin: 0, 
                  fontSize: 15, 
                  fontWeight: 600, 
                  color: 'var(--text)',
                  lineHeight: 1.4
                }}>
                  {article.title}
                </h3>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
                      {article.author_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span>{article.author_name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                    <Calendar size={13} />
                    <span>{new Date(article.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  paddingTop: 12,
                  borderTop: '1px solid var(--border-subtle)',
                  marginTop: 4
                }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                      <Eye size={12} />
                      <span>{article.views}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                      <ThumbsUp size={11} color="var(--success)" />
                      <span>{article.helpful_count}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                      <ThumbsDown size={11} color="var(--danger)" />
                      <span>{article.not_helpful_count}</span>
                    </div>
                  </div>
                  
                  {article.tags && article.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {article.tags.slice(0, 2).map(tag => (
                        <span key={tag} style={{ fontSize: 10, color: 'var(--text-muted)' }}>#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
