'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  Trash2, RefreshCw, Maximize2, Star, GripVertical,
} from 'lucide-react';
import type { PinnedMetric, Ticket } from '../types';
import { STATUS_COLORS, PRIORITY_COLORS } from '../types';
import { ScorecardWidget, InteractiveDonutChart, InteractiveBarChart, GaugeChart } from '../components/recharts';
import { CardSection } from '../components/Charts';

interface PinboardTabProps {
  pins: PinnedMetric[];
  pinsLoading: boolean;
  /** Full tickets data for computing pin values */
  tickets: Ticket[];
  /** Callback to unpin with pin id + metric key */
  onUnpin: (id: string, metricKey: string) => void;
  /** Callback to reorder pins */
  onReorder: (fromIdx: number, toIdx: number) => void;
  /** Callback to refresh pin data */
  onRefresh: () => void;
}

// ── Chart data shape returned by computePinChart ──
interface PinChartData {
  type: 'donut' | 'bar' | 'gauge';
  donutData?: { name: string; value: number; color: string }[];
  barData?: { name: string; value: number; color?: string }[];
  gaugeValue?: number;
  gaugeLabel?: string;
  gaugeUnit?: string;
}

// ── Compute chart data from tickets for chart-type metric keys ──
function computePinChart(metric: PinnedMetric, tickets: Ticket[]): PinChartData | null {
  const key = metric.metric_key;

  // Edge case: no tickets
  if (!tickets || tickets.length === 0) return null;

  // ── Ticket distribution donuts ──
  if (key === 'chart_status_donut') {
    const counts: Record<string, number> = {};
    tickets.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
    const data = Object.entries(counts).map(([k, v]) => ({
      name: k.replace(/_/g, ' '), value: v,
      color: STATUS_COLORS[k] || 'var(--text-muted)',
    }));
    return data.length ? { type: 'donut', donutData: data } : null;
  }

  if (key === 'chart_priority_donut') {
    const counts: Record<string, number> = {};
    tickets.forEach(t => { const p = t.priority?.toLowerCase() || 'low'; counts[p] = (counts[p] || 0) + 1; });
    const data = Object.entries(counts).map(([k, v]) => ({
      name: k.charAt(0).toUpperCase() + k.slice(1), value: v,
      color: PRIORITY_COLORS[k] || 'var(--text-muted)',
    }));
    return data.length ? { type: 'donut', donutData: data } : null;
  }

  if (key === 'chart_type_donut') {
    const counts: Record<string, number> = {};
    tickets.forEach(t => { const ty = t.ticket_type || 'incident'; counts[ty] = (counts[ty] || 0) + 1; });
    const data = Object.entries(counts).map(([k, v]) => ({
      name: k.replace(/_/g, ' '), value: v,
      color: k === 'incident' ? 'var(--danger)' : k === 'service_request' ? 'var(--info)' : 'var(--accent)',
    }));
    return data.length ? { type: 'donut', donutData: data } : null;
  }

  // ── Bar charts (category, trend, breaches, agent) ──
  if (key === 'chart_category_bar') {
    const counts: Record<string, number> = {};
    tickets.forEach(t => { const c = t.category_name || 'Uncategorized'; counts[c] = (counts[c] || 0) + 1; });
    const data = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ name: k, value: v }));
    return data.length ? { type: 'bar', barData: data } : null;
  }

  if (key === 'chart_ticket_trend') {
    const counts: Record<string, number> = {};
    tickets.forEach(t => {
      const d = new Date(t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      counts[d] = (counts[d] || 0) + 1;
    });
    const data = Object.entries(counts)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([k, v]) => ({ name: k, value: v }));
    return data.length ? { type: 'bar', barData: data } : null;
  }

  if (key === 'chart_breaches_bar') {
    const counts: Record<string, number> = {};
    tickets.filter(t => t.sla_breached).forEach(t => {
      const p = t.priority?.toLowerCase() || 'low';
      counts[p] = (counts[p] || 0) + 1;
    });
    const data = Object.entries(counts).map(([k, v]) => ({
      name: k.charAt(0).toUpperCase() + k.slice(1), value: v,
    }));
    return data.length ? { type: 'bar', barData: data } : null;
  }

  if (key === 'chart_agent_comparison') {
    const counts: Record<string, number> = {};
    tickets.forEach(t => {
      const name = t.assigned_to_name || 'Unassigned';
      counts[name] = (counts[name] || 0) + 1;
    });
    const data = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ name: k, value: v }));
    return data.length ? { type: 'bar', barData: data } : null;
  }

  // ── Gauge ──
  if (key === 'chart_sla_compliance_gauge') {
    const total = tickets.length;
    const breached = tickets.filter(t => t.sla_breached).length;
    const pct = total ? Math.round(((total - breached) / total) * 100) : 100;
    return { type: 'gauge', gaugeValue: pct, gaugeLabel: 'SLA Compliance', gaugeUnit: '%' };
  }

  // ── Problem charts (filter by ticket_type === 'problem') ──
  if (key === 'chart_problem_status') {
    const problems = tickets.filter(t => t.ticket_type === 'problem');
    const counts: Record<string, number> = {};
    problems.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
    const data = Object.entries(counts).map(([k, v]) => ({
      name: k.replace(/_/g, ' '), value: v,
      color: STATUS_COLORS[k] || 'var(--text-muted)',
    }));
    return data.length ? { type: 'donut', donutData: data } : null;
  }

  if (key === 'chart_problem_priority') {
    const problems = tickets.filter(t => t.ticket_type === 'problem');
    const counts: Record<string, number> = {};
    problems.forEach(t => { const p = t.priority?.toLowerCase() || 'low'; counts[p] = (counts[p] || 0) + 1; });
    const data = Object.entries(counts).map(([k, v]) => ({
      name: k.charAt(0).toUpperCase() + k.slice(1), value: v,
      color: PRIORITY_COLORS[k] || 'var(--text-muted)',
    }));
    return data.length ? { type: 'donut', donutData: data } : null;
  }

  if (key === 'chart_problem_trend') {
    const problems = tickets.filter(t => t.ticket_type === 'problem');
    const counts: Record<string, number> = {};
    problems.forEach(t => {
      const d = new Date(t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      counts[d] = (counts[d] || 0) + 1;
    });
    const data = Object.entries(counts)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([k, v]) => ({ name: k, value: v }));
    return data.length ? { type: 'bar', barData: data } : null;
  }

  // ── Fallback for unsupported chart types ──
  return null;
}

