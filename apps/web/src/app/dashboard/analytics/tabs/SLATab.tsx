'use client';

import { useMemo } from 'react';
import { Shield, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { CardSection } from '../components/Charts';
import { ExportButton } from '../components/export';
import { ScorecardWidget, GaugeChart, InteractiveBarChart } from '../components/recharts';
import type { Ticket, AdminStats } from '../types';

interface SLATabProps {
  filteredTickets: Ticket[];
  adminStats: AdminStats | null;
  isAdminOrAgent: boolean;
  onExportCSV: (section: string) => void;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

export default function SLATab({ filteredTickets, adminStats, isAdminOrAgent, onExportCSV, isMetricPinned, handlePin, handleUnpin }: SLATabProps) {
  const total = filteredTickets.length;

  const slaStats = useMemo(() => {
    const breached = filteredTickets.filter(t => t.sla_breached).length;
    return { breached, compliance: total ? Math.round(((total - breached) / total) * 100) : 100 };
  }, [filteredTickets, total]);

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

  const breachedTickets = useMemo(() => filteredTickets.filter(t => t.sla_breached), [filteredTickets]);

  function pinProps(key: string, label: string, type: string = 'kpi') {
    return (isMetricPinned && handlePin && handleUnpin) ? {
      metricKey: key, metricLabel: label,
      isPinned: isMetricPinned(key),
      onPin: () => handlePin(key, label, type),
      onUnpin: () => handleUnpin(key),
    } : {};
  }

  // Breach breakdown for priority
  const breachByPriority = useMemo(() => {
    const m: Record<string, number> = {};
    filteredTickets.filter(t => t.sla_breached).forEach(t => {
      const p = t.priority?.toLowerCase() || 'low';
      m[p] = (m[p] || 0) + 1;
    });
    return Object.entries(m).map(([p, c]) => ({
      name: p.charAt(0).toUpperCase() + p.slice(1),
      value: c,
    }));
  }, [filteredTickets]);

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ExportButton section="sla" label="SLA" onExport={onExportCSV} isAdminOrAgent={isAdminOrAgent} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <ScorecardWidget
          label="SLA Compliance"
          value={slaStats.compliance}
          unit="%"
          icon={CheckCircle2}
          iconColor={slaStats.compliance >= 90 ? 'var(--success)' : slaStats.compliance >= 70 ? 'var(--warning)' : 'var(--danger)'}
          iconBg="var(--bg-elevated)"
          accentColor={slaStats.compliance >= 90 ? 'var(--success)' : slaStats.compliance >= 70 ? 'var(--warning)' : 'var(--danger)'}
          target={{ current: slaStats.compliance, target: 100, label: 'target' }}
          {...pinProps('sla_compliance', 'SLA Compliance')}
        />
        <ScorecardWidget
          label="SLA Breaches"
          value={slaStats.breached}
          icon={AlertTriangle}
          iconColor="var(--danger)"
          iconBg="var(--danger-bg)"
          accentColor="var(--danger)"
          change={{ value: total, label: 'total evaluated', isPositive: slaStats.breached === 0 }}
          {...pinProps('sla_breaches', 'SLA Breaches')}
        />
        <ScorecardWidget
          label="At Risk"
          value={adminStats?.sla?.at_risk_count ?? 0}
          icon={Clock}
          iconColor="var(--warning)"
          iconBg="var(--warning-bg)"
          accentColor="var(--warning)"
          {...pinProps('sla_at_risk', 'At Risk')}
        />
        <ScorecardWidget
          label="Avg Resolution"
          value={resolutionStats.formatted}
          icon={Shield}
          iconColor="var(--accent)"
          iconBg="var(--accent-subtle)"
          accentColor="var(--accent)"
          {...pinProps('sla_avg_resolution', 'Avg Resolution')}
        />
      </div>

      {/* Gauge + Breach breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20 }}>
        <CardSection title="SLA Compliance Gauge" icon={CheckCircle2} {...pinProps('chart_sla_compliance_gauge', 'SLA Compliance Gauge', 'chart')}>
          <GaugeChart
            value={slaStats.compliance}
            target={100}
            label="SLA Compliance"
            unit="%"
            showExport={true}
            exportFilename="sla-compliance-gauge"
            size={220}
            thresholds={{ danger: 70, warning: 90 }}
          />
        </CardSection>
        {breachByPriority.length > 0 && (
          <CardSection title="Breaches by Priority" icon={AlertTriangle} {...pinProps('chart_breaches_bar', 'Breaches by Priority', 'chart')}>
            <InteractiveBarChart
              data={breachByPriority}
              layout="horizontal"
              height={Math.max(160, breachByPriority.length * 50)}
              showExport={true}
              showGrid={false}
              exportFilename="sla-breaches-by-priority"
              onBarClick={(datum) => console.log('Breach priority clicked:', datum)}
            />
          </CardSection>
        )}
      </div>

      <CardSection title="SLA Breached Tickets" icon={Shield}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['#', 'Title', 'Priority', 'Assignee', 'Due Date'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {breachedTickets.slice(0, 20).map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--danger-bg)' }}>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 11 }}>#{t.number}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 500, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)' }}>{t.priority}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{t.assigned_to_name || 'Unassigned'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>
                    {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {breachedTickets.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--success)' }}>
                  <CheckCircle2 size={20} style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: 14, fontWeight: 600 }}>No SLA breaches!</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>All tickets are meeting their deadlines.</div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardSection>
    </div>
  );
}
