'use client';

import type { ProblemReportData } from '../types';
import ProblemReports from '../components/ProblemReports';
import { ExportButton } from '../components/export';

interface ProblemsTabProps {
  data: ProblemReportData | null;
  onExportCSV: (section: string) => void;
  isAdminOrAgent: boolean;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

export default function ProblemsTab({ data, onExportCSV, isAdminOrAgent, isMetricPinned, handlePin, handleUnpin }: ProblemsTabProps) {
  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ExportButton section="problems" label="Problems" onExport={onExportCSV} isAdminOrAgent={isAdminOrAgent} />
      <ProblemReports data={data} isMetricPinned={isMetricPinned} handlePin={handlePin} handleUnpin={handleUnpin} />
    </div>
  );
}
