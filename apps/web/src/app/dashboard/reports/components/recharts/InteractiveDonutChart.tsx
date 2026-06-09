'use client';

import React, { useRef, useCallback } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Sector,
} from 'recharts';
import { exportToPng, exportToSvg, cssVar } from './export-utils';

// ── Types ──────────────────────────────────────────────────────

export interface DonutSegment {
  name: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  data: DonutSegment[];
  /** Inner radius ratio (0-1) — controls donut hole size. Default 0.6 */
  innerRadius?: number;
  /** Outer radius ratio (0-1). Default 0.85 */
  outerRadius?: number;
  /** Total displayed in center */
  total?: number;
  totalLabel?: string;
  /** Tooltip value suffix */
  unit?: string;
  /** Click handler for drill-down */
  onSegmentClick?: (segment: DonutSegment, index: number) => void;
  /** Export filename (without extension) */
  exportFilename?: string;
  /** Show export buttons */
  showExport?: boolean;
  /** Chart height */
  height?: number;
}

// ── Custom Active Shape ────────────────────────────────────────

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.3}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <text x={cx} y={cy - 8} textAnchor="middle" fill={cssVar('--text', '#1F2937')} fontSize={13} fontWeight={700}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill={cssVar('--text-muted', '#9CA3AF')} fontSize={11}>
        {value} ({(percent * 100).toFixed(1)}%)
      </text>
    </g>
  );
};

// ── Custom Tooltip ─────────────────────────────────────────────

const CustomTooltip = ({ active, payload, unit }: any) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color }} />
        <span style={{ fontWeight: 600, color: cssVar('--text', '#1F2937') }}>{p.name}</span>
      </div>
      <span style={{ color: cssVar('--text-secondary', '#4B5563') }}>
        {p.value} {p.unit || ''}
      </span>
    </div>
  );
};

// ── Component ──────────────────────────────────────────────────

const InteractiveDonutChart: React.FC<DonutChartProps> = ({
  data,
  innerRadius = 0.6,
  outerRadius = 0.85,
  total,
  totalLabel = 'total',
  unit,
  onSegmentClick,
  exportFilename = 'donut-chart',
  showExport = false,
  height = 300,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = React.useState<number | undefined>(undefined);

  const handleClick = useCallback(
    (_: any, index: number) => {
      onSegmentClick?.(data[index], index);
    },
    [data, onSegmentClick]
  );

  const computedTotal = total ?? data.reduce((s, d) => s + d.value, 0);

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
          <PieChart>
            {total !== undefined && activeIndex === undefined && (
              <g>
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={cssVar('--text', '#1F2937')}
                  fontSize={24}
                  fontWeight={800}
                >
                  {computedTotal}
                </text>
                <text
                  x="50%"
                  y="50%"
                  dy={20}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={cssVar('--text-muted', '#9CA3AF')}
                  fontSize={12}
                >
                  {totalLabel}
                </text>
              </g>
            )}
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={`${innerRadius * 100}%`}
              outerRadius={`${outerRadius * 100}%`}
              dataKey="value"
              nameKey="name"
              paddingAngle={2}
              {...({ activeIndex } as any)}
              activeShape={renderActiveShape}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
              onClick={handleClick}
              cursor={onSegmentClick ? 'pointer' : 'default'}
              animationBegin={0}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip unit={unit} />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              iconSize={8}
              formatter={(value: string) => (
                <span style={{ color: cssVar('--text-secondary', '#4B5563'), fontSize: 12 }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default InteractiveDonutChart;
