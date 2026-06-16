'use client';

import React, { memo, useRef, useCallback, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { exportToPng, exportToSvg, cssVar } from './export-utils';

// ── Types ──────────────────────────────────────────────────────

export interface FunnelStage {
  name: string;
  value: number;
  color: string;
}

export interface FunnelChartProps {
  data: FunnelStage[];
  /** Tooltip value suffix */
  unit?: string;
  /** Show conversion rates between stages */
  showConversion?: boolean;
  /** Click handler for drill-down */
  onStageClick?: (stage: FunnelStage, index: number) => void;
  /** Export filename (without extension) */
  exportFilename?: string;
  /** Show export buttons */
  showExport?: boolean;
  /** Chart height */
  height?: number;
}

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
      <div style={{ fontWeight: 600, color: cssVar('--text', '#1F2937'), marginBottom: 4 }}>{p.payload.name}</div>
      <span style={{ color: cssVar('--text-secondary', '#4B5563') }}>
        {p.value} {unit || ''}
      </span>
    </div>
  );
};

// ── Component ──────────────────────────────────────────────────

const FunnelChart: React.FC<FunnelChartProps> = ({
  data,
  unit,
  showConversion = true,
  onStageClick,
  exportFilename = 'funnel',
  showExport = false,
  height = 320,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | undefined>(undefined);

  const handleClick = useCallback(
    (_: any, index: number) => {
      onStageClick?.(data[index], index);
    },
    [data, onStageClick]
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
        No funnel data available
      </div>
    );
  }

  // Build funnel with percentage widths
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const funnelData = data.map((d) => ({
    ...d,
    pctWidth: (d.value / maxVal) * 100,
    conversion: 0,
  }));

  // Add conversion rates
  if (showConversion) {
    for (let i = 1; i < funnelData.length; i++) {
      funnelData[i].conversion =
        funnelData[i - 1].value > 0
          ? Math.round((funnelData[i].value / funnelData[i - 1].value) * 100)
          : 0;
    }
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
          <BarChart
            data={funnelData}
            layout="vertical"
            margin={{ top: 8, right: 60, left: 100, bottom: 8 }}
            barCategoryGap={12}
          >
            <XAxis type="number" hide domain={[0, maxVal]} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: cssVar('--text', '#1F2937'), fontSize: 12, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip content={<CustomTooltip unit={unit} />} />
            <Bar
              dataKey="value"
              radius={[0, 6, 6, 0]}
              cursor={onStageClick ? 'pointer' : 'default'}
              onMouseEnter={(_, index) => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(undefined)}
              onClick={handleClick}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {funnelData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  opacity={hoveredIndex === undefined || hoveredIndex === index ? 1 : 0.5}
                />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(val: any) => `${val ?? ''} ${unit || ''}`}
                style={{ fill: cssVar('--text-muted', '#9CA3AF'), fontSize: 12, fontWeight: 500 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Conversion rate labels */}
        {showConversion && funnelData.length > 1 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-around',
              padding: '4px 0 0 90px',
              fontSize: 11,
              color: cssVar('--text-muted', '#9CA3AF'),
            }}
          >
            {funnelData.slice(1).map((stage, i) => (
              <div
                key={stage.name}
                style={{ display: 'flex', alignItems: 'center', gap: 3 }}
              >
                <span style={{ fontWeight: 600, color: cssVar('--success', '#10B981') }}>
                  {stage.conversion}%
                </span>
                <span>conversion</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(FunnelChart);
