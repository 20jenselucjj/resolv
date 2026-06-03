'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, Activity, Zap, Flag, FileText, Users, TrendingUp,
  AlertTriangle, Search, ChevronDown, ChevronUp, Download, Clock, PieChart, Calendar
} from 'lucide-react';
import type { AnalyticsData } from './types';

interface AnalyticsTabProps {
  analytics: AnalyticsData | null;
  loading: boolean;
  handleFlagQuery: (id: string) => Promise<void>;
}

const TIME_RANGES = ['24h', '7d', '30d', '90d', 'All Time'] as const;
type TimeRange = typeof TIME_RANGES[number];

const SOURCE_COLORS: Record<string, string> = {
  kb_sync: '#8b5cf6',
  ticket_sync: '#3b82f6',
  manual: '#10b981',
  url: '#f59e0b',
  file: '#ef4444',
};

const SOURCE_LABELS: Record<string, string> = {
  kb_sync: 'Knowledge Base',
  ticket_sync: 'Tickets',
  manual: 'Manual',
  url: 'URL',
  file: 'File',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getWeekOverWeekChange(daily: { date: string; count: number }[]): number | null {
  if (daily.length < 14) return null;
  const sorted = [...daily].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const recent = sorted.slice(-7).reduce((s, d) => s + d.count, 0);
  const prev = sorted.slice(-14, -7).reduce((s, d) => s + d.count, 0);
  if (prev === 0) return null;
  return ((recent - prev) / prev) * 100;
}

function computeMovingAverage(data: { date: string; count: number }[], window: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < window - 1) return null;
    const slice = data.slice(i - window + 1, i + 1);
    return slice.reduce((s, d) => s + d.count, 0) / window;
  });
}

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    d += ` C${cx},${prev.y} ${cx},${curr.y} ${curr.x},${curr.y}`;
  }
  return d;
}

