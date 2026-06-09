'use client';

import React, { useRef, useCallback, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { exportToPng, exportToSvg, cssVar } from './export-utils';

// ── Types ──────────────────────────────────────────────────────

export interface BarChartDatum {
  name: string;
  value: number;
  /** Optional per-bar color */
  color?: string;
}

export interface BarChartProps {
  data: BarChartDatum[];
  /** Bar color (default: var(--accent)) */
  color?: string;
  /** Per-bar coloring */
  colorMap?: Record<string, string>;
  /** Bar border radius */
  radius?: number;
  /** Orientation */
  layout?: 'vertical' | 'horizontal';
  /** Tooltip value suffix */
  unit?: string;
  /** Click handler for drill-down */
  onBarClick?: (datum: BarChartDatum, index: number) => void;
  /** Export filename (without extension) */
  exportFilename?: string;
  /** Show export buttons */
  showExport?: boolean;
  /** Chart height */
  height?: number;
  /** Show grid lines */
  showGrid?: boolean;
  /** Stack multiple data series */
  series?: { dataKey: string; name: string; color: string }[];
  /** Width (defaults to 100%) */
  width?: number | `${number}%`;
  /** X-axis label */
  xLabel?: string;
  /** Y-axis label */
  yLabel?: string;
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
      <div style={{ fontWeight: 600, color: cssVar('--text', '#1F2937'), marginBottom: 4 }}>{label}</div>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: entry.color }} />
          <span style={{ color: cssVar('--text-secondary', '#4B5563') }}>
            {entry.name}: <strong>{entry.value}</strong> {unit || ''}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Component ──────────────────────────────────────────────────

const InteractiveBarChart: React.FC<BarChartProps> = ({
  data,
  color,
  colorMap,
  radius = 4,
  layout = 'vertical',
  unit,
  onBarClick,
  exportFilename = 'bar-chart',
  showExport = false,
  height = 300,
  showGrid = true,
  series,
  width = '100%',
  xLabel,
  yLabel,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | undefined>(undefined);
  const defaultColor = color || cssVar('--accent', '#1E40AF');

  const handleClick = useCallback(
    (data: any, index: number) => {
      onBarClick?.(data as BarChartDatum, index);
    },
    [onBarClick]
  );

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

  const isHorizontal = layout === 'horizontal';

  // Dynamic YAxis width for horizontal layout — based on longest label
  const longestLabel = data.reduce((max, d) => Math.max(max, d.name.length), 0);
  const yAxisWidth = isHorizontal ? Math.min(Math.max(longestLabel * 7.5 + 16, 60), 180) : undefined;

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
      <div ref={chartRef}>
        <ResponsiveContainer width={width} height={height}>
          <BarChart
            data={data}
            layout={isHorizontal ? 'vertical' : 'horizontal'}
            margin={{ top: 8, right: 8, left: 8, bottom: 40 }}
          >
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={cssVar('--border-subtle', '#eef0f3')}
                vertical={false}
              />
            )}
            {isHorizontal ? (
              <>
                <XAxis
                  type="number"
                  tick={{ fill: cssVar('--text-muted', '#9CA3AF'), fontSize: 11 }}
                  axisLine={{ stroke: cssVar('--border', '#dde1e7') }}
                  tickLine={false}
                  tickMargin={8}
                  label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -6, style: { fill: cssVar('--text-muted', '#9CA3AF'), fontSize: 11 } } : undefined}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: cssVar('--text-muted', '#9CA3AF'), fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={yAxisWidth}
                  tickMargin={4}
                  label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', style: { fill: cssVar('--text-muted', '#9CA3AF'), fontSize: 11 } } : undefined}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="name"
                  tick={{ fill: cssVar('--text-muted', '#9CA3AF'), fontSize: 11 }}
                  axisLine={{ stroke: cssVar('--border', '#dde1e7') }}
                  tickLine={false}
                  tickMargin={8}
                  interval="preserveStartEnd"
                  angle={data.length > 8 ? -35 : 0}
                  textAnchor={data.length > 8 ? 'end' : 'middle'}
                  height={data.length > 8 ? 60 : 30}
                  label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -6, style: { fill: cssVar('--text-muted', '#9CA3AF'), fontSize: 11 } } : undefined}
                />
                <YAxis
                  tick={{ fill: cssVar('--text-muted', '#9CA3AF'), fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={4}
                  label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', style: { fill: cssVar('--text-muted', '#9CA3AF'), fontSize: 11 } } : undefined}
                />
              </>
            )}
            <Tooltip content={<CustomTooltip unit={unit} />} />
            {series ? (
              series.map((s) => (
                <Bar
                  key={s.dataKey}
                  dataKey={s.dataKey}
                  name={s.name}
                  fill={s.color}
                  radius={radius}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              ))
            ) : (
              <Bar
                dataKey="value"
                radius={radius}
                cursor={onBarClick ? 'pointer' : 'default'}
                onMouseEnter={(_, index) => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(undefined)}
                onClick={handleClick}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      colorMap?.[entry.name] ||
                      entry.color ||
                      defaultColor
                    }
                    opacity={hoveredIndex === undefined || hoveredIndex === index ? 1 : 0.7}
                  />
                ))}
              </Bar>
            )}
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="rect"
              iconSize={10}
              formatter={(value: string) => (
                <span style={{ color: cssVar('--text-secondary', '#4B5563'), fontSize: 12 }}>{value}</span>
              )}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default InteractiveBarChart;
