'use client';

import { useMemo } from 'react';
import {
  LayoutDashboard, Ticket, Target, Grid3x3, Layers,
  BookOpen, Package, TrendingUp, FileText, Pin, Menu, X,
} from 'lucide-react';

export type SectionKey =
  | 'overview'
  | 'operational'
  | 'service-level'
  | 'matrix'
  | 'itsm-modules'
  | 'knowledge-ai'
  | 'assets-licenses'
  | 'benchmarks'
  | 'reports'
  | 'pinboard';

interface Section {
  key: SectionKey;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  adminOnly?: boolean;
}

const SECTIONS: Section[] = [
  { key: 'overview',        label: 'Overview',          icon: LayoutDashboard },
  { key: 'operational',     label: 'Operational',       icon: Ticket },
  { key: 'service-level',   label: 'Service Level',      icon: Target },
  { key: 'matrix',          label: 'Matrix',             icon: Grid3x3, adminOnly: true },
  { key: 'itsm-modules',    label: 'ITSM Modules',       icon: Layers, adminOnly: true },
  { key: 'knowledge-ai',    label: 'Knowledge & AI',     icon: BookOpen, adminOnly: true },
  { key: 'assets-licenses', label: 'Assets & Licenses',  icon: Package, adminOnly: true },
  { key: 'benchmarks',      label: 'Benchmarks',         icon: TrendingUp, adminOnly: true },
  { key: 'reports',         label: 'Reports',            icon: FileText },
  { key: 'pinboard',        label: 'Pinboard',           icon: Pin },
];

interface AnalyticsSidebarProps {
  activeSection: SectionKey;
  onSectionChange: (key: SectionKey) => void;
  isAdminOrAgent: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function AnalyticsSidebar({
  activeSection,
  onSectionChange,
  isAdminOrAgent,
  mobileOpen,
  onMobileClose,
}: AnalyticsSidebarProps) {
  const visibleSections = useMemo(
    () => SECTIONS.filter((s) => !s.adminOnly || isAdminOrAgent),
    [isAdminOrAgent],
  );

  const sidebarContent = (
    <div
      style={{
        width: 250,
        minWidth: 250,
        background: 'var(--bg-elevated, #1a1a1a)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        borderRight: '1px solid var(--border, rgba(255,255,255,0.1))',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--border, rgba(255,255,255,0.1))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #fff)', letterSpacing: '-0.01em' }}>
          Analytics
        </span>
        <button
          onClick={onMobileClose}
          aria-label="Close sidebar"
          style={{
            display: 'none',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted, rgba(255,255,255,0.6))',
            cursor: 'pointer',
            padding: 4,
          }}
          className="analytics-sidebar-close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Sections */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }} aria-label="Analytics sections">
        {visibleSections.map((section) => {
          const active = activeSection === section.key;
          return (
            <button
              key={section.key}
              onClick={() => {
                onSectionChange(section.key);
                onMobileClose();
              }}
              aria-current={active ? 'page' : undefined}
              aria-label={section.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '10px 16px',
                border: 'none',
                background: active ? 'var(--accent-subtle, rgba(59, 130, 246, 0.15))' : 'transparent',
                color: active ? 'var(--accent, #60a5fa)' : 'var(--text-muted, rgba(255,255,255,0.7))',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                textAlign: 'left',
                transition: 'all 0.15s ease',
                borderLeft: active ? '3px solid var(--accent, #60a5fa)' : '3px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'var(--bg-secondary, rgba(255,255,255,0.05))';
                  e.currentTarget.style.color = 'var(--text, #fff)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted, rgba(255,255,255,0.7))';
                }
              }}
            >
              <section.icon size={20} />
              <span>{section.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={onMobileClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 999,
          }}
          className="analytics-mobile-overlay"
        />
      )}

      {/* Desktop sidebar */}
      <div className="analytics-sidebar-desktop" style={{ display: 'flex' }}>
        {sidebarContent}
      </div>

      {/* Mobile sidebar drawer */}
      <div
        className="analytics-sidebar-mobile"
        style={{
          position: 'fixed',
          top: 0,
          left: mobileOpen ? 0 : -260,
          bottom: 0,
          zIndex: 1000,
          transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {sidebarContent}
      </div>

      <style>{`
        @media (max-width: 767px) {
          .analytics-sidebar-desktop { display: none !important; }
          .analytics-sidebar-close { display: flex !important; }
        }
        @media (min-width: 768px) {
          .analytics-mobile-overlay { display: none !important; }
        }
      `}</style>
    </>
  );
}
