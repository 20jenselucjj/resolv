'use client';

import { useMemo } from 'react';
import {
  BarChart3, Target, Clock, AlertCircle, Star, Activity, ShieldCheck,
  TrendingUp, Download, Layers, PieChart,
} from 'lucide-react';
import {
  InteractiveDonutChart, InteractiveBarChart, InteractiveLineChart, InteractiveAreaChart,
} from '../components/recharts';
import { cssVar } from '../components/recharts/export-utils';
import { CardSection } from '../components/Charts';
import { EmptyState } from '../components/shared';
import { STATUS_COLORS } from '../types';
import type {
  Ticket, AdminStats, TimeSeriesData, AssetStats, KnowledgeStats, AIAnalytics,
  ProblemReportData, ChangeReportData, ApprovalReportData, LicenseReportData,
  ReportTab, DrillDownLevel, ComparisonData,
} from '../types';
import KPITile from './components/KPITile';
import RAGScorecard from './components/RAGScorecard';
import AgentPerformanceTable from './components/AgentPerformanceTable';
import type { RAGStatus, DomainHealth } from './components/RAGScorecard';

// ── Props ──────────────────────────────────────────────────────

interface OverviewSectionProps {
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
  timeRange: string;
  onTabChange: (tab: ReportTab) => void;
  onExportOverview: () => void;
  onDrillDown?: (level: DrillDownLevel) => void;
  onCrossFilterChange?: (key: string, value: string | null) => void;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
  comparisonData?: ComparisonData | null;
  comparisonLoading?: boolean;
}

// ── Format helpers ─────────────────────────────────────────────

function formatHrs(hrs: number): string {
  if (hrs <= 0) return 'N/A';
  return hrs < 24 ? `${hrs.toFixed(1)}h` : `${(hrs / 24).toFixed(1)}d`;
}

function getRAGForResolution(hrs: number): RAGStatus {
  if (hrs <= 0) return 'green';
  if (hrs < 22) return 'green';
  if (hrs < 30) return 'yellow';
  return 'red';
}

function getRAGForSLA(compliance: number): RAGStatus {
  if (compliance >= 95) return 'green';
  if (compliance >= 90) return 'yellow';
  return 'red';
}

function getRAGForFCR(fcr: number): RAGStatus {
  if (fcr >= 74) return 'green';
  if (fcr >= 60) return 'yellow';
  return 'red';
}

function getRAGForCSAT(csat: number): RAGStatus {
  if (csat >= 4.0) return 'green';
  if (csat >= 3.5) return 'yellow';
  return 'red';
}

function getRAGForBreaches(count: number): RAGStatus {
  if (count === 0) return 'green';
  if (count <= 5) return 'yellow';
  return 'red';
}

function pinProps(
  isMetricPinned: ((key: string) => boolean) | undefined,
  handlePin: ((key: string, label: string, type?: string, config?: any) => void) | undefined,
  handleUnpin: ((key: string) => void) | undefined,
  key: string,
  label: string,
  type: string = 'kpi',
) {
  if (!isMetricPinned || !handlePin || !handleUnpin) return {};
  return {
    metricKey: key,
    metricLabel: label,
    isPinned: isMetricPinned(key),
    onPin: () => handlePin(key, label, type),
    onUnpin: () => handleUnpin(key),
  };
}

// ── Component ──────────────────────────────────────────────────

