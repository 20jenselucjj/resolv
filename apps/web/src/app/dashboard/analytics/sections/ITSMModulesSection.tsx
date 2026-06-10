'use client';

import { useState, useMemo } from 'react';
import { Bug, Wrench, CheckSquare, AlertTriangle, AlertCircle, Clock, Link as LinkIcon, Target, Activity, CheckCircle, RotateCcw, GitPullRequest, ClipboardList, ThumbsUp, FileText, Hourglass, UserCheck } from 'lucide-react';
import { CardSection, MiniTable } from '../components/Charts';
import { EmptyState } from '../components/shared';
import { InteractiveDonutChart, InteractiveBarChart, InteractiveLineChart, ScorecardWidget, GaugeChart } from '../components/recharts';
import type { ProblemReportData, ChangeReportData, ApprovalReportData } from '../types';

// ── Color Maps ──────────────────────────────────────────────────────────────────

const PROBLEM_STATUS_COLORS: Record<string, string> = {
  open: '#3B82F6',
  in_progress: '#F59E0B',
  investigating: '#F59E0B',
  identified: '#8b5cf6',
  resolved: '#16A34A',
  closed: '#6B7280',
};

const PROBLEM_PRIORITY_COLORS: Record<string, string> = {
  p1: '#EF4444',
  p2: '#F97316',
  p3: '#F59E0B',
  p4: '#16A34A',
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#16A34A',
};

const CHANGE_STATUS_COLORS: Record<string, string> = {
  pending: '#8B5CF6',
  submitted: '#8B5CF6',
  draft: '#6B7280',
  approved: '#16A34A',
  implemented: '#0D9488',
  failed: '#EF4444',
  rejected: '#EF4444',
  rolled_back: '#F97316',
  cancelled: '#6B7280',
  closed: '#6B7280',
};

const CHANGE_TYPE_COLORS: Record<string, string> = {
  standard: '#16A34A',
  normal: '#3B82F6',
  emergency: '#EF4444',
};

const RISK_COLORS: Record<string, string> = {
  low: '#16A34A',
  medium: '#F59E0B',
  high: '#F97316',
  critical: '#EF4444',
};

const APPROVAL_STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  approved: '#16A34A',
  rejected: '#EF4444',
  denied: '#EF4444',
  overdue: '#DC2626',
  cancelled: '#6B7280',
};

// ── Helpers ─────────────────────────────────────────────────────────────────────

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function pinProps(
  key: string, label: string,
  isPinnedFn?: (k: string) => boolean,
  pinFn?: (k: string, l: string, t?: string) => void,
  unpinFn?: (k: string) => void,
  type: string = 'kpi',
) {
  return (isPinnedFn && pinFn && unpinFn)
    ? {
        metricKey: key,
        metricLabel: label,
        isPinned: isPinnedFn(key),
        onPin: () => pinFn(key, label, type),
        onUnpin: () => unpinFn(key),
      }
    : {};
}

// ── Types ───────────────────────────────────────────────────────────────────────

interface ITSMModulesSectionProps {
  problemData: ProblemReportData | null;
  changeData: ChangeReportData | null;
  approvalData: ApprovalReportData | null;
  isAdminOrAgent: boolean;
  onExportCSV: (section: string) => void;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

type SubTab = 'problems' | 'changes' | 'approvals';

const SUB_TABS: { key: SubTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'problems', label: 'Problems', icon: Bug },
  { key: 'changes', label: 'Changes', icon: Wrench },
  { key: 'approvals', label: 'Approvals', icon: CheckSquare },
];

// ── Problem Management Tab ──────────────────────────────────────────────────────

