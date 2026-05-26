'use client';

import React from 'react';

export const SkeletonBlock = ({ width, height, style }: { width: string | number; height: string | number; style?: React.CSSProperties }) => (
  <div
    className="ds-skeleton"
    style={{ width, height, ...style }}
  />
);

export const LoadingSkeleton = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
    {/* Header skeleton */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SkeletonBlock width="200px" height="24px" />
      <SkeletonBlock width="400px" height="16px" />
    </div>
    {/* Progress bar skeleton */}
    <div style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
      <SkeletonBlock width="140px" height="13px" style={{ marginBottom: 16 }} />
      <SkeletonBlock width="100%" height="8px" style={{ marginBottom: 20 }} />
      <div style={{ display: 'flex', gap: 24 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <SkeletonBlock width="32px" height="32px" style={{ borderRadius: '50%' }} />
            <SkeletonBlock width="80px" height="12px" />
            <SkeletonBlock width="60px" height="10px" />
          </div>
        ))}
      </div>
    </div>
    {/* Section skeletons */}
    {[1, 2, 3].map(i => (
      <div key={i} style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SkeletonBlock width="160px" height="13px" />
        <SkeletonBlock width="100%" height="40px" />
        <SkeletonBlock width="100%" height="40px" />
      </div>
    ))}
  </div>
);