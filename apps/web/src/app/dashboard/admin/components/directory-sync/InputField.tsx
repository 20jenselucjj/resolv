'use client';

import React from 'react';

export const InputField = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  hidden = false,
  hint,
  icon,
}: {
  label: string;
  value?: string;
  onChange: (val: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  hidden?: boolean;
  hint?: string;
  icon?: React.ReactNode;
}) => {
  if (hidden) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        {icon && (
          <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            {icon}
          </div>
        )}
        <input
          className="input"
          type={type}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={icon ? { paddingLeft: 32 } : undefined}
        />
      </div>
      {hint && <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{hint}</span>}
    </div>
  );
};