export default function OverviewSection(props: OverviewSectionProps) {
  const {
    tickets, filteredTickets, adminStats, timeSeries, assetStats,
    knowledgeStats, aiAnalytics, problemData, changeData, approvalData, licenseData,
    isAdminOrAgent, timeRange, onTabChange, onExportOverview, onDrillDown,
    onCrossFilterChange,
    isMetricPinned, handlePin, handleUnpin,
    comparisonData,
  } = props;

  const total = filteredTickets.length;

  // ── Core KPI Computations ────────────────────────────────────────────────────

  const slaStats = useMemo(() => {
    const breached = filteredTickets.filter((t) => t.sla_breached).length;
    return {
      breached,
      compliance: total ? Math.round(((total - breached) / total) * 100) : 100,
    };
  }, [filteredTickets, total]);

  const responseStats = useMemo(() => {
    const withResponse = filteredTickets.filter((t) => t.first_response_at);
    if (!withResponse.length) return { avg: 0, formatted: 'N/A' };
    const sum = withResponse.reduce(
      (a, t) => a + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()),
      0,
    );
    const hrs = sum / withResponse.length / 3600000;
    return { avg: hrs, formatted: hrs < 1 ? `${Math.round(hrs * 60)}m` : `${hrs.toFixed(1)}h` };
  }, [filteredTickets]);

  const resolutionStats = useMemo(() => {
    const resolved = filteredTickets.filter((t) => ['resolved', 'closed'].includes(t.status.toLowerCase()));
    if (!resolved.length) return { avgHrs: 0, formatted: 'N/A' };
    const sum = resolved.reduce((a, t) => {
      const end = t.resolved_at || t.closed_at || t.updated_at;
      return a + (new Date(end).getTime() - new Date(t.created_at).getTime());
    }, 0);
    const hrs = sum / resolved.length / 3600000;
    return { avgHrs: hrs, formatted: formatHrs(hrs) };
  }, [filteredTickets]);

  const openCount = filteredTickets.filter((t) => t.status === 'open').length;
  const progressCount = filteredTickets.filter((t) => t.status === 'in_progress').length;
  const resolvedCount = filteredTickets.filter((t) => ['resolved', 'closed'].includes(t.status.toLowerCase())).length;

  const csatAvg = useMemo(() => {
    const rated = filteredTickets.filter(
      (t): t is Ticket & { satisfaction_rating: number } =>
        t.satisfaction_rating !== null && t.satisfaction_rating !== undefined,
    );
    if (!rated.length) return null;
    const sum = rated.reduce((a, t) => a + t.satisfaction_rating, 0);
    return sum / rated.length;
  }, [filteredTickets]);

  const fcrRate = useMemo(() => {
    const resolved = filteredTickets.filter((t) => ['resolved', 'closed'].includes(t.status.toLowerCase()));
    if (!resolved.length) return 0;
    const withFirstResponse = resolved.filter((t) => t.first_response_at).length;
    return Math.round((withFirstResponse / resolved.length) * 100);
  }, [filteredTickets]);

  const activeBreaches = adminStats?.sla?.breached_count ?? slaStats.breached;

  // ── Comparison helpers ───────────────────────────────────────────────────────

  const getComparison = (key: string): { value: number; isPositive: boolean } | undefined => {
    if (!comparisonData?.changes?.[key]) return undefined;
    const ch = comparisonData.changes[key];
    return {
      value: Math.round(Math.abs(ch.change_pct ?? 0)),
      isPositive: (ch.change_pct ?? 0) >= 0,
    };
  };

  // ── Sparklines ─────────────────────────────────────────────────────────────

  const tsPoints = timeSeries?.tickets || [];
  const slaTsPoints = timeSeries?.sla || [];

  const sparklineTicketVolume = useMemo(() => {
    if (tsPoints.length) return tsPoints.map((p) => ({ value: p.created || 0 }));
    const buckets: Record<string, number> = {};
    filteredTickets.forEach((t) => {
      const d = t.created_at.split('T')[0];
      buckets[d] = (buckets[d] || 0) + 1;
    });
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, count]) => ({ value: count }));
  }, [tsPoints, filteredTickets]);

  const sparklineResolved = useMemo(() => {
    if (tsPoints.length) return tsPoints.map((p) => ({ value: p.resolved || 0 }));
    const buckets: Record<string, number> = {};
    filteredTickets.forEach((t) => {
      if (t.resolved_at) {
        const d = t.resolved_at.split('T')[0];
        buckets[d] = (buckets[d] || 0) + 1;
      }
    });
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, count]) => ({ value: count }));
  }, [tsPoints, filteredTickets]);

  const sparklineSLA = useMemo(() => {
    if (slaTsPoints.length) return slaTsPoints.map((p) => ({ value: p.breached || 0 }));
    return [];
  }, [slaTsPoints]);

  const sparklineResolution = useMemo(() => {
    if (timeSeries?.avg_resolution?.length) {
      return timeSeries.avg_resolution.map((p) => ({ value: Math.round(p.hours || 0) }));
    }
    if (resolutionStats.avgHrs > 0) return [{ value: Math.round(resolutionStats.avgHrs) }];
    return [];
  }, [timeSeries, resolutionStats.avgHrs]);

  // ── Breakdowns ─────────────────────────────────────────────────────────────

  const statusBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    filteredTickets.forEach((t) => {
      m[t.status] = (m[t.status] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filteredTickets]);

  const categoryBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    filteredTickets.forEach((t) => {
      const c = t.category_name || 'Uncategorized';
      m[c] = (m[c] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [filteredTickets]);

  const typeBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    filteredTickets.forEach((t) => {
      const ty = t.ticket_type || 'incident';
      m[ty] = (m[ty] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filteredTickets]);

  const statusSegments = statusBreakdown.map(([status, count]) => ({
    name: status.replace(/_/g, ' '),
    value: count,
    color: STATUS_COLORS[status] || cssVar('--text-muted', '#9CA3AF'),
  }));

  const categoryBarData = categoryBreakdown.map(([cat, count]) => ({ name: cat, value: count }));

  // ── Trend chart data (last 12 points) ────────────────────────────────────────

  const last12Points = useMemo(() => {
    const pts = tsPoints.length ? tsPoints : [];
    const sliced = pts.slice(-12);
    return sliced.map((p) => ({
      name: new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      created: p.created || 0,
      resolved: p.resolved || 0,
      net: (p.created || 0) - (p.resolved || 0),
    }));
  }, [tsPoints]);

  const slaTrendData = useMemo(() => {
    const pts = slaTsPoints.length ? slaTsPoints : tsPoints;
    const sliced = pts.slice(-12);
    return sliced.map((p) => {
      const created = p.created || 1;
      const breached = p.breached || 0;
      const compliance = Math.round(((created - breached) / created) * 100);
      return {
        name: new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        compliance,
        breached,
      };
    });
  }, [slaTsPoints, tsPoints]);

  // ── Agent Performance ──────────────────────────────────────────────────────

  const agentMetrics = useMemo(() => {
    const agentMap: Record<string, {
      resolved: number;
      resolutionTimes: number[];
      csatScores: number[];
      slaBreached: number;
      slaTotal: number;
      weekly: Record<string, number>;
    }> = {};

    filteredTickets.forEach((t) => {
      const name = t.assigned_to_name || 'Unassigned';
      if (!agentMap[name]) {
        agentMap[name] = {
          resolved: 0, resolutionTimes: [], csatScores: [], slaBreached: 0, slaTotal: 0, weekly: {},
        };
      }
      const a = agentMap[name];
      a.slaTotal += 1;
      if (t.sla_breached) a.slaBreached += 1;

      if (['resolved', 'closed'].includes(t.status.toLowerCase())) {
        a.resolved += 1;
        const end = t.resolved_at || t.closed_at || t.updated_at;
        const hrs = (new Date(end).getTime() - new Date(t.created_at).getTime()) / 3600000;
        a.resolutionTimes.push(hrs);

        const week = new Date(t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        a.weekly[week] = (a.weekly[week] || 0) + 1;
      }

      if (t.satisfaction_rating !== null && t.satisfaction_rating !== undefined) {
        a.csatScores.push(t.satisfaction_rating);
      }
    });

    return Object.entries(agentMap)
      .sort(([, a], [, b]) => b.resolved - a.resolved)
      .slice(0, 5)
      .map(([name, data]) => {
        const avgHrs = data.resolutionTimes.length
          ? data.resolutionTimes.reduce((s, v) => s + v, 0) / data.resolutionTimes.length
          : 0;
        const csat = data.csatScores.length
          ? data.csatScores.reduce((s, v) => s + v, 0) / data.csatScores.length
          : null;
        const slaCompliance = data.slaTotal
          ? Math.round(((data.slaTotal - data.slaBreached) / data.slaTotal) * 100)
          : 100;
        const weeklyTrend = Object.entries(data.weekly)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, count]) => count);

        return {
          name,
          ticketsResolved: data.resolved,
          avgResolutionTime: formatHrs(avgHrs),
          csat,
          slaCompliance,
          weeklyTrend: weeklyTrend.length ? weeklyTrend : [0],
        };
      });
  }, [filteredTickets]);

  // ── RAG Scorecard Data ─────────────────────────────────────────────────────

  const domainHealth: DomainHealth[] = useMemo(() => {
    const domains: DomainHealth[] = [];

    // Incident Management
    const incidentResolved = filteredTickets.filter(
      (t) => t.ticket_type === 'incident' && ['resolved', 'closed'].includes(t.status.toLowerCase()),
    ).length;
    const incidentTotal = filteredTickets.filter((t) => t.ticket_type === 'incident').length || 1;
    const incidentSLA = filteredTickets.filter((t) => t.ticket_type === 'incident' && !t.sla_breached).length;
    const incidentCompliance = Math.round((incidentSLA / incidentTotal) * 100);
    const incidentMTTR = problemData?.mttr_hours ?? resolutionStats.avgHrs;
    const incidentFCR = incidentResolved ? Math.round((incidentResolved / incidentTotal) * 100) : 0;

    let incidentStatus: RAGStatus = 'green';
    if (incidentCompliance < 90 || incidentMTTR > 30 || incidentFCR < 60) incidentStatus = 'red';
    else if (incidentCompliance < 95 || incidentMTTR > 22 || incidentFCR < 74) incidentStatus = 'yellow';

    domains.push({
      name: 'Incident Management',
      status: incidentStatus,
      metrics: [
        { label: 'MTTR', value: formatHrs(incidentMTTR) },
        { label: 'FCR', value: incidentFCR, unit: '%' },
        { label: 'SLA', value: incidentCompliance, unit: '%' },
      ],
      trend: incidentCompliance >= 95 ? 'up' : incidentCompliance < 90 ? 'down' : 'flat',
    });

    // Service Requests
    const srTotal = filteredTickets.filter((t) => t.ticket_type === 'service_request').length || 1;
    const srOpen = filteredTickets.filter((t) => t.ticket_type === 'service_request' && ['open', 'in_progress'].includes(t.status.toLowerCase())).length;
    const srResolved = filteredTickets.filter(
      (t) => t.ticket_type === 'service_request' && ['resolved', 'closed'].includes(t.status.toLowerCase()),
    );
    const srAvgHrs = srResolved.length
      ? srResolved.reduce((a, t) => {
          const end = t.resolved_at || t.closed_at || t.updated_at;
          return a + (new Date(end).getTime() - new Date(t.created_at).getTime()) / 3600000;
        }, 0) / srResolved.length
      : 0;

    let srStatus: RAGStatus = 'green';
    if (srOpen > 20 || srAvgHrs > 48) srStatus = 'red';
    else if (srOpen > 10 || srAvgHrs > 24) srStatus = 'yellow';

    domains.push({
      name: 'Service Requests',
      status: srStatus,
      metrics: [
        { label: 'Fulfillment', value: formatHrs(srAvgHrs) },
        { label: 'Backlog', value: srOpen },
        { label: 'Resolved', value: srResolved.length },
      ],
      trend: srOpen <= 5 ? 'up' : srOpen > 15 ? 'down' : 'flat',
    });

    // Problem Management
    const probOpen = problemData?.by_status?.open ?? 0;
    const probTotal = problemData?.total ?? 0;
    const probRCA = problemData?.incident_link_rate ?? 0;
    const probMTTR = problemData?.mttr_hours ?? 0;

    let probStatus: RAGStatus = 'green';
    if (probOpen > 10 || probRCA < 50 || probMTTR > 48) probStatus = 'red';
    else if (probOpen > 5 || probRCA < 70 || probMTTR > 30) probStatus = 'yellow';

    domains.push({
      name: 'Problem Management',
      status: probStatus,
      metrics: [
        { label: 'Open Problems', value: probOpen },
        { label: 'RCA Rate', value: Math.round(probRCA), unit: '%' },
        { label: 'MTTR', value: formatHrs(probMTTR) },
      ],
      trend: probOpen <= 3 ? 'up' : probOpen > 8 ? 'down' : 'flat',
    });

    // Change Management
    const changeSuccess = changeData?.success_rate ?? 0;
    const changeEmergency = changeData?.emergency_rate ?? 0;
    const changeTotal = changeData?.total ?? 0;

    let changeStatus: RAGStatus = 'green';
    if (changeSuccess < 80 || changeEmergency > 15) changeStatus = 'red';
    else if (changeSuccess < 90 || changeEmergency > 10) changeStatus = 'yellow';

    domains.push({
      name: 'Change Management',
      status: changeStatus,
      metrics: [
        { label: 'Success Rate', value: Math.round(changeSuccess), unit: '%' },
        { label: 'Emergency %', value: Math.round(changeEmergency), unit: '%' },
        { label: 'Total', value: changeTotal },
      ],
      trend: changeSuccess >= 95 ? 'up' : changeSuccess < 85 ? 'down' : 'flat',
    });

    // Knowledge Base
    const kbTotal = knowledgeStats?.total ?? 0;
    const kbPublished = knowledgeStats?.byStatus?.find((s) => s.status === 'published')?.count ?? 0;
    const kbViews = knowledgeStats?.viewsDaily?.reduce((a, d) => a + d.count, 0) ?? 0;
    const deflectionRate = kbTotal > 0 ? Math.round((kbViews / (kbTotal * 5)) * 100) : 0; // proxy

    let kbStatus: RAGStatus = 'green';
    if (kbTotal < 10 || deflectionRate < 20) kbStatus = 'red';
    else if (kbTotal < 25 || deflectionRate < 40) kbStatus = 'yellow';

    domains.push({
      name: 'Knowledge Base',
      status: kbStatus,
      metrics: [
        { label: 'Articles', value: kbTotal },
        { label: 'Published', value: kbPublished },
        { label: 'Deflection', value: Math.min(deflectionRate, 100), unit: '%' },
      ],
      trend: kbViews > 50 ? 'up' : kbViews < 20 ? 'down' : 'flat',
    });

    // Agent Performance
    const avgCSAT = csatAvg ?? 0;
    const agentUtil = agentMetrics.length
      ? Math.round((agentMetrics.reduce((a, ag) => a + ag.ticketsResolved, 0) / (total || 1)) * 100)
      : 0;

    let agentStatus: RAGStatus = 'green';
    if (avgCSAT < 3.5 || agentUtil > 90) agentStatus = 'red';
    else if (avgCSAT < 4.0 || agentUtil > 75) agentStatus = 'yellow';

    domains.push({
      name: 'Agent Performance',
      status: agentStatus,
      metrics: [
        { label: 'Utilization', value: agentUtil, unit: '%' },
        { label: 'CSAT', value: avgCSAT ? avgCSAT.toFixed(1) : '—' },
        { label: 'Top Agents', value: agentMetrics.length },
      ],
      trend: avgCSAT >= 4.2 ? 'up' : avgCSAT < 3.8 ? 'down' : 'flat',
    });

    return domains;
  }, [filteredTickets, problemData, changeData, knowledgeStats, csatAvg, agentMetrics, total, resolutionStats.avgHrs]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Export button */}
      {isAdminOrAgent && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onExportOverview}
            className="btn btn-secondary btn-sm"
            aria-label="Export overview analytics"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={13} /> Export Overview
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          ROW 1: Headline KPI Tiles
          ═══════════════════════════════════════════════════════════ */}
      <section aria-label="Key performance indicators">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
          }}
        >
          <KPITile
            label="Total Tickets"
            value={total.toLocaleString()}
            icon={BarChart3}
            iconColor="var(--accent)"
            iconBg="var(--accent-subtle)"
            accentColor="var(--accent)"
            sparklineData={sparklineTicketVolume}
            sparklineColor="var(--accent)"
            change={getComparison('total_tickets')}
            {...pinProps(isMetricPinned, handlePin, handleUnpin, 'overview_total_tickets', 'Total Tickets')}
          />

          <KPITile
            label="Avg Resolution Time"
            value={resolutionStats.formatted}
            ragStatus={getRAGForResolution(resolutionStats.avgHrs)}
            icon={Clock}
            iconColor="var(--warning)"
            iconBg="var(--warning-bg)"
            accentColor="var(--warning)"
            sparklineData={sparklineResolution}
            sparklineColor="var(--warning)"
            change={getComparison('avg_resolution_hours')}
            target={resolutionStats.avgHrs > 0 ? { current: Math.max(0, 30 - resolutionStats.avgHrs), target: 30, label: 'vs target' } : undefined}
            {...pinProps(isMetricPinned, handlePin, handleUnpin, 'overview_avg_resolution', 'Avg Resolution Time')}
          />

          <KPITile
            label="SLA Compliance"
            value={slaStats.compliance}
            unit="%"
            ragStatus={getRAGForSLA(slaStats.compliance)}
            icon={Target}
            iconColor={slaStats.compliance >= 95 ? 'var(--success)' : slaStats.compliance >= 90 ? 'var(--warning)' : 'var(--danger)'}
            iconBg={slaStats.compliance >= 95 ? 'var(--success-bg)' : slaStats.compliance >= 90 ? 'var(--warning-bg)' : 'var(--danger-bg)'}
            accentColor={slaStats.compliance >= 95 ? 'var(--success)' : slaStats.compliance >= 90 ? 'var(--warning)' : 'var(--danger)'}
            sparklineData={sparklineSLA}
            sparklineColor={slaStats.compliance >= 95 ? 'var(--success)' : 'var(--danger)'}
            change={getComparison('sla_compliance_pct')}
            target={{ current: slaStats.compliance, target: 95, label: 'vs 95%' }}
            {...pinProps(isMetricPinned, handlePin, handleUnpin, 'overview_sla_compliance', 'SLA Compliance')}
          />

          <KPITile
            label="First Contact Resolution"
            value={fcrRate}
            unit="%"
            ragStatus={getRAGForFCR(fcrRate)}
            icon={ShieldCheck}
            iconColor="var(--success)"
            iconBg="var(--success-bg)"
            accentColor="var(--success)"
            change={{
              value: fcrRate,
              label: 'of resolved',
              isPositive: fcrRate >= 74,
            }}
            target={{ current: fcrRate, target: 74, label: 'vs 74%' }}
            {...pinProps(isMetricPinned, handlePin, handleUnpin, 'overview_fcr', 'First Contact Resolution')}
          />

          {csatAvg !== null && (
            <KPITile
              label="CSAT Score"
              value={csatAvg.toFixed(1)}
              unit="/5"
              ragStatus={getRAGForCSAT(csatAvg)}
              icon={Star}
              iconColor="var(--warning)"
              iconBg="var(--warning-bg)"
              accentColor="var(--warning)"
              change={getComparison('csat_avg')}
              target={{ current: csatAvg, target: 4.0, label: 'vs 4.0' }}
              {...pinProps(isMetricPinned, handlePin, handleUnpin, 'overview_csat', 'CSAT Score')}
            />
          )}

          <KPITile
            label="Tickets Resolved"
            value={resolvedCount.toLocaleString()}
            icon={Activity}
            iconColor="var(--success)"
            iconBg="var(--success-bg)"
            accentColor="var(--success)"
            sparklineData={sparklineResolved}
            sparklineColor="var(--success)"
            change={getComparison('resolved_tickets')}
            {...pinProps(isMetricPinned, handlePin, handleUnpin, 'overview_resolved', 'Tickets Resolved')}
          />

          <KPITile
            label="Active SLA Breaches"
            value={activeBreaches}
            ragStatus={getRAGForBreaches(activeBreaches)}
            icon={AlertCircle}
            iconColor={activeBreaches === 0 ? 'var(--success)' : activeBreaches <= 5 ? 'var(--warning)' : 'var(--danger)'}
            iconBg={activeBreaches === 0 ? 'var(--success-bg)' : activeBreaches <= 5 ? 'var(--warning-bg)' : 'var(--danger-bg)'}
            accentColor={activeBreaches === 0 ? 'var(--success)' : activeBreaches <= 5 ? 'var(--warning)' : 'var(--danger)'}
            change={{
              value: activeBreaches,
              label: 'breaches',
              isPositive: activeBreaches === 0,
            }}
            target={activeBreaches > 0 ? { current: Math.max(0, 5 - activeBreaches), target: 5, label: 'until red' } : undefined}
            {...pinProps(isMetricPinned, handlePin, handleUnpin, 'overview_sla_breaches', 'Active SLA Breaches')}
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          ROW 2: RAG Traffic-Light Scorecard
          ═══════════════════════════════════════════════════════════ */}
      {isAdminOrAgent && (
        <section aria-label="Service health scorecard">
          <div style={{ marginBottom: 12 }}>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <TrendingUp size={16} color="var(--accent)" />
              Service Health Overview
            </h2>
          </div>
          <RAGScorecard
            domains={domainHealth}
            onDomainClick={(name) => {
              const map: Record<string, ReportTab> = {
                'Incident Management': 'tickets',
                'Service Requests': 'tickets',
                'Problem Management': 'problems',
                'Change Management': 'changes',
                'Knowledge Base': 'knowledge',
                'Agent Performance': 'performance',
              };
              onTabChange(map[name] || 'overview');
            }}
          />
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          ROW 3: Trend Charts (2-column)
          ═══════════════════════════════════════════════════════════ */}
      {isAdminOrAgent && (
        <section aria-label="Trend charts">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
              gap: 20,
            }}
          >
            {/* Ticket Volume Trend */}
            <CardSection
              title="Ticket Volume Trend"
              icon={BarChart3}
              {...pinProps(isMetricPinned, handlePin, handleUnpin, 'chart_ticket_trend', 'Ticket Volume Trend', 'chart')}
            >
              {last12Points.length > 0 ? (
                <InteractiveLineChart
                  data={last12Points}
                  series={[
                    { dataKey: 'created', name: 'Created', color: 'var(--accent)', strokeWidth: 2.5 },
                    { dataKey: 'resolved', name: 'Resolved', color: 'var(--success)', strokeWidth: 2.5 },
                  ]}
                  height={240}
                  showExport={true}
                  showGrid={true}
                  exportFilename="overview-ticket-volume-trend"
                  fillArea={true}
                  onPointClick={
                    onDrillDown
                      ? (datum) =>
                          onDrillDown({
                            label: `Date: ${datum.name}`,
                            filterKey: 'status',
                            filterValue: 'open',
                            count: (datum.created || 0) as number,
                          })
                      : undefined
                  }
                />
              ) : (
                <EmptyState
                  title="No trend data available"
                  description="Ticket volume trends will appear once there is sufficient data for the selected time range."
                  size="sm"
                />
              )}
            </CardSection>

            {/* SLA Compliance Trend */}
            <CardSection
              title="SLA Compliance Trend"
              icon={Target}
              {...pinProps(isMetricPinned, handlePin, handleUnpin, 'chart_sla_trend', 'SLA Compliance Trend', 'chart')}
            >
              {slaTrendData.length > 0 ? (
                <InteractiveAreaChart
                  data={slaTrendData}
                  series={[
                    { dataKey: 'compliance', name: 'Compliance %', color: 'var(--success)', fillOpacity: 0.2 },
                  ]}
                  height={240}
                  showExport={true}
                  showGrid={true}
                  exportFilename="overview-sla-compliance-trend"
                  unit="%"
                  onPointClick={
                    onDrillDown
                      ? (datum) =>
                          onDrillDown({
                            label: `Date: ${datum.name}`,
                            filterKey: 'status',
                            filterValue: 'open',
                            count: (datum.compliance || 0) as number,
                          })
                      : undefined
                  }
                />
              ) : (
                <EmptyState
                  title="No SLA trend data available"
                  description="SLA compliance trends will appear once there is sufficient ticket data for the selected period."
                  size="sm"
                />
              )}
            </CardSection>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          ROW 4: Service Health Overview (Donut)
          ═══════════════════════════════════════════════════════════ */}
      <section aria-label="Ticket status distribution">
        <CardSection
          title="Service Health Overview"
          icon={PieChart}
          {...pinProps(isMetricPinned, handlePin, handleUnpin, 'chart_status_donut', 'Service Health Overview', 'chart')}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 24,
              alignItems: 'center',
            }}
          >
            <div style={{ minHeight: 280 }}>
              {statusSegments.length > 0 ? (
                <InteractiveDonutChart
                  data={statusSegments}
                  total={total}
                  totalLabel="active tickets"
                  height={280}
                  showExport={true}
                  onSegmentClick={
                    onDrillDown || onCrossFilterChange
                      ? (seg) => {
                          const statusValue = seg.name.toLowerCase().replace(/ /g, '_');
                          onCrossFilterChange?.('status', statusValue);
                          onDrillDown?.({
                            label: `Status: ${seg.name}`,
                            filterKey: 'status',
                            filterValue: statusValue,
                            count: seg.value,
                          });
                        }
                      : undefined
                  }
                  exportFilename="overview-status-distribution"
                />
              ) : (
                <EmptyState
                  title="No status data available"
                  description="Ticket status distribution will appear once tickets are created."
                  size="sm"
                />
              )}
            </div>

            {/* Status legend / details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {statusBreakdown.map(([status, count]) => {
                const pct = total ? Math.round((count / total) * 100) : 0;
                return (
                  <div
                    key={status}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: STATUS_COLORS[status] || 'var(--text-muted)',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>
                      {status.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                      {count.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardSection>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          ROW 5: Top Categories + Agent Performance
          ═══════════════════════════════════════════════════════════ */}
      <section aria-label="Categories and agent performance">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
            gap: 20,
          }}
        >
          {/* Top Categories */}
          <CardSection
            title="Top Categories"
            icon={Layers}
            {...pinProps(isMetricPinned, handlePin, handleUnpin, 'chart_category_bar', 'Top Categories', 'chart')}
          >
            {categoryBarData.length > 0 ? (
              <InteractiveBarChart
                data={categoryBarData}
                layout="horizontal"
                height={Math.max(200, categoryBarData.length * 44)}
                showExport={true}
                showGrid={false}
                onBarClick={
                  onDrillDown || onCrossFilterChange
                    ? (datum) => {
                        onCrossFilterChange?.('category', datum.name);
                        onDrillDown?.({
                          label: `Category: ${datum.name}`,
                          filterKey: 'category',
                          filterValue: datum.name,
                          count: datum.value,
                        });
                      }
                    : undefined
                }
                exportFilename="overview-top-categories"
              />
            ) : (
              <EmptyState
                title="No category data available"
                description="Top categories will appear once tickets are categorized."
                size="sm"
              />
            )}
          </CardSection>

          {/* Agent Performance Snapshot */}
          <CardSection
            title="Agent Performance Snapshot"
            icon={Activity}
            {...pinProps(isMetricPinned, handlePin, handleUnpin, 'table_agent_performance', 'Agent Performance Snapshot', 'table')}
          >
            <AgentPerformanceTable
              agents={agentMetrics}
              emptyMessage="No agent data available for the selected period."
            />
          </CardSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          ROW 6: Domain Summary Cards (legacy, admin-only)
          ═══════════════════════════════════════════════════════════ */}
      {isAdminOrAgent && (
        <section aria-label="Domain summaries">
          <div style={{ marginBottom: 12 }}>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Activity size={16} color="var(--accent)" />
              ITSM Module Summary
            </h2>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
            }}
          >
            {/* Problems */}
            <div
              className="rp-card card"
              style={{
                padding: 20,
                borderRadius: 14,
                border: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s, transform 0.15s',
              }}
              onClick={() => onTabChange('problems')}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'var(--warning-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AlertCircle size={14} color="var(--warning)" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Problems</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)' }}>
                {problemData?.total ?? '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {problemData
                  ? `${problemData.by_status?.open ?? 0} open · MTTR ${problemData.mttr_hours ? problemData.mttr_hours.toFixed(1) + 'h' : 'N/A'}`
                  : 'Problem management'}
              </div>
            </div>

            {/* Changes */}
            <div
              className="rp-card card"
              style={{
                padding: 20,
                borderRadius: 14,
                border: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s, transform 0.15s',
              }}
              onClick={() => onTabChange('changes')}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'var(--accent-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Activity size={14} color="var(--accent)" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Changes</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)' }}>
                {changeData?.total ?? '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {changeData
                  ? `${changeData.success_rate ?? 0}% success · ${changeData.emergency_count ?? 0} emergency`
                  : 'Change management'}
              </div>
            </div>

            {/* Approvals */}
            <div
              className="rp-card card"
              style={{
                padding: 20,
                borderRadius: 14,
                border: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s, transform 0.15s',
              }}
              onClick={() => onTabChange('approvals')}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'var(--success-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShieldCheck size={14} color="var(--success)" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Approvals</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)' }}>
                {approvalData?.total ?? '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {approvalData
                  ? `${approvalData.approval_rate ?? 0}% approved · ${approvalData.overdue_count ?? 0} overdue`
                  : 'Approval workflows'}
              </div>
            </div>

            {/* Licenses */}
            <div
              className="rp-card card"
              style={{
                padding: 20,
                borderRadius: 14,
                border: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s, transform 0.15s',
              }}
              onClick={() => onTabChange('licenses')}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'rgba(34,197,94,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Target size={14} color="#22c55e" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Licenses</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)' }}>
                {licenseData?.total ?? '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {licenseData
                  ? `${licenseData.utilization_rate ?? 0}% utilized · ${licenseData.expiring_soon ?? 0} expiring`
                  : 'Software licenses'}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Non-admin notice */}
      {!isAdminOrAgent && (
        <div
          className="card"
          style={{
            padding: 32,
            borderRadius: 14,
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 14,
          }}
        >
          Executive insights are available for administrators and agents.
        </div>
      )}
    </div>
  );
}