// ── Helper: compute a display value from tickets for a pinned metric ──
function computePinValue(metric: PinnedMetric, tickets: Ticket[]): { value: string | number; unit?: string } {
  // Edge case: no tickets available
  if (!tickets || tickets.length === 0) {
    return { value: '—' };
  }

  const key = metric.metric_key;

  // ── SLA / Compliance ──
  if (key.includes('sla') || key.endsWith('_compliance')) {
    const total = tickets.length;
    const breached = tickets.filter(t => t.sla_breached).length;
    const pct = total ? Math.round(((total - breached) / total) * 100) : 100;
    return { value: pct, unit: '%' };
  }

  // ── Open tickets ──
  if (key.includes('_open')) {
    const count = tickets.filter(t => t.status === 'open').length;
    return { value: count };
  }

  // ── In progress ──
  if (key.includes('_in_progress') || key === 'in_progress') {
    const count = tickets.filter(t => t.status === 'in_progress').length;
    return { value: count };
  }

  // ── Resolution / Resolved time / MTTR ──
  if (key.includes('_resolution') || key.includes('_resolved') || key.includes('_mttr')) {
    const resolved = tickets.filter(t => ['resolved', 'closed'].includes(t.status.toLowerCase()));
    if (!resolved.length) return { value: 'N/A' };
    const sum = resolved.reduce((a, t) => {
      const end = t.resolved_at || t.closed_at || t.updated_at;
      return a + (new Date(end).getTime() - new Date(t.created_at).getTime());
    }, 0);
    const hrs = sum / resolved.length / 3600000;
    return { value: hrs < 24 ? `${hrs.toFixed(1)}h` : `${(hrs / 24).toFixed(1)}d` };
  }

  // ── Response time ──
  if (key.includes('_response')) {
    const withResp = tickets.filter(t => t.first_response_at);
    if (!withResp.length) return { value: 'N/A' };
    const sum = withResp.reduce((a, t) => a + (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()), 0);
    const hrs = sum / withResp.length / 3600000;
    return { value: hrs < 1 ? `${Math.round(hrs * 60)}m` : `${hrs.toFixed(1)}h` };
  }

  // ── Breach count ──
  if (key.includes('_breach')) {
    return { value: tickets.filter(t => t.sla_breached).length };
  }

  // ── Satisfaction / CSAT ──
  if (key.includes('_csat') || key.includes('_satisfaction')) {
    const rated = tickets.filter(t => t.satisfaction_rating != null);
    if (!rated.length) return { value: '—' };
    const avg = rated.reduce((a, t) => a + (t.satisfaction_rating || 0), 0) / rated.length;
    return { value: avg.toFixed(1) };
  }

  // ── Total / Count / Handled → tickets.length ──
  if (key.includes('_total') || key.includes('_count') || key.includes('_handled')) {
    return { value: tickets.length };
  }

  // ── Percentage-based metrics (not directly computable from tickets) ──
  if (key.includes('_rate') || key.includes('_pct') || key.includes('_utilization') || key.includes('_confidence')) {
    return { value: '—', unit: '%' };
  }

  // ── Cost → dollar amount ──
  if (key.includes('_cost')) {
    return { value: '—', unit: '$' };
  }

  // ── Expiring / Queries → count ──
  if (key.includes('_expiring') || key.includes('_queries')) {
    return { value: '—' };
  }

  // ── Fallback: unknown key ──
  return { value: '—' };
}

