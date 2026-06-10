'use client';

import { useState, useMemo } from 'react';
import {
  BookOpen, Brain, Eye, TrendingUp, ThumbsUp, FilePlus,
  FileEdit, Bot, AlertTriangle, Clock, Search, Percent,
  ShieldAlert, ExternalLink, Star, MessageSquare, Activity,
} from 'lucide-react';
import { CardSection, MiniTable } from '../components/Charts';
import { EmptyState } from '../components/shared';
import {
  InteractiveDonutChart,
  InteractiveBarChart,
  InteractiveLineChart,
  ScorecardWidget,
} from '../components/recharts';
import type { KnowledgeStats, AIAnalytics } from '../types';

// ── Color Constants ─────────────────────────────────────────────────────────

const KB_STATUS_COLORS: Record<string, string> = {
  draft: '#F59E0B',
  published: '#16A34A',
  archived: '#6B7280',
};

const CONFIDENCE_HIGH = '#16A34A';
const CONFIDENCE_MED = '#F59E0B';
const CONFIDENCE_LOW = '#EF4444';

const HELPFUL_HIGH = '#16A34A';
const HELPFUL_MED = '#F59E0B';
const HELPFUL_LOW = '#EF4444';

// ── Helpers ─────────────────────────────────────────────────────────────────

function pinProps(
  key: string, label: string,
  isPinnedFn?: (k: string) => boolean,
  pinFn?: (k: string, l: string, t?: string) => void,
  unpinFn?: (k: string) => void,
  type: string = 'kpi',
) {
  return (isPinnedFn && pinFn && unpinFn)
    ? {
        metricKey: key,
        metricLabel: label,
        isPinned: isPinnedFn(key),
        onPin: () => pinFn(key, label, type),
        onUnpin: () => unpinFn(key),
      }
    : {};
}

function getConfidenceColor(score: number): string {
  if (score >= 80) return CONFIDENCE_HIGH;
  if (score >= 60) return CONFIDENCE_MED;
  return CONFIDENCE_LOW;
}

function getHelpfulnessColor(pct: number): string {
  if (pct >= 80) return HELPFUL_HIGH;
  if (pct >= 60) return HELPFUL_MED;
  return HELPFUL_LOW;
}

function percent(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 100) : 0;
}

// ── Sortable Table Component ───────────────────────────────────────────────

interface SortColumn {
  key: string;
  label: string;
  sortable?: boolean;
}

