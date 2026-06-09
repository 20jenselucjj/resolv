'use client';

import { CardSection, MiniTable } from './Charts';
import { InteractiveDonutChart, InteractiveBarChart, ScorecardWidget } from './recharts';
import { CheckSquare, Clock, ThumbsUp, AlertTriangle, FileText } from 'lucide-react';

interface ApprovalReportsProps {
  data: {
    total: number;
    by_status: Record<string, number>;
    avg_time_to_decide_hours: number;
    by_entity_type: Record<string, number>;
    overdue_count: number;
    approval_rate: number;
    created_trend: { date: string; count: number }[];
  } | null;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--warning)',
  approved: 'var(--success)',
  denied: 'var(--danger)',
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

export default function ApprovalReports({ data, isMetricPinned, handlePin, handleUnpin }: ApprovalReportsProps) {
  if (!data) {
    return (
      <div className="rp-fade" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <CheckSquare size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
        Approval data is not available.
      </div>
    );
  }

  const statusTotal = Object.values(data.by_status).reduce((a, b) => a + b, 0);
  const entityTotal = Object.values(data.by_entity_type).reduce((a, b) => a + b, 0);

  const statusChartData = Object.entries(data.by_status).map(([key, value]) => ({
    name: key,
    value,
    color: STATUS_COLORS[key] || 'var(--text-muted)',
  }));

  const entityChartData = Object.entries(data.by_entity_type)
    .sort(([, a], [, b]) => b - a)
    .map(([key, value]) => ({
      name: key.replace(/_/g, ' '),
      value,
    }));

  const approvalRateColor = data.approval_rate >= 80 ? 'var(--success)' : data.approval_rate >= 50 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <ScorecardWidget
          label="Total Approvals"
          value={data.total}
          icon={CheckSquare}
          iconColor="var(--accent)"
          iconBg="var(--accent-subtle)"
          accentColor="var(--accent)"
          {...pinProps('approvals_total', 'Total Approvals', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Avg Time to Decide"
          value={data.avg_time_to_decide_hours > 0 ? formatHours(data.avg_time_to_decide_hours) : 'N/A'}
          icon={Clock}
          iconColor="var(--info)"
          iconBg="var(--info-bg)"
          accentColor="var(--info)"
          {...pinProps('approvals_avg_time_to_decide', 'Avg Time to Decide', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Approval Rate"
          value={Math.round(data.approval_rate)}
          unit="%"
          icon={ThumbsUp}
          iconColor={approvalRateColor}
          iconBg="var(--bg-elevated)"
          accentColor={approvalRateColor}
          {...pinProps('approvals_approval_rate', 'Approval Rate', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Overdue"
          value={data.overdue_count}
          icon={AlertTriangle}
          iconColor={data.overdue_count > 0 ? 'var(--danger)' : 'var(--text-muted)'}
          iconBg={data.overdue_count > 0 ? 'var(--danger-bg)' : 'var(--bg-tertiary)'}
          accentColor={data.overdue_count > 0 ? 'var(--danger)' : 'var(--border)'}
          {...pinProps('approvals_overdue', 'Overdue', isMetricPinned, handlePin, handleUnpin)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>
        {/* Status Distribution */}
        <CardSection title="Approval Status Distribution" icon={CheckSquare} {...pinProps('chart_approval_status', 'Approval Status Distribution', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {statusChartData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No status data available.</div>
          ) : (
            <InteractiveDonutChart
              data={statusChartData}
              total={statusTotal}
              totalLabel="approvals"
              height={280}
              showExport={true}
              onSegmentClick={(seg) => console.log('Approval status clicked:', seg)}
              exportFilename="approvals-status-distribution"
            />
          )}
        </CardSection>

        {/* By Entity Type */}
        <CardSection title="Approvals by Entity Type" icon={FileText} {...pinProps('chart_approval_entity', 'Approvals by Entity Type', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {entityChartData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No entity type data available.</div>
          ) : (
            <InteractiveBarChart
              data={entityChartData}
              layout="horizontal"
              height={Math.max(180, entityChartData.length * 50)}
              showExport={true}
              showGrid={false}
              onBarClick={(datum) => console.log('Entity type clicked:', datum)}
              exportFilename="approvals-entity-type"
            />
          )}
        </CardSection>
      </div>
    </div>
  );
}
