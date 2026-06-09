'use client';

export const ToggleSwitch = ({ enabled, onChange, small = false }: { enabled: boolean; onChange: () => void; small?: boolean }) => (
  <div
    onClick={onChange}
    style={{
      width: small ? 36 : 44,
      height: small ? 20 : 24,
      borderRadius: small ? 10 : 12,
      cursor: 'pointer',
      background: enabled ? 'var(--accent)' : 'var(--bg-tertiary)',
      border: `1px solid ${enabled ? 'var(--accent)' : 'var(--border)'}`,
      position: 'relative',
      transition: 'all 0.2s ease',
      flexShrink: 0,
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: small ? 1 : 2,
        left: enabled ? (small ? 18 : 22) : (small ? 1 : 2),
        width: small ? 16 : 18,
        height: small ? 16 : 18,
        borderRadius: '50%',
        background: enabled ? 'white' : 'var(--text-muted)',
        transition: 'left 0.2s ease',
        boxShadow: small ? undefined : '0 1px 3px rgba(0,0,0,0.2)',
      }}
    />
  </div>
);
