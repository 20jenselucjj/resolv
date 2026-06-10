'use client';

import { useMemo } from 'react';
import {
  Target, Activity, Clock, AlertCircle, TrendingUp, TrendingDown,
  BarChart3, Star, Layers,
} from 'lucide-react';
import { ScorecardWidget } from '../components/recharts';
import { CardSection } from '../components/Charts';
import type { Ticket, TimeRange } from '../types';

// ── Format helpers ─────────────────────────────────────────────────────────────

function formatHrs(hrs: number): string {
  if (hrs <= 0) return 'N/A';
  return hrs < 24 ? `${hrs.toFixed(1)}h` : `${(hrs / 24).toFixed(1)}d`;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface ExecutiveSummaryTabProps {
  tickets: Ticket[];
  filteredTickets: Ticket[];
  timeRange: TimeRange;
  isAdminOrAgent: boolean;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

export default function ExecutiveSummaryTab({
  tickets,
  filteredTickets,
  timeRange,
  isAdminOrAgent,
  isMetricPinned,
  handlePin,
  handleUnpin,
}: ExecutiveSummaryTabProps) {
  const total = filteredTickets.length;

  // ── Computed metrics ───────────────────────────────────────────────────────
  const slaStats = useMemo(() => {
    const breached = filteredTickets.filter(t => t.sla_breached).length;
    return { breached, compliance: total ? Math.round(((total - breached) / total) * 100) : 100 };
  }, [filteredTickets, total]);

  const responseStats = useMemo(() => {
    const withResponse = filteredTickets.filter(t => t.first_response_at);
    if (!withResponse.length) return { avg: 0, formatted: 'N/A' };
    const sum = withResponse.reduce((a, t) => a + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()), 0);
    const hrs = sum / withResponse.length / 3600000;
    return { avg: hrs, formatted: hrs < 1 ? `${Math.round(hrs * 60)}m` : `${hrs.toFixed(1)}h` };
  }, [filteredTickets]);

  const resolutionStats = useMemo(() => {
    const resolved = filteredTickets.filter(t => ['resolved', 'closed'].includes(t.status.toLowerCase()));
    if (!resolved.length) return { avgHrs: 0, formatted: 'N/A' };
    const sum = resolved.reduce((a, t) => {
      const end = t.resolved_at || t.closed_at || t.updated_at;
      return a + (new Date(end).getTime() - new Date(t.created_at).getTime());
    }, 0);
    const hrs = sum / resolved.length / 3600000;
    return { avgHrs: hrs, formatted: hrs < 24 ? `${hrs.toFixed(1)}h` : `${(hrs / 24).toFixed(1)}d` };
  }, [filteredTickets]);

  const openCount = filteredTickets.filter(t => t.status === 'open').length;
  const progressCount = filteredTickets.filter(t => t.status === 'in_progress').length;
  const resolvedCount = filteredTickets.filter(t => ['resolved', 'closed'].includes(t.status.toLowerCase())).length;
  const csatAvg = useMemo(() => {
    const rated = filteredTickets.filter((t): t is Ticket & { satisfaction_rating: number } =>
      t.satisfaction_rating !== null && t.satisfaction_rating !== undefined
    );
    if (!rated.length) return null;
    const sum = rated.reduce((a, t) => a + t.satisfaction_rating, 0);
    return (sum / rated.length).toFixed(1);
  }, [filteredTickets]);

  // ── Sparkline from current tickets by created date ─────────────────────────
  const sparklineVolume = useMemo(() => {
    const dayBuckets: Record<string, number> = {};
    filteredTickets.forEach(t => {
      const d = t.created_at.split('T')[0];
      dayBuckets[d] = (dayBuckets[d] || 0) + 1;
    });
    return Object.entries(dayBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, count]) => ({ value: count }));
  }, [filteredTickets]);

  const sparklineResolved = useMemo(() => {
    const dayBuckets: Record<string, number> = {};
    filteredTickets.forEach(t => {
      if (t.resolved_at) {
        const d = t.resolved_at.split('T')[0];
        dayBuckets[d] = (dayBuckets[d] || 0) + 1;
      }
    });
    return Object.entries(dayBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, count]) => ({ value: count }));
  }, [filteredTickets]);

  // ── Avg resolution sparkline ───────────────────────────────────────────────
  const resolutionHrs = useMemo(() => {
    if (resolutionStats.avgHrs <= 0) return undefined;
    return [{ value: Math.round(resolutionStats.avgHrs) }];
  }, [resolutionStats.avgHrs]);

  // ── Top issues by category (data-driven) ──────────────────────────────────
  const topIssues = useMemo(() => {
    const categoryCounts: Record<string, number> = {};
    filteredTickets.forEach(t => {
      const cat = t.category_name || 'Uncategorized';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    return Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [filteredTickets]);

  function pinProps(key: string, label: string) {
    return (isMetricPinned && handlePin && handleUnpin) ? {
      metricKey: key, metricLabel: label,
      isPinned: isMetricPinned(key),
      onPin: () => handlePin(key, label, 'kpi'),
      onUnpin: () => handleUnpin(key),
    } : {};
  }

  // ── Build data-driven summary text ────────────────────────────────────────
  const summaryLines: string[] = [];
  if (slaStats.compliance >= 95) {
    summaryLines.push(`SLA compliance is at ${slaStats.compliance}% — above the 95% target.`);
  } else if (slaStats.compliance < 85) {
    summaryLines.push(`SLA compliance is at ${slaStats.compliance}%, below the recommended threshold.`);
  } else {
    summaryLines.push(`SLA compliance is at ${slaStats.compliance}%.`);
  }
  if (resolutionStats.avgHrs > 0) {
    summaryLines.push(`Average resolution time is ${resolutionStats.formatted} across ${resolvedCount} resolved tickets.`);
  }
  if (responseStats.avg > 0) {
    summaryLines.push(`First response averages ${responseStats.formatted}.`);
  }
  if (csatAvg) {
    summaryLines.push(`Customer satisfaction score is ${csatAvg}/5.`);
  }
  if (topIssues.length > 0) {
    summaryLines.push(`The most active category is "${topIssues[0].name}" with ${topIssues[0].count} tickets.`);
  }

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ═══ Top KPI Row ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <ScorecardWidget
          label="Total Tickets"
          value={total}
          icon={BarChart3}
          iconColor="var(--accent)"
          iconBg="var(--accent-subtle)"
          accentColor="var(--accent)"
          sparklineData={sparklineVolume.length > 0 ? sparklineVolume : undefined}
          sparklineColor="var(--accent)"
          {...pinProps('exec_total_tickets', 'Total Tickets')}
        />
        <ScorecardWidget
          label="SLA Compliance"
          value={slaStats.compliance}
          unit="%"
          icon={Target}
          iconColor={slaStats.compliance >= 95 ? 'var(--success)' : slaStats.compliance >= 85 ? 'var(--warning)' : 'var(--danger)'}
          iconBg={slaStats.compliance >= 95 ? 'var(--success-bg)' : slaStats.compliance >= 85 ? 'var(--warning-bg)' : '#fef2f2'}
          accentColor={slaStats.compliance >= 95 ? 'var(--success)' : slaStats.compliance >= 85 ? 'var(--warning)' : 'var(--danger)'}
          change={{ value: slaStats.breached, label: 'breaches', isPositive: slaStats.breached === 0 }}
          {...pinProps('exec_sla_compliance', 'SLA Compliance')}
        />
        <ScorecardWidget
          label="Avg Resolution"
          value={resolutionStats.formatted}
          icon={Clock}
          iconColor="var(--warning)"
          iconBg="var(--warning-bg)"
          accentColor="var(--warning)"
          sparklineData={resolutionHrs}
          sparklineColor="var(--warning)"
          {...pinProps('exec_avg_resolution', 'Avg Resolution')}
        />
        <ScorecardWidget
          label="Resolution Rate"
          value={total ? Math.round((resolvedCount / total) * 100) : 0}
          unit="%"
          icon={Activity}
          iconColor="var(--success)"
          iconBg="var(--success-bg)"
          accentColor="var(--success)"
          change={{ value: openCount, label: 'open', isPositive: openCount <= resolvedCount }}
          {...pinProps('exec_resolution_rate', 'Resolution Rate')}
        />
        {csatAvg && (
          <ScorecardWidget
            label="CSAT Score"
            value={csatAvg}
            unit="/5"
            icon={Star}
            iconColor="var(--warning)"
            iconBg="var(--warning-bg)"
            accentColor="var(--warning)"
            {...pinProps('exec_csat', 'CSAT Score')}
          />
        )}
        <ScorecardWidget
          label="Open Tickets"
          value={openCount}
          icon={AlertCircle}
          iconColor="var(--info)"
          iconBg="var(--info-bg)"
          accentColor="var(--info)"
          change={{ value: progressCount, label: 'in progress', isPositive: progressCount < openCount }}
          {...pinProps('exec_open_tickets', 'Open Tickets')}
        />
        <ScorecardWidget
          label="Avg Response"
          value={responseStats.formatted}
          icon={Activity}
          iconColor="var(--accent)"
          iconBg="var(--accent-subtle)"
          accentColor="var(--accent)"
          sparklineData={sparklineVolume.length > 0 ? sparklineVolume : undefined}
          sparklineColor="var(--accent)"
          {...pinProps('exec_avg_response', 'Avg Response')}
        />
      </div>

      {/* ═══ Data-Driven Summary Section ═══ */}
      {isAdminOrAgent && (
        <>
          <div className="card" style={{
            padding: 24,
            borderRadius: 14,
            border: '1px solid var(--border)',
            background: 'linear-gradient(135deg, #1e3a5f 0%, #1a365d 100%)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <BarChart3 size={18} color="#fff" />
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '0.01em' }}>
                Executive Summary
              </span>
            </div>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, margin: 0 }}>
              {summaryLines.join(' ')}
            </p>
          </div>

          {/* Top Issues by Category (data-driven) */}
          {topIssues.length > 0 && (
            <CardSection title="Top Issues by Category" icon={Layers}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {topIssues.map((issue, i) => {
                  const maxCount = Math.max(...topIssues.map(t => t.count), 1);
                  const barWidth = (issue.count / maxCount) * 100;

                  return (
                    <div key={issue.name}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: 6,
                          background: 'var(--accent-subtle)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
                        }}>
                          {i + 1}
                        </span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                          {issue.name}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', minWidth: 36, textAlign: 'right' }}>
                          {issue.count}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${barWidth}%`,
                          background: 'var(--accent)',
                          borderRadius: 3,
                          transition: 'width 0.8s ease',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardSection>
          )}
        </>
      )}

      {/* ── Non-admin notice ────────────────────────────────────────────────── */}
      {!isAdminOrAgent && (
        <div className="card" style={{
          padding: 32, borderRadius: 14, textAlign: 'center',
          color: 'var(--text-muted)', fontSize: 14,
        }}>
          Executive insights are available for administrators and agents.
        </div>
      )}
    </div>
  );
}
