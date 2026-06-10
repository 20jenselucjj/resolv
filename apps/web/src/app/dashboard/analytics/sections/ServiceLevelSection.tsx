'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2, AlertTriangle, Clock, Gauge, TrendingUp,
  Shield, Users, BarChart3, AlertOctagon,
} from 'lucide-react';
import {
  ScorecardWidget, GaugeChart, InteractiveBarChart,
  InteractiveAreaChart, HeatmapChart,
} from '../components/recharts';
import { CardSection } from '../components/Charts';
import { EmptyState } from '../components/shared';
import { ExportButton } from '../components/export';
import type { Ticket, AdminStats, ComparisonData, TimeSeriesData, DrillDownLevel } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ServiceLevelSectionProps {
  filteredTickets: Ticket[];
  adminStats: AdminStats | null;
  isAdminOrAgent: boolean;
  onExportCSV: (section: string) => void;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
  comparisonData?: ComparisonData | null;
  timeSeries?: TimeSeriesData | null;
  onDrillDown?: (level: DrillDownLevel) => void;
  onCrossFilterChange?: (key: string, value: string | null) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SLA_TARGETS = {
  response: { P1: 1, P2: 4, P3: 8, P4: 24 } as Record<string, number>,
  resolution: { P1: 4, P2: 8, P3: 24, P4: 48 } as Record<string, number>,
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'P1 - Critical',
  high: 'P2 - High',
  medium: 'P3 - Medium',
  low: 'P4 - Low',
};

const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'];
const PRIORITY_TO_P: Record<string, string> = { critical: 'P1', high: 'P2', medium: 'P3', low: 'P4' };

const RAG = {
  good: '#16A34A',
  warning: '#F59E0B',
  danger: '#EF4444',
} as const;

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_MAP: Record<string, string> = { Sun: 'Sun', Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu', Fri: 'Fri', Sat: 'Sat' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function hoursDiff(start: string, end: string | null | undefined): number {
  if (!end) return 0;
  return (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
}

function pctColor(pct: number): string {
  return pct >= 95 ? RAG.good : pct >= 90 ? RAG.warning : RAG.danger;
}

function trendArrow(cur: number, prev: number | null): { arrow: string; color: string } {
  if (prev == null) return { arrow: '—', color: 'var(--text-muted)' };
  const diff = cur - prev;
  if (Math.abs(diff) < 1) return { arrow: '→', color: 'var(--text-muted)' };
  return diff > 0 ? { arrow: '↑', color: RAG.good } : { arrow: '↓', color: RAG.danger };
}

function getTrendInfo(current: number, previous: number | null | undefined, lowerIsBetter = false) {
  if (previous == null) return { change: null, direction: 'stable' as const, color: '#6B7280' };
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return { change: 0, direction: 'stable' as const, color: '#6B7280' };
  const isPositive = lowerIsBetter ? diff < 0 : diff > 0;
  return {
    change: diff,
    direction: isPositive ? 'improving' as const : 'declining' as const,
    color: isPositive ? '#16A34A' : '#EF4444',
  };
}

function priorityToP(priority: string): string {
  return PRIORITY_TO_P[priority.toLowerCase()] || 'P4';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function pinHelper(
  isMetricPinned?: (key: string) => boolean,
  handlePin?: (key: string, label: string, type?: string, config?: any) => void,
  handleUnpin?: (key: string) => void,
) {
  return (key: string, label: string, type = 'kpi') => {
    if (!isMetricPinned || !handlePin || !handleUnpin) return {};
    return {
      metricKey: key,
      metricLabel: label,
      isPinned: isMetricPinned(key),
      onPin: () => handlePin(key, label, type),
      onUnpin: () => handleUnpin(key),
    };
  };
}

// ── Inline table style helpers ────────────────────────────────────────────────

const TH = {
  padding: '10px 14px',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap' as const,
  textAlign: 'left' as const,
  cursor: 'pointer' as const,
  userSelect: 'none' as const,
};

const TD = { padding: '10px 14px', fontSize: 13 };
const TD_MUTED = { ...TD, fontSize: 12, color: 'var(--text-muted)' };
const TD_SEC = { ...TD, color: 'var(--text-secondary)' };

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function ServiceLevelSection(props: ServiceLevelSectionProps) {
  const { filteredTickets, adminStats, isAdminOrAgent, onExportCSV, isMetricPinned, handlePin, handleUnpin, comparisonData, timeSeries, onDrillDown, onCrossFilterChange } = props;
  const pin = useMemo(() => pinHelper(isMetricPinned, handlePin, handleUnpin), [isMetricPinned, handlePin, handleUnpin]);

  // ── Sort state ─────────────────────────────────────────────────────────────
  const [assigneeSortKey, setAssigneeSortKey] = useState('breach_rate');
  const [assigneeSortDir, setAssigneeSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (
    key: string,
    curKey: string,
    curDir: 'asc' | 'desc',
    setKey: (k: string) => void,
    setDir: (d: 'asc' | 'desc') => void,
  ) => {
    if (curKey === key) {
      setDir(curDir === 'asc' ? 'desc' : 'asc');
    } else {
      setKey(key);
      setDir('desc');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  SECTION 1: SLA Overview KPIs — Computed stats
  // ═══════════════════════════════════════════════════════════════════════════

  const {
    totalTickets,
    breachedTickets,
    compliance,
    atRiskCount,
    avgResponseHrs,
    avgResolutionHrs,
    compliancePrev,
    breachPrev,
    responsePrev,
    resolutionPrev,
  } = useMemo(() => {
    const total = filteredTickets.length;
    const breached = filteredTickets.filter(t => t.sla_breached);
    const comp = total ? Math.round(((total - breached.length) / total) * 100) : 100;

    // Response time (hours)
    const withResp = filteredTickets.filter(t => t.first_response_at);
    const avgResp = withResp.length
      ? withResp.reduce((s, t) => s + hoursDiff(t.created_at, t.first_response_at), 0) / withResp.length
      : 0;

    // Resolution time (hours)
    const resolved = filteredTickets.filter(t => ['resolved', 'closed'].includes(t.status.toLowerCase()));
    const avgRes = resolved.length
      ? resolved.reduce((s, t) => {
          const end = t.resolved_at || t.closed_at || t.updated_at;
          return s + hoursDiff(t.created_at, end);
        }, 0) / resolved.length
      : 0;

    // At-risk count (tickets approaching breach with <50% time remaining)
    const now = Date.now();
    const atRisk = filteredTickets.filter(t => {
      if (!t.due_date || t.sla_breached) return false;
      const due = new Date(t.due_date).getTime();
      const created = new Date(t.created_at).getTime();
      const totalDur = due - created;
      const elapsed = now - created;
      if (totalDur <= 0 || elapsed <= 0) return false;
      return (totalDur - elapsed) / totalDur < 0.5;
    }).length;

    // Previous-period values from real comparison data (null if unavailable)
    const prevComp = comparisonData?.previous_period?.sla_compliance_pct ?? null;
    const prevBreach = comparisonData?.previous_period?.sla_breaches ?? null;
    const prevResp = comparisonData?.previous_period?.avg_response_hours ?? null;
    const prevRes = comparisonData?.previous_period?.avg_resolution_hours ?? null;

    return {
      totalTickets: total,
      breachedTickets: breached,
      compliance: comp,
      atRiskCount: adminStats?.sla?.at_risk_count ?? atRisk,
      avgResponseHrs: Math.round(avgResp * 10) / 10,
      avgResolutionHrs: Math.round(avgRes * 10) / 10,
      compliancePrev: prevComp,
      breachPrev: prevBreach,
      responsePrev: prevResp,
      resolutionPrev: prevRes,
    };
  }, [filteredTickets, adminStats, comparisonData]);

  // ── Change objects for ScorecardWidget (null-safe) ───────────────────────
  const complianceChange = compliancePrev != null
    ? { value: Math.abs(compliance - compliancePrev), label: 'vs last period' as const, isPositive: compliance >= compliancePrev }
    : undefined;
  const breachChange = breachPrev != null
    ? { value: Math.abs(breachPrev - breachedTickets.length), label: 'vs last period' as const, isPositive: breachedTickets.length <= breachPrev }
    : undefined;
  const responseChange = responsePrev != null
    ? { value: Math.abs(responsePrev - avgResponseHrs), label: 'vs last period' as const, isPositive: avgResponseHrs <= responsePrev }
    : undefined;
  const resolutionChange = resolutionPrev != null
    ? { value: Math.abs(resolutionPrev - avgResolutionHrs), label: 'vs last period' as const, isPositive: avgResolutionHrs <= resolutionPrev }
    : undefined;

  // ═══════════════════════════════════════════════════════════════════════════
  //  SECTION 2: SLA Compliance Trend — Weekly time series
  // ═══════════════════════════════════════════════════════════════════════════

  const weeklyTrend = useMemo(() => {
    const map = new Map<string, { met: number; breached: number }>();

    filteredTickets.forEach(t => {
      const d = new Date(t.created_at);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff)).toISOString().slice(0, 10);
      const e = map.get(monday) || { met: 0, breached: 0 };
      if (t.sla_breached) e.breached++;
      else e.met++;
      map.set(monday, e);
    });

    const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    const recent = sorted.slice(-12);

    // If <2 weeks of ticket data, fall back to timeSeries.sla daily data (aggregated weekly)
    if (recent.length < 2 && timeSeries?.sla && timeSeries.sla.length >= 14) {
      const weekMap = new Map<string, { breached: number; created: number }>();
      timeSeries.sla.forEach(point => {
        if (point.breached == null) return;
        const d = new Date(point.date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff)).toISOString().slice(0, 10);
        const e = weekMap.get(monday) || { breached: 0, created: 0 };
        e.breached += point.breached;
        e.created += point.created || 0;
        weekMap.set(monday, e);
      });
      return Array.from(weekMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .filter(([, v]) => v.created > 0)
        .map(([date, v]) => ({
          name: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          met: Math.max(0, v.created - v.breached),
          breached: v.breached,
          total: v.created,
          compliance: v.created > 0 ? Math.round(((v.created - v.breached) / v.created) * 100) : 100,
          date,
        }));
    }

    // Not enough data — return empty (chart will show empty state)
    if (recent.length < 2) {
      return [];
    }

    return recent.map(([date, v]) => ({
      name: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      met: v.met,
      breached: v.breached,
      total: v.met + v.breached,
      compliance: v.met + v.breached > 0 ? Math.round((v.met / (v.met + v.breached)) * 100) : 100,
      date,
    }));
  }, [filteredTickets, timeSeries]);

  // ═══════════════════════════════════════════════════════════════════════════
  //  SECTION 3: SLA by Priority
  // ═══════════════════════════════════════════════════════════════════════════

  const priorityData = useMemo(() => {
    const map = new Map<string, { total: number; met: number; breached: number; totalResHrs: number; resolved: number }>();

    filteredTickets.forEach(t => {
      const p = (t.priority || 'low').toLowerCase();
      const e = map.get(p) || { total: 0, met: 0, breached: 0, totalResHrs: 0, resolved: 0 };
      e.total++;
      if (t.sla_breached) e.breached++;
      else e.met++;
      if (t.resolved_at || t.closed_at) {
        const hrs = hoursDiff(t.created_at, t.resolved_at || t.closed_at);
        if (hrs > 0) { e.totalResHrs += hrs; e.resolved++; }
      }
      map.set(p, e);
    });

    return PRIORITY_ORDER.map(p => {
      const d = map.get(p) || { total: 0, met: 0, breached: 0, totalResHrs: 0, resolved: 0 };
      const compPct = d.total > 0 ? Math.round((d.met / d.total) * 100) : 100;
      const avgRes = d.resolved > 0 ? Math.round((d.totalResHrs / d.resolved) * 10) / 10 : 0;
      const prev: number | null = null; // per-priority comparison data not available from API
      return {
        priority: p,
        label: PRIORITY_LABELS[p] || p,
        total: d.total,
        met: d.met,
        breached: d.breached,
        compliancePct: compPct,
        avgResolutionHrs: avgRes,
        color: pctColor(compPct),
        trend: trendArrow(compPct, prev),
      };
    });
  }, [filteredTickets]);

  const priorityChartData = priorityData.map(p => ({
    name: p.label,
    met: p.met,
    breached: p.breached,
    total: p.total,
    value: 0,
  }));

  // ═══════════════════════════════════════════════════════════════════════════
  //  SECTION 4: Breach Analysis
  // ═══════════════════════════════════════════════════════════════════════════

  const breachByCategory = useMemo(() => {
    const map = new Map<string, number>();
    breachedTickets.forEach(t => {
      const cat = t.category_name || 'Uncategorized';
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    const total = breachedTickets.length;
    return Array.from(map.entries())
      .map(([name, count]) => ({
        name,
        value: count,
        pctOfTotal: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [breachedTickets]);

  const breachByAssignee = useMemo(() => {
    const map = new Map<string, { total: number; breaches: number; totalResHrs: number; resolved: number }>();
    filteredTickets.forEach(t => {
      const name = t.assigned_to_name || 'Unassigned';
      const e = map.get(name) || { total: 0, breaches: 0, totalResHrs: 0, resolved: 0 };
      e.total++;
      if (t.sla_breached) e.breaches++;
      const end = t.resolved_at || t.closed_at;
      if (end) {
        const hrs = hoursDiff(t.created_at, end);
        if (hrs > 0) { e.totalResHrs += hrs; e.resolved++; }
      }
      map.set(name, e);
    });
    return Array.from(map.entries())
      .map(([name, d]) => ({
        name,
        total: d.total,
        breaches: d.breaches,
        breachRate: d.total > 0 ? Math.round((d.breaches / d.total) * 1000) / 10 : 0,
        avgResolution: d.resolved > 0 ? Math.round((d.totalResHrs / d.resolved) * 10) / 10 : 0,
      }))
      .filter(d => d.total > 0)
      .sort((a, b) => b.breachRate - a.breachRate);
  }, [filteredTickets]);

  // ═══════════════════════════════════════════════════════════════════════════
  //  SECTION 5: At-Risk Tickets
  // ═══════════════════════════════════════════════════════════════════════════

  const atRiskTickets = useMemo(() => {
    const now = Date.now();
    return filteredTickets
      .filter(t => {
        if (!t.due_date || t.sla_breached) return false;
        const due = new Date(t.due_date).getTime();
        const created = new Date(t.created_at).getTime();
        const totalDur = due - created;
        const elapsed = now - created;
        if (totalDur <= 0 || elapsed <= 0) return false;
        return (totalDur - elapsed) / totalDur < 0.5;
      })
      .map(t => {
        const due = new Date(t.due_date!).getTime();
        const created = new Date(t.created_at).getTime();
        const totalHrs = (due - created) / 3_600_000;
        const remainingMs = due - now;
        const remainingHrs = Math.max(0, remainingMs / 3_600_000);
        const pctRem = totalHrs > 0 ? (remainingHrs / totalHrs) * 100 : 0;
        const slaTarget = SLA_TARGETS.resolution[priorityToP(t.priority)] || 24;
        return {
          ...t,
          slaTarget,
          totalHrs: Math.round(totalHrs * 10) / 10,
          remainingHrs: Math.round(remainingHrs * 10) / 10,
          pctRemaining: Math.round(pctRem),
          timeColor: pctRem > 50 ? RAG.good : pctRem > 20 ? RAG.warning : RAG.danger,
        };
      })
      .sort((a, b) => a.remainingHrs - b.remainingHrs);
  }, [filteredTickets]);

  // ═══════════════════════════════════════════════════════════════════════════
  //  SECTION 6: Response & Resolution SLA Compliance
  // ═══════════════════════════════════════════════════════════════════════════

  const responseSlaPct = useMemo(() => {
    const withResp = filteredTickets.filter(t => t.first_response_at);
    if (!withResp.length) return 100;
    let met = 0;
    withResp.forEach(t => {
      const target = SLA_TARGETS.response[priorityToP(t.priority)] || 24;
      if (hoursDiff(t.created_at, t.first_response_at) <= target) met++;
    });
    return Math.round((met / withResp.length) * 100);
  }, [filteredTickets]);

  const resolutionSlaPct = useMemo(() => {
    const resolved = filteredTickets.filter(t => ['resolved', 'closed'].includes(t.status.toLowerCase()));
    if (!resolved.length) return 100;
    let met = 0;
    resolved.forEach(t => {
      const target = SLA_TARGETS.resolution[priorityToP(t.priority)] || 48;
      const end = t.resolved_at || t.closed_at || t.updated_at;
      if (hoursDiff(t.created_at, end) <= target) met++;
    });
    return Math.round((met / resolved.length) * 100);
  }, [filteredTickets]);

  // ═══════════════════════════════════════════════════════════════════════════
  //  SECTION 7: SLA Performance Heatmap
  // ═══════════════════════════════════════════════════════════════════════════

  const heatmapData = useMemo(() => {
    const map = new Map<string, { count: number; breached: number }>();

    filteredTickets.forEach(t => {
      const d = new Date(t.created_at);
      const day = DAY_ORDER[d.getDay() === 0 ? 6 : d.getDay() - 1]; // Mon=0 … Sun=6
      const hour = String(d.getHours()).padStart(2, '0');
      const key = `${day}|${hour}`;
      const e = map.get(key) || { count: 0, breached: 0 };
      e.count++;
      if (t.sla_breached) e.breached++;
      map.set(key, e);
    });

    const result: { day: string; hour: string; value: number; meta: { total: number; breaches: number } }[] = [];
    DAY_ORDER.forEach(day => {
      for (let h = 0; h < 24; h++) {
        const hour = String(h).padStart(2, '0');
        const e = map.get(`${day}|${hour}`);
        const total = e?.count || 0;
        const breaches = e?.breached || 0;
        result.push({
          day,
          hour,
          value: total > 0 ? Math.round(((total - breaches) / total) * 100) : 100,
          meta: { total, breaches },
        });
      }
    });
    return result;
  }, [filteredTickets]);

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ExportButton section="sla" label="SLA Report" onExport={onExportCSV} isAdminOrAgent={isAdminOrAgent} />

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 1 — SLA Overview KPIs (5 cards)
         ═════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <ScorecardWidget
          label="Overall SLA Compliance"
          value={compliance}
          unit="%"
          icon={CheckCircle2}
          iconColor={compliance >= 95 ? RAG.good : compliance >= 90 ? RAG.warning : RAG.danger}
          iconBg={compliance >= 95 ? `${RAG.good}15` : compliance >= 90 ? `${RAG.warning}15` : `${RAG.danger}15`}
          accentColor={pctColor(compliance)}
          change={complianceChange}
          {...pin('kpi_sla_compliance', 'Overall SLA Compliance')}
        />
        <ScorecardWidget
          label="Total SLA Breaches"
          value={breachedTickets.length}
          icon={AlertTriangle}
          iconColor={RAG.danger}
          iconBg={`${RAG.danger}15`}
          accentColor={breachedTickets.length > 0 ? RAG.danger : RAG.good}
          change={breachChange}
          {...pin('kpi_sla_breaches', 'Total SLA Breaches')}
        />
        <ScorecardWidget
          label="At-Risk Tickets"
          value={atRiskCount}
          icon={Clock}
          iconColor={RAG.warning}
          iconBg={`${RAG.warning}15`}
          accentColor={atRiskCount > 0 ? RAG.warning : RAG.good}
          {...pin('kpi_at_risk', 'At-Risk Tickets')}
        />
        <ScorecardWidget
          label="Avg Response Time"
          value={avgResponseHrs}
          unit="hrs"
          icon={Gauge}
          iconColor={avgResponseHrs < 4 ? RAG.good : avgResponseHrs < 8 ? RAG.warning : RAG.danger}
          iconBg={avgResponseHrs < 4 ? `${RAG.good}15` : avgResponseHrs < 8 ? `${RAG.warning}15` : `${RAG.danger}15`}
          accentColor={avgResponseHrs < 4 ? RAG.good : avgResponseHrs < 8 ? RAG.warning : RAG.danger}
          change={responseChange}
          {...pin('kpi_avg_response', 'Avg Response Time')}
        />
        <ScorecardWidget
          label="Avg Resolution Time"
          value={avgResolutionHrs}
          unit="hrs"
          icon={Shield}
          iconColor={avgResolutionHrs < 22 ? RAG.good : avgResolutionHrs < 36 ? RAG.warning : RAG.danger}
          iconBg={avgResolutionHrs < 22 ? `${RAG.good}15` : avgResolutionHrs < 36 ? `${RAG.warning}15` : `${RAG.danger}15`}
          accentColor={avgResolutionHrs < 22 ? RAG.good : avgResolutionHrs < 36 ? RAG.warning : RAG.danger}
          change={resolutionChange}
          {...pin('kpi_avg_resolution', 'Avg Resolution Time')}
        />
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 2 — SLA Compliance Trend (full-width area chart)
         ═════════════════════════════════════════════════════════════════════ */}
      <CardSection title="SLA Compliance Trend" icon={TrendingUp} {...pin('chart_sla_trend', 'SLA Compliance Trend', 'chart')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {weeklyTrend.length > 0 ? (
            <>
              <InteractiveAreaChart
                data={weeklyTrend}
                series={[
                  { dataKey: 'met', name: 'Met SLA', color: RAG.good, stackId: 'sla' },
                  { dataKey: 'breached', name: 'Breached', color: RAG.danger, stackId: 'sla' },
                ]}
                height={320}
                showExport
                exportFilename="sla-compliance-trend"
                showGrid
                xKey="name"
                yLabel="Ticket Count"
                onPointClick={
                  onDrillDown
                    ? (datum) =>
                        onDrillDown({
                          label: `Week: ${datum.name}`,
                          filterKey: 'status',
                          filterValue: 'open',
                          count: (datum as any).total || 0,
                        })
                    : undefined
                }
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                {[
                  { color: RAG.good, label: 'Met SLA' },
                  { color: RAG.danger, label: 'Breached' },
                  { color: '#3B82F6', label: '95% Target', dashed: true },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 16, height: 3,
                      background: l.dashed ? 'transparent' : l.color,
                      borderTop: l.dashed ? `2px dashed ${l.color}` : undefined,
                      borderRadius: 2,
                    }} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={<TrendingUp size={32} />}
              title="Insufficient Data"
              description="Need at least 2 weeks of data for trend visualization."
              size="md"
            />
          )}
        </div>
      </CardSection>

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 3 — SLA by Priority (stacked bar chart + table)
         ═════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 20 }}>
        <CardSection title="SLA by Priority (Distribution)" icon={BarChart3} {...pin('chart_sla_priority', 'SLA by Priority', 'chart')}>
          <InteractiveBarChart
            data={priorityChartData}
            series={[
              { dataKey: 'met', name: 'Met SLA', color: RAG.good },
              { dataKey: 'breached', name: 'Breached', color: RAG.danger },
            ]}
            height={280}
            showExport
            exportFilename="sla-by-priority"
            showGrid
            unit="tickets"
            onBarClick={
              onDrillDown || onCrossFilterChange
                ? (datum) => {
                    const pMap: Record<string, string> = {
                      'P1 - Critical': 'critical',
                      'P2 - High': 'high',
                      'P3 - Medium': 'medium',
                      'P4 - Low': 'low',
                    };
                    const pVal = pMap[datum.name] || datum.name;
                    onCrossFilterChange?.('priority', pVal);
                    onDrillDown?.({
                      label: `Priority: ${datum.name}`,
                      filterKey: 'priority',
                      filterValue: pVal,
                      count: (datum as any).total || datum.value,
                    });
                  }
                : undefined
            }
          />
        </CardSection>

        <CardSection title="SLA by Priority (Details)" icon={BarChart3} {...pin('table_sla_priority', 'SLA by Priority Table', 'table')}>
          <div style={{ overflowX: 'auto' }}>
            <table role="table" aria-label="SLA metrics by priority" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Priority', 'Total', 'Met', 'Breached', 'Compliance %', 'Avg Resolution', 'Trend'].map(h => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {priorityData.map(p => (
                  <tr key={p.priority}
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ ...TD, fontWeight: 600 }}>{p.label}</td>
                    <td style={TD}>{p.total}</td>
                    <td style={{ ...TD, color: RAG.good }}>{p.met}</td>
                    <td style={{ ...TD, color: p.breached > 0 ? RAG.danger : 'var(--text-muted)' }}>{p.breached}</td>
                    <td style={TD}>
                      <span style={{
                        fontWeight: 600, fontSize: 12,
                        color: p.color,
                        background: `${p.color}15`,
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}>{p.compliancePct}%</span>
                    </td>
                    <td style={TD_SEC}>{p.avgResolutionHrs > 0 ? `${p.avgResolutionHrs}hrs` : '—'}</td>
                    <td style={{ ...TD, fontSize: 16, color: p.trend.color }}>{p.trend.arrow}</td>
                  </tr>
                ))}
                {priorityData.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No priority data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardSection>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 4 — SLA Breach Analysis (horizontal bar + table)
         ═════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 20 }}>
        <CardSection title="Breach by Category" icon={AlertOctagon} {...pin('chart_breach_category', 'Breach by Category', 'chart')}>
          <InteractiveBarChart
            data={breachByCategory.map(c => ({
              name: c.name,
              value: c.value,
              color: c.pctOfTotal > 30 ? RAG.danger : c.pctOfTotal > 15 ? '#F97316' : RAG.warning,
            }))}
            layout="horizontal"
            height={Math.max(200, breachByCategory.length * 40)}
            showExport
            exportFilename="breach-by-category"
            showGrid={false}
            unit="breaches"
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
          />
        </CardSection>

        <CardSection title="Breach by Assignee" icon={Users} {...pin('table_breach_assignee', 'Breach by Assignee', 'table')}>
          <div style={{ overflowX: 'auto' }}>
            <table role="table" aria-label="SLA breach analysis by assignee" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {[
                    { key: 'name', label: 'Assignee' },
                    { key: 'total', label: 'Total Tickets' },
                    { key: 'breaches', label: 'Breaches' },
                    { key: 'breach_rate', label: 'Breach Rate' },
                    { key: 'avg_resolution', label: 'Avg Resolution' },
                    { key: 'status', label: 'Status' },
                  ].map(h => (
                    <th key={h.key}
                      onClick={() => toggleSort(h.key, assigneeSortKey, assigneeSortDir, setAssigneeSortKey, setAssigneeSortDir)}
                      style={TH}
                    >
                      {h.label} {assigneeSortKey === h.key ? (assigneeSortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...breachByAssignee]
                  .sort((a, b) => {
                    let cmp = 0;
                    switch (assigneeSortKey) {
                      case 'name': cmp = a.name.localeCompare(b.name); break;
                      case 'total': cmp = a.total - b.total; break;
                      case 'breaches': cmp = a.breaches - b.breaches; break;
                      case 'avg_resolution': cmp = a.avgResolution - b.avgResolution; break;
                      default: cmp = a.breachRate - b.breachRate;
                    }
                    return assigneeSortDir === 'asc' ? cmp : -cmp;
                  })
                  .map(a => {
                    const stColor = a.breachRate > 15 ? RAG.danger : a.breachRate > 10 ? RAG.warning : RAG.good;
                    const stLabel = a.breachRate > 15 ? 'Critical' : a.breachRate > 10 ? 'Warning' : 'Good';
                    return (
                      <tr key={a.name}
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ ...TD, fontWeight: 600 }}>{a.name}</td>
                        <td style={TD}>{a.total}</td>
                        <td style={{ ...TD, color: a.breaches > 0 ? RAG.danger : 'var(--text-muted)' }}>{a.breaches}</td>
                        <td style={TD}>
                          <span style={{ fontWeight: 600, fontSize: 12, color: stColor }}>{a.breachRate}%</span>
                        </td>
                        <td style={TD_SEC}>{a.avgResolution > 0 ? `${a.avgResolution}hrs` : '—'}</td>
                        <td style={TD}>
                          <span style={{
                            fontSize: 11, fontWeight: 600,
                            color: stColor, background: `${stColor}15`,
                            padding: '2px 8px', borderRadius: 4,
                          }}>{stLabel}</span>
                        </td>
                      </tr>
                    );
                  })}
                {breachByAssignee.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No assignee data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardSection>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 5 — At-Risk Tickets (full-width table)
         ═════════════════════════════════════════════════════════════════════ */}
      <CardSection title="At-Risk Tickets (Approaching SLA Breach)" icon={AlertTriangle} {...pin('table_at_risk', 'At-Risk Tickets', 'table')}>
        <div style={{ overflowX: 'auto' }}>
          <table role="table" aria-label="At-risk tickets approaching SLA breach" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Ticket #', 'Subject', 'Priority', 'Assignee', 'Category', 'Created', 'Due In', 'Time Remaining', 'Action'].map(h => (
                  <th key={h} style={{ ...TH, cursor: 'default' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {atRiskTickets.slice(0, 20).map(t => {
                const bg = t.pctRemaining < 20
                  ? `${RAG.danger}08`
                  : t.pctRemaining < 50
                    ? `${RAG.warning}08`
                    : undefined;
                return (
                  <tr key={t.id}
                    style={{ borderBottom: '1px solid var(--border-subtle)', background: bg }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => { e.currentTarget.style.background = bg || 'transparent'; }}
                  >
                    <td style={{ ...TD_MUTED, fontSize: 11, fontWeight: 600 }}>#{t.number}</td>
                    <td style={{ ...TD, fontWeight: 500, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</td>
                    <td style={TD}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: `var(--priority-${t.priority?.toLowerCase() || 'low'})` }}>
                        {t.priority}
                      </span>
                    </td>
                    <td style={TD_MUTED}>{t.assigned_to_name || 'Unassigned'}</td>
                    <td style={TD_SEC}>{t.category_name || '—'}</td>
                    <td style={TD_MUTED}>{timeAgo(t.created_at)}</td>
                    <td style={{ ...TD, fontWeight: 600, color: 'var(--text-secondary)' }}>{t.slaTarget}h</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: t.timeColor }}>
                          {t.remainingHrs > 1 ? `${Math.round(t.remainingHrs)}h` : `${Math.round(t.remainingHrs * 60)}m`}
                        </span>
                        <div style={{
                          width: 60, height: 6, background: 'var(--bg-tertiary)',
                          borderRadius: 3, overflow: 'hidden', flexShrink: 0,
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(t.pctRemaining, 100)}%`,
                            background: t.timeColor,
                            borderRadius: 3,
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                      </div>
                    </td>
                    <td style={TD}>
                      <button
                        onClick={() => window.open(`/dashboard/tickets/${t.id}`, '_blank')}
                        className="btn btn-sm"
                        style={{ fontSize: 11, padding: '4px 10px' }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
              {atRiskTickets.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: RAG.good }}>
                  <CheckCircle2 size={20} style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: 14, fontWeight: 600 }}>No at-risk tickets</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>All tickets have sufficient time remaining.</div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardSection>

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 6 — Response vs Resolution SLA (2 gauge charts)
         ═════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 20 }}>
        <CardSection title="Response SLA Compliance" icon={Gauge} {...pin('gauge_response_sla', 'Response SLA Compliance', 'chart')}>
          <GaugeChart
            value={responseSlaPct}
            target={95}
            label="Response SLA"
            unit="%"
            showExport
            exportFilename="response-sla-gauge"
            size={220}
            thresholds={{ danger: 80, warning: 90 }}
          />
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            Avg Response Time: {avgResponseHrs}hrs
          </div>
        </CardSection>

        <CardSection title="Resolution SLA Compliance" icon={Gauge} {...pin('gauge_resolution_sla', 'Resolution SLA Compliance', 'chart')}>
          <GaugeChart
            value={resolutionSlaPct}
            target={95}
            label="Resolution SLA"
            unit="%"
            showExport
            exportFilename="resolution-sla-gauge"
            size={220}
            thresholds={{ danger: 80, warning: 90 }}
          />
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            Avg Resolution Time: {avgResolutionHrs}hrs
          </div>
        </CardSection>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          SECTION 7 — SLA Performance Heatmap (full-width)
         ═════════════════════════════════════════════════════════════════════ */}
      <CardSection title="SLA Performance Heatmap" icon={BarChart3} {...pin('chart_sla_heatmap', 'SLA Performance Heatmap', 'chart')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Compliance % by day & hour —{' '}
            <span style={{ color: RAG.good, fontWeight: 600 }}>green</span> = high compliance,&nbsp;
            <span style={{ color: RAG.danger, fontWeight: 600 }}>red</span> = low compliance
          </div>
          <HeatmapChart
            data={heatmapData}
            days={DAY_ORDER}
            hours={Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))}
            colors={[RAG.danger, RAG.warning, RAG.good]}
            showExport
            exportFilename="sla-performance-heatmap"
            rowHeight={22}
            showValues={false}
            onCellClick={
              onDrillDown
                ? (cell) =>
                    onDrillDown({
                      label: `Day: ${(cell as any).day} Hour: ${(cell as any).hour}`,
                      filterKey: 'status',
                      filterValue: 'open',
                      count: (cell as any).meta?.total || 0,
                    })
                : undefined
            }
          />
        </div>
      </CardSection>
    </div>
  );
}
