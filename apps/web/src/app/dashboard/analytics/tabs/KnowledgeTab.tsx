'use client';

import type { KnowledgeStats } from '../types';
import KnowledgeReports from '../components/KnowledgeReports';
import { ExportButton } from '../components/export';

interface KnowledgeTabProps {
  stats: KnowledgeStats | null;
  isAdminOrAgent: boolean;
  onExportCSV: (section: string) => void;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

export default function KnowledgeTab({ stats, isAdminOrAgent, onExportCSV, isMetricPinned, handlePin, handleUnpin }: KnowledgeTabProps) {
  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ExportButton section="knowledge" label="Knowledge" onExport={onExportCSV} isAdminOrAgent={isAdminOrAgent} />
      <KnowledgeReports stats={stats} isMetricPinned={isMetricPinned} handlePin={handlePin} handleUnpin={handleUnpin} />
    </div>
  );
}
