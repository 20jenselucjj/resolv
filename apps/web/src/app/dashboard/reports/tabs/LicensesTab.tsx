'use client';

import type { LicenseReportData } from '../types';
import LicenseReports from '../components/LicenseReports';
import { ExportButton } from '../components/export';

interface LicensesTabProps {
  data: LicenseReportData | null;
  onExportCSV: (section: string) => void;
  isAdminOrAgent: boolean;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

export default function LicensesTab({ data, onExportCSV, isAdminOrAgent, isMetricPinned, handlePin, handleUnpin }: LicensesTabProps) {
  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ExportButton section="licenses" label="Licenses" onExport={onExportCSV} isAdminOrAgent={isAdminOrAgent} />
      <LicenseReports data={data} isMetricPinned={isMetricPinned} handlePin={handlePin} handleUnpin={handleUnpin} />
    </div>
  );
}
