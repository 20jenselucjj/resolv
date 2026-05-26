'use client';

import { BarChart3, Activity, Zap, Flag, FileText, Users } from 'lucide-react';
import type { AnalyticsData } from './types';

interface AnalyticsTabProps {
  analytics: AnalyticsData | null;
  loading: boolean;
  handleFlagQuery: (id: string) => Promise<void>;
}

export function AnalyticsTab(props: AnalyticsTabProps) {
  const { analytics, loading, handleFlagQuery } = props;

  if (!analytics && !loading) {
    return (
      <div style={{ padding: '60px 40px', textAlign: 'center', borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', border: '1px dashed var(--border)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <BarChart3 size={28} style={{ color: 'var(--text-muted)' }} />
        </div>
        <p style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>No analytics data available</p>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
          Analytics will populate once the AI assistant begins processing queries
        </p>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px',
        padding: '20px 24px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, var(--bg) 100%)',
        borderRadius: 'var(--radius-lg)', border: '1px solid rgba(139, 92, 246, 0.2)'
      }}>
        <div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: '#8b5cf6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={18} />
            </div>
            Retrieval Analytics
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '500px' }}>
            Monitor model query hits, vector matching confidence, and flag anomalies for manual review
          </p>
        </div>
      </div>

      {/* Core KPI metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div style={{ padding: '20px', background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Queries</span>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'var(--accent-subtle)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>
            {analytics.summary.total_queries.toLocaleString()}
          </div>
        </div>

        <div style={{ padding: '20px', background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Confidence</span>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>
            {(analytics.summary.avg_confidence * 100).toFixed(1)}%
          </div>
        </div>

        <div style={{ padding: '20px', background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Flagged</span>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'var(--danger-bg)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Flag size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>
            {analytics.summary.flagged_count}
          </div>
        </div>

        <div style={{ padding: '20px', background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Sources</span>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'rgba(147, 51, 234, 0.1)', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>
            {analytics.summary.active_sources}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        {/* Daily Volume Bar Chart */}
        <div style={{ padding: '20px', background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Daily Retrieval Volume</h4>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '180px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            {analytics.daily_volume.map((d, index) => {
              const maxCount = Math.max(...analytics.daily_volume.map(day => day.count), 1);
              const percentageHeight = (d.count / maxCount) * 100;
              return (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)' }}>{d.count}</span>
                  <div
                    style={{
                      width: '60%',
                      height: `${Math.max(percentageHeight * 1.2, 4)}px`,
                      maxHeight: '140px',
                      background: `linear-gradient(to top, var(--accent) 0%, var(--accent-mid) 100%)`,
                      borderRadius: '4px 4px 0 0',
                      minHeight: '4px'
                    }}
                  />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>{d.date}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Source Usage Matrix */}
        <div style={{ padding: '20px', background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Source Retrieval Density</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 0', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source</th>
                  <th style={{ padding: '8px 0', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Hits</th>
                </tr>
              </thead>
              <tbody>
                {analytics.source_stats.map((src, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 0' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>{src.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{src.category} · {src.chunk_count} chunks</div>
                    </td>
                    <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, fontSize: '14px', color: 'var(--accent)' }}>
                      {src.query_hits}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Queries / Flagged Area */}
      <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Recent Model Inquiries</h4>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px 8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)' }}>Live</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {analytics.recent_queries.map((q) => {
            const conf = Math.round((q.confidence_score || 0) * 100) / 100;
            const confColor = conf > 85 ? 'var(--success)' : conf > 70 ? 'var(--warning)' : 'var(--danger)';
            return (
              <div key={q.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', transition: 'background 0.15s' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text)', fontStyle: 'italic' }}>
                    &ldquo;{q.query}&rdquo;
                  </p>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={11} /> {q.user_name || 'Unknown'}
                    </span>
                    <span>·</span>
                    <span>{new Date(q.created_at).toLocaleString()}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ textAlign: 'center', padding: '8px 16px', background: conf > 85 ? 'var(--success-bg)' : conf > 70 ? 'var(--warning-bg)' : 'var(--danger-bg)', borderRadius: 'var(--radius-md)', minWidth: '70px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confidence</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: confColor }}>{conf.toFixed(0)}%</div>
                  </div>

                  <button
                    disabled={q.flagged_for_review}
                    onClick={() => handleFlagQuery(q.id)}
                    style={{
                      padding: '8px 14px', borderRadius: 'var(--radius-md)', border: `1px solid ${q.flagged_for_review ? 'var(--danger-border)' : 'var(--border)'}`,
                      background: q.flagged_for_review ? 'var(--danger-bg)' : 'transparent',
                      color: q.flagged_for_review ? 'var(--danger)' : 'var(--text-secondary)',
                      fontSize: '12px', fontWeight: 600, cursor: q.flagged_for_review ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s'
                    }}
                  >
                    <Flag size={13} />
                    {q.flagged_for_review ? 'Flagged' : 'Flag'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
