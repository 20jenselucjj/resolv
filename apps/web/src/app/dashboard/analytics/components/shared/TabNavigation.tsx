'use client';

import type { ReportTab } from '../../types';

interface TabDefinition {
  key: ReportTab;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  adminOnly?: boolean;
}

interface TabNavigationProps {
  tabs: TabDefinition[];
  activeTab: ReportTab;
  onTabChange: (tab: ReportTab) => void;
  isAdminOrAgent: boolean;
}

export default function TabNavigation({ tabs, activeTab, onTabChange, isAdminOrAgent }: TabNavigationProps) {
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 16, flexWrap: 'wrap' }}>
      {tabs.filter(t => !t.adminOnly || isAdminOrAgent).map(tab => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
            background: activeTab === tab.key ? 'var(--accent-subtle)' : 'transparent',
            color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
            transition: 'all 0.15s',
          }}
        >
          <tab.icon size={13} />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
