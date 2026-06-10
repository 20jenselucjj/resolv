'use client';

import { CardSection, MiniTable } from './Charts';
import { InteractiveBarChart, ScorecardWidget } from './recharts';
import { Brain, Bot, AlertTriangle, ThumbsUp, Zap } from 'lucide-react';
import type { AIAnalytics } from '../types';

function pinProps(key: string, label: string, isPinnedFn?: (k: string) => boolean, pinFn?: (k: string, l: string, t?: string) => void, unpinFn?: (k: string) => void, type: string = 'kpi') {
  return (isPinnedFn && pinFn && unpinFn) ? {
    metricKey: key, metricLabel: label,
    isPinned: isPinnedFn(key),
    onPin: () => pinFn(key, label, type),
    onUnpin: () => unpinFn(key),
  } : {};
}

export default function AIReports({ stats, isMetricPinned, handlePin, handleUnpin }: { stats: AIAnalytics | null; isMetricPinned?: (key: string) => boolean; handlePin?: (key: string, label: string, type?: string, config?: any) => void; handleUnpin?: (key: string) => void; }) {
  if (!stats) {
    return (
      <div className="rp-fade" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        AI analytics are not available. Enable AI training to see analytics.
      </div>
    );
  }

  const { summary } = stats;
  const confidencePct = Math.round(summary.avg_confidence * 100);

  const dailyVolumeBarData = stats.daily_volume.map(d => ({
    name: d.date,
    value: d.count,
  }));

  const confidenceColor = confidencePct >= 80 ? 'var(--success)' : confidencePct >= 60 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <ScorecardWidget
          label="Total Queries"
          value={summary.total_queries}
          icon={Bot}
          iconColor="var(--accent)"
          iconBg="var(--accent-subtle)"
          accentColor="var(--accent)"
          {...pinProps('ai_total_queries', 'Total Queries', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Confidence"
          value={confidencePct}
          unit="%"
          icon={ThumbsUp}
          iconColor={confidenceColor}
          iconBg={confidencePct >= 80 ? 'var(--success-bg)' : confidencePct >= 60 ? 'var(--warning-bg)' : 'var(--danger-bg)'}
          accentColor={confidenceColor}
          {...pinProps('ai_confidence', 'Confidence', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Flagged"
          value={summary.flagged_count}
          icon={AlertTriangle}
          iconColor={summary.flagged_count > 0 ? 'var(--danger)' : 'var(--text)'}
          iconBg={summary.flagged_count > 0 ? 'var(--danger-bg)' : 'var(--bg-tertiary)'}
          accentColor={summary.flagged_count > 0 ? 'var(--danger)' : 'var(--border)'}
          {...pinProps('ai_flagged', 'Flagged', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Knowledge Sources"
          value={`${summary.active_sources}/${summary.total_sources}`}
          icon={Brain}
          iconColor="var(--info)"
          iconBg="var(--info-bg)"
          accentColor="var(--info)"
          {...pinProps('ai_knowledge_sources', 'Knowledge Sources', isMetricPinned, handlePin, handleUnpin)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20 }}>
        {/* Daily query volume */}
        {dailyVolumeBarData.length > 0 && (
          <CardSection title="Daily Query Volume (30 days)" icon={Zap} {...pinProps('chart_ai_volume', 'AI Daily Query Volume', isMetricPinned, handlePin, handleUnpin, 'chart')}>
            <InteractiveBarChart
              data={dailyVolumeBarData}
              layout="vertical"
              height={200}
              showExport={true}
              showGrid={true}
              onBarClick={(datum) => console.log('Daily volume clicked:', datum)}
              exportFilename="ai-daily-volume"
            />
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Total: {stats.daily_volume.reduce((a, d) => a + d.count, 0)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Avg: {Math.round(stats.daily_volume.reduce((a, d) => a + d.count, 0) / stats.daily_volume.length)}/day
              </div>
            </div>
          </CardSection>
        )}

        {/* Source statistics */}
        <CardSection title="Knowledge Source Usage" icon={Brain}>
          <MiniTable
            headers={['Source', 'Chunks', 'Query Hits']}
            rows={stats.source_stats.slice(0, 10).map(s => [
              <span key="name" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{s.name}</span>,
              <span key="chunks" style={{ fontSize: 12 }}>{s.chunk_count}</span>,
              <span key="hits" style={{ fontWeight: 700 }}>{s.query_hits}</span>,
            ])}
            emptyMessage="No knowledge sources configured."
          />
        </CardSection>
      </div>

      {/* Recent flagged queries */}
      {stats.flagged_queries.length > 0 && (
        <CardSection title="Flagged Queries — Needs Review" icon={AlertTriangle}>
          <MiniTable
            headers={['Query', 'Date']}
            rows={stats.flagged_queries.map(f => [
              <span key="q" style={{ fontSize: 12, color: 'var(--text)' }}>{f.query}</span>,
              <span key="d" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(f.created_at).toLocaleDateString()}</span>,
            ])}
          />
        </CardSection>
      )}

      {/* Recent queries */}
      {stats.recent_queries.length > 0 && (
        <CardSection title="Recent AI Queries" icon={Bot}>
          <MiniTable
            headers={['Query', 'User', 'Confidence', 'Flagged']}
            rows={stats.recent_queries.slice(0, 15).map(q => [
              <span key="q" style={{ fontSize: 12, color: 'var(--text)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{q.query}</span>,
              <span key="u" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{q.user_name || 'Unknown'}</span>,
              <span key="c" style={{ fontWeight: 600, color: q.confidence_score >= 0.8 ? 'var(--success)' : q.confidence_score >= 0.5 ? 'var(--warning)' : 'var(--danger)' }}>
                {Math.round(q.confidence_score * 100)}%
              </span>,
              <span key="f" style={{ color: q.flagged_for_review ? 'var(--danger)' : 'var(--text-muted)' }}>
                {q.flagged_for_review ? '⚠ Yes' : '—'}
              </span>,
            ])}
            emptyMessage="No recent queries."
          />
        </CardSection>
      )}
    </div>
  );
}
