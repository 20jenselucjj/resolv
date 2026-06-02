'use client';

import { CardSection, MiniTable, DonutChart, BarChart } from './Charts';
import { Brain, Bot, AlertTriangle, Target, ThumbsUp, Zap } from 'lucide-react';
import type { AIAnalytics } from '../types';

export default function AIReports({ stats }: { stats: AIAnalytics | null }) {
  if (!stats) {
    return (
      <div className="rp-fade" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        AI analytics are not available. Enable AI training to see analytics.
      </div>
    );
  }

  const { summary } = stats;
  const confidencePct = Math.round(summary.avg_confidence * 100);

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div className="rp-card card" style={{ padding: '20px 24px', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Queries</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={16} color="var(--accent)" />
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1, marginTop: 8 }}>{summary.total_queries}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>AI RAG queries processed</div>
        </div>
        <div className="rp-card card" style={{ padding: '20px 24px', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confidence</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--success-bg)', border: '1px solid var(--success-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ThumbsUp size={16} color="var(--success)" />
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: confidencePct >= 80 ? 'var(--success)' : confidencePct >= 60 ? 'var(--warning)' : 'var(--danger)', lineHeight: 1, marginTop: 8 }}>
            {confidencePct}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Avg confidence score</div>
        </div>
        <div className="rp-card card" style={{ padding: '20px 24px', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Flagged</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={16} color="var(--danger)" />
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: summary.flagged_count > 0 ? 'var(--danger)' : 'var(--text)', lineHeight: 1, marginTop: 8 }}>{summary.flagged_count}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Flagged for review</div>
        </div>
        <div className="rp-card card" style={{ padding: '20px 24px', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Knowledge Sources</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--info-bg)', border: '1px solid var(--info-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={16} color="var(--info)" />
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1, marginTop: 8 }}>{summary.active_sources}<span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>/{summary.total_sources}</span></div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Active / Total sources</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20 }}>
        {/* Daily query volume */}
        {stats.daily_volume.length > 0 && (
          <CardSection title="Daily Query Volume (30 days)" icon={Zap}>
            <BarChart data={stats.daily_volume.map(d => ({ label: d.date, value: d.count }))} color="var(--accent)" />
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