// ── Accent colors cycled per pinned card ──
const ACCENT_COLORS = [
  'var(--accent)',
  'var(--success)',
  'var(--warning)',
  'var(--info)',
  'var(--danger)',
  '#7c3aed',
  '#ec4899',
];

// ── Draggable Pin Item (KPI-only) ──────────────────────────────────────────
interface PinItemProps {
  pin: PinnedMetric;
  tickets: Ticket[];
  onUnpin: () => void;
  onExpand: () => void;
  index: number;
  onDragStart: (e: React.DragEvent, idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onTouchStart: (e: React.TouchEvent, idx: number) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

const PinItem: React.FC<PinItemProps> = ({
  pin, tickets, onUnpin, onExpand,
  index, onDragStart, onDragOver, onDragEnd,
  onTouchStart, onTouchMove, onTouchEnd,
}) => {
  const { value, unit } = computePinValue(pin, tickets);
  const [expanded, setExpanded] = useState(false);

  const handleExpand = useCallback(() => {
    setExpanded(true);
    onExpand();
  }, [onExpand]);

  // ── Expanded fullscreen modal ──
  if (expanded) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
        onClick={() => setExpanded(false)}
      >
        <div
          className="rp-card card"
          style={{
            maxWidth: 800,
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            borderRadius: 16,
            padding: 32,
            background: 'var(--bg-elevated, #fff)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{pin.metric_label}</h2>
            <button
              onClick={() => setExpanded(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20 }}
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>
            {value}{unit && <span style={{ fontSize: 20, color: 'var(--text-muted)', marginLeft: 8 }}>{unit}</span>}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Metric key: {pin.metric_key} · Type: {pin.metric_type}
          </p>
          {pin.config && (
            <pre style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16, background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, overflow: 'auto' }}>
              {JSON.stringify(pin.config, null, 2)}
            </pre>
          )}
        </div>
      </div>
    );
  }

  // ── Card using ScorecardWidget ──
  const accentColor = ACCENT_COLORS[index % ACCENT_COLORS.length];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      onTouchStart={(e) => onTouchStart(e, index)}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'relative',
        touchAction: 'none',
      }}
    >
      <ScorecardWidget
        label={pin.metric_label}
        value={value}
        unit={unit || undefined}
        accentColor={accentColor}
      />

      {/* Drag handle overlay */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          color: 'var(--text-muted)',
          opacity: 0.5,
          cursor: 'grab',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        <GripVertical size={14} />
      </div>

      {/* Action buttons overlay */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'flex',
          gap: 4,
          zIndex: 2,
        }}
      >
        <button
          onClick={handleExpand}
          title="Expand full screen"
          style={actionBtnStyle}
        >
          <Maximize2 size={13} />
        </button>
        <button
          onClick={onUnpin}
          title="Remove from pinboard"
          style={{ ...actionBtnStyle, color: 'var(--danger, #EF4444)' }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};

// ── Expanded modal for chart pins ──
const ChartExpandedModal: React.FC<{
  pin: PinnedMetric;
  chartData: PinChartData | null;
  onClose: () => void;
}> = ({ pin, chartData, onClose }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    }}
    onClick={onClose}
  >
    <div
      className="rp-card card"
      style={{
        maxWidth: 900,
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        borderRadius: 16,
        padding: 32,
        background: 'var(--bg-elevated, #fff)',
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{pin.metric_label}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20 }}>✕</button>
      </div>

      {!chartData ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
          Chart data is not available for this context.
        </div>
      ) : chartData.type === 'donut' && chartData.donutData ? (
        <InteractiveDonutChart data={chartData.donutData} height={400} showExport={true} />
      ) : chartData.type === 'bar' && chartData.barData ? (
        <InteractiveBarChart data={chartData.barData} height={350} showExport={true} layout="horizontal" showGrid={true} />
      ) : chartData.type === 'gauge' ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <GaugeChart value={chartData.gaugeValue!} size={240} label={chartData.gaugeLabel} unit={chartData.gaugeUnit} showExport={true} />
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>No data available.</div>
      )}

      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 16 }}>
        Metric key: {pin.metric_key} · Type: {pin.metric_type}
      </p>
    </div>
  </div>
);

