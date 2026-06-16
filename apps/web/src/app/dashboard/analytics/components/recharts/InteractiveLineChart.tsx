'use client';

import React, { memo, useRef, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Dot,
} from 'recharts';
import { exportToPng, exportToSvg, cssVar } from './export-utils';
import ChartSkeleton from './ChartSkeleton';

// ── Types ──────────────────────────────────────────────────────

export interface LineSeries {
  dataKey: string;
  name: string;
  color: string;
  /** Whether to show dots */
  dot?: boolean;
  /** Stroke width */
  strokeWidth?: number;
  /** Dash array for dashed lines */
  strokeDasharray?: string;
}

export interface LineChartDatum {
  name: string;
  [key: string]: any;
}

export interface InteractiveLineChartProps {
  data: LineChartDatum[];
  /** Series to render */
  series: LineSeries[];
  /** Click handler on data point */
  onPointClick?: (datum: LineChartDatum, seriesKey: string) => void;
  /** Export filename (without extension) */
  exportFilename?: string;
  /** Show export buttons */
  showExport?: boolean;
  /** Chart height */
  height?: number;
  /** Show grid lines */
  showGrid?: boolean;
  /** X-axis data key */
  xKey?: string;
  /** Tooltip value suffix */
  unit?: string;
  /** Fill area under lines */
  fillArea?: boolean;
  /** Y-axis label */
  yLabel?: string;
  /** X-axis label */
  xLabel?: string;
  /** Enable zoom (visual hint only — full zoom requires custom impl) */
  enableZoom?: boolean;
  /** Loading state */
  loading?: boolean;
}

// ── Custom Tooltip ─────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: cssVar('--bg-elevated', '#fff'),
        border: `1px solid ${cssVar('--border', '#dde1e7')}`,
        borderRadius: 8,
        padding: '10px 14px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, color: cssVar('--text', '#1F2937'), marginBottom: 6 }}>{label}</div>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
          <span style={{ color: cssVar('--text-secondary', '#4B5563') }}>
            {entry.name}: <strong>{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</strong> {unit || ''}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Custom Active Dot ──────────────────────────────────────────

const CustomizedDot = (props: any) => {
  const { cx, cy, stroke, payload, seriesKey, onClick } = props;
  return (
    <Dot
      cx={cx}
      cy={cy}
      r={4}
      fill={stroke}
      stroke={cssVar('--bg', '#fff')}
      strokeWidth={2}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={() => onClick?.(payload, seriesKey)}
    />
  );
};

// ── Component ──────────────────────────────────────────────────

const InteractiveLineChart: React.FC<InteractiveLineChartProps> = ({
  data,
  series,
  onPointClick,
  exportFilename = 'line-chart',
  showExport = false,
  height = 300,
  showGrid = true,
  xKey = 'name',
  unit,
  yLabel,
  xLabel,
  enableZoom = false,
  loading = false,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [hiddenSeries, setHiddenSeries] = React.useState<Set<string>>(new Set());

  const handleLegendClick = useCallback((entry: any) => {
    const key = entry.dataKey;
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (loading) {
    return <ChartSkeleton height={height} showLegend showGrid={showGrid} />;
  }

  if (!data.length) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: cssVar('--text-muted', '#9CA3AF'),
          fontSize: 14,
        }}
      >
        No data available
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {enableZoom && (
          <span style={{ fontSize: 11, color: cssVar('--text-muted', '#9CA3AF') }}>
            Scroll to zoom · Drag to pan
          </span>
        )}
        {showExport && (
          <>
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
          </>
        )}
      </div>
      <div ref={chartRef} role="img" aria-label="Line chart">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
          >
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={cssVar('--border-subtle', '#eef0f3')}
                vertical={false}
              />
            )}
            <XAxis
              dataKey={xKey}
              tick={{ fill: cssVar('--text-muted', '#9CA3AF'), fontSize: 11 }}
              axisLine={{ stroke: cssVar('--border', '#dde1e7') }}
              tickLine={false}
              tickMargin={8}
              interval="preserveStartEnd"
              angle={data.length > 12 ? -30 : 0}
              textAnchor={data.length > 12 ? 'end' : 'middle'}
              height={data.length > 12 ? 50 : 30}
              label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -6, style: { fill: cssVar('--text-muted', '#9CA3AF'), fontSize: 11 } } : undefined}
            />
            <YAxis
              tick={{ fill: cssVar('--text-muted', '#9CA3AF'), fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickMargin={4}
              label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', style: { fill: cssVar('--text-muted', '#9CA3AF'), fontSize: 11 } } : undefined}
            />
            <Tooltip content={<CustomTooltip unit={unit} />} />
            {series.map((s) => (
              <Line
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                name={s.name}
                stroke={s.color}
                strokeWidth={s.strokeWidth ?? 2}
                strokeDasharray={s.strokeDasharray}
                hide={hiddenSeries.has(s.dataKey)}
                dot={s.dot !== false ? <CustomizedDot seriesKey={s.dataKey} onClick={onPointClick} /> : false}
                activeDot={{ r: 6, fill: s.color, stroke: cssVar('--bg', '#fff'), strokeWidth: 2, cursor: onPointClick ? 'pointer' : 'default' }}
                animationDuration={800}
                animationEasing="ease-out"
              />
            ))}
            <Legend
              verticalAlign="bottom"
              height={30}
              iconType="line"
              iconSize={14}
              onClick={handleLegendClick}
              formatter={(value: string) => (
                <span style={{ color: cssVar('--text-secondary', '#4B5563'), fontSize: 12 }}>{value}</span>
              )}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default memo(InteractiveLineChart);
