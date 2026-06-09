'use client';

import { SLAPoliciesTab } from './SLAPoliciesTab';
import { WorkingHoursTab } from './WorkingHoursTab';
import type { SLAPolicy } from './types';

export function SlaHoursTab({
  showAlert,
  setConfirmModal,
  policies,
  onRefresh
}: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (modal: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
  policies: SLAPolicy[];
  onRefresh: () => void;
}) {
  return (
    <>
      <style>{`
        .sla-hours-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        @media (max-width: 768px) {
          .sla-hours-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '4px 0' }}>
        <div className="sla-hours-grid">
          <div className="card" style={{ padding: '20px', border: '1px solid var(--border)' }}>
            <SLAPoliciesTab
              policies={policies}
              onRefresh={onRefresh}
              showAlert={showAlert}
              setConfirmModal={setConfirmModal}
            />
          </div>

          <div className="card" style={{ padding: '20px', border: '1px solid var(--border)' }}>
            <WorkingHoursTab showAlert={showAlert} />
          </div>
        </div>
      </div>
    </>
  );
}
