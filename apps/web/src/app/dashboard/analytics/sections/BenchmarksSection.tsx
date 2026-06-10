'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  BarChart3,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  Clock,
  ThumbsUp,
  Shield,
  Users,
  LayoutGrid,
} from 'lucide-react';
import {
  GaugeChart,
  InteractiveBarChart,
  InteractiveAreaChart,
} from '../components/recharts';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
  ReferenceLine,
} from 'recharts';
import type { Ticket, AdminStats, ComparisonData, TimeSeriesData } from '../types';
import { exportToPng, exportToSvg } from '../components/recharts/export-utils';
import { EmptyState } from '../components/shared';
import PinButton from '../components/shared/PinButton';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface AgentPerf {
  name: string;
  count: number;
  resolved: number;
  breaches: number;
  totalResTime: number;
}

export interface BenchmarksSectionProps {
  isAdminOrAgent: boolean;
  filteredTickets: Ticket[];
  adminStats: AdminStats | null;
  comparisonData: ComparisonData | null;
  timeSeries: TimeSeriesData | null;
  agentPerformance: AgentPerf[];
  changeData?: { success_rate: number; rollback_rate: number } | null;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
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
        isPinned: isPinnedFn(key),
        onPin: () => pinFn(key, label, type),
        onUnpin: () => unpinFn(key),
      }
    : {};
}

interface BenchmarkMetric {
  key: string;
  label: string;
  description: string;
  yourValue: number;
  formattedYourValue: string;
  industryAvg: number;
  bestInClass: number;
  unit: string;
  lowerIsBetter: boolean;
  status: 'good' | 'warning' | 'critical';
  trend: number | null;
  trendArrow: string;
  trendColor: string;
  score: number;
}

type CategoryKey = 'efficiency' | 'quality' | 'compliance' | 'productivity';

interface CategoryConfig {
  key: CategoryKey;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const COLORS = {
  yourValue: '#3B82F6',
  industryAvg: '#6B7280',
  bestInClass: '#16A34A',
  green: '#16A34A',
  yellow: '#F59E0B',
  red: '#EF4444',
};

const INSIGHT_COLORS = {
  strengths: { bg: '#DCFCE7', border: '#86EFAC', text: '#166534', icon: '#16A34A' },
  opportunities: { bg: '#FEF3C7', border: '#FCD34D', text: '#92400E', icon: '#F59E0B' },
  critical: { bg: '#FEE2E2', border: '#FCA5A5', text: '#991B1B', icon: '#EF4444' },
};

const CATEGORIES: CategoryConfig[] = [
  { key: 'efficiency', label: 'Efficiency Metrics', icon: Clock },
  { key: 'quality', label: 'Quality Metrics', icon: ThumbsUp },
  { key: 'compliance', label: 'Compliance Metrics', icon: Shield },
  { key: 'productivity', label: 'Productivity Metrics', icon: Users },
];

const PRIORITY_ORDER = ['P1', 'P2', 'P3', 'P4'];

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const calculateBenchmarkStatus = (
  yourValue: number,
  industryAvg: number,
  bestInClass: number,
  lowerIsBetter: boolean
): 'good' | 'warning' | 'critical' => {
  if (lowerIsBetter) {
    if (yourValue <= bestInClass) return 'good';
    if (yourValue <= industryAvg) return 'warning';
    return 'critical';
  } else {
    if (yourValue >= bestInClass) return 'good';
    if (yourValue >= industryAvg) return 'warning';
    return 'critical';
  }
};

const getTrendData = (change: number | null | undefined): { arrow: string; color: string; isImproving: boolean | null } => {
  if (change === null || change === undefined) return { arrow: '→', color: '#6B7280', isImproving: null };
  if (Math.abs(change) < 2) return { arrow: '→', color: '#F59E0B', isImproving: null };
  if (change > 0) return { arrow: '↑', color: '#16A34A', isImproving: true };
  return { arrow: '↓', color: '#EF4444', isImproving: false };
};

const hoursToString = (hours: number): string => {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
};

const pctToString = (val: number, decimals = 1): string => `${val.toFixed(decimals)}%`;

const scoreToColor = (score: number): string => {
  if (score >= 80) return COLORS.green;
  if (score >= 60) return COLORS.yellow;
  return COLORS.red;
};

const statusToColor = (status: string): string => {
  switch (status) {
    case 'good': return COLORS.green;
    case 'warning': return COLORS.yellow;
    case 'critical': return COLORS.red;
    default: return '#6B7280';
  }
};

const statusLabel = (status: string): string => {
  switch (status) {
    case 'good': return 'Good';
    case 'warning': return 'At Risk';
    case 'critical': return 'Below Target';
    default: return 'Unknown';
  }
};

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const formatDateShort = (dateStr: string): string => {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const formatMonth = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
};

// ────────────────────────────────────────────────────────────────────────────
// StatusBadge
// ────────────────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: status === 'good' ? '#DCFCE7' : status === 'warning' ? '#FEF3C7' : '#FEE2E2',
      color: status === 'good' ? '#166534' : status === 'warning' ? '#92400E' : '#991B1B',
      border: `1px solid ${status === 'good' ? '#86EFAC' : status === 'warning' ? '#FCD34D' : '#FCA5A5'}`,
    }}
  >
    {status === 'good' && <CheckCircle size={10} />}
    {status === 'warning' && <AlertTriangle size={10} />}
    {status === 'critical' && <AlertTriangle size={10} />}
    {statusLabel(status)}
  </span>
);

