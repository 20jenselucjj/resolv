'use client';

import React from 'react';

export const EmptyState = ({ icon, title, description, action }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) => (
  <div style={{
    padding: '40px 24px',
    textAlign: 'center',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-secondary)',
  }}>
    <div style={{
      width: 48, height: 48, borderRadius: '50%',
      background: 'var(--bg-tertiary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 14px',
      color: 'var(--text-muted)',
    }}>
      {icon}
    </div>
    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: 320, margin: '0 auto', lineHeight: 1.5 }}>{description}</div>
    {action && <div style={{ marginTop: 16 }}>{action}</div>}
  </div>
);