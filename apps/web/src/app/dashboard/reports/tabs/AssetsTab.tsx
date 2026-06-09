'use client';

import type { AssetStats } from '../types';
import AssetReports from '../components/AssetReports';
import { ExportButton } from '../components/export';

interface AssetsTabProps {
  stats: AssetStats | null;
  isAdminOrAgent: boolean;
  onExportCSV: (section: string) => void;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

export default function AssetsTab({ stats, isAdminOrAgent, onExportCSV, isMetricPinned, handlePin, handleUnpin }: AssetsTabProps) {
  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ExportButton section="assets" label="Assets" onExport={onExportCSV} isAdminOrAgent={isAdminOrAgent} />
      <AssetReports stats={stats} isMetricPinned={isMetricPinned} handlePin={handlePin} handleUnpin={handleUnpin} />
    </div>
  );
}