export function AnalyticsTab(props: AnalyticsTabProps) {
  const { analytics, loading, handleFlagQuery } = props;

  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    try { return (localStorage.getItem('resolv_analytics_time_range') as TimeRange) || '30d' } catch { return '30d' }
  });

  useEffect(() => { localStorage.setItem('resolv_analytics_time_range', timeRange) }, [timeRange]);
  const [querySearch, setQuerySearch] = useState('');
  const [querySort, setQuerySort] = useState<'newest' | 'highest' | 'lowest' | 'flagged'>('newest');
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);

  const filteredDaily = useMemo(() => {
    if (!analytics) return [];
    const sorted = [...analytics.daily_volume].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    if (timeRange === 'All Time') return sorted;
    const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return sorted.filter((d) => new Date(d.date) >= cutoff);
  }, [analytics, timeRange]);

  const filteredQueries = useMemo(() => {
    if (!analytics) return [];
    let list = [...analytics.recent_queries];
    if (querySearch) {
      const q = querySearch.toLowerCase();
      list = list.filter((r) => r.query.toLowerCase().includes(q) || (r.user_name || '').toLowerCase().includes(q));
    }
    switch (querySort) {
      case 'newest': return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'highest': return list.sort((a, b) => b.confidence_score - a.confidence_score);
      case 'lowest': return list.sort((a, b) => a.confidence_score - b.confidence_score);
      case 'flagged': return list.sort((a, b) => (b.flagged_for_review ? 1 : 0) - (a.flagged_for_review ? 1 : 0));
      default: return list;
    }
  }, [analytics, querySearch, querySort]);

  const sourceTypeData = useMemo(() => {
    if (!analytics) return [];
    const map = new Map<string, { count: number; hits: number }>();
    analytics.source_stats.forEach((s) => {
      const cat = s.category || 'other';
      const existing = map.get(cat) || { count: 0, hits: 0 };
      existing.count += s.chunk_count;
      existing.hits += s.query_hits;
      map.set(cat, existing);
    });
    return Array.from(map.entries()).map(([category, data]) => ({ category, ...data }));
  }, [analytics]);

  const totalSourceHits = sourceTypeData.reduce((s, d) => s + d.hits, 0);

  if (!analytics && !loading) {
    return (
      <div style={{ padding: '60px 40px', textAlign: 'center', borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', border: '1px dashed var(--border)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <BarChart3 size={28} style={{ color: 'var(--text-muted)' }} />
        </div>
        <p style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>No analytics data available</p>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
          Analytics will populate once the AI assistant begins processing queries. Configure your knowledge sources and submit a test query to see results here.
        </p>
      </div>
    );
  }

  if (!analytics) return null;

  const missRate = analytics.summary.total_queries > 0
    ? ((analytics.recent_queries.filter((q) => q.confidence_score < 0.3).length / analytics.recent_queries.length) * 100)
    : 0;

  const lowConfCount = analytics.recent_queries.filter((q) => q.confidence_score < 0.4).length;
  const estimatedMissRate = analytics.recent_queries.length > 0
    ? (lowConfCount / analytics.recent_queries.length) * 100
    : 0;

  const flaggedRate = analytics.summary.total_queries > 0
    ? (analytics.summary.flagged_count / analytics.summary.total_queries) * 100
    : 0;

  const sourceCoverage = analytics.summary.total_sources > 0
    ? (analytics.summary.active_sources / analytics.summary.total_sources) * 100
    : 0;

  const wowChange = getWeekOverWeekChange(analytics.daily_volume);

  // --- SVG Line Chart dimensions ---
  const CHART_W = 600;
  const CHART_H = 200;
  const PAD_L = 40;
  const PAD_R = 16;
  const PAD_T = 20;
  const PAD_B = 36;
  const plotW = CHART_W - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_T - PAD_B;

  const maxCount = Math.max(...filteredDaily.map((d) => d.count), 1);
  const yTicks = 4;
  const yStep = Math.ceil(maxCount / yTicks);

  const points = filteredDaily.map((d, i) => ({
    x: PAD_L + (i / Math.max(filteredDaily.length - 1, 1)) * plotW,
    y: PAD_T + plotH - (d.count / maxCount) * plotH,
    count: d.count,
    date: d.date,
  }));

  const maWindow = 7;
  const maValues = computeMovingAverage(filteredDaily, maWindow);
  const maPoints = maValues
    .map((v, i) => (v !== null ? { x: points[i].x, y: PAD_T + plotH - (v / maxCount) * plotH, val: v } : null))
    .filter((p): p is { x: number; y: number; val: number } => p !== null);

  // --- Donut Chart ---
  const DONUT_SIZE = 160;
  const DONUT_RADIUS = 60;
  const DONUT_THICKNESS = 20;
  const cx = DONUT_SIZE / 2;
  const cy = DONUT_SIZE / 2;

  const sortedSourceTypes = [...sourceTypeData].sort((a, b) => b.hits - a.hits);
  let donutStart = 0;

  // --- Sort source stats by hits descending ---
  const sortedSourceStats = [...analytics.source_stats].sort((a, b) => b.query_hits - a.query_hits);
  const topSourceHitRate = sortedSourceStats.length > 0
    ? analytics.summary.total_queries > 0
      ? (sortedSourceStats[0].query_hits / analytics.summary.total_queries * 100).toFixed(1)
      : '0.0'
    : '0.0';

  const mostQueriedDay = filteredDaily.length > 0
    ? filteredDaily.reduce((a, b) => (a.count > b.count ? a : b))
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px',
        padding: '20px 24px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, var(--bg) 100%)',
        borderRadius: 'var(--radius-lg)', border: '1px solid rgba(139, 92, 246, 0.2)'
      }}>
        <div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: '#8b5cf6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={18} />
            </div>
            Retrieval Analytics
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '500px' }}>
            Monitor model query hits, vector matching confidence, and flag anomalies for manual review
          </p>
        </div>
        {/* Time Range Selector */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '3px' }}>
          {TIME_RANGES.map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
                fontSize: '12px', fontWeight: timeRange === range ? 700 : 500,
                color: timeRange === range ? 'var(--accent)' : 'var(--text-muted)',
                background: timeRange === range ? 'var(--bg)' : 'transparent',
                cursor: 'pointer', transition: 'all 0.15s',
                boxShadow: timeRange === range ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
        {[
          { label: 'Total Queries', value: analytics.summary.total_queries.toLocaleString(), icon: <Activity size={18} />, color: 'var(--accent)', bg: 'var(--accent-subtle)' },
          { label: 'Avg Confidence', value: `${(analytics.summary.avg_confidence * 100).toFixed(1)}%`, icon: <Zap size={18} />, color: 'var(--success)', bg: 'var(--success-bg)' },
          { label: 'Flagged', value: analytics.summary.flagged_count, icon: <Flag size={18} />, color: 'var(--danger)', bg: 'var(--danger-bg)' },
          { label: 'Active Sources', value: `${analytics.summary.active_sources}`, icon: <FileText size={18} />, color: '#9333ea', bg: 'rgba(147, 51, 234, 0.1)' },
          { label: 'Miss Rate', value: `${missRate.toFixed(1)}%`, icon: <AlertTriangle size={18} />, color: missRate > 20 ? 'var(--danger)' : missRate > 10 ? 'var(--warning)' : 'var(--text-secondary)', bg: missRate > 20 ? 'var(--danger-bg)' : missRate > 10 ? 'var(--warning-bg)' : 'var(--bg-tertiary)' },
        ].map((card, i) => (
          <div key={i} style={{ padding: '20px', background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</span>
              <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {card.icon}
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: card.label === 'Miss Rate' ? (missRate > 20 ? 'var(--danger)' : missRate > 10 ? 'var(--warning)' : 'var(--text)') : 'var(--text)' }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
        {/* Left: Daily Query Volume - Line Chart */}
        <div style={{ padding: '20px', background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Daily Query Volume</h4>
            </div>
            {wowChange !== null && (
              <span style={{
                fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-full)',
                color: wowChange >= 0 ? 'var(--success)' : 'var(--danger)',
                background: wowChange >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)',
              }}>
                {wowChange >= 0 ? '+' : ''}{wowChange.toFixed(1)}% vs last week
              </span>
            )}
          </div>
          <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
            <svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="xMidYMid meet" style={{ minWidth: Math.max(CHART_W, filteredDaily.length * 20) }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {/* Y-axis gridlines + labels */}
              {Array.from({ length: yTicks + 1 }, (_, i) => {
                const val = yStep * i;
                const y = PAD_T + plotH - (val / maxCount) * plotH;
                return (
                  <g key={i}>
                    <line x1={PAD_L} y1={y} x2={CHART_W - PAD_R} y2={y} stroke="var(--border)" strokeWidth="1" />
                    <text x={PAD_L - 8} y={y + 4} textAnchor="end" fill="var(--text-muted)" fontSize="11">{val}</text>
                  </g>
                );
              })}
              {/* Area fill */}
              {points.length > 1 && (
                <path
                  d={`M${points[0].x},${PAD_T + plotH} ${buildSmoothPath(points).slice(1)} L${points[points.length - 1].x},${PAD_T + plotH} Z`}
                  fill="url(#areaGrad)"
                />
              )}
              {/* Main line */}
              {points.length > 1 && (
                <path d={buildSmoothPath(points)} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              )}
              {/* 7-day moving average */}
              {maPoints.length > 1 && (
                <path d={buildSmoothPath(maPoints)} fill="none" stroke="var(--warning)" strokeWidth="1.5" strokeDasharray="6,4" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
              )}
              {/* Data dots */}
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2" />
              ))}
              {/* X-axis labels */}
              {points.filter((_, i) => {
                if (filteredDaily.length <= 10) return true;
                const step = Math.ceil(filteredDaily.length / 10);
                return i % step === 0 || i === filteredDaily.length - 1;
              }).map((p, i, arr) => (
                <text key={i} x={p.x} y={CHART_H - 8} textAnchor="middle" fill="var(--text-muted)" fontSize="11">
                  {formatShortDate(p.date)}
                </text>
              ))}
            </svg>
          </div>
        </div>

        {/* Right: Source Type Breakdown - Donut Chart */}
        <div style={{ padding: '20px', background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <PieChart size={16} style={{ color: 'var(--accent)' }} />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Source Type Breakdown</h4>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            {/* Donut */}
            <div style={{ width: DONUT_SIZE, height: DONUT_SIZE, position: 'relative', flexShrink: 0 }}>
              <svg width={DONUT_SIZE} height={DONUT_SIZE} viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}>
                {/* Background ring */}
                <circle cx={cx} cy={cy} r={DONUT_RADIUS} fill="none" stroke="var(--bg-tertiary)" strokeWidth={DONUT_THICKNESS} />
                {/* Segments */}
                {sortedSourceTypes.map((item) => {
                  const angle = totalSourceHits > 0 ? (item.hits / totalSourceHits) * 360 : 0;
                  const startAngle = donutStart;
                  const endAngle = donutStart + angle;
                  donutStart = endAngle;
                  if (angle <= 0) return null;
                  const sr = (startAngle * Math.PI) / 180;
                  const er = (endAngle * Math.PI) / 180;
                  const r = DONUT_RADIUS;
                  const x1 = cx + r * Math.sin(sr);
                  const y1 = cy - r * Math.cos(sr);
                  const x2 = cx + r * Math.sin(er);
                  const y2 = cy - r * Math.cos(er);
                  const largeArc = angle > 180 ? 1 : 0;
                  return (
                    <path
                      key={item.category}
                      d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
                      fill="none"
                      stroke={SOURCE_COLORS[item.category] || 'var(--accent)'}
                      strokeWidth={DONUT_THICKNESS}
                      strokeLinecap="round"
                    />
                  );
                })}
              </svg>
              {/* Center text */}
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)' }}>{totalSourceHits}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>hits</span>
              </div>
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              {sortedSourceTypes.map((item) => {
                const pct = totalSourceHits > 0 ? ((item.hits / totalSourceHits) * 100).toFixed(1) : '0.0';
                return (
                  <div key={item.category} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: SOURCE_COLORS[item.category] || 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '12px', color: 'var(--text)', fontWeight: 500 }}>
                      {SOURCE_LABELS[item.category] || item.category}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>{item.hits}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Two-column metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left: Performance Metrics */}
        <div style={{ padding: '20px', background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={16} style={{ color: 'var(--accent)' }} />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Performance Metrics</h4>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'Avg Retrieval Latency', value: '\u2014', hint: '' },
              { label: 'Top-K Hit Rate', value: '\u2014', hint: '' },
              { label: 'Avg Confidence Score', value: `${(analytics.summary.avg_confidence * 100).toFixed(1)}%`, hint: '' },
              { label: 'Most Queried Day', value: mostQueriedDay ? `${formatDate(mostQueriedDay.date)} (${mostQueriedDay.count})` : '\u2014', hint: '' },
            ].map((metric, i) => (
              <div key={i} style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{metric.label}</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: metric.value === '\u2014' ? 'var(--text-muted)' : 'var(--text)' }}>{metric.value}</div>
                {metric.hint && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 4 }}>{metric.hint}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Quality Metrics */}
        <div style={{ padding: '20px', background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={16} style={{ color: 'var(--accent)' }} />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Quality Metrics</h4>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'Flagged Query Rate', value: `${flaggedRate.toFixed(1)}%`, hint: `${analytics.summary.flagged_count} / ${analytics.summary.total_queries} queries` },
              { label: 'Estimated Miss Rate', value: `${estimatedMissRate.toFixed(1)}%`, hint: `confidence < 0.4 (${lowConfCount} queries)` },
              { label: 'Source Coverage', value: `${sourceCoverage.toFixed(1)}%`, hint: `${analytics.summary.active_sources} / ${analytics.summary.total_sources} sources` },
              { label: 'Total Data Points', value: `${analytics.daily_volume.length}`, hint: `${filteredDaily.length} in selected range` },
            ].map((metric, i) => (
              <div key={i} style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{metric.label}</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>{metric.value}</div>
                {metric.hint && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 4 }}>{metric.hint}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Source Performance Table */}
      <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={16} style={{ color: 'var(--accent)' }} />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Source Performance</h4>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Top: {topSourceHitRate}% hit rate</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>&middot;</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sorted by hits</span>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Chunks</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Query Hits</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Hit Rate</th>
              </tr>
            </thead>
            <tbody>
              {sortedSourceStats.map((src, index) => {
                const hitRate = analytics.summary.total_queries > 0
                  ? (src.query_hits / analytics.summary.total_queries) * 100
                  : 0;
                const hitRateColor = hitRate > 20 ? 'var(--success)' : hitRate > 5 ? 'var(--warning)' : 'var(--danger)';
                const isTop = index === 0;
                return (
                  <tr key={index} style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: isTop ? 'rgba(16, 185, 129, 0.04)' : 'transparent',
                  }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isTop && (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--success)', padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--success-bg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top</span>
                        )}
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>{src.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {src.category || '\u2014'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>
                      {src.chunk_count}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontSize: '13px', color: 'var(--accent)' }}>
                      {src.query_hits}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontSize: '13px', color: hitRateColor }}>
                      {hitRate.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
              {sortedSourceStats.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No source data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Queries */}
      <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={16} style={{ color: 'var(--accent)' }} />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Recent Model Inquiries</h4>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px 8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)' }}>Live</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative', width: 180 }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search queries..."
                value={querySearch}
                onChange={(e) => setQuerySearch(e.target.value)}
                style={{
                  width: '100%', padding: '6px 8px 6px 28px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)',
                  fontSize: '12px', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            {/* Sort */}
            <select
              value={querySort}
              onChange={(e) => setQuerySort(e.target.value as typeof querySort)}
              style={{
                padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text)', fontSize: '12px', fontWeight: 500,
                cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="newest">Newest</option>
              <option value="highest">Highest Confidence</option>
              <option value="lowest">Lowest Confidence</option>
              <option value="flagged">Flagged First</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filteredQueries.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              {querySearch ? 'No queries match your search.' : 'No queries recorded yet.'}
            </div>
          )}
          {filteredQueries.map((q) => {
            const conf = Math.round((q.confidence_score || 0) * 100) / 100;
            const confPct = conf * 100;
            const confColor = confPct > 85 ? 'var(--success)' : confPct > 70 ? 'var(--warning)' : 'var(--danger)';
            const confBg = confPct > 85 ? 'var(--success-bg)' : confPct > 70 ? 'var(--warning-bg)' : 'var(--danger-bg)';
            const isExpanded = expandedQuery === q.id;
            return (
              <div key={q.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <div style={{
                  padding: '14px 20px', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', gap: '16px', transition: 'background 0.15s', cursor: 'pointer',
                }}
                  onClick={() => setExpandedQuery(isExpanded ? null : q.id)}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text)', fontStyle: 'italic' }}>
                      &ldquo;{q.query}&rdquo;
                    </p>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={11} /> {q.user_name || 'Unknown'}
                      </span>
                      <span>&middot;</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={11} /> {new Date(q.created_at).toLocaleString()}
                      </span>
                      {q.flagged_for_review && (
                        <>
                          <span>&middot;</span>
                          <span style={{ color: 'var(--danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Flag size={11} /> Flagged
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <div style={{ textAlign: 'center', padding: '8px 14px', background: confBg, borderRadius: 'var(--radius-md)', minWidth: '64px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confidence</div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: confColor }}>{confPct.toFixed(0)}%</div>
                    </div>
                    <button
                      disabled={q.flagged_for_review}
                      onClick={(e) => { e.stopPropagation(); handleFlagQuery(q.id); }}
                      style={{
                        padding: '8px 12px', borderRadius: 'var(--radius-md)', border: `1px solid ${q.flagged_for_review ? 'var(--danger-border)' : 'var(--border)'}`,
                        background: q.flagged_for_review ? 'var(--danger-bg)' : 'transparent',
                        color: q.flagged_for_review ? 'var(--danger)' : 'var(--text-secondary)',
                        fontSize: '12px', fontWeight: 600, cursor: q.flagged_for_review ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
                      }}
                    >
                      <Flag size={13} />
                      {q.flagged_for_review ? 'Flagged' : 'Flag'}
                    </button>
                    <div style={{ color: 'var(--text-muted)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      <ChevronDown size={16} />
                    </div>
                  </div>
                </div>
                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{
                    padding: '12px 20px 16px 20px', background: 'var(--bg-secondary)',
                    borderTop: '1px solid var(--border-subtle)', margin: '0',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '12px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.04em' }}>Query ID</span>
                        <div style={{ color: 'var(--text)', fontWeight: 500, marginTop: 3, fontFamily: 'monospace', fontSize: '11px' }}>{q.id}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.04em' }}>Timestamp</span>
                        <div style={{ color: 'var(--text)', fontWeight: 500, marginTop: 3 }}>{new Date(q.created_at).toLocaleString()}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.04em' }}>Score</span>
                        <div style={{ color: confColor, fontWeight: 700, marginTop: 3 }}>{confPct.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
