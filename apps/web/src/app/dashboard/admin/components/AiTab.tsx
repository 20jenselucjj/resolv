'use client';

import { useState } from 'react';
import { AIConfigTab } from './AIConfigTab';
import { AITrainingTab } from '../AITrainingTab';

export function AiTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [activeTab, setActiveTab] = useState<'config' | 'training'>('config');

  const tabs = [
    { key: 'config' as const, label: 'Config' },
    { key: 'training' as const, label: 'Training' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Sub-tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '4px 4px 0',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
        className="ai-subtab-nav"
      >
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: 'none',
              background: activeTab === key ? 'var(--accent)' : 'transparent',
              color: activeTab === key ? '#fff' : 'var(--text-secondary)',
              borderRadius: 'var(--radius-full)',
              transition: 'all 0.15s ease',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ padding: '0', marginTop: '12px' }}>
        {activeTab === 'config' && <AIConfigTab showAlert={showAlert} />}
        {activeTab === 'training' && <AITrainingTab showAlert={showAlert} />}
      </div>

      <style jsx>{`
        .ai-subtab-nav::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
