'use client';

import { useState } from 'react';
import { AIConfigTab } from './AIConfigTab';
import { AITrainingTab } from '../AITrainingTab';
import { Brain, BookOpen } from 'lucide-react';

export function AiTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [activeSection, setActiveSection] = useState<'config' | 'training'>('config');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Section Tabs - cleaner design */}
      <div style={{
        display: 'flex', gap: '8px', padding: '4px',
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', width: 'fit-content',
      }}>
        <button
          onClick={() => setActiveSection('config')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none',
            background: activeSection === 'config' ? 'var(--accent)' : 'transparent',
            color: activeSection === 'config' ? '#fff' : 'var(--text-secondary)',
            borderRadius: 'var(--radius-md)', transition: 'all 0.15s ease',
          }}
        >
          <Brain size={15} /> Configuration
        </button>
        <button
          onClick={() => setActiveSection('training')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none',
            background: activeSection === 'training' ? 'var(--accent)' : 'transparent',
            color: activeSection === 'training' ? '#fff' : 'var(--text-secondary)',
            borderRadius: 'var(--radius-md)', transition: 'all 0.15s ease',
          }}
        >
          <BookOpen size={15} /> Knowledge & Training
        </button>
      </div>

      {/* Content */}
      {activeSection === 'config' && <AIConfigTab showAlert={showAlert} />}
      {activeSection === 'training' && <AITrainingTab showAlert={showAlert} />}
    </div>
  );
}
