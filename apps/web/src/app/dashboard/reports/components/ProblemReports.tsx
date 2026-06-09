'use client';

import { CardSection, MiniTable } from './Charts';
import { InteractiveDonutChart, InteractiveLineChart, ScorecardWidget } from './recharts';
import { AlertTriangle, Clock, Link, AlertCircle } from 'lucide-react';

interface ProblemReportsProps {
  data: {
    total: number;
    by_status: Record<string, number>;
    by_priority: Record<string, number>;
    mttr_hours: number;
    created_trend: { date: string; count: number }[];
    top_root_causes: { category: string; count: number }[];
    incident_link_rate: number;
  } | null;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'var(--warning)',
  investigating: 'var(--accent)',
  identified: '#8b5cf6',
  resolved: 'var(--success)',
  closed: 'var(--text-muted)',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'var(--danger)',
  high: '#f97316',
  medium: 'var(--warning)',
  low: 'var(--success)',
};

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function pinProps(key: string, label: string, isPinnedFn?: (k: string) => boolean, pinFn?: (k: string, l: string, t?: string) => void, unpinFn?: (k: string) => void, type: string = 'kpi') {
  return (isPinnedFn && pinFn && unpinFn) ? {
    metricKey: key, metricLabel: label,
    isPinned: isPinnedFn(key),
    onPin: () => pinFn(key, label, type),
    onUnpin: () => unpinFn(key),
  } : {};
}

export default function ProblemReports({ data, isMetricPinned, handlePin, handleUnpin }: ProblemReportsProps) {
  if (!data) {
    return (
      <div className="rp-fade" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <AlertTriangle size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
        Problem management data is not available.
      </div>
    );
  }

  const openProblems = data.by_status?.open || 0;
  const statusTotal = Object.values(data.by_status).reduce((a, b) => a + b, 0);
  const priorityTotal = Object.values(data.by_priority).reduce((a, b) => a + b, 0);
  const maxRootCause = Math.max(...data.top_root_causes.map(r => r.count), 1);

  const statusChartData = Object.entries(data.by_status).map(([key, value]) => ({
    name: key.replace(/_/g, ' '),
    value,
    color: STATUS_COLORS[key] || 'var(--text-muted)',
  }));

  const priorityChartData = Object.entries(data.by_priority)
    .sort(([, a], [, b]) => b - a)
    .map(([key, value]) => ({
      name: key,
      value,
      color: PRIORITY_COLORS[key] || 'var(--text-muted)',
    }));

  const trendLineData = data.created_trend.map(t => ({
    name: new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    count: t.count,
  }));

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <ScorecardWidget
          label="Total Problems"
          value={data.total}
          icon={AlertTriangle}
          iconColor="var(--warning)"
          iconBg="var(--warning-bg)"
          accentColor="var(--warning)"
          change={{ value: openProblems, label: 'open', isPositive: openProblems === 0 }}
          {...pinProps('problems_total', 'Total Problems', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="MTTR"
          value={data.mttr_hours > 0 ? formatHours(data.mttr_hours) : 'N/A'}
          icon={Clock}
          iconColor="var(--accent)"
          iconBg="var(--accent-subtle)"
          accentColor="var(--accent)"
          {...pinProps('problems_mttr', 'MTTR', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Incident Link Rate"
          value={`${Math.round(data.incident_link_rate)}%`}
          icon={Link}
          iconColor="var(--info)"
          iconBg="var(--info-bg)"
          accentColor="var(--info)"
          {...pinProps('problems_incident_link_rate', 'Incident Link Rate', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Open Problems"
          value={openProblems}
          icon={AlertCircle}
          iconColor={openProblems > 0 ? 'var(--warning)' : 'var(--text-muted)'}
          iconBg={openProblems > 0 ? 'var(--warning-bg)' : 'var(--bg-tertiary)'}
          accentColor={openProblems > 0 ? 'var(--warning)' : 'var(--border)'}
          {...pinProps('problems_open', 'Open Problems', isMetricPinned, handlePin, handleUnpin)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
        {/* Status Distribution */}
        <CardSection title="Status Distribution" icon={AlertTriangle} {...pinProps('chart_problem_status', 'Problem Status Distribution', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {statusChartData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No status data available.</div>
          ) : (
            <InteractiveDonutChart
              data={statusChartData}
              total={statusTotal}
              totalLabel="problems"
              height={280}
              showExport={true}
              onSegmentClick={(seg) => console.log('Problem status clicked:', seg)}
              exportFilename="problems-status-distribution"
            />
          )}
        </CardSection>

        {/* Priority Distribution */}
        <CardSection title="Priority Distribution" icon={AlertCircle} {...pinProps('chart_problem_priority', 'Problem Priority Distribution', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {priorityChartData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No priority data available.</div>
          ) : (
            <InteractiveDonutChart
              data={priorityChartData}
              total={priorityTotal}
              totalLabel="problems"
              height={280}
              showExport={true}
              onSegmentClick={(seg) => console.log('Problem priority clicked:', seg)}
              exportFilename="problems-priority-distribution"
            />
          )}
        </CardSection>
      </div>

      {/* Creation Trend */}
      <CardSection title="Problem Creation Trend" icon={Clock} {...pinProps('chart_problem_trend', 'Problem Creation Trend', isMetricPinned, handlePin, handleUnpin, 'chart')}>
        {trendLineData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No trend data available.</div>
        ) : (
          <InteractiveLineChart
            data={trendLineData}
            series={[{ dataKey: 'count', name: 'Created', color: 'var(--info)' }]}
            height={200}
            showExport={true}
            showGrid={true}
            xKey="name"
            exportFilename="problems-creation-trend"
            onPointClick={(datum) => console.log('Trend point clicked:', datum)}
          />
        )}
      </CardSection>

      {/* Top Root Causes */}
      {data.top_root_causes.length > 0 && (
        <CardSection title="Top Root Causes" icon={AlertTriangle} {...pinProps('chart_root_causes', 'Top Root Causes', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          <MiniTable
            headers={['Category', 'Problems', '']}
            rows={data.top_root_causes.slice(0, 10).map(r => [
              <span key="cat" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{r.category}</span>,
              <span key="cnt" style={{ fontWeight: 700 }}>{r.count}</span>,
              <div key="bar" style={{ width: 60, height: 4, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(r.count / maxRootCause) * 100}%`, background: 'var(--warning)', borderRadius: 2 }} />
              </div>,
            ])}
            emptyMessage="No root cause data available."
          />
        </CardSection>
      )}
    </div>
  );
}