function SortableTable({
  columns,
  rows,
  defaultSort,
  defaultDir = 'desc',
  emptyMessage = 'No data available.',
}: {
  columns: SortColumn[];
  rows: { cells: (string | React.ReactNode)[]; raw: Record<string, any> }[];
  defaultSort?: string;
  defaultDir?: 'asc' | 'desc';
  emptyMessage?: string;
}) {
  const [sortKey, setSortKey] = useState<string>(defaultSort || columns[0]?.key || '');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultDir);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a.raw[sortKey];
      const bVal = b.raw[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                style={{
                  textAlign: 'left',
                  padding: '10px 14px',
                  fontWeight: 600,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-muted)',
                  cursor: col.sortable ? 'pointer' : 'default',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {col.label}
                {col.sortable && sortKey === col.key && (
                  <span style={{ marginLeft: 4, fontSize: 10 }}>
                    {sortDir === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, i) => (
            <tr
              key={i}
              style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {row.cells.map((cell, j) => (
                <td key={j} style={{ padding: '10px 14px' }}>{cell}</td>
              ))}
            </tr>
          ))}
          {sortedRows.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Knowledge Base Content ─────────────────────────────────────────────────

function KnowledgeContent({
  stats,
  isMetricPinned,
  handlePin,
  handleUnpin,
}: {
  stats: KnowledgeStats | null;
  isMetricPinned?: (k: string) => boolean;
  handlePin?: (k: string, l: string, t?: string) => void;
  handleUnpin?: (k: string) => void;
}) {
  const metrics = useMemo(() => {
    if (!stats) return null;

    const published = stats.byStatus.find((s) => s.status === 'published')?.count || 0;
    const draft = stats.byStatus.find((s) => s.status === 'draft')?.count || 0;
    const archived = stats.byStatus.find((s) => s.status === 'archived')?.count || 0;

    // Total views (last 30 days) from topViewed
    const totalViews = stats.topViewed.reduce((a, v) => a + v.views, 0);

    // Helpfulness metrics
    const totalEngagement = stats.topViewed.reduce((a, v) => a + v.helpful_count + v.not_helpful_count, 0);
    const totalHelpful = stats.topViewed.reduce((a, v) => a + v.helpful_count, 0);
    const selfServiceRate = totalEngagement > 0 ? percent(totalHelpful, totalEngagement) : 0;

    // Avg article rating (1-5 scale mapped from helpfulness)
    const avgRating = totalEngagement > 0
      ? Math.round(((totalHelpful / totalEngagement) * 4 + 1) * 10) / 10
      : 0;

    // Articles created/updated (last 30 days) — approximated from viewsDaily length as a proxy
    // In production, this would come from the API
    const articlesCreated = 0; // API doesn't provide this yet
    const articlesUpdated = 0;

    // Views trend from viewsDaily
    const viewsTrend = (stats.viewsDaily || []).map((d) => d.count);
    const viewsTrendChange = viewsTrend.length >= 2
      ? percent(viewsTrend[viewsTrend.length - 1], viewsTrend[0]) - 100
      : 0;

    return {
      published, draft, archived,
      totalViews, totalEngagement, totalHelpful,
      selfServiceRate, avgRating,
      articlesCreated, articlesUpdated,
      viewsTrend, viewsTrendChange,
    };
  }, [stats]);

  if (!stats || !metrics) {
    return (
      <EmptyState
        icon={<BookOpen size={32} />}
        title="Knowledge base stats are not available"
        description="Ensure knowledge base articles are created and published."
        size="md"
      />
    );
  }

  // ── Donut chart data (by status) ──────────────────────────────────
  const statusChartData = [
    { name: 'Draft', value: metrics.draft, color: KB_STATUS_COLORS.draft },
    { name: 'Published', value: metrics.published, color: KB_STATUS_COLORS.published },
    { name: 'Archived', value: metrics.archived, color: KB_STATUS_COLORS.archived },
  ].filter((s) => s.value > 0);

  // ── Top 10 viewed bar chart data ─────────────────────────────────
  const topViewedBarData = stats.topViewed.slice(0, 10).map((v) => ({
    name: v.title.length > 35 ? v.title.slice(0, 35) + '…' : v.title,
    value: v.views,
  })).reverse();

  // ── Article Effectiveness table data ─────────────────────────────
  const effectivenessRows = stats.topViewed.map((v) => {
    const helpfulPct = v.helpful_count + v.not_helpful_count > 0
      ? percent(v.helpful_count, v.helpful_count + v.not_helpful_count)
      : 0;
    const helpfulColor = getHelpfulnessColor(helpfulPct);
    return {
      cells: [
        <span key="title" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{v.title}</span>,
        <span key="views" style={{ fontWeight: 700, fontSize: 13 }}>{v.views}</span>,
        <span key="helpful" style={{ fontWeight: 600, fontSize: 13, color: HELPFUL_HIGH }}>{v.helpful_count}</span>,
        <span key="not" style={{ fontWeight: 600, fontSize: 13, color: HELPFUL_LOW }}>{v.not_helpful_count}</span>,
        <span key="pct" style={{ fontWeight: 700, fontSize: 13, color: helpfulColor }}>{helpfulPct}%</span>,
        <span key="linked" style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>,
      ] as (string | React.ReactNode)[],
      raw: {
        title: v.title,
        views: v.views,
        helpful: v.helpful_count,
        not_helpful: v.not_helpful_count,
        helpfulness_pct: helpfulPct,
        linked_tickets: 0,
      },
    };
  });

  // ── KB Search Analytics placeholder ──────────────────────────────
  const searchRows: { cells: (string | React.ReactNode)[]; raw: Record<string, any> }[] = [];

  // ── Coverage Gap Analysis placeholder ────────────────────────────
  const coverageRows: { cells: (string | React.ReactNode)[]; raw: Record<string, any> }[] = [];

  const selfServiceTarget = 40;
  const ratingTarget = 4.0;

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── KPI Row 1: 6 cards ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <ScorecardWidget
          label="Total Articles"
          value={stats.total}
          icon={BookOpen}
          iconColor="#3B82F6"
          iconBg="rgba(59,130,246,0.12)"
          accentColor="#3B82F6"
          change={{ value: metrics.published, label: 'published', isPositive: true }}
          {...pinProps('kb_total_articles', 'Total Articles', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Article Views (30d)"
          value={metrics.totalViews}
          icon={Eye}
          iconColor="#8B5CF6"
          iconBg="rgba(139,92,246,0.12)"
          accentColor="#8B5CF6"
          sparklineData={metrics.viewsTrend.map((v) => ({ value: v }))}
          sparklineColor="#8B5CF6"
          change={{
            value: Math.abs(metrics.viewsTrendChange),
            label: metrics.viewsTrendChange >= 0 ? 'vs last period' : 'vs last period',
            isPositive: metrics.viewsTrendChange >= 0,
          }}
          {...pinProps('kb_article_views', 'Article Views', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Self-Service Success"
          value={metrics.selfServiceRate}
          unit="%"
          icon={Percent}
          iconColor={metrics.selfServiceRate >= selfServiceTarget ? HELPFUL_HIGH : HELPFUL_MED}
          iconBg={metrics.selfServiceRate >= selfServiceTarget ? 'rgba(22,163,74,0.12)' : 'rgba(245,158,11,0.12)'}
          accentColor={metrics.selfServiceRate >= selfServiceTarget ? HELPFUL_HIGH : HELPFUL_MED}
          target={{ current: metrics.selfServiceRate, target: selfServiceTarget, label: `target: >${selfServiceTarget}%` }}
          {...pinProps('kb_self_service', 'Self-Service Success', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Avg Article Rating"
          value={metrics.avgRating > 0 ? metrics.avgRating.toFixed(1) : 'N/A'}
          icon={Star}
          iconColor={metrics.avgRating >= ratingTarget ? '#F59E0B' : 'var(--text-muted)'}
          iconBg={metrics.avgRating >= ratingTarget ? 'rgba(245,158,11,0.12)' : 'var(--bg-tertiary)'}
          accentColor={metrics.avgRating >= ratingTarget ? '#F59E0B' : 'var(--border)'}
          target={metrics.avgRating > 0 ? { current: metrics.avgRating * 25, target: ratingTarget * 25, label: `target: >${ratingTarget.toFixed(1)}` } : undefined}
          {...pinProps('kb_avg_rating', 'Avg Article Rating', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Articles Created (30d)"
          value={metrics.articlesCreated || '—'}
          icon={FilePlus}
          iconColor="#16A34A"
          iconBg="rgba(22,163,74,0.12)"
          accentColor="#16A34A"
          {...pinProps('kb_articles_created', 'Articles Created', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Articles Updated (30d)"
          value={metrics.articlesUpdated || '—'}
          icon={FileEdit}
          iconColor="#F59E0B"
          iconBg="rgba(245,158,11,0.12)"
          accentColor="#F59E0B"
          {...pinProps('kb_articles_updated', 'Articles Updated', isMetricPinned, handlePin, handleUnpin)}
        />
      </div>

      {/* ── Charts Row 1: Donut + Top Viewed Bar ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
        {/* Articles by Status Donut */}
        <CardSection title="Articles by Status" icon={BookOpen} {...pinProps('chart_kb_status', 'KB Articles by Status', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {statusChartData.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <BookOpen size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
              <p style={{ fontSize: 13 }}>No article status data for the current filter criteria.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 200px' }}>
                <InteractiveDonutChart
                  data={statusChartData}
                  total={stats.total}
                  totalLabel="articles"
                  height={240}
                  showExport={true}
                  onSegmentClick={(seg) => console.log('KB status clicked:', seg)}
                  exportFilename="kb-articles-by-status"
                />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <MiniTable
                  headers={['Status', 'Count', '%']}
                  rows={statusChartData.map((s) => [
                    <span key="s" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                      {s.name}
                    </span>,
                    <span key="c" style={{ fontWeight: 700 }}>{s.value}</span>,
                    <span key="p" style={{ color: 'var(--text-muted)' }}>{percent(s.value, stats.total)}%</span>,
                  ])}
                  emptyMessage="No status data."
                />
              </div>
            </div>
          )}
        </CardSection>

        {/* Top 10 Most Viewed (Horizontal Bar) */}
        <CardSection title="Top 10 Most Viewed Articles" icon={Eye} {...pinProps('chart_kb_top_viewed', 'Top Viewed Articles', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {topViewedBarData.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Eye size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
              <p style={{ fontSize: 13 }}>No article view data for the current filter criteria.</p>
            </div>
          ) : (
            <InteractiveBarChart
              data={topViewedBarData}
              layout="horizontal"
              height={Math.max(200, topViewedBarData.length * 45)}
              showExport={true}
              showGrid={false}
              onBarClick={(datum) => console.log('Article clicked:', datum)}
              exportFilename="kb-top-viewed"
              color="#3B82F6"
            />
          )}
        </CardSection>
      </div>

      {/* ── Article Effectiveness Table ─────────────────────────────── */}
      <CardSection title="Article Effectiveness" icon={ThumbsUp} {...pinProps('table_kb_effectiveness', 'Article Effectiveness', isMetricPinned, handlePin, handleUnpin, 'table')}>
        <SortableTable
          columns={[
            { key: 'title', label: 'Article Title', sortable: true },
            { key: 'views', label: 'Views', sortable: true },
            { key: 'helpful', label: 'Helpful', sortable: true },
            { key: 'not_helpful', label: 'Not Helpful', sortable: true },
            { key: 'helpfulness_pct', label: 'Helpfulness %', sortable: true },
            { key: 'linked_tickets', label: 'Linked Tickets', sortable: true },
          ]}
          rows={effectivenessRows}
          defaultSort="views"
          emptyMessage="No article effectiveness data available."
        />
        <div style={{ marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: HELPFUL_HIGH }} />
            {'>'}80% helpful
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: HELPFUL_MED }} />
            60-80% helpful
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: HELPFUL_LOW }} />
            {'<'}60% helpful
          </div>
        </div>
      </CardSection>

      {/* ── KB Search Analytics Table ──────────────────────────────── */}
      <CardSection title="KB Search Analytics" icon={Search} {...pinProps('table_kb_search', 'KB Search Analytics', isMetricPinned, handlePin, handleUnpin, 'table')}>
        {searchRows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Search size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
            <p style={{ fontSize: 13 }}>Search analytics data is not yet available. Enable KB search logging to track search terms and click-through rates.</p>
          </div>
        ) : (
          <SortableTable
            columns={[
              { key: 'term', label: 'Search Term', sortable: true },
              { key: 'search_count', label: 'Search Count', sortable: true },
              { key: 'results_found', label: 'Results Found', sortable: true },
              { key: 'click_through_pct', label: 'Click-Through %', sortable: true },
            ]}
            rows={searchRows}
            defaultSort="search_count"
            emptyMessage="No search analytics data available."
          />
        )}
      </CardSection>

      {/* ── Coverage Gap Analysis Table ────────────────────────────── */}
      <CardSection title="Coverage Gap Analysis" icon={ShieldAlert} {...pinProps('table_kb_coverage_gaps', 'Coverage Gap Analysis', isMetricPinned, handlePin, handleUnpin, 'table')}>
        {coverageRows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <ShieldAlert size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
            <p style={{ fontSize: 13 }}>Coverage gap analysis is not yet available. Enable ticket-to-KB matching to identify categories with gaps.</p>
          </div>
        ) : (
          <SortableTable
            columns={[
              { key: 'category', label: 'Category', sortable: true },
              { key: 'tickets_without_article', label: 'Tickets Without KB Article', sortable: true },
              { key: 'pct_of_total', label: '% of Total', sortable: true },
            ]}
            rows={coverageRows}
            defaultSort="tickets_without_article"
            emptyMessage="No coverage gap data available."
          />
        )}
      </CardSection>
    </div>
  );
}

// ── AI & Chatbot Content ───────────────────────────────────────────────────

function AIContent({
  stats,
  isMetricPinned,
  handlePin,
  handleUnpin,
}: {
  stats: AIAnalytics | null;
  isMetricPinned?: (k: string) => boolean;
  handlePin?: (k: string, l: string, t?: string) => void;
  handleUnpin?: (k: string) => void;
}) {
  const metrics = useMemo(() => {
    if (!stats) return null;

    const { summary } = stats;
    const confidencePct = Math.round(summary.avg_confidence * 100);

    // Daily volume trend
    const dailyVolume = (stats.daily_volume || []).map((d) => ({ value: d.count }));
    const totalDailyVolume = stats.daily_volume.reduce((a, d) => a + d.count, 0);
    const avgDailyVolume = stats.daily_volume.length > 0
      ? Math.round(totalDailyVolume / stats.daily_volume.length)
      : 0;

    // Trend direction
    const volumeTrend = dailyVolume.length >= 7
      ? percent(dailyVolume.slice(-7).reduce((a, v) => a + v.value, 0) / 7,
               dailyVolume.slice(0, 7).reduce((a, v) => a + v.value, 0) / 7) - 100
      : 0;

    // Confidence distribution from recent_queries
    const distBins = [
      { range: '0-20%', min: 0, max: 0.2, count: 0, color: CONFIDENCE_LOW },
      { range: '20-40%', min: 0.2, max: 0.4, count: 0, color: CONFIDENCE_LOW },
      { range: '40-60%', min: 0.4, max: 0.6, count: 0, color: CONFIDENCE_MED },
      { range: '60-80%', min: 0.6, max: 0.8, count: 0, color: CONFIDENCE_MED },
      { range: '80-100%', min: 0.8, max: 1.0, count: 0, color: CONFIDENCE_HIGH },
    ];
    (stats.recent_queries || []).forEach((q) => {
      const bin = distBins.find((b) => q.confidence_score >= b.min && q.confidence_score < b.max);
      if (bin) bin.count++;
    });

    // Top queries aggregated
    const queryMap = new Map<string, { count: number; totalConfidence: number; flagged: number }>();
    (stats.recent_queries || []).forEach((q) => {
      const key = q.query.toLowerCase().trim();
      const existing = queryMap.get(key);
      if (existing) {
        existing.count++;
        existing.totalConfidence += q.confidence_score;
        if (q.flagged_for_review) existing.flagged++;
      } else {
        queryMap.set(key, { count: 1, totalConfidence: q.confidence_score, flagged: q.flagged_for_review ? 1 : 0 });
      }
    });
    const topQueries = Array.from(queryMap.entries())
      .map(([query, data]) => ({
        query,
        count: data.count,
        avgConfidence: Math.round((data.totalConfidence / data.count) * 100),
        flaggedPct: Math.round((data.flagged / data.count) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Performance by category — derive from source_stats
    const catMap = new Map<string, { count: number; totalConfidence: number }>();
    (stats.source_stats || []).forEach((s) => {
      const cat = s.category || 'Uncategorized';
      const existing = catMap.get(cat);
      if (existing) {
        existing.count += s.query_hits;
        // Use chunk_count as a proxy for quality/confidence per category
        existing.totalConfidence += (s.chunk_count > 0 ? Math.min(s.query_hits / s.chunk_count, 1) : 0.5) * s.query_hits;
      } else {
        catMap.set(cat, {
          count: s.query_hits,
          totalConfidence: (s.chunk_count > 0 ? Math.min(s.query_hits / s.chunk_count, 1) : 0.5) * s.query_hits,
        });
      }
    });
    const perfByCategory = Array.from(catMap.entries())
      .map(([category, data]) => ({
        category: category.charAt(0).toUpperCase() + category.slice(1),
        queryCount: data.count,
        avgConfidence: Math.round((data.totalConfidence / data.count) * 100) || 0,
      }))
      .sort((a, b) => b.queryCount - a.queryCount);

    // Avg response time — not in API, placeholder
    const avgResponseTime = null;
    const deflectionRate = null;

    return {
      confidencePct,
      totalDailyVolume,
      avgDailyVolume,
      volumeTrend,
      dailyVolumeData: dailyVolume,
      distBins,
      topQueries,
      perfByCategory,
      avgResponseTime,
      deflectionRate,
    };
  }, [stats]);

  if (!stats || !metrics) {
    return (
      <EmptyState
        icon={<Brain size={32} />}
        title="AI analytics are not available"
        description="Enable AI training and allow users to interact with the AI assistant to generate analytics."
        size="md"
      />
    );
  }

  const { summary } = stats;
  const confidenceColor = getConfidenceColor(metrics.confidencePct);

  // ── Daily volume line chart data ──────────────────────────────────
  const dailyLineData = (stats.daily_volume || []).map((d) => ({
    name: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    queries: d.count,
  }));

  // ── Confidence distribution chart ─────────────────────────────────
  const confidenceDistData = metrics.distBins.map((b) => ({
    name: b.range,
    value: b.count,
    color: b.color,
  }));

  // ── Top queries table ─────────────────────────────────────────────
  const topQueryRows = metrics.topQueries.map((q) => ({
    cells: [
      <span key="q" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{q.query}</span>,
      <span key="c" style={{ fontWeight: 700 }}>{q.count}</span>,
      <span key="conf" style={{ fontWeight: 600, color: getConfidenceColor(q.avgConfidence) }}>{q.avgConfidence}%</span>,
      <span key="fl" style={{ fontWeight: 600, color: q.flaggedPct > 10 ? CONFIDENCE_LOW : 'var(--text-muted)' }}>{q.flaggedPct}%</span>,
    ] as (string | React.ReactNode)[],
    raw: {
      query: q.query,
      count: q.count,
      avg_confidence: q.avgConfidence,
      flagged_pct: q.flaggedPct,
    },
  }));

  // ── Flagged queries table ─────────────────────────────────────────
  const flaggedQueryRows = (stats.flagged_queries || []).map((fq) => {
    // Find matching recent query for confidence score
    const match = (stats.recent_queries || []).find((rq) => rq.id === fq.id);
    const confidenceScore = match ? Math.round(match.confidence_score * 100) : 0;
    return {
      cells: [
        <span key="q" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{fq.query}</span>,
        <span key="c" style={{ fontWeight: 600, color: getConfidenceColor(confidenceScore) }}>{confidenceScore}%</span>,
        <span key="r" style={{ fontSize: 12, color: 'var(--text-muted)' }}>Low confidence / Needs review</span>,
        <span key="d" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(fq.created_at).toLocaleDateString()}</span>,
        <button
          key="act"
          onClick={() => console.log('Review flagged query:', fq.id)}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <ExternalLink size={11} /> Review
        </button>,
      ] as (string | React.ReactNode)[],
      raw: {
        query: fq.query,
        confidence: confidenceScore,
        reason: 'Low confidence',
        date: fq.created_at,
        id: fq.id,
      },
    };
  });

  // ── AI Performance by Category bar chart ──────────────────────────
  const perfBarData = metrics.perfByCategory.map((p) => ({
    name: p.category,
    value: p.queryCount,
    color: getConfidenceColor(p.avgConfidence),
  }));

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── KPI Row: 5 cards ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
        <ScorecardWidget
          label="Total AI Queries (30d)"
          value={summary.total_queries}
          icon={Bot}
          iconColor="#3B82F6"
          iconBg="rgba(59,130,246,0.12)"
          accentColor="#3B82F6"
          sparklineData={metrics.dailyVolumeData}
          sparklineColor="#3B82F6"
          change={{ value: Math.abs(Math.round(metrics.volumeTrend)), label: 'vs last period', isPositive: metrics.volumeTrend >= 0 }}
          {...pinProps('ai_total_queries', 'Total AI Queries', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Avg Confidence Score"
          value={metrics.confidencePct}
          unit="%"
          icon={ThumbsUp}
          iconColor={confidenceColor}
          iconBg={metrics.confidencePct >= 80 ? 'rgba(22,163,74,0.12)' : metrics.confidencePct >= 60 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)'}
          accentColor={confidenceColor}
          target={{ current: metrics.confidencePct, target: 80, label: 'target: >80%' }}
          {...pinProps('ai_avg_confidence', 'Avg Confidence Score', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Flagged for Review"
          value={summary.flagged_count}
          icon={AlertTriangle}
          iconColor={summary.flagged_count > 0 ? CONFIDENCE_LOW : 'var(--text)'}
          iconBg={summary.flagged_count > 0 ? 'rgba(239,68,68,0.12)' : 'var(--bg-tertiary)'}
          accentColor={summary.flagged_count > 0 ? CONFIDENCE_LOW : 'var(--border)'}
          change={{ value: summary.flagged_count, label: summary.flagged_count > 0 ? 'needs attention' : 'clear', isPositive: summary.flagged_count === 0 }}
          {...pinProps('ai_flagged_count', 'Flagged Queries', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="AI Deflection Rate"
          value={metrics.deflectionRate !== null ? `${metrics.deflectionRate}%` : '—'}
          icon={TrendingUp}
          iconColor="#8B5CF6"
          iconBg="rgba(139,92,246,0.12)"
          accentColor="#8B5CF6"
          {...pinProps('ai_deflection_rate', 'AI Deflection Rate', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Avg Response Time"
          value={metrics.avgResponseTime !== null ? `${metrics.avgResponseTime}s` : '—'}
          icon={Clock}
          iconColor="#16A34A"
          iconBg="rgba(22,163,74,0.12)"
          accentColor="#16A34A"
          {...pinProps('ai_avg_response_time', 'Avg Response Time', isMetricPinned, handlePin, handleUnpin)}
        />
      </div>

      {/* ── Charts Row 1: Line + Histogram ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
        {/* AI Query Volume (Line Chart) */}
        <CardSection title="AI Query Volume (Last 30 Days)" icon={Activity} {...pinProps('chart_ai_volume', 'AI Query Volume', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {dailyLineData.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Activity size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
              <p style={{ fontSize: 13 }}>No query volume data for the current filter criteria.</p>
            </div>
          ) : (
            <>
              <InteractiveLineChart
                data={dailyLineData}
                series={[{ dataKey: 'queries', name: 'Daily Queries', color: '#3B82F6' }]}
                height={220}
                showExport={true}
                showGrid={true}
                xKey="name"
                exportFilename="ai-query-volume"
                onPointClick={(datum) => console.log('Volume point clicked:', datum)}
              />
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Total: {metrics.totalDailyVolume}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Avg: {metrics.avgDailyVolume}/day
                </div>
              </div>
            </>
          )}
        </CardSection>

        {/* Confidence Score Distribution */}
        <CardSection title="Confidence Score Distribution" icon={Percent} {...pinProps('chart_ai_confidence_dist', 'Confidence Distribution', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {confidenceDistData.length === 0 || confidenceDistData.every((d) => d.value === 0) ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Percent size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
              <p style={{ fontSize: 13 }}>No confidence score data for the current filter criteria.</p>
            </div>
          ) : (
            <>
              <InteractiveBarChart
                data={confidenceDistData}
                layout="vertical"
                height={220}
                showExport={true}
                showGrid={false}
                onBarClick={(datum) => console.log('Confidence bin clicked:', datum)}
                exportFilename="ai-confidence-distribution"
                colorMap={confidenceDistData.reduce((m, d) => ({ ...m, [d.name]: d.color }), {} as Record<string, string>)}
              />
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: CONFIDENCE_HIGH }} />
                  {'>'}80% High
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: CONFIDENCE_MED }} />
                  40-80% Med
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: CONFIDENCE_LOW }} />
                  {'<'}40% Low
                </div>
              </div>
            </>
          )}
        </CardSection>
      </div>

      {/* ── Top AI Queries Table ────────────────────────────────────── */}
      <CardSection title="Top AI Queries" icon={MessageSquare} {...pinProps('table_ai_top_queries', 'Top AI Queries', isMetricPinned, handlePin, handleUnpin, 'table')}>
        {topQueryRows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <MessageSquare size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
            <p style={{ fontSize: 13 }}>No query data yet. Queries will appear once users interact with the AI assistant.</p>
          </div>
        ) : (
          <SortableTable
            columns={[
              { key: 'query', label: 'Query', sortable: true },
              { key: 'count', label: 'Count', sortable: true },
              { key: 'avg_confidence', label: 'Avg Confidence', sortable: true },
              { key: 'flagged_pct', label: 'Flagged %', sortable: true },
            ]}
            rows={topQueryRows}
            defaultSort="count"
            emptyMessage="No query data available."
          />
        )}
      </CardSection>

      {/* ── Flagged Queries Table ───────────────────────────────────── */}
      <CardSection title="Flagged Queries — Needs Review" icon={AlertTriangle} {...pinProps('table_ai_flagged', 'Flagged Queries', isMetricPinned, handlePin, handleUnpin, 'table')}>
        {flaggedQueryRows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <AlertTriangle size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontWeight: 500, marginBottom: 4 }}>No queries flagged</p>
            <p style={{ fontSize: 13 }}>All AI responses are meeting confidence thresholds. No queries require review.</p>
          </div>
        ) : (
          <SortableTable
            columns={[
              { key: 'query', label: 'Query', sortable: true },
              { key: 'confidence', label: 'Confidence', sortable: true },
              { key: 'reason', label: 'Flagged Reason' },
              { key: 'date', label: 'Date', sortable: true },
              { key: 'id', label: 'Action' },
            ]}
            rows={flaggedQueryRows}
            defaultSort="date"
            emptyMessage="No flagged queries."
          />
        )}
      </CardSection>

      {/* ── AI Performance by Category (Bar Chart) ──────────────────── */}
      <CardSection title="AI Performance by Category" icon={BarChart3Icon} {...pinProps('chart_ai_perf_category', 'AI Performance by Category', isMetricPinned, handlePin, handleUnpin, 'chart')}>
        {perfBarData.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ margin: '0 auto 12px', opacity: 0.5 }}>
              <BarChart3Icon size={32} />
            </div>
            <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
            <p style={{ fontSize: 13 }}>No category performance data for the current filter criteria.</p>
          </div>
        ) : (
          <>
            <InteractiveBarChart
              data={perfBarData}
              layout="horizontal"
              height={Math.max(200, perfBarData.length * 55)}
              showExport={true}
              showGrid={false}
              onBarClick={(datum) => console.log('Category clicked:', datum)}
              exportFilename="ai-performance-by-category"
              colorMap={perfBarData.reduce((m, d) => ({ ...m, [d.name]: d.color }), {} as Record<string, string>)}
            />
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: CONFIDENCE_HIGH }} />
                {'>'}80% confidence
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: CONFIDENCE_MED }} />
                60-80% confidence
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: CONFIDENCE_LOW }} />
                {'<'}60% confidence
              </div>
            </div>
          </>
        )}
      </CardSection>
    </div>
  );
}

// ── Fix missing icon ─────────────────────────────────────────────────────────

function BarChart3Icon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="20" x2="3" y2="10" />
      <line x1="9" y1="20" x2="9" y2="4" />
      <line x1="15" y1="20" x2="15" y2="8" />
      <line x1="21" y1="20" x2="21" y2="12" />
    </svg>
  );
}