function ProblemsContent({
  data,
  isMetricPinned,
  handlePin,
  handleUnpin,
}: {
  data: ProblemReportData | null;
  isMetricPinned?: (k: string) => boolean;
  handlePin?: (k: string, l: string, t?: string) => void;
  handleUnpin?: (k: string) => void;
}) {
  const metrics = useMemo(() => {
    if (!data) return null;
    const openCount = data.by_status?.open || 0;
    const statusTotal = Object.values(data.by_status).reduce((a, b) => a + b, 0);
    const priorityTotal = Object.values(data.by_priority).reduce((a, b) => a + b, 0);

    // Estimate avg age of open problems from available data
    // Without direct field, we derive it from created_trend as placeholder logic
    const avgAgeOpenDays = openCount > 0 && data.created_trend?.length
      ? Math.round(
          data.created_trend
            .slice(-4)
            .reduce((sum, d) => sum + d.count, 0) / openCount * 7
        )
      : 0;

    return { openCount, statusTotal, priorityTotal, avgAgeOpenDays };
  }, [data]);

  if (!data || !metrics) {
    return (
      <EmptyState
        icon={<AlertTriangle size={32} />}
        title="Problem management data is not available"
        description="Ensure problem tracking is configured and problems are registered."
        size="md"
      />
    );
  }

  const statusChartData = Object.entries(data.by_status).map(([key, value]) => ({
    name: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    value,
    color: PROBLEM_STATUS_COLORS[key] || 'var(--text-muted)',
  }));

  const priorityChartData = Object.entries(data.by_priority)
    .sort(([, a], [, b]) => b - a)
    .map(([key, value]) => ({
      name: key.toUpperCase(),
      value,
      color: PROBLEM_PRIORITY_COLORS[key.toLowerCase()] || 'var(--text-muted)',
    }));

  const trendLineData = (data.created_trend || []).map((t) => ({
    name: new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    count: t.count,
  }));

  const maxRootCause = Math.max(...(data.top_root_causes || []).map((r) => r.count), 1);

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── KPI Row ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <ScorecardWidget
          label="Total Problems"
          value={data.total}
          icon={AlertTriangle}
          iconColor="#F59E0B"
          iconBg="rgba(245,158,11,0.12)"
          accentColor="#F59E0B"
          {...pinProps('problems_total', 'Total Problems', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Open Problems"
          value={metrics.openCount}
          icon={AlertCircle}
          iconColor="#3B82F6"
          iconBg="rgba(59,130,246,0.12)"
          accentColor="#3B82F6"
          target={{ current: metrics.openCount, target: 50, label: metrics.openCount <= 50 ? '✓ Target' : `${metrics.openCount} open` }}
          {...pinProps('problems_open', 'Open Problems', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Avg Age of Open (days)"
          value={metrics.avgAgeOpenDays}
          unit="days"
          icon={Clock}
          iconColor="#8B5CF6"
          iconBg="rgba(139,92,246,0.12)"
          accentColor="#8B5CF6"
          change={{ value: metrics.avgAgeOpenDays > 30 ? 100 : Math.round((1 - metrics.avgAgeOpenDays / 30) * 100), label: metrics.avgAgeOpenDays <= 30 ? 'on target' : 'needs attention', isPositive: metrics.avgAgeOpenDays <= 30 }}
          {...pinProps('problems_avg_age', 'Avg Age of Open', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="MTTR"
          value={data.mttr_hours > 0 ? formatHours(data.mttr_hours) : 'N/A'}
          icon={Target}
          iconColor="#16A34A"
          iconBg="rgba(22,163,74,0.12)"
          accentColor="#16A34A"
          change={{ value: data.mttr_hours > 72 ? Math.round((data.mttr_hours / 72) * 100) : Math.round((1 - data.mttr_hours / 72) * 100), label: data.mttr_hours <= 72 ? 'within target' : 'exceeds target', isPositive: data.mttr_hours <= 72 }}
          {...pinProps('problems_mttr', 'MTTR', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Incident Link Rate"
          value={`${Math.round(data.incident_link_rate)}%`}
          icon={LinkIcon}
          iconColor="#0D9488"
          iconBg="rgba(13,148,136,0.12)"
          accentColor="#0D9488"
          target={{ current: data.incident_link_rate, target: 80, label: data.incident_link_rate >= 80 ? '✓ >80% target' : `${Math.round(data.incident_link_rate)}%` }}
          {...pinProps('problems_incident_link_rate', 'Incident Link Rate', isMetricPinned, handlePin, handleUnpin)}
        />
      </div>

      {/* ── Charts Row 1 ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>
        <CardSection title="Problems by Status" icon={Activity} {...pinProps('chart_problem_status', 'Problems by Status', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {statusChartData.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Activity size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
              <p style={{ fontSize: 13 }}>No status data for the current filter criteria.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ flex: '0 0 200px' }}>
                <InteractiveDonutChart
                  data={statusChartData}
                  total={metrics.statusTotal}
                  totalLabel="problems"
                  height={240}
                  showExport={true}
                  onSegmentClick={(seg) => console.log('Problem status clicked:', seg)}
                  exportFilename="problems-by-status"
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <MiniTable
                  headers={['Status', 'Count', '%']}
                  rows={statusChartData.map((s) => [
                    <span key="s" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                      {s.name}
                    </span>,
                    <span key="c" style={{ fontWeight: 700 }}>{s.value}</span>,
                    <span key="p" style={{ color: 'var(--text-muted)' }}>{Math.round((s.value / metrics.statusTotal) * 100)}%</span>,
                  ])}
                  emptyMessage="No status data."
                />
              </div>
            </div>
          )}
        </CardSection>

        <CardSection title="Problems by Priority" icon={AlertCircle} {...pinProps('chart_problem_priority', 'Problems by Priority', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {priorityChartData.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <AlertCircle size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
              <p style={{ fontSize: 13 }}>No priority data for the current filter criteria.</p>
            </div>
          ) : (
            <InteractiveBarChart
              data={priorityChartData}
              layout="horizontal"
              height={Math.max(180, priorityChartData.length * 60)}
              showExport={true}
              showGrid={false}
              onBarClick={(datum) => console.log('Priority clicked:', datum)}
              exportFilename="problems-by-priority"
              colorMap={priorityChartData.reduce((m, d) => ({ ...m, [d.name]: d.color }), {} as Record<string, string>)}
            />
          )}
        </CardSection>
      </div>

      {/* ── Creation Trend ────────────────────────────────────────────── */}
      <CardSection title="Problem Creation Trend" icon={Clock} {...pinProps('chart_problem_trend', 'Problem Creation Trend', isMetricPinned, handlePin, handleUnpin, 'chart')}>
        {trendLineData.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Clock size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
            <p style={{ fontSize: 13 }}>No creation trend data for the current filter criteria.</p>
          </div>
        ) : (
          <InteractiveLineChart
            data={trendLineData}
            series={[{ dataKey: 'count', name: 'Problems Created', color: '#3B82F6' }]}
            height={200}
            showExport={true}
            showGrid={true}
            xKey="name"
            exportFilename="problems-creation-trend"
            onPointClick={(datum) => console.log('Trend point clicked:', datum)}
          />
        )}
      </CardSection>

      {/* ── Top Root Causes ───────────────────────────────────────────── */}
      {data.top_root_causes && data.top_root_causes.length > 0 && (
        <CardSection title="Top Root Causes" icon={AlertTriangle} {...pinProps('chart_root_causes', 'Top Root Causes', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          <MiniTable
            headers={['Root Cause', 'Count', '% of Total', '']}
            rows={data.top_root_causes.slice(0, 10).map((r) => [
              <span key="cat" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{r.category}</span>,
              <span key="cnt" style={{ fontWeight: 700 }}>{r.count}</span>,
              <span key="pct" style={{ color: 'var(--text-muted)' }}>{Math.round((r.count / metrics.statusTotal) * 100)}%</span>,
              <div key="bar" style={{ width: 60, height: 4, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(r.count / maxRootCause) * 100}%`, background: '#F59E0B', borderRadius: 2 }} />
              </div>,
            ])}
            emptyMessage="No root cause data available."
          />
        </CardSection>
      )}

      {/* ── Problem-Incident Linkage ──────────────────────────────────── */}
      <CardSection title="Problem-Incident Linkage" icon={LinkIcon} {...pinProps('chart_problem_linkage', 'Problem-Incident Linkage', isMetricPinned, handlePin, handleUnpin, 'chart')}>
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
          <LinkIcon size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
          Linkage details available once incidents are linked to problems.
        </div>
      </CardSection>
    </div>
  );
}

// ── Change Management Tab ────────────────────────────────────────────────────────

function ChangesContent({
  data,
  isMetricPinned,
  handlePin,
  handleUnpin,
}: {
  data: ChangeReportData | null;
  isMetricPinned?: (k: string) => boolean;
  handlePin?: (k: string, l: string, t?: string) => void;
  handleUnpin?: (k: string) => void;
}) {
  if (!data) {
    return (
      <EmptyState
        icon={<GitPullRequest size={32} />}
        title="Change management data is not available"
        description="Ensure change management is configured and change records are registered."
        size="md"
      />
    );
  }

  const statusTotal = Object.values(data.by_status).reduce((a, b) => a + b, 0);
  const typeTotal = Object.values(data.by_type).reduce((a, b) => a + b, 0);
  const riskTotal = Object.values(data.by_risk).reduce((a, b) => a + b, 0);

  const statusDonutData = Object.entries(data.by_status).map(([key, value]) => ({
    name: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    value,
    color: CHANGE_STATUS_COLORS[key] || 'var(--text-muted)',
  }));

  const typeChartData = Object.entries(data.by_type)
    .sort(([, a], [, b]) => b - a)
    .map(([key, value]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value,
      color: CHANGE_TYPE_COLORS[key] || 'var(--accent)',
    }));

  const riskChartData = Object.entries(data.by_risk)
    .sort(([, a], [, b]) => b - a)
    .map(([key, value]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value,
      color: RISK_COLORS[key] || 'var(--text-muted)',
    }));

  // Simulated success trend from created_trend data
  const successTrendData = (data.created_trend || []).map((t) => ({
    name: new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    successRate: data.success_rate || 0,
    changes: t.count,
  }));

  const successRateColor = data.success_rate >= 95 ? '#16A34A' : data.success_rate >= 80 ? '#F59E0B' : '#EF4444';

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── KPI Row ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <ScorecardWidget
          label="Total Changes"
          value={data.total}
          icon={GitPullRequest}
          iconColor="#3B82F6"
          iconBg="rgba(59,130,246,0.12)"
          accentColor="#3B82F6"
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
          target={{ current: data.success_rate, target: 95, label: data.success_rate >= 95 ? '✓ >95%' : `${Math.round(data.success_rate)}%` }}
          {...pinProps('changes_success_rate', 'Success Rate', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Rollback Rate"
          value={Math.round(data.rollback_rate)}
          unit="%"
          icon={RotateCcw}
          iconColor={data.rollback_rate > 5 ? '#EF4444' : '#16A34A'}
          iconBg={data.rollback_rate > 5 ? 'rgba(239,68,68,0.12)' : 'rgba(22,163,74,0.12)'}
          accentColor={data.rollback_rate > 5 ? '#EF4444' : '#16A34A'}
          target={{ current: Math.max(0, 5 - data.rollback_rate) * 20, target: 100, label: data.rollback_rate <= 5 ? '✓ <5% target' : `${Math.round(data.rollback_rate)}%` }}
          {...pinProps('changes_rollback_rate', 'Rollback Rate', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Emergency Changes"
          value={`${Math.round(data.emergency_rate)}%`}
          icon={AlertTriangle}
          iconColor={data.emergency_rate > 10 ? '#EF4444' : '#F59E0B'}
          iconBg={data.emergency_rate > 10 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)'}
          accentColor={data.emergency_rate > 10 ? '#EF4444' : '#F59E0B'}
          change={{ value: Math.round(data.emergency_rate), label: 'of all changes', isPositive: data.emergency_rate <= 10 }}
          {...pinProps('changes_emergency', 'Emergency Changes', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Avg Implementation"
          value={data.avg_implementation_hours > 0 ? formatHours(data.avg_implementation_hours) : 'N/A'}
          icon={Clock}
          iconColor="#8B5CF6"
          iconBg="rgba(139,92,246,0.12)"
          accentColor="#8B5CF6"
          change={{ value: data.avg_implementation_hours <= 24 ? Math.round((1 - data.avg_implementation_hours / 24) * 100) : Math.round((data.avg_implementation_hours / 24) * 100), label: data.avg_implementation_hours <= 24 ? 'within target' : 'exceeds target', isPositive: data.avg_implementation_hours <= 24 }}
          {...pinProps('changes_avg_impl', 'Avg Implementation Time', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="PIR Completion"
          value={Math.round(data.pir_completion_rate)}
          unit="%"
          icon={ClipboardList}
          iconColor={data.pir_completion_rate >= 80 ? '#16A34A' : data.pir_completion_rate >= 50 ? '#F59E0B' : '#EF4444'}
          iconBg={data.pir_completion_rate >= 80 ? 'rgba(22,163,74,0.12)' : data.pir_completion_rate >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)'}
          accentColor={data.pir_completion_rate >= 80 ? '#16A34A' : data.pir_completion_rate >= 50 ? '#F59E0B' : '#EF4444'}
          {...pinProps('changes_pir_completion', 'PIR Completion', isMetricPinned, handlePin, handleUnpin)}
        />
      </div>

      {/* ── Charts Row 1 ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Status */}
        <CardSection title="Changes by Status" icon={Activity} {...pinProps('chart_change_status', 'Changes by Status', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {statusDonutData.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Activity size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
              <p style={{ fontSize: 13 }}>No status data for the current filter criteria.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ flex: '0 0 180px' }}>
                <InteractiveDonutChart
                  data={statusDonutData}
                  total={statusTotal}
                  totalLabel="changes"
                  height={220}
                  showExport={true}
                  onSegmentClick={(seg) => console.log('Change status clicked:', seg)}
                  exportFilename="changes-by-status"
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <MiniTable
                  headers={['Status', 'Count', '%']}
                  rows={statusDonutData.map((s) => [
                    <span key="s" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                      {s.name}
                    </span>,
                    <span key="c" style={{ fontWeight: 700 }}>{s.value}</span>,
                    <span key="p" style={{ color: 'var(--text-muted)' }}>{Math.round((s.value / statusTotal) * 100)}%</span>,
                  ])}
                  emptyMessage="No status data."
                />
              </div>
            </div>
          )}
        </CardSection>

        {/* Type */}
        <CardSection title="Changes by Type" icon={GitPullRequest} {...pinProps('chart_change_type', 'Changes by Type', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {typeChartData.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <GitPullRequest size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
              <p style={{ fontSize: 13 }}>No type data for the current filter criteria.</p>
            </div>
          ) : (
            <InteractiveBarChart
              data={typeChartData}
              layout="horizontal"
              height={Math.max(180, typeChartData.length * 60)}
              showExport={true}
              showGrid={false}
              onBarClick={(datum) => console.log('Change type clicked:', datum)}
              exportFilename="changes-by-type"
              colorMap={typeChartData.reduce((m, d) => ({ ...m, [d.name]: d.color }), {} as Record<string, string>)}
            />
          )}
        </CardSection>
      </div>

      {/* ── Charts Row 2 ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Risk */}
        <CardSection title="Changes by Risk Level" icon={AlertTriangle} {...pinProps('chart_change_risk', 'Changes by Risk Level', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {riskChartData.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <AlertTriangle size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
              <p style={{ fontSize: 13 }}>No risk data for the current filter criteria.</p>
            </div>
          ) : (
            <InteractiveBarChart
              data={riskChartData}
              layout="horizontal"
              height={Math.max(180, riskChartData.length * 60)}
              showExport={true}
              showGrid={false}
              onBarClick={(datum) => console.log('Risk clicked:', datum)}
              exportFilename="changes-by-risk"
              colorMap={riskChartData.reduce((m, d) => ({ ...m, [d.name]: d.color }), {} as Record<string, string>)}
            />
          )}
        </CardSection>

        {/* Success Gauge */}
        <CardSection title="Success Rate" icon={CheckCircle} {...pinProps('chart_change_success_gauge', 'Change Success Rate', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          <GaugeChart
            value={Math.round(data.success_rate)}
            target={95}
            label="Success Rate"
            unit="%"
            showExport={true}
            exportFilename="changes-success-rate"
            size={200}
            thresholds={{ danger: 60, warning: 80 }}
          />
        </CardSection>
      </div>

      {/* ── Success Trend ──────────────────────────────────────────────── */}
      <CardSection title="Change Success Trend" icon={Activity} {...pinProps('chart_change_success_trend', 'Change Success Trend', isMetricPinned, handlePin, handleUnpin, 'chart')}>
        {successTrendData.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Activity size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
            <p style={{ fontSize: 13 }}>No trend data for the current filter criteria.</p>
          </div>
        ) : (
          <InteractiveLineChart
            data={successTrendData}
            series={[
              { dataKey: 'successRate', name: 'Success Rate %', color: '#16A34A', strokeWidth: 2 },
              { dataKey: 'changes', name: 'Changes', color: '#3B82F6', strokeWidth: 2, strokeDasharray: '4 4' },
            ]}
            height={220}
            showExport={true}
            showGrid={true}
            xKey="name"
            exportFilename="changes-success-trend"
            yLabel="% / Count"
          />
        )}
      </CardSection>

      {/* ── Recent Changes ─────────────────────────────────────────────── */}
      <CardSection title="Recent Changes" icon={GitPullRequest} {...pinProps('chart_recent_changes', 'Recent Changes', isMetricPinned, handlePin, handleUnpin, 'chart')}>
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
          <GitPullRequest size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
          Recent change details will appear here once change records are linked.
        </div>
      </CardSection>
    </div>
  );
}

// ── Approval Workflows Tab ─────────────────────────────────────────────────────

function ApprovalsContent({
  data,
  isMetricPinned,
  handlePin,
  handleUnpin,
}: {
  data: ApprovalReportData | null;
  isMetricPinned?: (k: string) => boolean;
  handlePin?: (k: string, l: string, t?: string) => void;
  handleUnpin?: (k: string) => void;
}) {
  if (!data) {
    return (
      <EmptyState
        icon={<CheckSquare size={32} />}
        title="Approval data is not available"
        description="Ensure approval workflows are configured and approval records are registered."
        size="md"
      />
    );
  }

  const statusTotal = Object.values(data.by_status).reduce((a, b) => a + b, 0);
  const entityTotal = Object.values(data.by_entity_type).reduce((a, b) => a + b, 0);
  const pendingCount = data.by_status?.pending || 0;

  const statusChartData = Object.entries(data.by_status)
    .sort(([, a], [, b]) => b - a)
    .map(([key, value]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value,
      color: APPROVAL_STATUS_COLORS[key] || 'var(--text-muted)',
    }));

  const entityChartData = Object.entries(data.by_entity_type)
    .sort(([, a], [, b]) => b - a)
    .map(([key, value]) => ({
      name: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value,
    }));

  const trendLineData = (data.created_trend || []).map((t) => ({
    name: new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    count: t.count,
  }));

  const approvalRateColor = data.approval_rate >= 80 ? '#16A34A' : data.approval_rate >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── KPI Row ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <ScorecardWidget
          label="Total Requests"
          value={data.total}
          icon={FileText}
          iconColor="#3B82F6"
          iconBg="rgba(59,130,246,0.12)"
          accentColor="#3B82F6"
          {...pinProps('approvals_total', 'Total Approval Requests', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Pending Approvals"
          value={pendingCount}
          icon={Hourglass}
          iconColor="#F59E0B"
          iconBg="rgba(245,158,11,0.12)"
          accentColor="#F59E0B"
          change={{ value: pendingCount > 0 ? 100 : 0, label: pendingCount > 0 ? 'awaiting action' : 'none pending', isPositive: pendingCount === 0 }}
          {...pinProps('approvals_pending', 'Pending Approvals', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Avg Decision Time"
          value={data.avg_time_to_decide_hours > 0 ? formatHours(data.avg_time_to_decide_hours) : 'N/A'}
          icon={Clock}
          iconColor="#8B5CF6"
          iconBg="rgba(139,92,246,0.12)"
          accentColor="#8B5CF6"
          change={{ value: data.avg_time_to_decide_hours <= 24 ? Math.round((1 - data.avg_time_to_decide_hours / 24) * 100) : Math.round((data.avg_time_to_decide_hours / 24) * 100), label: data.avg_time_to_decide_hours <= 24 ? 'within target' : 'exceeds target', isPositive: data.avg_time_to_decide_hours <= 24 }}
          {...pinProps('approvals_avg_time', 'Avg Decision Time', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Approval Rate"
          value={Math.round(data.approval_rate)}
          unit="%"
          icon={ThumbsUp}
          iconColor={approvalRateColor}
          iconBg="var(--bg-elevated)"
          accentColor={approvalRateColor}
          target={{ current: data.approval_rate, target: 80, label: data.approval_rate >= 80 ? '✓ >80%' : `${Math.round(data.approval_rate)}%` }}
          {...pinProps('approvals_rate', 'Approval Rate', isMetricPinned, handlePin, handleUnpin)}
        />
      </div>

      {/* ── Charts Row 1 ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>
        <CardSection title="Approvals by Status" icon={Activity} {...pinProps('chart_approval_status', 'Approvals by Status', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {statusChartData.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Activity size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
              <p style={{ fontSize: 13 }}>No status data for the current filter criteria.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ flex: '0 0 180px' }}>
                <InteractiveDonutChart
                  data={statusChartData}
                  total={statusTotal}
                  totalLabel="approvals"
                  height={220}
                  showExport={true}
                  onSegmentClick={(seg) => console.log('Approval status clicked:', seg)}
                  exportFilename="approvals-by-status"
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <MiniTable
                  headers={['Status', 'Count', '%']}
                  rows={statusChartData.map((s) => [
                    <span key="s" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                      {s.name}
                    </span>,
                    <span key="c" style={{ fontWeight: 700 }}>{s.value}</span>,
                    <span key="p" style={{ color: 'var(--text-muted)' }}>{Math.round((s.value / statusTotal) * 100)}%</span>,
                  ])}
                  emptyMessage="No status data."
                />
              </div>
            </div>
          )}
        </CardSection>

        <CardSection title="Approvals by Entity Type" icon={FileText} {...pinProps('chart_approval_entity', 'Approvals by Entity Type', isMetricPinned, handlePin, handleUnpin, 'chart')}>
          {entityChartData.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <FileText size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
              <p style={{ fontSize: 13 }}>No entity type data for the current filter criteria.</p>
            </div>
          ) : (
            <InteractiveBarChart
              data={entityChartData}
              layout="horizontal"
              height={Math.max(180, entityChartData.length * 55)}
              showExport={true}
              showGrid={false}
              onBarClick={(datum) => console.log('Entity type clicked:', datum)}
              exportFilename="approvals-by-entity-type"
            />
          )}
        </CardSection>
      </div>

      {/* ── Decision Trend ────────────────────────────────────────────── */}
      <CardSection title="Approval Decision Trend" icon={Activity} {...pinProps('chart_approval_trend', 'Approval Decision Trend', isMetricPinned, handlePin, handleUnpin, 'chart')}>
        {trendLineData.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Activity size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
            <p style={{ fontSize: 13 }}>No trend data for the current filter criteria.</p>
          </div>
        ) : (
          <InteractiveLineChart
            data={trendLineData}
            series={[{ dataKey: 'count', name: 'Approvals', color: '#8B5CF6' }]}
            height={200}
            showExport={true}
            showGrid={true}
            xKey="name"
            exportFilename="approvals-decision-trend"
            onPointClick={(datum) => console.log('Trend point clicked:', datum)}
          />
        )}
      </CardSection>

      {/* ── Overdue Approvals ──────────────────────────────────────────── */}
      <CardSection title="Overdue Approvals" icon={AlertTriangle} {...pinProps('chart_overdue_approvals', 'Overdue Approvals', isMetricPinned, handlePin, handleUnpin, 'chart')}>
        {data.overdue_count > 0 ? (
          <MiniTable
            headers={['Request #', 'Entity Type', 'Requester', 'Due Date', 'Days Overdue', 'Approver']}
            rows={[]}
            emptyMessage="Overdue detail records not yet available in this view."
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
            <CheckCircle size={28} style={{ margin: '0 auto 8px', opacity: 0.4, color: '#16A34A' }} />
            No overdue approvals — all requests are on track.
          </div>
        )}
      </CardSection>

      {/* ── Recent Approvals ───────────────────────────────────────────── */}
      <CardSection title="Recent Approvals" icon={UserCheck} {...pinProps('chart_recent_approvals', 'Recent Approvals', isMetricPinned, handlePin, handleUnpin, 'chart')}>
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
          <UserCheck size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
          Recent approval details will appear here once approval records are linked.
        </div>
      </CardSection>
    </div>
  );
}

// ── Main Section ────────────────────────────────────────────────────────────────

export default function ITSMModulesSection(props: ITSMModulesSectionProps) {
  const {
    problemData,
    changeData,
    approvalData,
    isAdminOrAgent,
    onExportCSV,
    isMetricPinned,
    handlePin,
    handleUnpin,
  } = props;

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('problems');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Sub-tab navigation */}
      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        {SUB_TABS.map((st) => (
          <button
            key={st.key}
            onClick={() => setActiveSubTab(st.key)}
            aria-label={st.label}
            aria-selected={activeSubTab === st.key}
            role="tab"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              background: activeSubTab === st.key ? 'var(--accent-subtle)' : 'transparent',
              color: activeSubTab === st.key ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            <st.icon size={16} />
            {st.label}
          </button>
        ))}
        {/* Export button */}
        <div style={{ marginLeft: 'auto' }}>
          {isAdminOrAgent && (
            <button
              onClick={() => onExportCSV(activeSubTab)}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px' }}
            >
              Export {SUB_TABS.find((t) => t.key === activeSubTab)?.label || ''}
            </button>
          )}
        </div>
      </div>

      {activeSubTab === 'problems' && (
        <ProblemsContent
          data={problemData}
          isMetricPinned={isMetricPinned}
          handlePin={handlePin}
          handleUnpin={handleUnpin}
        />
      )}

      {activeSubTab === 'changes' && (
        <ChangesContent
          data={changeData}
          isMetricPinned={isMetricPinned}
          handlePin={handlePin}
          handleUnpin={handleUnpin}
        />
      )}

      {activeSubTab === 'approvals' && (
        <ApprovalsContent
          data={approvalData}
          isMetricPinned={isMetricPinned}
          handlePin={handlePin}
          handleUnpin={handleUnpin}
        />
      )}
    </div>
  );
}
