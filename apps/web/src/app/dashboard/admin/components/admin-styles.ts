import type React from 'react';

/** Standard section card container */
export const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '24px',
};

/** Section card title */
export const sectionTitle: React.CSSProperties = {
  fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px',
};

/** Section card description */
export const sectionDesc: React.CSSProperties = {
  fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px',
};

/** Standard text input */
export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: '13px',
  background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', color: 'var(--text)', outline: 'none',
  boxSizing: 'border-box',
};

/** Input label */
export const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 600,
  color: 'var(--text-secondary)', marginBottom: '4px',
};

/** Sub-section card nested inside a section */
export const subsectionStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', padding: '16px', marginTop: '12px',
};
