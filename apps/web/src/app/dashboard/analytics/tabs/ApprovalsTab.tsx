'use client';

import type { ApprovalReportData } from '../types';
import ApprovalReports from '../components/ApprovalReports';
import { ExportButton } from '../components/export';

interface ApprovalsTabProps {
  data: ApprovalReportData | null;
  onExportCSV: (section: string) => void;
  isAdminOrAgent: boolean;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

export default function ApprovalsTab({ data, onExportCSV, isAdminOrAgent, isMetricPinned, handlePin, handleUnpin }: ApprovalsTabProps) {
  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ExportButton section="approvals" label="Approvals" onExport={onExportCSV} isAdminOrAgent={isAdminOrAgent} />
      <ApprovalReports data={data} isMetricPinned={isMetricPinned} handlePin={handlePin} handleUnpin={handleUnpin} />
    </div>
  );
}
