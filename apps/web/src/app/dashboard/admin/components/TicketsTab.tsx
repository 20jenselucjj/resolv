'use client';

import { useState } from 'react';
import { CategoriesTab } from './CategoriesTab';
import { WorkflowTab } from './WorkflowTab';
import { TicketStatusesTab } from './TicketStatusesTab';
import type { Category } from './types';

const SUB_TABS = ['All', 'Categories', 'Workflow', 'Statuses'] as const;
type SubTab = typeof SUB_TABS[number];

export function TicketsTab({
  showAlert,
  setConfirmModal,
  categories,
  onRefreshCategories,
}: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (modal: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
  categories: Category[];
  onRefreshCategories: () => void;
}) {
  const [subTab, setSubTab] = useState<SubTab>('All');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <style>{`
        .tickets-tab-pills {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          white-space: nowrap;
          padding-bottom: 2px;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .tickets-tab-pills::-webkit-scrollbar { display: none; }
        @media (min-width: 768px) {
          .tickets-tab-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        }
        @media (max-width: 767px) {
          .tickets-tab-grid { display: flex; flex-direction: column; gap: 20px; }
        }
      `}</style>

      {/* Sub-tab pill navigation */}
      <div className="tickets-tab-pills">
        {SUB_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              border: '1px solid',
              borderColor: subTab === tab ? 'var(--accent)' : 'var(--border)',
              background: subTab === tab ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
              color: subTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: subTab === tab ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.12s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* All view — Categories + Workflow side by side, Statuses full width */}
      {subTab === 'All' && (
        <>
          <div className="tickets-tab-grid">
            <CategoriesTab
              categories={categories}
              onRefresh={onRefreshCategories}
              showAlert={showAlert}
              setConfirmModal={setConfirmModal}
            />
            <WorkflowTab
              showAlert={showAlert}
              setConfirmModal={setConfirmModal}
            />
          </div>
          <TicketStatusesTab showAlert={showAlert} />
        </>
      )}

      {/* Individual sub-tab views */}
      {subTab === 'Categories' && (
        <CategoriesTab
          categories={categories}
          onRefresh={onRefreshCategories}
          showAlert={showAlert}
          setConfirmModal={setConfirmModal}
        />
      )}
      {subTab === 'Workflow' && (
        <WorkflowTab
          showAlert={showAlert}
          setConfirmModal={setConfirmModal}
        />
      )}
      {subTab === 'Statuses' && (
        <TicketStatusesTab showAlert={showAlert} />
      )}
    </div>
  );
}
