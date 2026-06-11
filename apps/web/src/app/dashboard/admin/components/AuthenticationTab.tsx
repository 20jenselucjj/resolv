'use client';

import { useState } from 'react';
import { Shield, Users, LogIn, GitBranch, Monitor } from 'lucide-react';
import { SSOTab } from './SSOTab';
import { DirectorySyncTab } from '../DirectorySyncTab';
import { AzureAdSyncTab } from './AzureAdSyncTab';
import { LoginModeSection } from './LoginModeSection';
import { RoleAssignmentRulesTab } from './RoleAssignmentRulesTab';

type AuthSubTab = 'sso' | 'directory-sync' | 'azure-ad' | 'role-rules' | 'login-mode';

interface SubTabConfig {
  id: AuthSubTab;
  label: string;
  icon: React.ReactNode;
}

const SUB_TABS: SubTabConfig[] = [
  { id: 'sso', label: 'SSO Providers', icon: <Shield size={14} /> },
  { id: 'directory-sync', label: 'Google Workspace', icon: <Users size={14} /> },
  { id: 'azure-ad', label: 'Azure AD / Entra ID', icon: <Monitor size={14} /> },
  { id: 'role-rules', label: 'Role Rules', icon: <GitBranch size={14} /> },
  { id: 'login-mode', label: 'Login Mode', icon: <LogIn size={14} /> },
];

export function AuthenticationTab({
  showAlert,
}: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
}) {
  const [activeSubTab, setActiveSubTab] = useState<AuthSubTab>('sso');

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

      {/* SSO Providers */}
      {activeSubTab === 'sso' && <SSOTab showAlert={showAlert} />}

      {/* Directory Sync — Google Workspace */}
      {activeSubTab === 'directory-sync' && <DirectorySyncTab showAlert={showAlert} />}

      {/* Azure AD / Entra ID Sync */}
      {activeSubTab === 'azure-ad' && <AzureAdSyncTab showAlert={showAlert} />}

      {/* Role Rules */}
      {activeSubTab === 'role-rules' && <RoleAssignmentRulesTab showAlert={showAlert} />}

      {/* Login Mode */}
      {activeSubTab === 'login-mode' && <LoginModeSection showAlert={showAlert} variant="page" />}
    </div>
  );
}
