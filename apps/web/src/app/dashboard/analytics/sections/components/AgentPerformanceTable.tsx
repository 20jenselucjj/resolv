'use client';

import React from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { cssVar } from '../../components/recharts/export-utils';

// ── Types ──────────────────────────────────────────────────────

export interface AgentMetric {
  name: string;
  ticketsResolved: number;
  avgResolutionTime: string;
  csat: number | null;
  slaCompliance: number;
  weeklyTrend: number[];
}

export interface AgentPerformanceTableProps {
  agents: AgentMetric[];
  emptyMessage?: string;
}

// ── Mini Sparkline for table ───────────────────────────────────

const MiniSparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  if (!data.length) return <span style={{ color: cssVar('--text-muted', '#6B7280'), fontSize: 11 }}>—</span>;
  const chartData = data.map((v) => ({ value: v }));
  return (
    <div style={{ width: 60, height: 24 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={color}
            fillOpacity={0.12}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── RAG Dot for SLA ────────────────────────────────────────────

const SLADot: React.FC<{ compliance: number }> = ({ compliance }) => {
  let color = '#16A34A';
  if (compliance < 90) color = '#EF4444';
  else if (compliance < 95) color = '#F59E0B';

  return (
    <span
      role="img"
      aria-label={`SLA compliance ${compliance}%`}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        marginRight: 6,
      }}
    />
  );
};

// ── Component ──────────────────────────────────────────────────

const AgentPerformanceTable: React.FC<AgentPerformanceTableProps> = ({ agents, emptyMessage }) => {
  if (!agents.length) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: 'center',
          color: cssVar('--text-muted', '#6B7280'),
          fontSize: 14,
        }}
      >
        {emptyMessage || 'No agent performance data available.'}
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${cssVar('--border', '#e5e7eb')}` }}>
            {['Agent', 'Resolved', 'Avg Time', 'CSAT', 'SLA %', 'Trend'].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  fontWeight: 600,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: cssVar('--text-muted', '#6B7280'),
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {agents.map((agent, i) => (
            <tr
              key={agent.name}
              style={{
                borderBottom: `1px solid ${cssVar('--border-subtle', '#f3f4f6')}`,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = cssVar('--bg-secondary', '#f9fafb');
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <td style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: cssVar('--accent-subtle', '#eff6ff'),
                      color: cssVar('--accent', '#2563EB'),
                      fontSize: 10,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ fontWeight: 600, color: cssVar('--text', '#1f2937') }}>
                    {agent.name}
                  </span>
                </div>
              </td>
              <td style={{ padding: '10px 12px', fontWeight: 700, color: cssVar('--text', '#1f2937') }}>
                {agent.ticketsResolved.toLocaleString()}
              </td>
              <td style={{ padding: '10px 12px', color: cssVar('--text-secondary', '#4b5563') }}>
                {agent.avgResolutionTime}
              </td>
              <td style={{ padding: '10px 12px' }}>
                {agent.csat !== null ? (
                  <span
                    style={{
                      fontWeight: 700,
                      color: agent.csat >= 4.0 ? '#16A34A' : agent.csat >= 3.5 ? '#F59E0B' : '#EF4444',
                    }}
                  >
                    {agent.csat.toFixed(1)}
                  </span>
                ) : (
                  <span style={{ color: cssVar('--text-muted', '#6B7280') }}>—</span>
                )}
              </td>
              <td style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <SLADot compliance={agent.slaCompliance} />
                  <span style={{ fontWeight: 600, color: cssVar('--text', '#1f2937') }}>
                    {agent.slaCompliance}%
                  </span>
                </div>
              </td>
              <td style={{ padding: '10px 12px' }}>
                <MiniSparkline
                  data={agent.weeklyTrend}
                  color={agent.slaCompliance >= 95 ? '#16A34A' : agent.slaCompliance >= 90 ? '#F59E0B' : '#EF4444'}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AgentPerformanceTable;