const actionBtnStyle: React.CSSProperties = {
  background: 'var(--bg-secondary, #f5f7fa)',
  border: '1px solid var(--border, #dde1e7)',
  borderRadius: 6,
  cursor: 'pointer',
  padding: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-muted)',
  transition: 'opacity 0.15s',
  opacity: 0.6,
};

// ── Pinboard Tab ────────────────────────────────────────────────────────
const PinboardTab: React.FC<PinboardTabProps> = ({
  pins,
  pinsLoading,
  tickets,
  onUnpin,
  onReorder,
  onRefresh,
}) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [touchIndex, setTouchIndex] = useState<number | null>(null);
  const [expandedChartPin, setExpandedChartPin] = useState<PinnedMetric | null>(null);
  const touchStartY = useRef(0);
  const touchCurrentY = useRef(0);

  // HTML5 Drag API
  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === idx) return;
    onReorder(dragIndex, idx);
    setDragIndex(idx);
  }, [dragIndex, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
  }, []);

  // Touch-based drag support
  const handleTouchStart = useCallback((e: React.TouchEvent, idx: number) => {
    setTouchIndex(idx);
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchCurrentY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(() => {
    setTouchIndex(null);
  }, []);

  // Split pins into KPI and chart groups
  const kpiPins = useMemo(() => pins.filter(p => p.metric_type !== 'chart'), [pins]);
  const chartPins = useMemo(() => pins.filter(p => p.metric_type === 'chart'), [pins]);

  if (pinsLoading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading pinboard...
      </div>
    );
  }

  if (pins.length === 0) {
    return (
      <div className="rp-fade" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>
          <Star size={48} style={{ color: 'var(--warning, #F59E0B)' }} />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          No Pinned Metrics Yet
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
          Navigate to any report tab and click the star icon <Star size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> on KPI cards or charts to pin your favorite metrics here.
        </p>
      </div>
    );
  }

  return (
    <div className="rp-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
            Pinboard
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {pins.length} pinned metric{pins.length !== 1 ? 's' : ''}
            {kpiPins.length > 0 ? ' · Drag KPI cards to reorder' : ''}
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          title="Refresh all pinboard data"
        >
          <RefreshCw size={13} /> Refresh All
        </button>
      </div>

      {/* ── KPI Pins Grid ── */}
      {kpiPins.length > 0 && (
        <div style={{ marginBottom: chartPins.length > 0 ? 28 : 0 }}>
          {chartPins.length > 0 && (
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Key Performance Indicators
            </h3>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 12,
              alignItems: 'stretch',
            }}
          >
            {kpiPins.map((pin) => {
              const originalIdx = pins.findIndex(p => p.id === pin.id);
              return (
                <PinItem
                  key={pin.id}
                  pin={pin}
                  tickets={tickets}
                  onUnpin={() => onUnpin(pin.id, pin.metric_key)}
                  onExpand={() => {}}
                  index={originalIdx >= 0 ? originalIdx : 0}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Chart Pins Grid ── */}
      {chartPins.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Pinned Charts
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
              gap: 16,
              alignItems: 'stretch',
            }}
          >
            {chartPins.map((pin) => {
              const chartData = computePinChart(pin, tickets);
              return (
                <div key={pin.id} style={{ position: 'relative' }}>
                  <CardSection title={pin.metric_label} icon={Star}>
                    {!chartData ? (
                      <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
                        Chart data not available for this context.
                      </div>
                    ) : chartData.type === 'donut' && chartData.donutData ? (
                      <InteractiveDonutChart data={chartData.donutData} height={200} showExport={false} />
                    ) : chartData.type === 'bar' && chartData.barData ? (
                      <InteractiveBarChart data={chartData.barData} height={200} showExport={false} layout="horizontal" showGrid={false} />
                    ) : chartData.type === 'gauge' ? (
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <GaugeChart value={chartData.gaugeValue!} size={160} label={chartData.gaugeLabel} unit={chartData.gaugeUnit} showExport={false} />
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>No data available</div>
                    )}
                  </CardSection>

                  {/* Action buttons overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      display: 'flex',
                      gap: 4,
                      zIndex: 2,
                    }}
                  >
                    <button
                      onClick={() => setExpandedChartPin(pin)}
                      title="Expand full screen"
                      style={actionBtnStyle}
                    >
                      <Maximize2 size={13} />
                    </button>
                    <button
                      onClick={() => onUnpin(pin.id, pin.metric_key)}
                      title="Remove from pinboard"
                      style={{ ...actionBtnStyle, color: 'var(--danger, #EF4444)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Expanded chart modal ── */}
      {expandedChartPin && (
        <ChartExpandedModal
          pin={expandedChartPin}
          chartData={computePinChart(expandedChartPin, tickets)}
          onClose={() => setExpandedChartPin(null)}
        />
      )}
    </div>
  );
};

export default PinboardTab;
