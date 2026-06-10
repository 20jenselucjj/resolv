'use client';

import React, { useRef, useState, useMemo, useCallback } from 'react';
import { exportToPng, exportToSvg, cssVar } from './export-utils';

// ── Types ──────────────────────────────────────────────────────

export interface HeatmapCell {
  /** Day label (e.g. "Mon", "Tue") */
  day: string;
  /** Hour label (e.g. "00", "01" … "23") */
  hour: string;
  /** Numeric value determining color intensity */
  value: number;
  /** Optional metadata for tooltip drill-down */
  meta?: Record<string, any>;
}

export interface HeatmapChartProps {
  data: HeatmapCell[];
  /** Array of day labels in order */
  days?: string[];
  /** Array of hour labels in order */
  hours?: string[];
  /** Color palette (low → high) */
  colors?: [string, string, string];
  /** Click handler for drill-down */
  onCellClick?: (cell: HeatmapCell) => void;
  /** Export filename (without extension) */
  exportFilename?: string;
  /** Show export buttons */
  showExport?: boolean;
  /** Chart height per row */
  rowHeight?: number;
  /** Cell border radius */
  cellRadius?: number;
  /** Gap between cells */
  cellGap?: number;
  /** Show value in cells */
  showValues?: boolean;
}

// ── Defaults ───────────────────────────────────────────────────

const DEFAULT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEFAULT_HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const DEFAULT_COLORS: [string, string, string] = ['#eef0f3', '#3B82F6', '#1E40AF'];

// ── Component ──────────────────────────────────────────────────

