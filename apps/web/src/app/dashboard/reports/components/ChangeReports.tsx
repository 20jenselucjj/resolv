'use client';

import { CardSection, MiniTable } from './Charts';
import { InteractiveDonutChart, GaugeChart, ScorecardWidget } from './recharts';
import { GitPullRequest, CheckCircle, RotateCcw, AlertTriangle, ClipboardList } from 'lucide-react';

interface ChangeReportsProps {
  data: {
    total: number;
    by_status: Record<string, number>;
    by_type: Record<string, number>;
    by_risk: Record<string, number>;
    by_priority: Record<string, number>;
    success_rate: number;
    rollback_rate: number;
    avg_implementation_hours: number;
    emergency_count: number;
    emergency_rate: number;
    pir_completion_rate: number;
    created_trend: { date: string; count: number }[];
  } | null;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  standard: 'var(--success)',
  normal: 'var(--accent)',
  emergency: 'var(--danger)',
};

const RISK_COLORS: Record<string, string> = {
  low: 'var(--success)',
  medium: 'var(--warning)',
  high: '#f97316',
  critical: 'var(--danger)',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'var(--text-muted)',
  submitted: 'var(--info)',
  approved: 'var(--success)',
  rejected: 'var(--danger)',
  implemented: '#8b5cf6',
  closed: 'var(--text-muted)',
  cancelled: 'var(--text-muted)',
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

export default function ChangeReports({ data, isMetricPinned, handlePin, handleUnpin }: ChangeReportsProps) {
  if (!data) {
    return (
      <div className="rp-fade" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <GitPullRequest size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
        Change management data is not available.
      </div>
    );
  }

  const typeTotal = Object.values(data.by_type).reduce((a, b) => a + b, 0);
  const riskTotal = Object.values(data.by_risk).reduce((a, b) => a + b, 0);
  const statusTotal = Object.values(data.by_status).reduce((a, b) => a + b, 0);

  const typeChartData = Object.entries(data.by_type).map(([key, value]) => ({
    name: key,
    value,
    color: TYPE_COLORS[key] || 'var(--accent)',
  }));

  const riskChartData = Object.entries(data.by_risk)
    .sort(([, a], [, b]) => b - a)
    .map(([key, value]) => ({
      name: key,
      value,
      color: RISK_COLORS[key] || 'var(--text-muted)',
    }));

  const statusRows = Object.entries(data.by_status).map(([key, value]) => ({
    status: key,
    count: value,
    pct: statusTotal ? Math.round((value / statusTotal) * 100) : 0,
    color: STATUS_COLORS[key] || 'var(--text-muted)',
  }));

  // Status donut data
  const statusDonutData = Object.entries(data.by_status).map(([key, value]) => ({
    name: key.replace(/_/g, ' '),
    value,
    color: STATUS_COLORS[key] || 'var(--text-muted)',
  }));

  const successRateColor = data.success_rate >= 80 ? 'var(--success)' : data.success_rate >= 60 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <ScorecardWidget
          label="Total Changes"
          value={data.total}
          icon={GitPullRequest}
          iconColor="var(--accent)"
          iconBg="var(--accent-subtle)"
          accentColor="var(--accent)"
          change={{ value: data.emergency_count, label: 'emergency', isPositive: data.emergency_count === 0 }}
          {...pinProps('changes_total', 'Total Changes', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Success Rate"
          value={Math.round(data.success_rate)}
          unit="%"
          icon={CheckCircle}
          iconColor={successRateColor}
          iconBg="var(--bg-elevated)"
          accentColor={successRateColor}
          {...pinProps('changes_success_rate', 'Success Rate', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Rollback Rate"
          value={Math.round(data.rollback_rate)}
          unit="%"
          icon={RotateCcw}
          iconColor={data.rollback_rate > 10 ? 'var(--danger)' : 'var(--text-muted)'}
          iconBg={data.rollback_rate > 10 ? 'var(--danger-bg)' : 'var(--bg-tertiary)'}
          accentColor={data.rollback_rate > 10 ? 'var(--danger)' : 'var(--border)'}
          {...pinProps('changes_rollback_rate', 'Rollback Rate', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Emergency Changes"
          value={data.emergency_count}
          icon={AlertTriangle}
          iconColor={data.emergency_count > 0 ? 'var(--danger)' : 'var(--text-muted)'}
          iconBg={data.emergency_count > 0 ? 'var(--danger-bg)' : 'var(--bg-tertiary)'}
          accentColor={data.emergency_count > 0 ? 'var(--danger)' : 'var(--border)'}
          {...pinProps('changes_emergency', 'Emergency Changes', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="PIR Completion"
          value={Math.round(data.pir_completion_rate)}
          unit="%"
          icon={ClipboardList}
          iconColor={data.pir_completion_rate >= 80 ? 'var(--success)' : data.pir_completion_rate >= 50 ? 'var(--warning)' : 'var(--danger)'}
          iconBg={data.pir_completion_rate >= 80 ? 'var(--success-bg)' : data.pir_completion_rate >= 50 ? 'var(--warning-bg)' : 'var(--danger-bg)'}
          accentColor={data.pir_completion_rate >= 80 ? 'var(--success)' : data.pir_completion_rate >= 50 ? 'var(--warning)' : 'var(--danger)'}
          {...pinProps('changes_pir_completion', 'PIR Completion', isMetricPinned, handlePin, handleUnpin)}
        />
      </div>

      {/* Success Rate Gauge */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <CardSection title="Success Rate" icon={CheckCircle} {...pinProps('chart_change_success', 'Change Success Rate', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          <GaugeChart
            value={Math.round(data.success_rate)}
            target={95}
            label="Success Rate"
            unit="%"
            showExport={true}
            exportFilename="changes-success-rate"
            size={220}
            thresholds={{ danger: 60, warning: 80 }}
          />
        </CardSection>

        {/* Type Distribution */}
        <CardSection title="Change Type Distribution" icon={GitPullRequest} {...pinProps('chart_change_type', 'Change Type Distribution', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {typeChartData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No type data available.</div>
          ) : (
            <InteractiveDonutChart
              data={typeChartData}
              total={typeTotal}
              totalLabel="changes"
              height={280}
              showExport={true}
              onSegmentClick={(seg) => console.log('Change type clicked:', seg)}
              exportFilename="changes-type-distribution"
            />
          )}
        </CardSection>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Risk Distribution */}
        <CardSection title="Risk Distribution" icon={AlertTriangle} {...pinProps('chart_change_risk', 'Change Risk Distribution', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {riskChartData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No risk data available.</div>
          ) : (
            <InteractiveDonutChart
              data={riskChartData}
              total={riskTotal}
              totalLabel="changes"
              height={280}
              showExport={true}
              onSegmentClick={(seg) => console.log('Risk clicked:', seg)}
              exportFilename="changes-risk-distribution"
            />
          )}
        </CardSection>

        {/* Status Breakdown */}
        <CardSection title="Status Breakdown" icon={ClipboardList} {...pinProps('chart_change_status', 'Change Status Breakdown', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {statusDonutData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No status data available.</div>
          ) : (
            <InteractiveDonutChart
              data={statusDonutData}
              total={statusTotal}
              totalLabel="changes"
              height={280}
              showExport={true}
              onSegmentClick={(seg) => console.log('Status clicked:', seg)}
              exportFilename="changes-status-breakdown"
            />
          )}
        </CardSection>
      </div>
    </div>
  );
}
