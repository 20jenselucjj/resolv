'use client';
import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', flexDirection: 'column', gap: 16, padding: 32, textAlign: 'center'
    }}>
      <AlertTriangle size={48} color="var(--danger)" />
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Something went wrong</h1>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 400, lineHeight: 1.6 }}>
        An unexpected error occurred. Our team has been notified.
      </p>
      <button onClick={reset} style={{
        padding: '10px 20px', borderRadius: 'var(--radius-md)', background: 'var(--accent)',
        color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer'
      }}>
        Try again
      </button>
    </div>
  );
}
