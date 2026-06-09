'use client';

import type { AIAnalytics } from '../types';
import AIReports from '../components/AIReports';
import { ExportButton } from '../components/export';

interface AITabProps {
  stats: AIAnalytics | null;
  isAdminOrAgent: boolean;
  onExportCSV: (section: string) => void;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

export default function AITab({ stats, isAdminOrAgent, onExportCSV, isMetricPinned, handlePin, handleUnpin }: AITabProps) {
  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ExportButton section="ai" label="AI" onExport={onExportCSV} isAdminOrAgent={isAdminOrAgent} />
      <AIReports stats={stats} isMetricPinned={isMetricPinned} handlePin={handlePin} handleUnpin={handleUnpin} />
    </div>
  );
}