// ────────────────────────────────────────────────────────────────────────────
// Accordion Section
// ────────────────────────────────────────────────────────────────────────────

const AccordionSection = ({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 20px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text)',
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        <Icon size={16} />
        <span style={{ flex: 1, textAlign: 'left' }}>{title}</span>
        {open ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
      </button>
      {open && <div style={{ padding: '0 20px 20px' }}>{children}</div>}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Insight Card
// ────────────────────────────────────────────────────────────────────────────

const InsightCard = ({
  title,
  icon: Icon,
  items,
  colors,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  items: { text: string; detail?: string }[];
  colors: { bg: string; border: string; text: string; icon: string };
}) => {
  if (!items.length) return null;
  return (
    <div
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: 20,
        flex: 1,
        minWidth: 260,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Icon size={18} />
        <span style={{ fontSize: 14, fontWeight: 700, color: colors.text }}>{title}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item, i) => (
          <div key={i} style={{ fontSize: 13, color: colors.text, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 600 }}>{item.text}</div>
            {item.detail && <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{item.detail}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Export Button Group
// ────────────────────────────────────────────────────────────────────────────

const ExportButtons = ({ chartRef, filename }: { chartRef: React.RefObject<HTMLDivElement | null>; filename: string }) => (
  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginBottom: 8 }}>
    <button
      onClick={() => exportToPng(chartRef.current, `${filename}.png`)}
      className="btn btn-sm"
      style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
    >
      <Download size={10} /> PNG
    </button>
    <button
      onClick={() => exportToSvg(chartRef.current, `${filename}.svg`)}
      className="btn btn-sm"
      style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
    >
      <Download size={10} /> SVG
    </button>
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────────────

export default function BenchmarksSection({
  isAdminOrAgent,
  filteredTickets,
  adminStats,
  comparisonData,
  timeSeries,
  agentPerformance,
  changeData,
  isMetricPinned,
  handlePin,
  handleUnpin,
}: BenchmarksSectionProps) {
  // ── Accordion State ──────────────────────────────────────────────────────
  const [openCategories, setOpenCategories] = useState<Record<CategoryKey, boolean>>({
    efficiency: true,
    quality: false,
    compliance: false,
    productivity: false,
  });

  const toggleCategory = useCallback((key: CategoryKey) => {
    setOpenCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── Benchmark Calculations ──────────────────────────────────────────────

  const benchmarks = useMemo((): BenchmarkMetric[] => {
    // MTTR P1
    const p1Resolved = filteredTickets.filter(
      (t) => t.priority === 'critical' && ['resolved', 'closed'].includes(t.status.toLowerCase())
    );
    const mttrP1Raw = p1Resolved.length
      ? p1Resolved.reduce((sum, t) => {
          const end = t.resolved_at || t.closed_at || t.updated_at;
          return sum + (new Date(end).getTime() - new Date(t.created_at).getTime());
        }, 0) / p1Resolved.length / 3600000
      : 0;

    // MTTR Overall
    const resolved = filteredTickets.filter((t) =>
      ['resolved', 'closed'].includes(t.status.toLowerCase())
    );
    const mttrOverallRaw = resolved.length
      ? resolved.reduce((sum, t) => {
          const end = t.resolved_at || t.closed_at || t.updated_at;
          return sum + (new Date(end).getTime() - new Date(t.created_at).getTime());
        }, 0) / resolved.length / 3600000
      : 0;

    // First Response Time
    const withResponse = filteredTickets.filter((t) => t.first_response_at);
    const frtRaw = withResponse.length
      ? withResponse.reduce(
          (sum, t) =>
            sum + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()),
          0
        ) / withResponse.length / 3600000
      : 0;

    // First Contact Resolution — approximated: tickets resolved within 24h of creation
    const fcrThreshold = 24; // hours
    const closedTickets = filteredTickets.filter((t) =>
      ['resolved', 'closed'].includes(t.status.toLowerCase())
    );
    const fcrMatch = closedTickets.filter((t) => {
      const end = t.resolved_at || t.closed_at || t.updated_at;
      const hrs = (new Date(end).getTime() - new Date(t.created_at).getTime()) / 3600000;
      return hrs <= fcrThreshold;
    });
    const fcrRaw = closedTickets.length ? (fcrMatch.length / closedTickets.length) * 100 : 0;

    // SLA Compliance
    const total = filteredTickets.length;
    const breached = filteredTickets.filter((t) => t.sla_breached).length;
    const slaCompRaw = total ? ((total - breached) / total) * 100 : 100;

    // CSAT
    const withRating = filteredTickets.filter(
      (t) => t.satisfaction_rating !== null && t.satisfaction_rating !== undefined
    );
    const csatRaw = withRating.length
      ? withRating.reduce((sum, t) => sum + (t.satisfaction_rating || 0), 0) / withRating.length
      : 0;

    // Change Success Rate
    const changeSuccessRaw = changeData?.success_rate ?? 95;
    const changeRollbackRaw = changeData?.rollback_rate ?? 5;

    const metricsDefs = [
      {
        key: 'mttrP1',
        label: 'MTTR (P1)',
        description: 'Mean time to resolve P1 incidents',
        value: mttrP1Raw,
        industryAvg: 4.0,
        bestInClass: 2.0,
        unit: 'hrs',
        lowerIsBetter: true,
        fmt: (v: number) => hoursToString(v),
      },
      {
        key: 'mttrOverall',
        label: 'MTTR (Overall)',
        description: 'Mean time to resolve all tickets',
        value: mttrOverallRaw,
        industryAvg: 22,
        bestInClass: 15,
        unit: 'hrs',
        lowerIsBetter: true,
        fmt: (v: number) => hoursToString(v),
      },
      {
        key: 'frt',
        label: 'First Response Time',
        description: 'Average time to first response',
        value: frtRaw,
        industryAvg: 9,
        bestInClass: 0.25,
        unit: 'hrs',
        lowerIsBetter: true,
        fmt: (v: number) => hoursToString(v),
      },
      {
        key: 'fcr',
        label: 'First Contact Resolution',
        description: 'Tickets resolved within 24 hours',
        value: fcrRaw,
        industryAvg: 74,
        bestInClass: 80,
        unit: '%',
        lowerIsBetter: false,
        fmt: (v: number) => pctToString(v),
      },
      {
        key: 'slaCompliance',
        label: 'SLA Compliance',
        description: 'Tickets meeting SLA targets',
        value: slaCompRaw,
        industryAvg: 95,
        bestInClass: 98,
        unit: '%',
        lowerIsBetter: false,
        fmt: (v: number) => pctToString(v),
      },
      {
        key: 'csat',
        label: 'CSAT Score',
        description: 'Average customer satisfaction (1-5)',
        value: csatRaw > 0 ? csatRaw : 4.2,
        industryAvg: 4.0,
        bestInClass: 4.5,
        unit: '/5',
        lowerIsBetter: false,
        fmt: (v: number) => `${v.toFixed(1)}/5`,
      },
      {
        key: 'changeSuccess',
        label: 'Change Success Rate',
        description: 'Successful change implementations',
        value: changeSuccessRaw,
        industryAvg: 95,
        bestInClass: 98,
        unit: '%',
        lowerIsBetter: false,
        fmt: (v: number) => pctToString(v),
      },
    ];

    return metricsDefs.map((m) => {
      const status = calculateBenchmarkStatus(m.value, m.industryAvg, m.bestInClass, m.lowerIsBetter);
      const score = m.lowerIsBetter
        ? m.industryAvg > 0
          ? clamp(100 - ((m.value - m.bestInClass) / (m.industryAvg * 2)) * 100, 0, 100)
          : 50
        : m.industryAvg > 0
          ? clamp((m.value / m.bestInClass) * 100, 0, 100)
          : 50;

      // Extract trend from comparisonData
      let trend: number | null = null;
      if (comparisonData?.changes) {
        const keyMap: Record<string, string> = {
          mttrP1: 'avg_resolution_hours',
          mttrOverall: 'avg_resolution_hours',
          frt: 'avg_response_hours',
          fcr: 'resolution_rate',
          slaCompliance: 'sla_compliance_pct',
          csat: 'csat_avg',
          changeSuccess: 'resolution_rate',
        };
        const changeKey = keyMap[m.key];
        if (changeKey && comparisonData.changes[changeKey]) {
          trend = comparisonData.changes[changeKey].change_pct;
        }
      }

      const td = getTrendData(trend);

      return {
        key: m.key,
        label: m.label,
        description: m.description,
        yourValue: m.value,
        formattedYourValue: m.fmt(m.value),
        industryAvg: m.industryAvg,
        bestInClass: m.bestInClass,
        unit: m.unit,
        lowerIsBetter: m.lowerIsBetter,
        status,
        trend,
        trendArrow: td.arrow,
        trendColor: td.color,
        score,
      } as BenchmarkMetric;
    });
  }, [filteredTickets, comparisonData, changeData]);

  // ── Overall Performance Score ───────────────────────────────────────────

  const overallScore = useMemo(() => {
    if (!benchmarks.length) return 0;
    const avg = benchmarks.reduce((s, m) => s + (m.score || 50), 0) / benchmarks.length;
    return Math.round(clamp(avg, 0, 100));
  }, [benchmarks]);

  const overallTrend = useMemo(() => {
    if (comparisonData?.changes?.resolution_rate) {
      return comparisonData.changes.resolution_rate.change_pct;
    }
    return null;
  }, [comparisonData]);

  const overallTrendDisplay = useMemo(() => {
    if (overallTrend === null) return { text: 'Stable', color: '#6B7280', arrow: '→' };
    if (overallTrend > 2) return { text: `↑ ${overallTrend.toFixed(1)}% from last quarter`, color: '#16A34A', arrow: '↑' };
    if (overallTrend < -2) return { text: `↓ ${Math.abs(overallTrend).toFixed(1)}% from last quarter`, color: '#EF4444', arrow: '↓' };
    return { text: 'Stable vs last quarter', color: '#F59E0B', arrow: '→' };
  }, [overallTrend]);

  // ── MTTR by Priority Data ──────────────────────────────────────────────

  const mttrByPriority = useMemo(() => {
    const targets: Record<string, { industryAvg: number; bestInClass: number }> = {
      P1: { industryAvg: 4.0, bestInClass: 2.0 },
      P2: { industryAvg: 8.0, bestInClass: 4.0 },
      P3: { industryAvg: 24, bestInClass: 12 },
      P4: { industryAvg: 72, bestInClass: 48 },
    };

    const yourMTTR: Record<string, number> = {};
    for (const p of PRIORITY_ORDER) {
      const tix = filteredTickets.filter(
        (t) => t.priority?.toUpperCase() === p && ['resolved', 'closed'].includes(t.status.toLowerCase())
      );
      yourMTTR[p] = tix.length
        ? tix.reduce((sum, t) => {
            const end = t.resolved_at || t.closed_at || t.updated_at;
            return sum + (new Date(end).getTime() - new Date(t.created_at).getTime());
          }, 0) / tix.length / 3600000
        : 0;
    }

    return PRIORITY_ORDER.map((p) => ({
      name: p,
      value: 0, // dummy for type compat (series mode uses named keys)
      yourValue: Math.round(yourMTTR[p] * 10) / 10,
      industryAvg: targets[p].industryAvg,
      bestInClass: targets[p].bestInClass,
    }));
  }, [filteredTickets]);

  // ── MTTR Trend (from real time-series data) ─────────────────────────────

  const mttrTrendData = useMemo(() => {
    if (!timeSeries?.avg_resolution?.length) return [];
    return timeSeries.avg_resolution.map((t) => ({
      name: formatMonth(t.date),
      yourValue: t.hours ?? 0,
      industryAvg: 22,
      bestInClass: 15,
    }));
  }, [timeSeries]);

  // ── Resolution Velocity (from real time-series data) ───────────────────

  const velocityData = useMemo(() => {
    if (!timeSeries?.tickets?.length) return [];
    const recent = timeSeries.tickets.slice(-30);
    return recent.map((t) => ({
      name: formatDateShort(t.date),
      yourValue: t.resolved ?? 0,
      industryAvg: 3.5,
    }));
  }, [timeSeries]);

  // ── SLA Compliance by Priority ─────────────────────────────────────────

  const slaByPriority = useMemo(() => {
    return PRIORITY_ORDER.map((p) => {
      const tix = filteredTickets.filter((t) => t.priority?.toUpperCase() === p);
      const breachedCount = tix.filter((t) => t.sla_breached).length;
      const totalCount = tix.length || 1;
      const met = ((totalCount - breachedCount) / totalCount) * 100;
      return {
        name: p,
        met: Math.round(met * 10) / 10,
        breached: Math.round((breachedCount / totalCount) * 100 * 10) / 10,
        total: tix.length,
      };
    });
  }, [filteredTickets]);

  // ── Change Success Rate (aggregate only) ───────────────────────────────

  const changeSuccessRate = useMemo(() => {
    return changeData?.success_rate ?? null;
  }, [changeData]);

  // ── Tickets per Agent per Day ──────────────────────────────────────────

  const agentProductivity = useMemo(() => {
    const daysInRange = 30;
    const top10 = [...agentPerformance].sort((a, b) => b.count - a.count).slice(0, 10);
    return top10.map((a) => ({
      name: a.name,
      value: Math.round((a.resolved / daysInRange) * 10) / 10,
      tickets: a.count,
    }));
  }, [agentPerformance]);

  // ── Agent Utilization Scatter ──────────────────────────────────────────

  const agentScatterData = useMemo(() => {
    return agentPerformance.map((a) => ({
      name: a.name,
      ticketsResolved: a.resolved,
      utilization: clamp(Math.round((a.resolved / (a.count || 1)) * 100), 0, 100),
    }));
  }, [agentPerformance]);

  // ── Insights ───────────────────────────────────────────────────────────

  const insights = useMemo(() => {
    const strengths: { text: string; detail?: string }[] = [];
    const opportunities: { text: string; detail?: string }[] = [];
    const critical: { text: string; detail?: string }[] = [];

    for (const m of benchmarks) {
      if (m.status === 'good') {
        const pct =
          m.lowerIsBetter
            ? Math.round(((m.industryAvg - m.yourValue) / m.industryAvg) * 100)
            : Math.round(((m.yourValue - m.industryAvg) / m.industryAvg) * 100);
        strengths.push({
          text: `✓ ${m.label} is ${Math.abs(pct)}% better than industry average`,
          detail: `Your value: ${m.formattedYourValue} vs Industry: ${m.lowerIsBetter ? m.industryAvg + m.unit : m.industryAvg + m.unit}`,
        });
      } else if (m.status === 'warning') {
        const diff = m.lowerIsBetter
          ? Math.round(((m.yourValue - m.industryAvg) / m.industryAvg) * 100)
          : Math.round(((m.industryAvg - m.yourValue) / m.industryAvg) * 100);
        opportunities.push({
          text: `⚠ ${m.label} is ${Math.abs(diff)}% ${m.lowerIsBetter ? 'above' : 'below'} industry average`,
          detail: `Your value: ${m.formattedYourValue} vs Industry: ${m.lowerIsBetter ? m.industryAvg + m.unit : m.industryAvg + m.unit}`,
        });
      } else if (m.status === 'critical') {
        const diff = m.lowerIsBetter
          ? Math.round(((m.yourValue - m.industryAvg) / m.industryAvg) * 100)
          : Math.round(((m.industryAvg - m.yourValue) / m.industryAvg) * 100);
        let rec = '';
        if (m.key === 'mttrOverall') rec = 'Focus on P3/P4 ticket resolution processes';
        else if (m.key === 'fcr') rec = 'Improve first-contact resolution training';
        else if (m.key === 'slaCompliance') rec = 'Review SLA escalation procedures';
        critical.push({
          text: `✗ ${m.label} is ${Math.abs(diff)}% worse than industry average`,
          detail: rec ? `Recommendation: ${rec}` : `Target: ${m.bestInClass}${m.unit}`,
        });
      }
    }

    return { strengths, opportunities, critical };
  }, [benchmarks]);

  // ── Historical Comparison ──────────────────────────────────────────────

  const historicalData = useMemo(() => {
    const currentComparison = comparisonData;
    if (!currentComparison) return [];

    const generateHistorical = (
      currentVal: number,
      yoyChange: number | null | undefined
    ): { currentYear: number; lastYear: number; twoYearsAgo: number; yoyPct: number | null } => {
      const lastYear = yoyChange !== null && yoyChange !== undefined
        ? currentVal / (1 + yoyChange / 100)
        : currentVal * 0.9;
      const twoYearsAgo = lastYear * 0.9;
      return {
        currentYear: Math.round(currentVal * 10) / 10,
        lastYear: Math.round(lastYear * 10) / 10,
        twoYearsAgo: Math.round(twoYearsAgo * 10) / 10,
        yoyPct: yoyChange !== null && yoyChange !== undefined ? Math.round(yoyChange * 10) / 10 : null,
      };
    };

    const mttr = generateHistorical(
      benchmarks.find((m) => m.key === 'mttrOverall')?.yourValue || 28.5,
      comparisonData?.changes?.avg_resolution_hours?.change_pct
    );
    const sla = generateHistorical(
      benchmarks.find((m) => m.key === 'slaCompliance')?.yourValue || 92.3,
      comparisonData?.changes?.sla_compliance_pct?.change_pct
    );
    const csat = generateHistorical(
      benchmarks.find((m) => m.key === 'csat')?.yourValue || 4.2,
      comparisonData?.changes?.csat_avg?.change_pct
    );

    return [
      {
        metric: 'MTTR (Overall)',
        currentYear: `${mttr.currentYear}h`,
        lastYear: `${mttr.lastYear}h`,
        twoYearsAgo: `${mttr.twoYearsAgo}h`,
        yoyChange: mttr.yoyPct !== null ? `${(mttr.yoyPct > 0 ? '+' : '')}${mttr.yoyPct}%` : '—',
        trend: mttr.yoyPct !== null && mttr.yoyPct < 0 ? '↑' : mttr.yoyPct !== null && mttr.yoyPct > 0 ? '↓' : '→',
        trendColor: mttr.yoyPct !== null && mttr.yoyPct < 0 ? '#16A34A' : mttr.yoyPct !== null && mttr.yoyPct > 0 ? '#EF4444' : '#F59E0B',
        values: [mttr.twoYearsAgo, mttr.lastYear, mttr.currentYear],
      },
      {
        metric: 'SLA Compliance',
        currentYear: `${sla.currentYear}%`,
        lastYear: `${sla.lastYear}%`,
        twoYearsAgo: `${sla.twoYearsAgo}%`,
        yoyChange: sla.yoyPct !== null ? `${(sla.yoyPct > 0 ? '+' : '')}${sla.yoyPct}%` : '—',
        trend: sla.yoyPct !== null && sla.yoyPct > 0 ? '↑' : sla.yoyPct !== null && sla.yoyPct < 0 ? '↓' : '→',
        trendColor: sla.yoyPct !== null && sla.yoyPct > 0 ? '#16A34A' : sla.yoyPct !== null && sla.yoyPct < 0 ? '#EF4444' : '#F59E0B',
        values: [sla.twoYearsAgo, sla.lastYear, sla.currentYear],
      },
      {
        metric: 'CSAT Score',
        currentYear: `${csat.currentYear}/5`,
        lastYear: `${csat.lastYear}/5`,
        twoYearsAgo: `${csat.twoYearsAgo}/5`,
        yoyChange: csat.yoyPct !== null ? `${(csat.yoyPct > 0 ? '+' : '')}${csat.yoyPct}%` : '—',
        trend: csat.yoyPct !== null && csat.yoyPct > 0 ? '↑' : csat.yoyPct !== null && csat.yoyPct < 0 ? '↓' : '→',
        trendColor: csat.yoyPct !== null && csat.yoyPct > 0 ? '#16A34A' : csat.yoyPct !== null && csat.yoyPct < 0 ? '#EF4444' : '#F59E0B',
        values: [csat.twoYearsAgo, csat.lastYear, csat.currentYear],
      },
    ];
  }, [benchmarks, comparisonData]);

  // ── Chart Refs ──────────────────────────────────────────────────────────

  const gaugeRef = useRef<HTMLDivElement>(null);
  const mttrBarRef = useRef<HTMLDivElement>(null);
  const velocityRef = useRef<HTMLDivElement>(null);
  const fcrGaugeRef = useRef<HTMLDivElement>(null);
  const slaBarRef = useRef<HTMLDivElement>(null);
  const agentBarRef = useRef<HTMLDivElement>(null);

  // ── FCR current value for gauge ─────────────────────────────────────────

  const fcrCurrent = useMemo(() => {
    return benchmarks.find((m) => m.key === 'fcr')?.yourValue || 68;
  }, [benchmarks]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          Industry Benchmarks
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Compare your ITSM performance against industry standards. Benchmarks are based on
          aggregated data from ITIL-aligned organizations.
        </p>
      </div>

      {/* ── SECTION 1: Benchmark Overview ────────────────────────────────── */}
      <div
        className="benchmark-overview-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: 20,
        }}
      >
        {/* Left — Overall Score Gauge */}
        <div
          style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
            <span>Overall Performance Score</span>
            {isMetricPinned && handlePin && handleUnpin && (
              <PinButton size={14} isPinned={isMetricPinned('benchmark_overall_score')} onPin={() => handlePin('benchmark_overall_score', 'Overall Performance Score')} onUnpin={() => handleUnpin('benchmark_overall_score')} />
            )}
          </div>
          <div ref={gaugeRef}>
            <GaugeChart
              value={overallScore}
              label="Performance Score"
              unit="%"
              goodColor={COLORS.green}
              warnColor={COLORS.yellow}
              dangerColor={COLORS.red}
              thresholds={{ danger: 60, warning: 80 }}
              size={220}
              showExport={isAdminOrAgent}
              exportFilename="benchmark-overall-score"
            />
          </div>
          <div style={{ marginTop: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
              Your Performance: {overallScore}% vs. Industry Average
            </div>
            <div style={{ fontSize: 12, color: overallTrendDisplay.color, marginTop: 4, fontWeight: 500 }}>
              {overallTrendDisplay.arrow} {overallTrendDisplay.text}
            </div>
          </div>
        </div>

        {/* Right — Summary Table */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <LayoutGrid size={14} style={{ color: 'var(--accent)' }} />
            Benchmark Summary
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Metric</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Your Value</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Industry Avg</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Best-in-Class</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Trend</th>
                </tr>
              </thead>
              <tbody>
                {benchmarks.slice(0, 8).map((m) => (
                  <tr
                    key={m.key}
                    style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text)' }}>{m.label}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: COLORS.yourValue }}>{m.formattedYourValue}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>{m.industryAvg}{m.unit}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: COLORS.bestInClass }}>{m.bestInClass}{m.unit}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <StatusBadge status={m.status} />
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 16, color: m.trendColor }}>
                      {m.trendArrow}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Detailed Benchmark Metrics ────────────────────────── */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
          Detailed Benchmark Metrics
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* ── Category 1: Efficiency ─────────────────────────────────── */}
          <AccordionSection
            title="Efficiency Metrics"
            icon={Clock}
            defaultOpen={openCategories.efficiency}
          >
            {/* MTTR by Priority - Grouped Bar */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  MTTR by Priority
                </h4>
                {isMetricPinned && handlePin && handleUnpin && (
                  <PinButton size={14} isPinned={isMetricPinned('benchmark_mttr')} onPin={() => handlePin('benchmark_mttr', 'MTTR by Priority', 'chart')} onUnpin={() => handleUnpin('benchmark_mttr')} />
                )}
              </div>
              <div ref={mttrBarRef}>
                <InteractiveBarChart
                  data={mttrByPriority}
                  series={[
                    { dataKey: 'yourValue', name: 'Your Value', color: COLORS.yourValue },
                    { dataKey: 'industryAvg', name: 'Industry Avg', color: COLORS.industryAvg },
                    { dataKey: 'bestInClass', name: 'Best-in-Class', color: COLORS.bestInClass },
                  ]}
                  height={260}
                  unit="hrs"
                  showExport={isAdminOrAgent}
                  exportFilename="mttr-by-priority"
                  yLabel="Hours"
                />
              </div>
            </div>

            {/* First Response Time Trend - Empty State */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <BarChart3 size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
                <p style={{ fontSize: 13 }}>Time-series data for this metric is not yet available. This metric is currently tracked as an aggregate value only.</p>
              </div>
            </div>

            {/* Ticket Resolution Velocity - Area */}
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
                Ticket Resolution Velocity
              </h4>
              <div ref={velocityRef}>
                <InteractiveAreaChart
                  data={velocityData}
                  series={[
                    { dataKey: 'yourValue', name: 'Your Velocity', color: COLORS.yourValue },
                    { dataKey: 'industryAvg', name: 'Industry Avg', color: COLORS.industryAvg },
                  ]}
                  height={260}
                  unit="tickets"
                  showExport={isAdminOrAgent}
                  exportFilename="resolution-velocity"
                  yLabel="Tickets per day"
                  xLabel="Last 30 days"
                />
              </div>
            </div>
          </AccordionSection>

          {/* ── Category 2: Quality ────────────────────────────────────── */}
          <AccordionSection
            title="Quality Metrics"
            icon={ThumbsUp}
            defaultOpen={openCategories.quality}
          >
            {/* CSAT Score Trend - Empty State */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, right: 8 }}>
                  {isMetricPinned && handlePin && handleUnpin && (
                    <PinButton size={14} isPinned={isMetricPinned('benchmark_csat')} onPin={() => handlePin('benchmark_csat', 'CSAT Score', 'kpi')} onUnpin={() => handleUnpin('benchmark_csat')} />
                  )}
                </div>
                <BarChart3 size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
                <p style={{ fontSize: 13 }}>Time-series data for this metric is not yet available. This metric is currently tracked as an aggregate value only.</p>
              </div>
            </div>

            {/* First Contact Resolution - Gauge Only (aggregate data) */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
                First Contact Resolution Rate
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 20, alignItems: 'center' }}>
                <div ref={fcrGaugeRef}>
                  <GaugeChart
                    value={clamp(fcrCurrent, 0, 100)}
                    label="FCR Rate"
                    unit="%"
                    goodColor={COLORS.bestInClass}
                    warnColor={COLORS.yellow}
                    dangerColor={COLORS.red}
                    thresholds={{ danger: 60, warning: 74 }}
                    size={180}
                    showExport={isAdminOrAgent}
                    exportFilename="fcr-gauge"
                  />
                  <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                    Target: 74% (Industry Avg) / 80% (Best-in-Class)
                  </div>
                </div>
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <BarChart3 size={28} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                  <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
                  <p style={{ fontSize: 13 }}>Time-series data for this metric is not yet available. This metric is currently tracked as an aggregate value only.</p>
                </div>
              </div>
            </div>

            {/* Reopen Rate Analysis - Not Tracked */}
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
                Reopen Rate Analysis
              </h4>
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <BarChart3 size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
                <p style={{ fontSize: 13 }}>Reopen tracking is not yet enabled. Enable reopen tracking in settings to view this metric.</p>
              </div>
            </div>
          </AccordionSection>

          {/* ── Category 3: Compliance ─────────────────────────────────── */}
          <AccordionSection
            title="Compliance Metrics"
            icon={Shield}
            defaultOpen={openCategories.compliance}
          >
            {/* SLA Compliance by Priority */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  SLA Compliance by Priority
                </h4>
                {isMetricPinned && handlePin && handleUnpin && (
                  <PinButton size={14} isPinned={isMetricPinned('benchmark_sla')} onPin={() => handlePin('benchmark_sla', 'SLA Compliance by Priority', 'chart')} onUnpin={() => handleUnpin('benchmark_sla')} />
                )}
              </div>
              {slaByPriority.some((d) => d.met > 0 || d.breached > 0) && (
                <div ref={slaBarRef}>
                  <ExportButtons chartRef={slaBarRef} filename="sla-by-priority" />
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={slaByPriority} margin={{ top: 8, right: 8, left: 8, bottom: 8 }} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle, #eef0f3)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: 'var(--text-muted, #9CA3AF)', fontSize: 11 }}
                        axisLine={{ stroke: 'var(--border, #dde1e7)' }}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: 'var(--text-muted, #9CA3AF)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        label={{ value: '%', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted, #9CA3AF)', fontSize: 11 } }}
                      />
                      <Tooltip
                        content={({ active, payload, label }: any) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div style={{ background: 'var(--bg-elevated, #fff)', border: '1px solid var(--border, #dde1e7)', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 13 }}>
                              <div style={{ fontWeight: 600, marginBottom: 4 }}>{label} Priority</div>
                              {payload.map((e: any, i: number) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ width: 8, height: 8, borderRadius: 2, background: e.color }} />
                                  <span>{e.name}: <strong>{e.value.toFixed(1)}%</strong></span>
                                </div>
                              ))}
                            </div>
                          );
                        }}
                      />
                      <ReferenceLine y={95} stroke="#F59E0B" strokeDasharray="6 3" label={{ value: 'Target: 95%', position: 'right', fontSize: 10, fill: '#F59E0B' }} />
                      <Bar dataKey="met" name="Met SLA" stackId="a" fill={COLORS.green} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="breached" name="Breached" stackId="a" fill={COLORS.red} radius={[0, 0, 0, 0]} />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value: string) => <span style={{ color: 'var(--text-secondary, #4B5563)', fontSize: 12 }}>{value}</span>}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {!slaByPriority.some((d) => d.met > 0) && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <BarChart3 size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                  <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
                  <p style={{ fontSize: 13 }}>No SLA data available for current filter criteria.</p>
                </div>
              )}
            </div>

            {/* Change Success Rate Trend - Empty State */}
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
                Change Success Rate Trend
              </h4>
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <BarChart3 size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
                <p style={{ fontSize: 13 }}>Time-series data for this metric is not yet available. This metric is currently tracked as an aggregate value only.</p>
              </div>
            </div>
          </AccordionSection>

          {/* ── Category 4: Productivity ────────────────────────────────── */}
          <AccordionSection
            title="Productivity Metrics"
            icon={Users}
            defaultOpen={openCategories.productivity}
          >
            {/* Tickets per Agent per Day */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
                Tickets per Agent per Day
              </h4>
              <div ref={agentBarRef}>
                <InteractiveBarChart
                  data={agentProductivity}
                  color={COLORS.yourValue}
                  radius={4}
                  height={300}
                  unit="tickets/day"
                  layout="horizontal"
                  showExport={isAdminOrAgent}
                  exportFilename="agent-productivity"
                  xLabel="Tickets per day"
                />
              </div>
              <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                Industry average: 5-7 tickets/agent/day
              </div>
            </div>

            {/* Agent Utilization Scatter */}
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
                Agent Utilization
              </h4>
              <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16 }}>
                {agentScatterData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <ScatterChart margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle, #eef0f3)" />
                      <XAxis
                        dataKey="ticketsResolved"
                        name="Tickets Resolved"
                        tick={{ fill: 'var(--text-muted, #9CA3AF)', fontSize: 11 }}
                        axisLine={{ stroke: 'var(--border, #dde1e7)' }}
                        tickLine={false}
                        type="number"
                        label={{ value: 'Tickets Resolved', position: 'insideBottom', offset: -6, style: { fill: 'var(--text-muted, #9CA3AF)', fontSize: 11 } }}
                      />
                      <YAxis
                        dataKey="utilization"
                        name="Utilization %"
                        domain={[0, 100]}
                        tick={{ fill: 'var(--text-muted, #9CA3AF)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        label={{ value: 'Utilization %', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted, #9CA3AF)', fontSize: 11 } }}
                      />
                      <ZAxis range={[60, 60]} />
                      <Tooltip
                        content={({ active, payload }: any) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div style={{ background: 'var(--bg-elevated, #fff)', border: '1px solid var(--border, #dde1e7)', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 13 }}>
                              <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.name}</div>
                              <div>Tickets: <strong>{d.ticketsResolved}</strong></div>
                              <div>Utilization: <strong>{d.utilization}%</strong></div>
                            </div>
                          );
                        }}
                      />
                      <Scatter data={agentScatterData} fill={COLORS.yourValue}>
                        {agentScatterData.map((_, idx) => (
                          <Cell key={idx} fill={COLORS.yourValue} opacity={0.7} />
                        ))}
                      </Scatter>
                      {/* Quadrant lines */}
                      <Legend
                        verticalAlign="bottom"
                        height={30}
                        formatter={() => (
                          <span style={{ color: 'var(--text-secondary, #4B5563)', fontSize: 12 }}>Each dot = one agent</span>
                        )}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <BarChart3 size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
                    <p style={{ fontSize: 13 }}>No agent performance data for the current filter criteria.</p>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>Top-right quadrant = High performers</span>
                  <span>Bottom-left = Needs improvement</span>
                </div>
              </div>
            </div>
          </AccordionSection>
        </div>
      </div>

      {/* ── SECTION 3: Benchmark Insights ────────────────────────────────── */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
          Benchmark Insights
        </h3>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <InsightCard
            title="Strengths"
            icon={CheckCircle}
            items={insights.strengths}
            colors={INSIGHT_COLORS.strengths}
          />
          <InsightCard
            title="Improvement Opportunities"
            icon={AlertTriangle}
            items={insights.opportunities}
            colors={INSIGHT_COLORS.opportunities}
          />
          <InsightCard
            title="Critical Areas"
            icon={AlertTriangle}
            items={insights.critical}
            colors={INSIGHT_COLORS.critical}
          />
        </div>
      </div>

      {/* ── SECTION 4: Historical Comparison ─────────────────────────────── */}
      {isAdminOrAgent && historicalData.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
            Historical Comparison (Year-over-Year)
          </h3>
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <BarChart3 size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p style={{ fontWeight: 500, marginBottom: 4 }}>No data available</p>
            <p style={{ fontSize: 13 }}>
              Historical comparison requires 12+ months of data.
            </p>
          </div>
        </div>
      )}

      {!isAdminOrAgent && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Full benchmark comparison with trend analysis available for admin users.
        </p>
      )}

      <style>{`
        @media (max-width: 640px) {
          .benchmark-overview-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
