'use client';

import React, { memo, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { exportToPng, exportToSvg, cssVar } from './export-utils';
import ChartSkeleton from './ChartSkeleton';

// ── Types ──────────────────────────────────────────────────────

export interface GaugeChartProps {
  /** Current value (0–100) */
  value: number;
  /** Target value */
  target?: number;
  /** Label displayed below the value */
  label?: string;
  /** Unit symbol (e.g. "%", "hrs") */
  unit?: string;
  /** Color when value is in good zone */
  goodColor?: string;
  /** Color when value is in warning zone */
  warnColor?: string;
  /** Color when value is in danger zone */
  dangerColor?: string;
  /** Thresholds for zones */
  thresholds?: { danger: number; warning: number };
  /** Whether to show target marker */
  showTarget?: boolean;
  /** Fill color of empty arc */
  emptyColor?: string;
  /** Export filename (without extension) */
  exportFilename?: string;
  /** Show export buttons */
  showExport?: boolean;
  /** Gauge size */
  size?: number;
  /** Click handler */
  onClick?: () => void;
  /** Loading state */
  loading?: boolean;
}

// ── Determine color based on value ─────────────────────────────

function getZoneColor(
  value: number,
  goodColor: string,
  warnColor: string,
  dangerColor: string,
  thresholds: { danger: number; warning: number }
): string {
  if (value < thresholds.danger) return dangerColor;
  if (value < thresholds.warning) return warnColor;
  return goodColor;
}

// ── Component ──────────────────────────────────────────────────

const GaugeChart: React.FC<GaugeChartProps> = ({
  value,
  target,
  label,
  unit,
  goodColor,
  warnColor,
  dangerColor,
  thresholds = { danger: 60, warning: 80 },
  showTarget = true,
  emptyColor,
  exportFilename = 'gauge',
  showExport = false,
  size = 240,
  onClick,
  loading = false,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  if (loading) {
    return <ChartSkeleton height={size * 0.8} showLegend={false} showGrid={false} />;
  }

  const safeValue = Math.min(Math.max(value, 0), 100);
  const safeTarget = target !== undefined ? Math.min(Math.max(target, 0), 100) : undefined;

  const gColor = goodColor || cssVar('--success', '#10B981');
  const wColor = warnColor || cssVar('--warning', '#F59E0B');
  const dColor = dangerColor || cssVar('--danger', '#EF4444');
  const eColor = emptyColor || cssVar('--bg-tertiary', '#eef0f3');

  const activeColor = getZoneColor(safeValue, gColor, wColor, dColor, thresholds);

  // Gauge is a semi-circle (180°). We use a PieChart with startAngle=180, endAngle=0.
  // Current value arc + remaining arc.
  const gaugeData = [
    { name: 'value', value: safeValue },
    { name: 'empty', value: 100 - safeValue },
  ];

  const fillColors = [activeColor, eColor];

  const height = size * 0.6;

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

      <div
        ref={chartRef}
        role="img"
        aria-label="Gauge chart"
        style={{ width: size, margin: '0 auto', cursor: onClick ? 'pointer' : 'default' }}
        onClick={onClick}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      >
        {/* ── Arc area with min/max endpoint labels ── */}
        <div style={{ position: 'relative' }}>
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={gaugeData}
                cx="50%"
                cy="100%"
                startAngle={180}
                endAngle={0}
                innerRadius="60%"
                outerRadius="100%"
                dataKey="value"
                paddingAngle={2}
                animationDuration={1000}
                animationEasing="ease-out"
                isAnimationActive={true}
              >
                {gaugeData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={fillColors[index]} />
                ))}
              </Pie>

              {/* Target marker arc */}
              {showTarget && safeTarget !== undefined && (
                <Pie
                  data={[{ name: 'target', value: safeTarget }]}
                  cx="50%"
                  cy="100%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius="60%"
                  outerRadius="105%"
                  dataKey="value"
                  paddingAngle={0}
                  isAnimationActive={false}
                >
                  <Cell fill="transparent" stroke={cssVar('--text', '#1F2937')} strokeWidth={2} strokeDasharray="4 2" />
                </Pie>
              )}
            </PieChart>
          </ResponsiveContainer>

          {/* Min label at arc left endpoint */}
          <span
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              fontSize: 10,
              fontWeight: 500,
              color: cssVar('--text-muted', '#9CA3AF'),
              pointerEvents: 'none',
              lineHeight: 1,
            }}
          >
            0{unit || ''}
          </span>

          {/* Max label at arc right endpoint */}
          <span
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              fontSize: 10,
              fontWeight: 500,
              color: cssVar('--text-muted', '#9CA3AF'),
              pointerEvents: 'none',
              lineHeight: 1,
            }}
          >
            100{unit || ''}
          </span>
        </div>

        {/* ── Value / label / target BELOW the arc (no overlap) ── */}
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: activeColor, lineHeight: 1 }}>
            {safeValue}
            {unit && (
              <span style={{ fontSize: 16, fontWeight: 600, color: cssVar('--text-muted', '#9CA3AF') }}>
                {unit}
              </span>
            )}
          </div>
          {label && (
            <div style={{ fontSize: 11, color: cssVar('--text-muted', '#9CA3AF'), marginTop: 2 }}>{label}</div>
          )}
          {showTarget && safeTarget !== undefined && (
            <div
              style={{
                fontSize: 10,
                color: cssVar('--text-muted', '#9CA3AF'),
                marginTop: 2,
              }}
            >
              Target: {safeTarget}{unit || ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(GaugeChart);
