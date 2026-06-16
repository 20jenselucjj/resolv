'use client';

import { useState } from 'react';
import { Sliders, Save, Clock } from 'lucide-react';
import BuilderTab from '../tabs/BuilderTab';
import SavedReportsTab from '../tabs/SavedReportsTab';
import SchedulesTab from '../tabs/SchedulesTab';

interface ReportsSectionProps {
  builderType: string;
  setBuilderType: (v: string) => void;
  builderDatePreset: string;
  setBuilderDatePreset: (v: string) => void;
  builderDateFrom: string;
  setBuilderDateFrom: (v: string) => void;
  builderDateTo: string;
  setBuilderDateTo: (v: string) => void;
  builderFilters: { status: string[]; priority: string[]; ticket_type: string[] };
  setBuilderFilters: (v: { status: string[]; priority: string[]; ticket_type: string[] }) => void;
  builderGroupBy: string;
  setBuilderGroupBy: (v: string) => void;
  builderMetrics: string[];
  setBuilderMetrics: (v: string[]) => void;
  builderName: string;
  setBuilderName: (v: string) => void;
  builderDescription: string;
  setBuilderDescription: (v: string) => void;
  builderPublic: boolean;
  setBuilderPublic: (v: boolean) => void;
  execLoading: boolean;
  execError: string | null;
  execResult: any;
  onRunReport: () => void;
  onSaveReport: () => void;
  savedReports: any[];
  reportSchedules: any[];
  schedulerStatus: any;
  showScheduleForm: boolean;
  scheduleForm: any;
  onToggleScheduleForm: (v: boolean) => void;
  onUpdateScheduleForm: (field: string, value: any) => void;
  onCreateSchedule: () => void;
  onDeleteSchedule: (id: string) => void;
  onRunScheduleNow: (id: string) => void;
  onRefreshSavedReports: () => void;
  onExecuteSavedReport: (id: string) => void;
  onEditSavedReport: (report: any) => void;
  onExportSavedReport: (id: string, format: string, name: string) => void;
  onDeleteSavedReport: (id: string) => void;
  isAdminOrAgent: boolean;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

type SubTab = 'builder' | 'saved-reports' | 'schedules';

const SUB_TABS: { key: SubTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'builder', label: 'Report Builder', icon: Sliders },
  { key: 'saved-reports', label: 'Saved Reports', icon: Save },
  { key: 'schedules', label: 'Schedules', icon: Clock },
];

export default function ReportsSection(props: ReportsSectionProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('saved-reports');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        {SUB_TABS.map((st) => (
          <button
            key={st.key}
            onClick={() => setActiveSubTab(st.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: activeSubTab === st.key ? 'var(--accent-subtle)' : 'transparent',
              color: activeSubTab === st.key ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            <st.icon size={14} />
            {st.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'builder' && (
        <BuilderTab
          builderType={props.builderType}
          setBuilderType={props.setBuilderType}
          builderDatePreset={props.builderDatePreset}
          setBuilderDatePreset={props.setBuilderDatePreset}
          builderDateFrom={props.builderDateFrom}
          setBuilderDateFrom={props.setBuilderDateFrom}
          builderDateTo={props.builderDateTo}
          setBuilderDateTo={props.setBuilderDateTo}
          builderFilters={props.builderFilters}
          setBuilderFilters={props.setBuilderFilters}
          builderGroupBy={props.builderGroupBy}
          setBuilderGroupBy={props.setBuilderGroupBy}
          builderMetrics={props.builderMetrics}
          setBuilderMetrics={props.setBuilderMetrics}
          builderName={props.builderName}
          setBuilderName={props.setBuilderName}
          builderDescription={props.builderDescription}
          setBuilderDescription={props.setBuilderDescription}
          builderPublic={props.builderPublic}
          setBuilderPublic={props.setBuilderPublic}
          execLoading={props.execLoading}
          execError={props.execError}
          execResult={props.execResult}
          onRunReport={props.onRunReport}
          onSaveReport={props.onSaveReport}
        />
      )}
      {activeSubTab === 'saved-reports' && (
        <SavedReportsTab
          savedReports={props.savedReports}
          execResult={props.execResult}
          execLoading={props.execLoading}
          onRefresh={props.onRefreshSavedReports}
          onExecute={props.onExecuteSavedReport}
          onEdit={props.onEditSavedReport}
          onExport={props.onExportSavedReport}
          onDelete={props.onDeleteSavedReport}
          isMetricPinned={props.isMetricPinned}
          handlePin={props.handlePin}
          handleUnpin={props.handleUnpin}
        />
      )}
      {activeSubTab === 'schedules' && (
        <SchedulesTab
          reportSchedules={props.reportSchedules}
          savedReports={props.savedReports}
          schedulerStatus={props.schedulerStatus}
          showScheduleForm={props.showScheduleForm}
          scheduleForm={props.scheduleForm}
          onToggleForm={props.onToggleScheduleForm}
          onUpdateForm={props.onUpdateScheduleForm}
          onCreate={props.onCreateSchedule}
          onDelete={props.onDeleteSchedule}
          onRunNow={props.onRunScheduleNow}
        />
      )}
    </div>
  );
}
