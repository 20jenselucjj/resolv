'use client';

import { Save, Info } from 'lucide-react';

interface SaveButtonProps {
  handleSave: () => void;
  saving: boolean;
}

export function SaveButton({ handleSave, saving }: SaveButtonProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 20px',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
    }}>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Info size={13} />
        Changes are saved to the server. Sync settings take effect on the next scheduled run.
      </div>
      <button
        className="btn btn-primary"
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8,
          fontSize: '13px', fontWeight: 600,
          boxShadow: '0 2px 8px rgba(var(--accent-rgb), 0.25)',
        }}
      >
        <Save size={15} />
        {saving ? 'Saving...' : 'Save Configuration'}
      </button>
    </div>
  );
}
