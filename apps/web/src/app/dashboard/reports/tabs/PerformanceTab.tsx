'use client';

import { Users, UserCheck, Clock, AlertTriangle } from 'lucide-react';
import { CardSection } from '../components/Charts';
import { ScorecardWidget, InteractiveBarChart } from '../components/recharts';

interface AgentPerf {
  name: string;
  count: number;
  resolved: number;
  breaches: number;
  totalResTime: number;
}

interface PerformanceTabProps {
  agentPerformance: AgentPerf[];
  isAdminOrAgent: boolean;
  onExportCSV: (section: string) => void;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

export default function PerformanceTab({ agentPerformance, isAdminOrAgent, onExportCSV, isMetricPinned, handlePin, handleUnpin }: PerformanceTabProps) {
  // Aggregate metrics for scorecards
  const totalHandled = agentPerformance.reduce((a, g) => a + g.count, 0);
  const totalResolved = agentPerformance.reduce((a, g) => a + g.resolved, 0);
  const totalBreaches = agentPerformance.reduce((a, g) => a + g.breaches, 0);
  const avgResRate = totalHandled ? Math.round((totalResolved / totalHandled) * 100) : 0;

  function pinProps(key: string, label: string, type: string = 'kpi') {
    return (isMetricPinned && handlePin && handleUnpin) ? {
      metricKey: key, metricLabel: label,
      isPinned: isMetricPinned(key),
      onPin: () => handlePin(key, label, type),
      onUnpin: () => handleUnpin(key),
    } : {};
  }

  // Bar chart data for agent comparison
  const agentBarData = agentPerformance.slice(0, 12).map(a => ({
    name: a.name,
    value: a.count,
    Handled: a.count,
    Resolved: a.resolved,
  }));

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <ScorecardWidget
          label="Total Handled"
          value={totalHandled}
          icon={UserCheck}
          iconColor="var(--accent)"
          iconBg="var(--accent-subtle)"
          accentColor="var(--accent)"
          {...pinProps('perf_total_handled', 'Total Handled')}
        />
        <ScorecardWidget
          label="Resolved"
          value={totalResolved}
          icon={Users}
          iconColor="var(--success)"
          iconBg="var(--success-bg)"
          accentColor="var(--success)"
          target={{ current: totalResolved, target: totalHandled || 1, label: `${avgResRate}%` }}
          {...pinProps('perf_resolved', 'Resolved')}
        />
        <ScorecardWidget
          label="SLA Breaches"
          value={totalBreaches}
          icon={AlertTriangle}
          iconColor={totalBreaches > 0 ? 'var(--danger)' : 'var(--text-muted)'}
          iconBg={totalBreaches > 0 ? 'var(--danger-bg)' : 'var(--bg-tertiary)'}
          accentColor={totalBreaches > 0 ? 'var(--danger)' : 'var(--border)'}
          {...pinProps('perf_sla_breaches', 'SLA Breaches')}
        />
        <ScorecardWidget
          label="Active Agents"
          value={agentPerformance.length}
          icon={Clock}
          iconColor="var(--info)"
          iconBg="var(--info-bg)"
          accentColor="var(--info)"
          {...pinProps('perf_active_agents', 'Active Agents')}
        />
      </div>

      {/* Agent comparison chart */}
      {agentBarData.length > 0 && (
        <CardSection title="Agent Comparison" icon={Users} {...pinProps('chart_agent_comparison', 'Agent Comparison', 'chart')}>
          <InteractiveBarChart
            data={agentBarData}
            layout="horizontal"
            height={Math.max(200, agentBarData.length * 60)}
            showExport={true}
            showGrid={true}
            exportFilename="performance-agent-comparison"
            series={[
              { dataKey: 'Handled', name: 'Handled', color: 'var(--accent)' },
              { dataKey: 'Resolved', name: 'Resolved', color: 'var(--success)' },
            ]}
          />
        </CardSection>
      )}

      {/* Detailed table */}
      <CardSection title="Agent Performance Details" icon={Users}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          {agentPerformance.length > 0 && (
            <button onClick={() => onExportCSV('performance')} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ExportIcon /> Export CSV
            </button>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Agent', 'Handled', 'Resolved', 'Resolution Rate', 'Avg Time', 'SLA Breaches', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agentPerformance.map(agent => {
                const avgHrs = agent.resolved ? agent.totalResTime / agent.resolved / 3600000 : 0;
                const resRate = agent.count ? Math.round(agent.resolved / agent.count * 100) : 0;
                const resText = !agent.resolved ? '—' : avgHrs < 1 ? `${Math.round(avgHrs * 60)} min` : avgHrs < 24 ? `${avgHrs.toFixed(1)}h` : `${(avgHrs / 24).toFixed(1)}d`;
                return (
                  <tr key={agent.name} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>{agent.name}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>{agent.count}</td>
                    <td style={{ padding: '12px 16px' }}>{agent.resolved}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden', maxWidth: 80 }}>
                          <div style={{ height: '100%', width: `${resRate}%`, background: resRate >= 80 ? 'var(--success)' : resRate >= 50 ? 'var(--warning)' : 'var(--danger)', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{resRate}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12 }}>{resText}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {agent.breaches > 0
                        ? <span style={{ padding: '2px 8px', borderRadius: 10, background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 11, fontWeight: 700 }}>{agent.breaches}</span>
                        : <span style={{ color: 'var(--success)', fontSize: 11, fontWeight: 600 }}>0</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                        background: agent.breaches === 0 && agent.resolved > 0 ? 'var(--success-bg)' : agent.breaches > 0 ? 'var(--warning-bg)' : 'var(--bg-tertiary)',
                        color: agent.breaches === 0 && agent.resolved > 0 ? 'var(--success)' : agent.breaches > 0 ? 'var(--warning)' : 'var(--text-muted)',
                      }}>
                        {agent.breaches === 0 && agent.resolved > 0 ? 'Good' : agent.breaches > 0 ? 'Review' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardSection>
    </div>
  );
}

function ExportIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
