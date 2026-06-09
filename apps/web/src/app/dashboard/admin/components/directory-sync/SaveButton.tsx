'use client';

import { Save, Info } from 'lucide-react';

interface SaveButtonProps {
  handleSave: () => void;
  saving: boolean;
  hasUnsavedChanges?: boolean;
}

export function SaveButton({ handleSave, saving, hasUnsavedChanges }: SaveButtonProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 20px',
      background: hasUnsavedChanges ? 'var(--warning-bg)' : 'var(--bg-secondary)',
      border: `1px solid ${hasUnsavedChanges ? 'var(--warning-border)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)',
      transition: 'all 0.2s ease',
    }}>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Info size={13} />
        {hasUnsavedChanges ? (
          <span style={{ color: 'var(--warning)' }}>
            <strong>Unsaved changes.</strong> Save your configuration before connecting OAuth or closing this page.
          </span>
        ) : (
          'Changes are saved to the server. Sync settings take effect on the next scheduled run.'
        )}
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8,
          fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer',
          borderRadius: 'var(--radius-md)',
          background: hasUnsavedChanges ? 'var(--warning)' : 'var(--accent)',
          color: 'white',
          boxShadow: hasUnsavedChanges
            ? '0 2px 8px rgba(var(--warning-rgb, 245,158,11), 0.25)'
            : '0 2px 8px rgba(var(--accent-rgb), 0.25)',
          opacity: saving ? 0.7 : 1,
        }}
      >
        <Save size={15} />
        {saving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'Save Configuration'}
      </button>
    </div>
  );
}