// ── Types ───────────────────────────────────────────────────────────────────

interface KnowledgeAISectionProps {
  knowledgeStats: KnowledgeStats | null;
  aiAnalytics: AIAnalytics | null;
  isAdminOrAgent: boolean;
  onExportCSV: (section: string) => void;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

type SubTab = 'knowledge' | 'ai';

const SUB_TABS: { key: SubTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
  { key: 'ai', label: 'AI & Chatbot', icon: Brain },
];

// ── Main Section ──────────────────────────────────────────────────────────────

export default function KnowledgeAISection(props: KnowledgeAISectionProps) {
  const {
    knowledgeStats,
    aiAnalytics,
    isAdminOrAgent,
    onExportCSV,
    isMetricPinned,
    handlePin,
    handleUnpin,
  } = props;

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('knowledge');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Sub-tab navigation with export */}
      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        {SUB_TABS.map((st) => (
          <button
            key={st.key}
            onClick={() => setActiveSubTab(st.key)}
            aria-label={st.label}
            aria-selected={activeSubTab === st.key}
            role="tab"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              background: activeSubTab === st.key ? 'var(--accent-subtle)' : 'transparent',
              color: activeSubTab === st.key ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            <st.icon size={16} />
            {st.label}
          </button>
        ))}
        {/* Export button */}
        <div style={{ marginLeft: 'auto' }}>
          {isAdminOrAgent && (
            <button
              onClick={() => onExportCSV(activeSubTab)}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px' }}
            >
              Export {SUB_TABS.find((t) => t.key === activeSubTab)?.label || ''}
            </button>
          )}
        </div>
      </div>

      {activeSubTab === 'knowledge' && (
        <KnowledgeContent
          stats={knowledgeStats}
          isMetricPinned={isMetricPinned}
          handlePin={handlePin}
          handleUnpin={handleUnpin}
        />
      )}

      {activeSubTab === 'ai' && (
        <AIContent
          stats={aiAnalytics}
          isMetricPinned={isMetricPinned}
          handlePin={handlePin}
          handleUnpin={handleUnpin}
        />
      )}
    </div>
  );
}
