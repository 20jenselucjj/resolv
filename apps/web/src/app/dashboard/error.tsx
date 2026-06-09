'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 16, padding: 32, textAlign: 'center'
    }}>
      <AlertTriangle size={40} color="var(--danger)" />
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Page failed to load</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 360, lineHeight: 1.6 }}>
        {error.message || 'An unexpected error occurred on this page.'}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={reset} style={{
          padding: '8px 16px', borderRadius: 'var(--radius-md)', background: 'var(--accent)',
          color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          <RefreshCw size={14} /> Try again
        </button>
        <button onClick={() => router.push('/dashboard/tickets')} style={{
          padding: '8px 16px', borderRadius: 'var(--radius-md)', background: 'transparent',
          color: 'var(--text)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
        }}>
          Go to Tickets
        </button>
      </div>
    </div>
  );
}
