'use client';

import { RefreshCcw } from 'lucide-react';

export default function LoadingState({ message = 'Loading analytics...' }: { message?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh', flexDirection: 'column', gap: 16 }}>
      <RefreshCcw className="animate-spin" size={32} color="var(--accent)" />
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{message}</p>
    </div>
  );
}
