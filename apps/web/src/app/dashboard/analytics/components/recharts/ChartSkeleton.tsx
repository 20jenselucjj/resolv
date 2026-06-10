'use client';

import React from 'react';
import { cssVar } from './export-utils';

interface ChartSkeletonProps {
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  ariaLabel?: string;
}

export default function ChartSkeleton({
  height = 240,
  showLegend = true,
  showGrid = true,
  ariaLabel = 'Loading chart data',
}: ChartSkeletonProps) {
  const bg = cssVar('--bg-elevated', '#fff');
  const subtle = cssVar('--bg-secondary', '#f8f9fb');
  const border = cssVar('--border-subtle', '#eef0f3');
  const text = cssVar('--text-muted', '#9CA3AF');

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
      style={{
        height,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 8px',
      }}
    >
      {/* Grid area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 12,
          padding: '0 40px 24px 48px',
          position: 'relative',
        }}
      >
        {/* Y-axis ticks */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 24,
            width: 40,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            paddingRight: 8,
          }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                width: 16 + Math.random() * 12,
                height: 6,
                borderRadius: 3,
                background: border,
              }}
            />
          ))}
        </div>

        {/* Bars */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse"
            style={{
              flex: 1,
              height: `${20 + Math.random() * 60}%`,
              background: border,
              borderRadius: 4,
              opacity: 0.6 + (i % 3) * 0.15,
              transition: 'opacity 0.3s',
            }}
          />
        ))}

        {/* X-axis ticks */}
        <div
          style={{
            position: 'absolute',
            left: 48,
            right: 8,
            bottom: 0,
            height: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                width: 20 + Math.random() * 16,
                height: 6,
                borderRadius: 3,
                background: border,
              }}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            height: 20,
            alignItems: 'center',
          }}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                className="animate-pulse"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: border,
                }}
              />
              <div
                className="animate-pulse"
                style={{
                  width: 40 + Math.random() * 30,
                  height: 6,
                  borderRadius: 3,
                  background: border,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
