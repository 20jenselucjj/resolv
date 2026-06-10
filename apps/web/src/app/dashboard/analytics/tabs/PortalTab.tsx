'use client';

import PortalReports from '../components/PortalReports';
import { ExportButton } from '../components/export';

interface PortalStats {
  totalUsers: number;
  userRegistrations30d: number;
  totalTickets: number;
  serviceRequestCount: number;
  csatAvg: number | undefined;
  csatCount: number;
}

interface PortalTabProps {
  portalStats: PortalStats;
  isAdminOrAgent: boolean;
  onExportCSV: (section: string) => void;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

export default function PortalTab({ portalStats, isAdminOrAgent, onExportCSV, isMetricPinned, handlePin, handleUnpin }: PortalTabProps) {
  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ExportButton section="portal" label="Portal" onExport={onExportCSV} isAdminOrAgent={isAdminOrAgent} />
      <PortalReports {...portalStats} isMetricPinned={isMetricPinned} handlePin={handlePin} handleUnpin={handleUnpin} />
    </div>
  );
}
