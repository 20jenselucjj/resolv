'use client';

import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: 6,
      background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 12,
    }}>
      <AlertTriangle size={13} /> {message}
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: 'none', border: 'none', color: 'var(--danger)',
            cursor: 'pointer', fontWeight: 600, marginLeft: 4,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <RefreshCcw size={12} /> Retry
        </button>
      )}
    </div>
  );
}
