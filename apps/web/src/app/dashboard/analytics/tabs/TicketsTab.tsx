'use client';

import { useMemo } from 'react';
import { FileText, Shield, Ticket as TicketIcon } from 'lucide-react';
import { CardSection } from '../components/Charts';
import { FilterBar } from '../components/filters';
import { InteractiveBarChart, ScorecardWidget } from '../components/recharts';
import { STATUS_COLORS, PRIORITY_COLORS } from '../types';
import type { Ticket } from '../types';

import type { DrillDownLevel } from '../types';

interface TicketsTabProps {
  filteredTickets: Ticket[];
  categories: string[];
  categoryFilter: string;
  onCategoryChange: (val: string) => void;
  priorityFilter: string;
  onPriorityChange: (val: string) => void;
  statusFilter: string;
  onStatusChange: (val: string) => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  onExportCSV: () => void;
  /** Drill-down handler */
  onDrillDown?: (level: DrillDownLevel) => void;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

export default function TicketsTab({
  filteredTickets, categories, categoryFilter, onCategoryChange,
  priorityFilter, onPriorityChange, statusFilter, onStatusChange,
  searchQuery, onSearchChange, onExportCSV, onDrillDown,
  isMetricPinned, handlePin, handleUnpin,
}: TicketsTabProps) {
  const total = filteredTickets.length;

  const priorityBreakdown = useMemo(() => {
    const m: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    filteredTickets.forEach(t => { const p = t.priority?.toLowerCase() || 'low'; m[p] = (m[p] || 0) + 1; });
    return Object.entries(m);
  }, [filteredTickets]);

  function pinProps(key: string, label: string, type: string = 'kpi') {
    return (isMetricPinned && handlePin && handleUnpin) ? {
      metricKey: key, metricLabel: label,
      isPinned: isMetricPinned(key),
      onPin: () => handlePin(key, label, type),
      onUnpin: () => handleUnpin(key),
    } : {};
  }

  const priorityBarData = priorityBreakdown.map(([p, count]) => ({
    name: p.charAt(0).toUpperCase() + p.slice(1),
    value: count,
    color: PRIORITY_COLORS[p] || 'var(--text-muted)',
  }));

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        categoryFilter={categoryFilter}
        onCategoryChange={onCategoryChange}
        priorityFilter={priorityFilter}
        onPriorityChange={onPriorityChange}
        statusFilter={statusFilter}
        onStatusChange={onStatusChange}
        categories={categories}
        showExportButton={filteredTickets.length > 0}
        onExport={onExportCSV}
      />

      {/* KPI Row + Priority Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <ScorecardWidget
          label="Total Tickets"
          value={total}
          icon={TicketIcon}
          iconColor="var(--accent)"
          iconBg="var(--accent-subtle)"
          accentColor="var(--accent)"
          change={{
            value: filteredTickets.filter(t => t.status === 'open').length,
            label: 'open',
            isPositive: false,
          }}
          {...pinProps('tickets_total', 'Total Tickets')}
        />
        <ScorecardWidget
          label="Resolved"
          value={filteredTickets.filter(t => ['resolved', 'closed'].includes(t.status.toLowerCase())).length}
          icon={Shield}
          iconColor="var(--success)"
          iconBg="var(--success-bg)"
          accentColor="var(--success)"
          {...pinProps('tickets_resolved', 'Resolved')}
        />
        <ScorecardWidget
          label="Unresolved"
          value={filteredTickets.filter(t => !['resolved', 'closed'].includes(t.status.toLowerCase())).length}
          icon={FileText}
          iconColor="var(--warning)"
          iconBg="var(--warning-bg)"
          accentColor="var(--warning)"
          {...pinProps('tickets_unresolved', 'Unresolved')}
        />
      </div>

      {/* Priority Distribution */}
      <CardSection title="Priority Distribution" icon={Shield} {...pinProps('chart_priority_donut', 'Priority Distribution', 'chart')}>
        <InteractiveBarChart
          data={priorityBarData}
          layout="horizontal"
          height={220}
          showExport={true}
          colorMap={PRIORITY_COLORS}
          onBarClick={onDrillDown ? (datum) => onDrillDown({
            label: `Priority: ${datum.name}`,
            filterKey: 'priority',
            filterValue: datum.name.toLowerCase(),
            count: datum.value,
          }) : undefined}
          exportFilename="tickets-priority-distribution"
          showGrid={false}
        />
      </CardSection>

      {/* Ticket Table */}
      <CardSection title={`Tickets (${total})`} icon={FileText}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['#', 'Title', 'Status', 'Priority', 'Type', 'Category', 'Assignee'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTickets.slice(0, 50).map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 11 }}>#{t.number}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 500, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, textTransform: 'capitalize',
                      background: (STATUS_COLORS[t.status] || 'var(--bg-tertiary)') + '20', color: STATUS_COLORS[t.status] || 'var(--text-muted)',
                      border: `1px solid ${(STATUS_COLORS[t.status] || 'var(--border)')}20`,
                    }}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: PRIORITY_COLORS[t.priority] || 'var(--text)', textTransform: 'capitalize' }}>{t.priority}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{(t.ticket_type || '').replace('_', ' ')}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{t.category_name || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{t.assigned_to_name || 'Unassigned'}</td>
                </tr>
              ))}
              {filteredTickets.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No tickets match the selected filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardSection>
    </div>
  );
}
