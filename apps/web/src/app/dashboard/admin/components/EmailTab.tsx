'use client';

import { useState } from 'react';
import { EmailTemplatesTab } from './EmailTemplatesTab';
import { AutoReplyTab } from './AutoReplyTab';

export function EmailTab({ showAlert, setConfirmModal }: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (modal: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
}) {
  const [activeSubTab, setActiveSubTab] = useState<'templates' | 'auto-reply'>('templates');

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: isActive ? 600 : 500,
    border: 'none',
    borderRadius: 'var(--radius-full)',
    cursor: 'pointer',
    background: isActive ? 'var(--accent)' : 'var(--bg-secondary)',
    color: isActive ? '#fff' : 'var(--text-secondary)',
    transition: 'background 0.2s, color 0.2s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Sub-tab Navigation */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          style={tabStyle(activeSubTab === 'templates')}
          onClick={() => setActiveSubTab('templates')}
        >
          Templates
        </button>
        <button
          style={tabStyle(activeSubTab === 'auto-reply')}
          onClick={() => setActiveSubTab('auto-reply')}
        >
          Auto Replies
        </button>
      </div>

      {/* Content */}
      {activeSubTab === 'templates' && (
        <EmailTemplatesTab showAlert={showAlert} setConfirmModal={setConfirmModal} />
      )}
      {activeSubTab === 'auto-reply' && (
        <AutoReplyTab showAlert={showAlert} />
      )}
    </div>
  );
}
