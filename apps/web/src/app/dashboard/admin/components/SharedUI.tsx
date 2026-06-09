'use client';

import React from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

export function ConfirmModal({ open, title, message, onConfirm, onCancel, danger = true }: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 24, maxWidth: 400, width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{title}</h3>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >Cancel</button>
          <button onClick={onConfirm} style={{
            padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none',
            background: danger ? 'var(--danger)' : 'var(--accent)', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scale(1.02)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
          >Confirm</button>
        </div>
      </div>
    </div>
  );
}

export function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: string }) {
  const styles: Record<string, React.CSSProperties> = {
    admin: { background: 'var(--critical-bg)', color: 'var(--critical)', border: '1px solid var(--critical-border)' },
    agent: { background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' },
    user: { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
    active: { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)' },
    inactive: { background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border)' },
    low: { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)' },
    medium: { background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--warning-border)' },
    high: { background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)' },
    critical: { background: 'var(--critical-bg)', color: 'var(--critical)', border: '1px solid var(--critical-border)' },
    locked: { background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)' },
    sso: { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' },
    password: { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
    default: { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
  };

  return (
    <span className="badge" style={{ ...(styles[variant] || styles.default), fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', textTransform: 'capitalize' }}>
      {children}
    </span>
  );
}

export const StatCard = ({ label, value, icon, color, bg }: { label: string; value: number | string; icon: React.ReactNode; color: string; bg: string }) => (
  <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-md)', background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
    </div>
    <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>{value}</div>
  </div>
);

export function Alert({ message, type = 'success', onClose }: { message: string; type?: 'success' | 'error'; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', padding: '12px 16px', borderRadius: 'var(--radius-md)',
      background: type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
      color: type === 'success' ? 'var(--success)' : 'var(--danger)',
      border: `1px solid ${type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
      display: 'flex', alignItems: 'center', gap: '12px', zIndex: 1000, boxShadow: 'var(--shadow-md)',
      animation: 'slideIn 0.2s ease-out'
    }}>
      {type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
      <span style={{ fontSize: '13px', fontWeight: 500 }}>{message}</span>
       <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, transition: 'opacity 0.15s ease' }}
         onMouseEnter={e => e.currentTarget.style.opacity = '0.6'}
         onMouseLeave={e => e.currentTarget.style.opacity = '1'}
       >
         <X size={14} />
       </button>
    </div>
  );
}

export function Modal({ title, children, onClose, maxWidth = '400px' }: { title: string; children: React.ReactNode; onClose: () => void; maxWidth?: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(2px)' }}>
      <div className="card" style={{ width: '100%', maxWidth, padding: 0, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="card-header" style={{ justifyContent: 'space-between', padding: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{title}</h3>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '4px' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
