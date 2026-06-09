'use client';

import { CardSection, MiniTable } from './Charts';
import { InteractiveDonutChart, ScorecardWidget } from './recharts';
import { BookOpen, TrendingUp, ThumbsUp, Eye } from 'lucide-react';
import type { KnowledgeStats } from '../types';

function pinProps(key: string, label: string, isPinnedFn?: (k: string) => boolean, pinFn?: (k: string, l: string, t?: string) => void, unpinFn?: (k: string) => void, type: string = 'kpi') {
  return (isPinnedFn && pinFn && unpinFn) ? {
    metricKey: key, metricLabel: label,
    isPinned: isPinnedFn(key),
    onPin: () => pinFn(key, label, type),
    onUnpin: () => unpinFn(key),
  } : {};
}

export default function KnowledgeReports({ stats, isMetricPinned, handlePin, handleUnpin }: { stats: KnowledgeStats | null; isMetricPinned?: (key: string) => boolean; handlePin?: (key: string, label: string, type?: string, config?: any) => void; handleUnpin?: (key: string) => void; }) {
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
  const totalViews = stats.topViewed.reduce((a, v) => a + v.views, 0);

  const statusChartData = stats.byStatus.map(s => ({
    name: s.status,
    value: s.count,
    color: s.status === 'published' ? 'var(--success)' : s.status === 'draft' ? 'var(--warning)' : 'var(--text-muted)',
  }));

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <ScorecardWidget
          label="Total Articles"
          value={stats.total}
          icon={BookOpen}
          iconColor="var(--accent)"
          iconBg="var(--accent-subtle)"
          accentColor="var(--accent)"
          change={{ value: published, label: 'published', isPositive: true }}
          {...pinProps('knowledge_total', 'Total Articles', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Total Views"
          value={totalViews}
          icon={Eye}
          iconColor="var(--info)"
          iconBg="var(--info-bg)"
          accentColor="var(--info)"
          {...pinProps('knowledge_views', 'Total Views', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Helpfulness"
          value={helpfulnessRate}
          unit="%"
          icon={ThumbsUp}
          iconColor={helpfulnessRate >= 80 ? 'var(--success)' : helpfulnessRate >= 50 ? 'var(--warning)' : 'var(--text)'}
          iconBg={helpfulnessRate >= 80 ? 'var(--success-bg)' : helpfulnessRate >= 50 ? 'var(--warning-bg)' : 'var(--bg-tertiary)'}
          accentColor={helpfulnessRate >= 80 ? 'var(--success)' : helpfulnessRate >= 50 ? 'var(--warning)' : 'var(--border)'}
          {...pinProps('knowledge_helpfulness', 'Helpfulness', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Categories"
          value={stats.byCategory.length}
          icon={TrendingUp}
          iconColor="var(--text-muted)"
          iconBg="var(--bg-tertiary)"
          accentColor="var(--border)"
          {...pinProps('knowledge_categories', 'Categories', isMetricPinned, handlePin, handleUnpin)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20}}>
        {/* Article status */}
        <CardSection title="Article Status" icon={BookOpen} {...pinProps('chart_knowledge_status', 'Knowledge Article Status', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          <InteractiveDonutChart
            data={statusChartData}
            total={stats.total}
            totalLabel="articles"
            height={280}
            showExport={true}
            onSegmentClick={(seg) => console.log('Article status clicked:', seg)}
            exportFilename="knowledge-article-status"
          />
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
