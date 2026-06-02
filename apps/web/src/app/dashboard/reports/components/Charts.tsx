'use client';

import React from 'react';

export const MiniBar = ({ value, max, color }: { value: number; max: number; color: string }) => (
  <div style={{ height: 4, flex: 1, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden', minWidth: 40 }}>
    <div style={{ height: '100%', width: `${max ? (value/max)*100 : 0}%`, background: color, borderRadius: 2, transition: 'width 1s ease-out' }} />
  </div>
);

export const TrendIndicator = ({ data, color, height }: { data: number[]; color: string; height?: number }) => {
  const h = height || 28;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: h, width: 52, flexShrink: 0 }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1, background: color,
          height: `${Math.max(((v - min) / range) * 100, 8)}%`,
          opacity: 0.35 + (i / data.length) * 0.65,
          borderRadius: '1px 1px 0 0',
          transition: 'height 0.4s ease',
        }} />
      ))}
    </div>
  );
};

export const DonutChart = ({ segments, total, size }: { segments: { label: string; value: number; color: string }[]; total: number; size: number }) => {
  const strokeW = size * 0.22;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        {segments.map((seg, i) => {
          const pct = total ? seg.value / total : 0;
          const dash = pct * circ;
          const segOffset = offset;
          offset += dash;
          return (
            <circle key={i} cx={size/2} cy={size/2} r={r}
              fill="none" stroke={seg.color} strokeWidth={strokeW}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-segOffset}
              style={{ transition: 'stroke-dasharray 1s ease-out, stroke-dashoffset 1s ease-out' }}
            />
          );
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <span style={{ fontSize: size * 0.24, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{total}</span>
        <span style={{ fontSize: size * 0.13, color: 'var(--text-muted)' }}>total</span>
      </div>
    </div>
  );
};

export const BarChart = ({ data, color, height }: { data: { label: string; value: number }[]; color: string; height?: number }) => {
  const h = height || 120;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: h, width: '100%' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
          <div style={{
            width: '100%', background: color, borderRadius: '3px 3px 0 0',
            height: `${(d.value / max) * 100}%`,
            opacity: 0.4 + (i / data.length) * 0.5,
            transition: 'height 0.5s ease', minHeight: d.value > 0 ? 4 : 0,
          }} />
        </div>
      ))}
    </div>
  );
};

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
  bg: string;
  border: string;
  trend?: number[];
  trendColor?: string;
}

export const KPICard = ({ label, value, sub, icon: Icon, color, bg, border, trend, trendColor }: KPICardProps) => (
  <div className="rp-card card" style={{
    padding: '20px 24px', borderRadius: 14, border: `1px solid var(--border)`,
    display: 'flex', flexDirection: 'column', gap: 8,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={16} color={color} />
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <span style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{value}</span>
      {trend && <TrendIndicator data={trend} color={trendColor || color} />}
    </div>
    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</span>
  </div>
);

interface MiniTableProps {
  headers: string[];
  rows: (string | React.ReactNode)[][];
  emptyMessage?: string;
}

export const MiniTable = ({ headers, rows, emptyMessage }: MiniTableProps) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          {headers.map(h => (
            <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {row.map((cell, j) => (
              <td key={j} style={{ padding: '10px 14px' }}>{cell}</td>
            ))}
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={headers.length} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>{emptyMessage || 'No data available.'}</td></tr>
        )}
      </tbody>
    </table>
  </div>
);

export const CardSection = ({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ size?: number }>; children: React.ReactNode }) => (
  <div className="rp-card card" style={{ borderRadius: 14, overflow: 'hidden' }}>
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
      {Icon && <Icon size={16} />} {title}
    </div>
    <div style={{ padding: 20 }}>{children}</div>
  </div>
);
