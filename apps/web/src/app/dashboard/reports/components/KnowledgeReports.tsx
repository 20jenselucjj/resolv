'use client';

import { CardSection, MiniTable, DonutChart } from './Charts';
import { BookOpen, TrendingUp, ThumbsUp, Eye } from 'lucide-react';
import type { KnowledgeStats } from '../types';

export default function KnowledgeReports({ stats }: { stats: KnowledgeStats | null }) {
  if (!stats) {
    return (
      <div className="rp-fade" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Knowledge base stats are not available.
      </div>
    );
  }

  const published = stats.byStatus.find(s => s.status === 'published')?.count || 0;
  const totalEngagement = stats.topViewed.reduce((a, v) => a + v.helpful_count + v.not_helpful_count, 0);
  const totalHelpful = stats.topViewed.reduce((a, v) => a + v.helpful_count, 0);
  const helpfulnessRate = totalEngagement > 0 ? Math.round((totalHelpful / totalEngagement) * 100) : 0;

  const statusChartData = stats.byStatus.map(s => ({
    label: s.status,
    value: s.count,
    color: s.status === 'published' ? 'var(--success)' : s.status === 'draft' ? 'var(--warning)' : 'var(--text-muted)',
  }));

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div className="rp-card card" style={{ padding: '20px 24px', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Articles</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={16} color="var(--accent)" />
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1, marginTop: 8 }}>{stats.total}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{published} published</div>
        </div>
        <div className="rp-card card" style={{ padding: '20px 24px', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Views</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--info-bg)', border: '1px solid var(--info-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Eye size={16} color="var(--info)" />
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1, marginTop: 8 }}>
            {stats.topViewed.reduce((a, v) => a + v.views, 0)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Across top articles</div>
        </div>
        <div className="rp-card card" style={{ padding: '20px 24px', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Helpfulness</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--success-bg)', border: '1px solid var(--success-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ThumbsUp size={16} color="var(--success)" />
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: helpfulnessRate >= 80 ? 'var(--success)' : helpfulnessRate >= 50 ? 'var(--warning)' : 'var(--text)', lineHeight: 1, marginTop: 8 }}>
            {helpfulnessRate}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{totalHelpful} helpful · {totalEngagement - totalHelpful} not</div>
        </div>
        <div className="rp-card card" style={{ padding: '20px 24px', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Categories</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} color="var(--text-muted)" />
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1, marginTop: 8 }}>{stats.byCategory.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Categories with articles</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20}}>
        {/* Article status */}
        <CardSection title="Article Status" icon={BookOpen}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <DonutChart segments={statusChartData} total={stats.total} size={100} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stats.byStatus.map(s => (
                <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'capitalize' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: s.status === 'published' ? 'var(--success)' : s.status === 'draft' ? 'var(--warning)' : 'var(--text-muted)' }} />
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{s.status}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{s.count}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 32, textAlign: 'right' }}>{stats.total ? Math.round(s.count/stats.total*100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        </CardSection>

        {/* Articles by category */}
        <CardSection title="Articles by Category" icon={TrendingUp}>
          <MiniTable
            headers={['Category', 'Articles']}
            rows={stats.byCategory.map(c => [
              <span key="cat" style={{ fontSize: 12, color: 'var(--text)' }}>{c.category || 'Uncategorized'}</span>,
              <span key="cnt" style={{ fontWeight: 700 }}>{c.count}</span>,
            ])}
            emptyMessage="No articles by category."
          />
        </CardSection>
      </div>

      {/* Top viewed articles */}
      <CardSection title="Most Viewed Articles" icon={Eye}>
        <MiniTable
          headers={['Article', 'Views', 'Helpful', 'Not Helpful']}
          rows={stats.topViewed.map(v => [
            <span key="title" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{v.title}</span>,
            <span key="views" style={{ fontWeight: 700 }}>{v.views}</span>,
            <span key="helpful" style={{ color: 'var(--success)', fontWeight: 600 }}>{v.helpful_count}</span>,
            <span key="not" style={{ color: 'var(--danger)', fontWeight: 600 }}>{v.not_helpful_count}</span>,
          ])}
          emptyMessage="No articles found."
        />
      </CardSection>

      {/* Author stats */}
      {stats.authorStats.length > 0 && (
        <CardSection title="Author Contributions" icon={BookOpen}>
          <MiniTable
            headers={['Author', 'Articles', 'Total Views']}
            rows={stats.authorStats.map(a => [
              <span key="name" style={{ fontWeight: 600, fontSize: 12 }}>{a.author}</span>,
              <span key="total">{a.total}</span>,
              <span key="views" style={{ fontWeight: 700 }}>{a.total_views}</span>,
            ])}
            emptyMessage="No author data."
          />
        </CardSection>
      )}
    </div>
  );
}
