'use client';

import { useState, useEffect } from 'react';
import { Server, Mail, FileText, Reply, Inbox } from 'lucide-react';
import { SmtpConfig } from './SmtpConfig';
import { EmailInboundTab } from './EmailInboundTab';
import { EmailTemplatesTab } from './EmailTemplatesTab';
import { AutoReplyTab } from './AutoReplyTab';
import { EmailLogTab } from './EmailLogTab';

type EmailSubTab = 'outbound' | 'inbound' | 'templates' | 'auto-reply' | 'email-log';

interface SubTabConfig {
  id: EmailSubTab;
  label: string;
  icon: React.ReactNode;
}

const SUB_TABS: SubTabConfig[] = [
  { id: 'outbound', label: 'Email Sending', icon: <Server size={14} /> },
  { id: 'inbound', label: 'Inbound Email', icon: <Inbox size={14} /> },
  { id: 'templates', label: 'Templates', icon: <FileText size={14} /> },
  { id: 'auto-reply', label: 'Auto Replies', icon: <Reply size={14} /> },
  { id: 'email-log', label: 'Email Log', icon: <Mail size={14} /> },
];

export function EmailTab({ showAlert, setConfirmModal }: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (modal: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
}) {
  const [activeSubTab, setActiveSubTab] = useState<EmailSubTab>(() => {
    try { return (localStorage.getItem('resolv_email_tab') as EmailSubTab) || 'outbound' } catch { return 'outbound' }
  });

  useEffect(() => { localStorage.setItem('resolv_email_tab', activeSubTab) }, [activeSubTab]);

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: isActive ? 600 : 500,
    border: 'none',
    borderRadius: 'var(--radius-full)',
    cursor: 'pointer',
    background: isActive ? 'var(--accent)' : 'var(--bg-secondary)',
    color: isActive ? '#fff' : 'var(--text-secondary)',
    transition: 'background 0.2s, color 0.2s',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Sub-tab Navigation */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            style={tabStyle(activeSubTab === tab.id)}
            onClick={() => setActiveSubTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeSubTab === 'outbound' && <SmtpConfig showAlert={showAlert} />}
      {activeSubTab === 'inbound' && <EmailInboundTab showAlert={showAlert} />}
      {activeSubTab === 'templates' && (
        <EmailTemplatesTab showAlert={showAlert} setConfirmModal={setConfirmModal} />
      )}
      {activeSubTab === 'auto-reply' && (
        <AutoReplyTab showAlert={showAlert} />
      )}
      {activeSubTab === 'email-log' && <EmailLogTab showAlert={showAlert} />}
    </div>
  );
}
