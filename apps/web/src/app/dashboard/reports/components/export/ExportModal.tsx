'use client';

import { X, CheckSquare, FileText, Shield, Users, Monitor, BookOpen, Brain, LayoutDashboard, Download, Bug, Wrench, CheckSquare as CheckSquareIcon, DollarSign } from 'lucide-react';

type ExportFormat = 'csv' | 'excel';

interface ExportModalProps {
  show: boolean;
  onClose: () => void;
  exportSections: Record<string, boolean>;
  onToggleSection: (key: string) => void;
  onExport: () => void;
  isAdminOrAgent: boolean;
  timeRange: string;
  exportFormat: ExportFormat;
  onFormatChange: (format: ExportFormat) => void;
}

const EXPORT_SECTION_LABELS: Record<string, { label: string; icon: React.ComponentType<{ size?: number; color?: string }>; adminOnly?: boolean }> = {
  overview: { label: 'Overview', icon: LayoutDashboard },
  tickets: { label: 'Tickets', icon: FileText },
  sla: { label: 'SLA Summary', icon: Shield },
  performance: { label: 'Agent Performance', icon: Users, adminOnly: true },
  problems: { label: 'Problems', icon: Bug, adminOnly: true },
  changes: { label: 'Changes', icon: Wrench, adminOnly: true },
  approvals: { label: 'Approvals', icon: CheckSquareIcon, adminOnly: true },
  licenses: { label: 'Licenses', icon: DollarSign, adminOnly: true },
  assets: { label: 'Asset Inventory', icon: Monitor, adminOnly: true },
  knowledge: { label: 'Knowledge Base', icon: BookOpen, adminOnly: true },
  ai: { label: 'AI Analytics', icon: Brain, adminOnly: true },
  portal: { label: 'Self-Service Portal', icon: LayoutDashboard, adminOnly: true },
};

const FORMAT_OPTIONS: { value: ExportFormat; label: string; desc: string }[] = [
  { value: 'csv', label: 'CSV', desc: 'Comma-separated values' },
  { value: 'excel', label: 'Excel', desc: 'Formatted .xlsx with sheets' },
];

export default function ExportModal({ show, onClose, exportSections, onToggleSection, onExport, isAdminOrAgent, timeRange, exportFormat, onFormatChange }: ExportModalProps) {
  if (!show) return null;

  const selectedCount = Object.entries(exportSections).filter(([, v]) => v).length;

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div className="rp-fade" style={{
        backgroundColor: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 0, width: '100%', maxWidth: 520,
        position: 'relative', boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              Export Report Data
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Select sections and format for export
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
            padding: 4, borderRadius: 6, transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Format selection */}
        <div style={{ padding: '16px 24px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Export Format
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {FORMAT_OPTIONS.map(fmt => (
              <button
                key={fmt.value}
                onClick={() => onFormatChange(fmt.value)}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
                  background: exportFormat === fmt.value ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                  border: `1px solid ${exportFormat === fmt.value ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                  transition: 'all 0.15s', textAlign: 'left',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: exportFormat === fmt.value ? 'var(--accent)' : 'var(--text)' }}>
                  {fmt.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {fmt.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Section checkboxes */}
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Sections to Export ({selectedCount} selected)
          </div>
          {Object.entries(EXPORT_SECTION_LABELS)
            .filter(([, config]) => !config.adminOnly || isAdminOrAgent)
            .sort(([, a], [, b]) => a.label.localeCompare(b.label))
            .map(([key, config]) => {
              const Icon = config.icon;
              const checked = exportSections[key];
              return (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
                  background: checked ? 'var(--accent-subtle)' : 'transparent',
                  border: `1px solid ${checked ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                  marginBottom: 6, transition: 'all 0.15s',
                }} onClick={() => onToggleSection(key)}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 4,
                    background: checked ? 'var(--accent)' : 'var(--bg-tertiary)',
                    border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s', flexShrink: 0,
                  }}>
                    {checked && <CheckSquare size={12} color="white" />}
                  </div>
                  <Icon size={16} color={checked ? 'var(--accent)' : 'var(--text-muted)'} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: checked ? 'var(--accent)' : 'var(--text)' }}>{config.label}</div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 24px', borderTop: '1px solid var(--border)',
          background: 'var(--bg-secondary)', borderRadius: '0 0 16px 16px',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {timeRange === 'all' ? 'All time' : `Last ${timeRange}`}
            {exportFormat === 'excel' && ' · Multiple sheets'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} className="btn btn-ghost btn-sm">
              Cancel
            </button>
            <button
              onClick={onExport}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              disabled={selectedCount === 0}
            >
              <Download size={13} /> Export {selectedCount > 0 ? `(${selectedCount})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
