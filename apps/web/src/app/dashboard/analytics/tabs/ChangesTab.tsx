'use client';

import type { ChangeReportData } from '../types';
import ChangeReports from '../components/ChangeReports';
import { ExportButton } from '../components/export';

interface ChangesTabProps {
  data: ChangeReportData | null;
  onExportCSV: (section: string) => void;
  isAdminOrAgent: boolean;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

export default function ChangesTab({ data, onExportCSV, isAdminOrAgent, isMetricPinned, handlePin, handleUnpin }: ChangesTabProps) {
  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ExportButton section="changes" label="Changes" onExport={onExportCSV} isAdminOrAgent={isAdminOrAgent} />
      <ChangeReports data={data} isMetricPinned={isMetricPinned} handlePin={handlePin} handleUnpin={handleUnpin} />
    </div>
  );
}
