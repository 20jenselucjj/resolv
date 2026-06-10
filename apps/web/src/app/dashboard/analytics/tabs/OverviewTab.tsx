'use client';

import { useMemo } from 'react';
import {
  Target, Activity, Clock, AlertCircle, Layers, PieChart, BarChart3, TrendingUp,
  Monitor, BookOpen, Bot, Users, Bug, Wrench, CheckSquare, DollarSign, Download,
} from 'lucide-react';
import { CardSection } from '../components/Charts';
import { InteractiveDonutChart, InteractiveAreaChart, InteractiveBarChart, ScorecardWidget } from '../components/recharts';
import { STATUS_COLORS, TYPE_COLORS } from '../types';
import type { Ticket, AdminStats, TimeSeriesData, AssetStats, KnowledgeStats, AIAnalytics, ProblemReportData, ChangeReportData, ApprovalReportData, LicenseReportData, ReportTab, DrillDownLevel } from '../types';

interface OverviewTabProps {
  tickets: Ticket[];
  filteredTickets: Ticket[];
  adminStats: AdminStats | null;
  timeSeries: TimeSeriesData | null;
  assetStats: AssetStats | null;
  knowledgeStats: KnowledgeStats | null;
  aiAnalytics: AIAnalytics | null;
  problemData: ProblemReportData | null;
  changeData: ChangeReportData | null;
  approvalData: ApprovalReportData | null;
  licenseData: LicenseReportData | null;
  isAdminOrAgent: boolean;
  timeRange?: string;
  onTabChange: (tab: ReportTab) => void;
  onExportOverview: () => void;
  /** Drill-down handler — called when a chart segment is clicked */
  onDrillDown?: (level: DrillDownLevel) => void;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

export default function OverviewTab({
  tickets, filteredTickets, adminStats, timeSeries, assetStats,
  knowledgeStats, aiAnalytics, problemData, changeData, approvalData, licenseData,
  isAdminOrAgent, timeRange = '30d', onTabChange, onExportOverview, onDrillDown,
  isMetricPinned, handlePin, handleUnpin,
}: OverviewTabProps) {
  const total = filteredTickets.length;

  // ── Computed Metrics ───────────────────────────────────────────────────────
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
    return { avgHrs: hrs, formatted: hrs < 24 ? `${hrs.toFixed(1)}h` : `${(hrs/24).toFixed(1)}d` };
  }, [filteredTickets]);

  const openCount = filteredTickets.filter(t => t.status === 'open').length;
  const progressCount = filteredTickets.filter(t => t.status === 'in_progress').length;

  // ── Breakdowns ─────────────────────────────────────────────────────────────
  const statusBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    filteredTickets.forEach(t => { m[t.status] = (m[t.status] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filteredTickets]);

  const typeBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    filteredTickets.forEach(t => { const ty = t.ticket_type || 'incident'; m[ty] = (m[ty]||0)+1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filteredTickets]);

  const categoryBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    filteredTickets.forEach(t => { const c = t.category_name || 'Uncategorized'; m[c] = (m[c]||0)+1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filteredTickets]);

  const maxStatusVal = Math.max(...statusBreakdown.map(s => s[1]), 1);
  const maxCategoryVal = Math.max(...categoryBreakdown.map(c => c[1]), 1);

  const tsPoints = timeSeries?.tickets || [];
  const slaTsPoints = timeSeries?.sla || [];

  const typeSegments = typeBreakdown.map(([type, count]) => ({
    name: type.replace('_', ' '), value: count,
    color: TYPE_COLORS[type] || 'var(--accent)',
  }));
  const statusSegments = statusBreakdown.map(([status, count]) => ({
    name: status.replace('_', ' '), value: count,
    color: STATUS_COLORS[status] || 'var(--text-muted)',
  }));

  // Sparkline data from time series
  const sparklineTicketVolume = tsPoints.map(p => ({ value: p.created || 0 }));
  const sparklineSlaBreaches = slaTsPoints.map(p => ({ value: p.breached || 0 }));
  const sparklineResolution = (timeSeries?.avg_resolution || []).map(p => ({ value: Math.round(p.hours || 0) }));

  // Category data for bar chart
  const categoryBarData = categoryBreakdown.map(([cat, count]) => ({ name: cat, value: count }));

  function pinProps(key: string, label: string, type: string = 'kpi') {
    return (isMetricPinned && handlePin && handleUnpin) ? {
      metricKey: key, metricLabel: label,
      isPinned: isMetricPinned(key),
      onPin: () => handlePin(key, label, type),
      onUnpin: () => handleUnpin(key),
    } : {};
  }

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Section export button */}
      {isAdminOrAgent && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onExportOverview} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={13} /> Export Overview
          </button>
        </div>
      )}
      {/* Top KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <ScorecardWidget
          label="SLA Compliance"
          value={slaStats.compliance}
          unit="%"
          icon={Target}
          iconColor="var(--success)"
          iconBg="var(--success-bg)"
          accentColor="var(--success)"
          sparklineData={sparklineSlaBreaches.length > 0 ? sparklineSlaBreaches : undefined}
          sparklineColor="var(--success)"
          change={{ value: slaStats.breached, label: 'breaches', isPositive: slaStats.breached === 0 }}
          {...pinProps('overview_sla_compliance', 'SLA Compliance')}
        />
        <ScorecardWidget
          label="First Response"
          value={responseStats.formatted}
          icon={Activity}
          iconColor="var(--accent)"
          iconBg="var(--accent-subtle)"
          accentColor="var(--accent)"
          sparklineData={sparklineTicketVolume.length > 0 ? sparklineTicketVolume : undefined}
          sparklineColor="var(--accent)"
          {...pinProps('overview_first_response', 'First Response')}
        />
        <ScorecardWidget
          label="Avg Resolution"
          value={resolutionStats.formatted}
          icon={Clock}
          iconColor="var(--warning)"
          iconBg="var(--warning-bg)"
          accentColor="var(--warning)"
          sparklineData={sparklineResolution.length > 0 ? sparklineResolution : undefined}
          sparklineColor="var(--warning)"
          change={{ value: openCount, label: 'open tickets', isPositive: openCount === 0 }}
          {...pinProps('overview_avg_resolution', 'Avg Resolution')}
        />
        {isAdminOrAgent && (
          <ScorecardWidget
            label="Open Tickets"
            value={openCount}
            icon={AlertCircle}
            iconColor="var(--info)"
            iconBg="var(--info-bg)"
            accentColor="var(--info)"
            sparklineData={sparklineTicketVolume.length > 0 ? sparklineTicketVolume : undefined}
            sparklineColor="var(--info)"
            change={{ value: progressCount, label: 'in progress', isPositive: progressCount < openCount }}
            {...pinProps('overview_open_tickets', 'Open Tickets')}
          />
        )}
      </div>

      {/* Donuts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
        <CardSection title="Status Distribution" icon={BarChart3} {...pinProps('chart_status_donut', 'Status Distribution', 'chart')}>
          <InteractiveDonutChart
            data={statusSegments}
            total={total}
            totalLabel="tickets"
            height={280}
            showExport={true}
            onSegmentClick={onDrillDown ? (seg) => onDrillDown({
              label: `Status: ${seg.name}`,
              filterKey: 'status',
              filterValue: seg.name.toLowerCase().replace(/ /g, '_'),
              count: seg.value,
            }) : undefined}
            exportFilename="overview-status-distribution"
          />
        </CardSection>
        <CardSection title="Ticket Types" icon={PieChart} {...pinProps('chart_type_donut', 'Ticket Types', 'chart')}>
          <InteractiveDonutChart
            data={typeSegments}
            total={total}
            totalLabel="tickets"
            height={280}
            showExport={true}
            onSegmentClick={onDrillDown ? (seg) => onDrillDown({
              label: `Type: ${seg.name}`,
              filterKey: 'ticket_type',
              filterValue: seg.name.toLowerCase().replace(/ /g, '_'),
              count: seg.value,
            }) : undefined}
            exportFilename="overview-ticket-types"
          />
        </CardSection>
      </div>

      {/* Time-series chart */}
      {isAdminOrAgent && tsPoints.length > 0 && (
        <CardSection title="Ticket Volume Over Time" icon={TrendingUp} {...pinProps('chart_ticket_trend', 'Ticket Volume Over Time', 'chart')}>
          <InteractiveAreaChart
            data={tsPoints.map(p => ({ name: new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), created: p.created || 0, resolved: p.resolved || 0 }))}
            series={[
              { dataKey: 'created', name: 'Created', color: 'var(--accent)' },
              { dataKey: 'resolved', name: 'Resolved', color: 'var(--success)' },
            ]}
            height={200}
            showExport={true}
            showGrid={true}
            exportFilename="overview-ticket-volume"
            onPointClick={onDrillDown ? (datum) => {
              const val = (datum.created || datum.resolved || 0) as number;
              onDrillDown({
                label: `Date: ${datum.name}`,
                filterKey: 'status',
                filterValue: 'open',
                count: val,
              });
            } : undefined}
          />
        </CardSection>
      )}

      {/* Category breakdown */}
      <CardSection title="Top Categories" icon={Layers} {...pinProps('chart_category_bar', 'Top Categories', 'chart')}>
        {categoryBarData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>No categories found</div>
        ) : (
          <InteractiveBarChart
            data={categoryBarData}
            layout="horizontal"
            height={Math.max(180, categoryBarData.length * 50)}
            showExport={true}
            onBarClick={onDrillDown ? (datum) => onDrillDown({
              label: `Category: ${datum.name}`,
              filterKey: 'category',
              filterValue: datum.name,
              count: datum.value,
            }) : undefined}
            exportFilename="overview-categories"
            showGrid={false}
          />
        )}
      </CardSection>

      {/* Domain summary cards */}
      {isAdminOrAgent && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div className="rp-card card" style={{ padding: 20, borderRadius: 14, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Monitor size={14} color="var(--info)" /> <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Assets</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{assetStats?.total ?? '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Total assets tracked</div>
          </div>
          <div className="rp-card card" style={{ padding: 20, borderRadius: 14, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <BookOpen size={14} color="var(--success)" /> <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Knowledge Base</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{knowledgeStats?.total ?? '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {knowledgeStats ? `${knowledgeStats.byStatus.find(s => s.status === 'published')?.count || 0} published` : 'Articles'}
            </div>
          </div>
          <div className="rp-card card" style={{ padding: 20, borderRadius: 14, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Bot size={14} color="var(--accent)" /> <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>AI Queries</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{aiAnalytics?.summary?.total_queries ?? '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {aiAnalytics ? `${Math.round(aiAnalytics.summary.avg_confidence * 100)}% avg confidence` : 'AI analytics'}
            </div>
          </div>
          <div className="rp-card card" style={{ padding: 20, borderRadius: 14, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Users size={14} color="var(--warning)" /> <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Users</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{adminStats?.users?.total ?? '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{adminStats?.users?.active_count ?? 0} active</div>
          </div>
        </div>
      )}

      {/* ITSM Summary cards */}
      {isAdminOrAgent && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>ITSM Overview</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div className="rp-card card" style={{ padding: 20, borderRadius: 14, border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => onTabChange('problems')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Bug size={14} color="var(--warning)" /> <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Problems</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{problemData?.total ?? '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {problemData ? `${problemData.by_status?.open ?? 0} open · MTTR ${problemData.mttr_hours ? problemData.mttr_hours.toFixed(1) + 'h' : 'N/A'}` : 'Problem management'}
              </div>
            </div>
            <div className="rp-card card" style={{ padding: 20, borderRadius: 14, border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => onTabChange('changes')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Wrench size={14} color="var(--accent)" /> <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Changes</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{changeData?.total ?? '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {changeData ? `${changeData.success_rate ?? 0}% success · ${changeData.emergency_count ?? 0} emergency` : 'Change management'}
              </div>
            </div>
            <div className="rp-card card" style={{ padding: 20, borderRadius: 14, border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => onTabChange('approvals')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <CheckSquare size={14} color="var(--success)" /> <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Approvals</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{approvalData?.total ?? '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {approvalData ? `${approvalData.approval_rate ?? 0}% approved · ${approvalData.overdue_count ?? 0} overdue` : 'Approval workflows'}
              </div>
            </div>
            <div className="rp-card card" style={{ padding: 20, borderRadius: 14, border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => onTabChange('licenses')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <DollarSign size={14} color="#22c55e" /> <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Licenses</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{licenseData?.total ?? '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {licenseData ? `${licenseData.utilization_rate ?? 0}% utilized · ${licenseData.expiring_soon ?? 0} expiring` : 'Software licenses'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