const HeatmapChart: React.FC<HeatmapChartProps> = ({
  data,
  days = DEFAULT_DAYS,
  hours = DEFAULT_HOURS,
  colors = DEFAULT_COLORS,
  onCellClick,
  exportFilename = 'heatmap',
  showExport = false,
  rowHeight = 24,
  cellRadius = 3,
  cellGap = 3,
  showValues = false,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; cell: HeatmapCell } | null>(null);

  // Build lookup map for O(1) access
  const valueMap = useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    data.forEach((cell) => {
      map.set(`${cell.day}|${cell.hour}`, cell);
    });
    return map;
  }, [data]);

  // Value range for color interpolation
  const { minVal, maxVal } = useMemo(() => {
    if (!data.length) return { minVal: 0, maxVal: 1 };
    const values = data.map((d) => d.value);
    return {
      minVal: Math.min(...values),
      maxVal: Math.max(...values, 1),
    };
  }, [data]);

  // Interpolate between two colors
  const interpolateColor = useCallback(
    (val: number): string => {
      const range = maxVal - minVal || 1;
      const t = Math.min(Math.max((val - minVal) / range, 0), 1);

      // Simple 3-stop gradient
      const stops = [
        { pos: 0, color: colors[0] },
        { pos: 0.5, color: colors[1] },
        { pos: 1, color: colors[2] },
      ];

      let lower = stops[0];
      let upper = stops[stops.length - 1];
      for (let i = 0; i < stops.length - 1; i++) {
        if (t >= stops[i].pos && t <= stops[i + 1].pos) {
          lower = stops[i];
          upper = stops[i + 1];
          break;
        }
      }

      const rangeT = (t - lower.pos) / (upper.pos - lower.pos || 1);

      // Parse hex to RGB
      const parseHex = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
          ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
          : { r: 0, g: 0, b: 0 };
      };

      const l = parseHex(lower.color);
      const u = parseHex(upper.color);

      const r = Math.round(l.r + (u.r - l.r) * rangeT);
      const g = Math.round(l.g + (u.g - l.g) * rangeT);
      const b = Math.round(l.b + (u.b - l.b) * rangeT);

      return `rgb(${r}, ${g}, ${b})`;
    },
    [minVal, maxVal, colors]
  );

  const handleCellClick = useCallback(
    (cell: HeatmapCell | undefined) => {
      if (cell && onCellClick) onCellClick(cell);
    },
    [onCellClick]
  );

  // ── Tooltip ──────────────────────────────────────────────────

  const TooltipOverlay = tooltip ? (
    <div
      style={{
        position: 'fixed',
        left: tooltip.x + 12,
        top: tooltip.y - 10,
        background: cssVar('--bg-elevated', '#fff'),
        border: `1px solid ${cssVar('--border', '#dde1e7')}`,
        borderRadius: 8,
        padding: '8px 12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        fontSize: 12,
        zIndex: 1000,
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontWeight: 600, color: cssVar('--text', '#1F2937') }}>
        {tooltip.cell.day} {tooltip.cell.hour}:00
      </div>
      <div style={{ color: cssVar('--text-secondary', '#4B5563') }}>
        Value: <strong>{tooltip.cell.value}</strong>
      </div>
      {tooltip.cell.meta &&
        Object.entries(tooltip.cell.meta).map(([k, v]) => (
          <div key={k} style={{ color: cssVar('--text-muted', '#9CA3AF') }}>
            {k}: {String(v)}
          </div>
        ))}
    </div>
  ) : null;

  // ── Empty state ──────────────────────────────────────────────

  if (!data.length) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          color: cssVar('--text-muted', '#9CA3AF'),
          fontSize: 14,
        }}
      >
        No heatmap data available
      </div>
    );
  }

  const cellW = rowHeight;

  return (
    <div>
      {showExport && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            onClick={() => exportToPng(chartRef.current, `${exportFilename}.png`)}
            className="btn btn-sm"
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            PNG
          </button>
          <button
            onClick={() => exportToSvg(chartRef.current, `${exportFilename}.svg`)}
            className="btn btn-sm"
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            SVG
          </button>
        </div>
      )}

      <div ref={chartRef} role="img" aria-label="Heatmap chart" style={{ position: 'relative', display: 'inline-block' }}>
        <div style={{ display: 'flex', gap: cellGap }}>
          {/* Hour headers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: cellGap, marginRight: 4 }}>
            {days.map((day) => (
              <div
                key={day}
                style={{
                  height: rowHeight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: 6,
                  fontSize: 10,
                  fontWeight: 600,
                  color: cssVar('--text-muted', '#9CA3AF'),
                  textTransform: 'uppercase',
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grid columns */}
          {hours.map((hour) => (
            <div key={hour} style={{ display: 'flex', flexDirection: 'column', gap: cellGap }}>
              {days.map((day) => {
                const cell = valueMap.get(`${day}|${hour}`);
                const fillColor = cell ? interpolateColor(cell.value) : cssVar('--bg-tertiary', '#eef0f3');
                const hasValue = cell !== undefined;

                return (
                  <div
                    key={`${day}-${hour}`}
                    role="gridcell"
                    tabIndex={hasValue && onCellClick ? 0 : undefined}
                    aria-label={hasValue && cell ? `${day} ${hour}:00, value ${cell.value}` : `${day} ${hour}:00, no data`}
                    style={{
                      width: cellW,
                      height: rowHeight,
                      borderRadius: cellRadius,
                      background: fillColor,
                      cursor: onCellClick && hasValue ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      fontWeight: 600,
                      color: hasValue && cell!.value > (maxVal - minVal) / 2 + minVal
                        ? '#fff'
                        : cssVar('--text-muted', '#9CA3AF'),
                      transition: 'opacity 0.15s, transform 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (hasValue) {
                        e.currentTarget.style.opacity = '0.8';
                        e.currentTarget.style.transform = 'scale(1.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.transform = 'scale(1)';
                      setTooltip(null);
                    }}
                    onMouseMove={(e) => {
                      if (hasValue && cell) {
                        setTooltip({ x: e.clientX, y: e.clientY, cell });
                      }
                    }}
                    onClick={() => handleCellClick(cell)}
                    onKeyDown={(e) => {
                      if (hasValue && onCellClick && cell && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        handleCellClick(cell);
                      }
                    }}
                    onFocus={(e) => {
                      if (hasValue && cell) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({ x: rect.left, y: rect.top, cell });
                      }
                    }}
                    onBlur={() => setTooltip(null)}
                  >
                    {showValues && hasValue && cell!.value}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Hour labels at bottom */}
        <div
          style={{
            display: 'flex',
            gap: cellGap,
            marginTop: 4,
            marginLeft: rowHeight + 4 + cellGap,
          }}
        >
          {hours.map((hour) => (
            <div
              key={hour}
              style={{
                width: rowHeight,
                fontSize: 9,
                color: cssVar('--text-muted', '#9CA3AF'),
                textAlign: 'center',
              }}
            >
              {hour}
            </div>
          ))}
        </div>

        {/* Color legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 8,
            fontSize: 10,
            color: cssVar('--text-muted', '#9CA3AF'),
          }}
        >
          <span>Low</span>
          <div
            style={{
              width: 80,
              height: 10,
              borderRadius: 4,
              background: `linear-gradient(to right, ${colors[0]}, ${colors[1]}, ${colors[2]})`,
            }}
          />
          <span>High</span>
        </div>

        {TooltipOverlay}
      </div>
    </div>
  );
};

export default HeatmapChart;
