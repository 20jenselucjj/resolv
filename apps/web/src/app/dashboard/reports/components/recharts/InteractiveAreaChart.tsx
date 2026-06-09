'use client';

import React, { useRef } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { exportToPng, exportToSvg, cssVar } from './export-utils';

// ── Types ──────────────────────────────────────────────────────

export interface AreaSeries {
  dataKey: string;
  name: string;
  color: string;
  /** Fill opacity (default 0.15) */
  fillOpacity?: number;
  /** Stack with other series */
  stackId?: string;
}

export interface AreaChartDatum {
  name: string;
  [key: string]: any;
}

export interface InteractiveAreaChartProps {
  data: AreaChartDatum[];
  /** Series to render */
  series: AreaSeries[];
  /** Click handler on data point */
  onPointClick?: (datum: AreaChartDatum, seriesKey: string) => void;
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
  /** Make gradient fill */
  gradient?: boolean;
  /** Y-axis label */
  yLabel?: string;
  /** X-axis label */
  xLabel?: string;
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
          <span style={{ width: 8, height: 8, borderRadius: 2, background: entry.color }} />
          <span style={{ color: cssVar('--text-secondary', '#4B5563') }}>
            {entry.name}: <strong>{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</strong> {unit || ''}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Component ──────────────────────────────────────────────────

const InteractiveAreaChart: React.FC<InteractiveAreaChartProps> = ({
  data,
  series,
  onPointClick,
  exportFilename = 'area-chart',
  showExport = false,
  height = 300,
  showGrid = true,
  xKey = 'name',
  unit,
  gradient = true,
  yLabel,
  xLabel,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

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
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
          >
            <defs>
              {gradient &&
                series.map((s) => (
                  <linearGradient key={s.dataKey} id={`gradient-${s.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
            </defs>
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
              <Area
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                fill={gradient ? `url(#gradient-${s.dataKey})` : s.color}
                fillOpacity={gradient ? 1 : (s.fillOpacity ?? 0.15)}
                stackId={s.stackId}
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
              formatter={(value: string) => (
                <span style={{ color: cssVar('--text-secondary', '#4B5563'), fontSize: 12 }}>{value}</span>
              )}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default InteractiveAreaChart;
