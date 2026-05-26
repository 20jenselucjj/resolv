'use client';

import React from 'react';

export const Section = ({ icon, iconBg, iconColor, label, description, children, badge }: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  description?: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) => (
  <div style={{
    padding: '24px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: description ? 20 : 16 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 'var(--radius-md)',
        background: iconBg, color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{label}</span>
          {badge}
        </div>
        {description && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 1 }}>{description}</div>
        )}
      </div>
    </div>
    {children}
  </div>
);