'use client';

import { useState, useCallback } from 'react';
import { getToken } from '@/lib/api';
import type {
  Ticket, AdminStats, AssetStats, KnowledgeStats, AIAnalytics,
  TimeRange, ProblemReportData, ChangeReportData, ApprovalReportData,
  LicenseReportData,
} from '../types';
import {
  exportToExcel,
  buildProblemsSheet,
  buildChangesSheet,
  buildApprovalsSheet,
  buildLicensesSheet,
} from '../utils';
import type { ExcelSheet } from '../utils';

// ── Section labels shared with ExportModal ─────────────────────────────────────
export const EXPORT_SECTION_LABELS: Record<string, { label: string; adminOnly?: boolean }> = {
  tickets: { label: 'Tickets' },
  overview: { label: 'Overview' },
  sla: { label: 'SLA Summary' },
  performance: { label: 'Agent Performance', adminOnly: true },
  problems: { label: 'Problems', adminOnly: true },
  changes: { label: 'Changes', adminOnly: true },
  approvals: { label: 'Approvals', adminOnly: true },
  licenses: { label: 'Licenses', adminOnly: true },
  assets: { label: 'Asset Inventory', adminOnly: true },
  knowledge: { label: 'Knowledge Base', adminOnly: true },
  ai: { label: 'AI Analytics', adminOnly: true },
  portal: { label: 'Self-Service Portal', adminOnly: true },
};

export type ExportFormat = 'csv' | 'excel';

interface ExportDeps {
  filteredTickets: Ticket[];
  agentPerformance: { name: string; count: number; resolved: number; breaches: number; totalResTime: number }[];
  assetStats: AssetStats | null;
  knowledgeStats: KnowledgeStats | null;
  aiAnalytics: AIAnalytics | null;
  adminStats: AdminStats | null;
  slaStats: { compliance: number; breached: number };
  total: number;
  resolutionStats: { avgHrs: number; formatted: string };
  timeRange: TimeRange;
  problemData: ProblemReportData | null;
  changeData: ChangeReportData | null;
  approvalData: ApprovalReportData | null;
  licenseData: LicenseReportData | null;
}

export function useExport(deps: ExportDeps) {
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [exportSections, setExportSections] = useState<Record<string, boolean>>({
    overview: true,
    tickets: true,
    sla: true,
    performance: true,
    problems: true,
    changes: true,
    approvals: true,
    licenses: true,
    assets: true,
    knowledge: true,
    ai: true,
    portal: true,
  });

  const toggleExportSection = (key: string) => {
    setExportSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── CSV Section Generators ────────────────────────────────────────────────

  const generateSectionCSV = useCallback((section: string): string | null => {
    const {
      filteredTickets, agentPerformance, assetStats, knowledgeStats,
      aiAnalytics, adminStats, slaStats, total, resolutionStats,
      problemData, changeData, approvalData, licenseData,
    } = deps;
    switch (section) {
      case 'tickets':
      case 'overview': {
        if (filteredTickets.length === 0) return null;
        const headers = ['ID', '#', 'Title', 'Status', 'Priority', 'Type', 'Category', 'Created', 'Updated', 'Assignee', 'SLA Breached', 'Due Date'];
        const rows = filteredTickets.map(t => [
          t.id, t.number, `"${t.title.replace(/"/g, '""')}"`, t.status, t.priority,
          t.ticket_type, t.category_name || '', t.created_at, t.updated_at,
          t.assigned_to_name || 'Unassigned', t.sla_breached ? 'Yes' : 'No', t.due_date || '',
        ]);
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      }
      case 'sla': {
        if (filteredTickets.length === 0) return null;
        const breached = filteredTickets.filter(t => t.sla_breached);
        const lines = [
          `SLA Compliance,,${slaStats.compliance}%`,
          `Total Tickets,,${total}`,
          `SLA Breaches,,${slaStats.breached}`,
          `At Risk,,${adminStats?.sla?.at_risk_count ?? '—'}`,
          `Avg Resolution,,${resolutionStats.formatted}`,
          '',
          'Breached Tickets',
          '#,Title,Priority,Assignee,Due Date',
          ...breached.map(t => [
            t.number, `"${t.title.replace(/"/g, '""')}"`, t.priority,
            t.assigned_to_name || 'Unassigned', t.due_date || '',
          ].join(',')),
        ];
        return lines.join('\n');
      }
      case 'performance': {
        if (agentPerformance.length === 0) return null;
        const headers = ['Agent', 'Handled', 'Resolved', 'Resolution Rate', 'Avg Time (h)', 'SLA Breaches', 'Status'];
        const rows = agentPerformance.map(a => {
          const avgHrs = a.resolved ? a.totalResTime / a.resolved / 3600000 : 0;
          const resRate = a.count ? Math.round(a.resolved / a.count * 100) : 0;
          const status = a.breaches === 0 && a.resolved > 0 ? 'Good' : a.breaches > 0 ? 'Review' : 'Pending';
          return [a.name, a.count, a.resolved, `${resRate}%`, avgHrs.toFixed(1), a.breaches, status];
        });
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      }
      case 'problems': {
        if (!problemData) return null;
        const lines: string[] = [];
        lines.push(`Total Problems,${problemData.total}`);
        lines.push(`MTTR (hours),${problemData.mttr_hours > 0 ? problemData.mttr_hours.toFixed(2) : 'N/A'}`);
        lines.push(`Incident Link Rate,${Math.round(problemData.incident_link_rate)}%`);
        lines.push('');
        lines.push('Status Distribution');
        lines.push('Status,Count');
        Object.entries(problemData.by_status).forEach(([key, val]) => {
          lines.push(`${key.replace(/_/g, ' ')},${val}`);
        });
        lines.push('');
        lines.push('Priority Distribution');
        lines.push('Priority,Count');
        Object.entries(problemData.by_priority).forEach(([key, val]) => {
          lines.push(`${key},${val}`);
        });
        if (problemData.top_root_causes.length > 0) {
          lines.push('');
          lines.push('Top Root Causes');
          lines.push('Category,Count');
          problemData.top_root_causes.forEach(r => {
            lines.push(`"${r.category.replace(/"/g, '""')}",${r.count}`);
          });
        }
        if (problemData.created_trend.length > 0) {
          lines.push('');
          lines.push('Problem Creation Trend');
          lines.push('Date,Count');
          problemData.created_trend.forEach(t => {
            lines.push(`${t.date},${t.count}`);
          });
        }
        return lines.join('\n');
      }
      case 'changes': {
        if (!changeData) return null;
        const lines: string[] = [];
        lines.push(`Total Changes,${changeData.total}`);
        lines.push(`Success Rate,${Math.round(changeData.success_rate)}%`);
        lines.push(`Rollback Rate,${Math.round(changeData.rollback_rate)}%`);
        lines.push(`Avg Implementation (hours),${changeData.avg_implementation_hours > 0 ? changeData.avg_implementation_hours.toFixed(2) : 'N/A'}`);
        lines.push(`Emergency Count,${changeData.emergency_count}`);
        lines.push(`Emergency Rate,${Math.round(changeData.emergency_rate)}%`);
        lines.push(`PIR Completion Rate,${Math.round(changeData.pir_completion_rate)}%`);
        lines.push('');
        lines.push('By Status');
        lines.push('Status,Count');
        Object.entries(changeData.by_status).forEach(([key, val]) => {
          lines.push(`${key.replace(/_/g, ' ')},${val}`);
        });
        lines.push('');
        lines.push('By Type');
        lines.push('Type,Count');
        Object.entries(changeData.by_type).forEach(([key, val]) => {
          lines.push(`${key},${val}`);
        });
        lines.push('');
        lines.push('By Risk');
        lines.push('Risk,Count');
        Object.entries(changeData.by_risk).forEach(([key, val]) => {
          lines.push(`${key},${val}`);
        });
        if (changeData.created_trend.length > 0) {
          lines.push('');
          lines.push('Change Creation Trend');
          lines.push('Date,Count');
          changeData.created_trend.forEach(t => {
            lines.push(`${t.date},${t.count}`);
          });
        }
        return lines.join('\n');
      }
      case 'approvals': {
        if (!approvalData) return null;
        const lines: string[] = [];
        lines.push(`Total Approvals,${approvalData.total}`);
        lines.push(`Avg Time to Decide (hours),${approvalData.avg_time_to_decide_hours > 0 ? approvalData.avg_time_to_decide_hours.toFixed(2) : 'N/A'}`);
        lines.push(`Approval Rate,${Math.round(approvalData.approval_rate)}%`);
        lines.push(`Overdue,${approvalData.overdue_count}`);
        lines.push('');
        lines.push('By Status');
        lines.push('Status,Count');
        Object.entries(approvalData.by_status).forEach(([key, val]) => {
          lines.push(`${key.replace(/_/g, ' ')},${val}`);
        });
        lines.push('');
        lines.push('By Entity Type');
        lines.push('Entity Type,Count');
        Object.entries(approvalData.by_entity_type).forEach(([key, val]) => {
          lines.push(`${key.replace(/_/g, ' ')},${val}`);
        });
        if (approvalData.created_trend.length > 0) {
          lines.push('');
          lines.push('Approval Request Trend');
          lines.push('Date,Count');
          approvalData.created_trend.forEach(t => {
            lines.push(`${t.date},${t.count}`);
          });
        }
        return lines.join('\n');
      }
      case 'licenses': {
        if (!licenseData) return null;
        const lines: string[] = [];
        lines.push(`Total Licenses,${licenseData.total}`);
        lines.push(`Total Cost,${licenseData.total_cost}`);
        lines.push(`Avg Cost per Seat,${licenseData.cost_per_seat_avg}`);
        lines.push(`Total Seats,${licenseData.total_seats}`);
        lines.push(`Used Seats,${licenseData.used_seats}`);
        lines.push(`Utilization Rate,${Math.round(licenseData.utilization_rate)}%`);
        lines.push(`Expiring Soon,${licenseData.expiring_soon}`);
        lines.push(`Over-allocated,${licenseData.over_allocated}`);
        lines.push('');
        lines.push('By Compliance');
        lines.push('Compliance,Count');
        Object.entries(licenseData.by_compliance).forEach(([key, val]) => {
          lines.push(`${key.replace(/_/g, ' ')},${val}`);
        });
        if (licenseData.by_publisher.length > 0) {
          lines.push('');
          lines.push('Top Publishers');
          lines.push('Publisher,Licenses,Total Cost');
          licenseData.by_publisher
            .sort((a, b) => b.total_cost - a.total_cost)
            .slice(0, 10)
            .forEach(p => {
              lines.push(`"${p.publisher.replace(/"/g, '""')}",${p.count},${p.total_cost}`);
            });
        }
        lines.push('');
        lines.push('By Type');
        lines.push('Type,Count');
        Object.entries(licenseData.by_type).forEach(([key, val]) => {
          lines.push(`${key.replace(/_/g, ' ')},${val}`);
        });
        return lines.join('\n');
      }
      case 'assets': {
        if (!assetStats) return null;
        const lines = [
          `Total Assets,,${assetStats.total}`,
          '',
          'By Status',
          'Status,Count',
          ...assetStats.byStatus.map(s => `${s.status},${s.count}`),
          '',
          'By Type',
          'Type,Count',
          ...assetStats.byType.map(t => `${t.asset_type},${t.count}`),
        ];
        return lines.join('\n');
      }
      case 'knowledge': {
        if (!knowledgeStats) return null;
        const lines = [
          `Total Articles,,${knowledgeStats.total}`,
          '',
          'By Status',
          'Status,Count',
          ...knowledgeStats.byStatus.map(s => `${s.status},${s.count}`),
          '',
          'Top Viewed',
          'Title,Views,Helpful,Not Helpful',
          ...knowledgeStats.topViewed.map(v => `"${v.title.replace(/"/g, '""')}",${v.views},${v.helpful_count},${v.not_helpful_count}`),
        ];
        if (knowledgeStats.byCategory.length > 0) {
          lines.push('', 'By Category', 'Category,Count');
          lines.push(...knowledgeStats.byCategory.map(c => `${c.category || 'Uncategorized'},${c.count}`));
        }
        return lines.join('\n');
      }
      case 'ai': {
        if (!aiAnalytics) return null;
        const { summary } = aiAnalytics;
        const lines = [
          `Total Queries,,${summary.total_queries}`,
          `Avg Confidence,,${(summary.avg_confidence * 100).toFixed(1)}%`,
          `Flagged for Review,,${summary.flagged_count}`,
          `Active Sources,,${summary.active_sources}`,
          `Total Sources,,${summary.total_sources}`,
        ];
        if (aiAnalytics.recent_queries.length > 0) {
          lines.push('', 'Recent Queries', 'Query,User,Confidence,Flagged');
          lines.push(...aiAnalytics.recent_queries.slice(0, 20).map(q =>
            `"${q.query.replace(/"/g, '""')}",${q.user_name || 'Unknown'},${(q.confidence_score * 100).toFixed(0)}%,${q.flagged_for_review ? 'Yes' : 'No'}`
          ));
        }
        return lines.join('\n');
      }
      case 'portal': {
        const srCount = filteredTickets.filter(t => t.ticket_type === 'service_request').length;
        const lines = [
          `Total Users,,${adminStats?.users?.total ?? 0}`,
          `Active Users,,${adminStats?.users?.active_count ?? 0}`,
          `Service Requests,,${srCount}`,
          `Total Tickets,,${total}`,
        ];
        return lines.join('\n');
      }
      default:
        return null;
    }
  }, [deps]);

  // ── Excel Section Generators ──────────────────────────────────────────────

  const generateSectionExcel = useCallback((section: string): ExcelSheet[] | null => {
    const {
      filteredTickets, agentPerformance, assetStats, knowledgeStats,
      aiAnalytics, adminStats, slaStats, total, resolutionStats,
      problemData, changeData, approvalData, licenseData,
    } = deps;

    switch (section) {
      case 'tickets':
      case 'overview': {
        if (filteredTickets.length === 0) return null;
        return [{
          name: 'Tickets',
          headers: ['ID', '#', 'Title', 'Status', 'Priority', 'Type', 'Category', 'Created', 'Updated', 'Assignee', 'SLA Breached', 'Due Date'],
          rows: filteredTickets.map(t => [
            t.id, t.number, t.title, t.status, t.priority,
            t.ticket_type, t.category_name || '', t.created_at, t.updated_at,
            t.assigned_to_name || 'Unassigned', t.sla_breached ? 'Yes' : 'No', t.due_date || '',
          ]),
        }];
      }
      case 'sla': {
        if (filteredTickets.length === 0) return null;
        const breached = filteredTickets.filter(t => t.sla_breached);
        const rows: (string | number | null | undefined)[][] = [
          ['SLA Compliance', `${slaStats.compliance}%`],
          ['Total Tickets', total],
          ['SLA Breaches', slaStats.breached],
          ['At Risk', adminStats?.sla?.at_risk_count ?? '—'],
          ['Avg Resolution', resolutionStats.formatted],
        ];
        if (breached.length > 0) {
          rows.push([]);
          rows.push(['Breached Tickets']);
          rows.push(['#', 'Title', 'Priority', 'Assignee', 'Due Date']);
          breached.forEach(t => {
            rows.push([t.number, t.title, t.priority, t.assigned_to_name || 'Unassigned', t.due_date || '']);
          });
        }
        return [{
          name: 'SLA',
          headers: ['Metric', 'Value'],
          rows,
          columnWidths: [30, 50],
        }];
      }
      case 'performance': {
        if (agentPerformance.length === 0) return null;
        return [{
          name: 'Performance',
          headers: ['Agent', 'Handled', 'Resolved', 'Resolution Rate', 'Avg Time (h)', 'SLA Breaches', 'Status'],
          rows: agentPerformance.map(a => {
            const avgHrs = a.resolved ? a.totalResTime / a.resolved / 3600000 : 0;
            const resRate = a.count ? Math.round(a.resolved / a.count * 100) : 0;
            const status = a.breaches === 0 && a.resolved > 0 ? 'Good' : a.breaches > 0 ? 'Review' : 'Pending';
            return [a.name, a.count, a.resolved, `${resRate}%`, parseFloat(avgHrs.toFixed(1)), a.breaches, status];
          }),
        }];
      }
      case 'problems': {
        if (!problemData) return null;
        const sheet = buildProblemsSheet(problemData);
        return sheet ? [sheet] : null;
      }
      case 'changes': {
        if (!changeData) return null;
        const sheet = buildChangesSheet(changeData);
        return sheet ? [sheet] : null;
      }
      case 'approvals': {
        if (!approvalData) return null;
        const sheet = buildApprovalsSheet(approvalData);
        return sheet ? [sheet] : null;
      }
      case 'licenses': {
        if (!licenseData) return null;
        const sheet = buildLicensesSheet(licenseData);
        return sheet ? [sheet] : null;
      }
      case 'assets': {
        if (!assetStats) return null;
        const rows: (string | number | null | undefined)[][] = [
          ['Total Assets', assetStats.total],
        ];
        if (assetStats.byStatus.length > 0) {
          rows.push([]);
          rows.push(['By Status']);
          rows.push(['Status', 'Count']);
          assetStats.byStatus.forEach(s => rows.push([s.status, s.count]));
        }
        if (assetStats.byType.length > 0) {
          rows.push([]);
          rows.push(['By Type']);
          rows.push(['Type', 'Count']);
          assetStats.byType.forEach(t => rows.push([t.asset_type, t.count]));
        }
        return [{
          name: 'Assets',
          headers: ['Metric / Category', 'Value / Count'],
          rows,
        }];
      }
      case 'knowledge': {
        if (!knowledgeStats) return null;
        const rows: (string | number | null | undefined)[][] = [
          ['Total Articles', knowledgeStats.total],
        ];
        if (knowledgeStats.byStatus.length > 0) {
          rows.push([]);
          rows.push(['By Status']);
          rows.push(['Status', 'Count']);
          knowledgeStats.byStatus.forEach(s => rows.push([s.status, s.count]));
        }
        if (knowledgeStats.topViewed.length > 0) {
          rows.push([]);
          rows.push(['Top Viewed', '', '', '']);
          rows.push(['Title', 'Views', 'Helpful', 'Not Helpful']);
          knowledgeStats.topViewed.forEach(v => rows.push([v.title, v.views, v.helpful_count, v.not_helpful_count]));
        }
        if (knowledgeStats.byCategory.length > 0) {
          rows.push([]);
          rows.push(['By Category']);
          rows.push(['Category', 'Count']);
          knowledgeStats.byCategory.forEach(c => rows.push([c.category || 'Uncategorized', c.count]));
        }
        return [{
          name: 'Knowledge',
          headers: ['Metric / Category', 'Value / Count'],
          rows,
        }];
      }
      case 'ai': {
        if (!aiAnalytics) return null;
        const { summary } = aiAnalytics;
        const rows: (string | number | null | undefined)[][] = [
          ['Total Queries', summary.total_queries],
          ['Avg Confidence', `${(summary.avg_confidence * 100).toFixed(1)}%`],
          ['Flagged for Review', summary.flagged_count],
          ['Active Sources', summary.active_sources],
          ['Total Sources', summary.total_sources],
        ];
        if (aiAnalytics.recent_queries.length > 0) {
          rows.push([]);
          rows.push(['Recent Queries']);
          rows.push(['Query', 'User', 'Confidence', 'Flagged']);
          aiAnalytics.recent_queries.slice(0, 20).forEach(q => {
            rows.push([q.query, q.user_name || 'Unknown', `${(q.confidence_score * 100).toFixed(0)}%`, q.flagged_for_review ? 'Yes' : 'No']);
          });
        }
        return [{
          name: 'AI Analytics',
          headers: ['Metric / Category', 'Value'],
          rows,
        }];
      }
      case 'portal': {
        const srCount = filteredTickets.filter(t => t.ticket_type === 'service_request').length;
        const rows: (string | number | null | undefined)[][] = [
          ['Total Users', adminStats?.users?.total ?? 0],
          ['Active Users', adminStats?.users?.active_count ?? 0],
          ['Service Requests', srCount],
          ['Total Tickets', total],
        ];
        return [{
          name: 'Portal',
          headers: ['Metric', 'Value'],
          rows,
        }];
      }
      default:
        return null;
    }
  }, [deps]);

  // ── Single section export (CSV) ──────────────────────────────────────────

  const exportSectionCSV = useCallback((section: string) => {
    const now = new Date().toISOString().split('T')[0];
    const csv = generateSectionCSV(section);
    if (!csv) return;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `resolv_report_${section}_${deps.timeRange}_${now}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [generateSectionCSV, deps.timeRange]);

  // ── Single section export (Excel) ────────────────────────────────────────

  const exportSectionExcel = useCallback(async (section: string) => {
    const now = new Date().toISOString().split('T')[0];
    const sheets = generateSectionExcel(section);
    if (!sheets || sheets.length === 0) return;
    try {
      await exportToExcel(sheets, `resolv_report_${section}_${deps.timeRange}_${now}.xlsx`, {
        title: `${section.charAt(0).toUpperCase() + section.slice(1)} Report`,
        subtitle: `Time range: ${deps.timeRange === 'all' ? 'All time' : `Last ${deps.timeRange}`}`,
      });
    } catch (err) {
      console.error('Excel export failed:', err);
    }
  }, [generateSectionExcel, deps.timeRange]);

  // ── Multi-section export (format-aware) ──────────────────────────────────

  const exportAllSelected = useCallback(async () => {
    const now = new Date().toISOString().split('T')[0];
    const selected = Object.entries(exportSections).filter(([, v]) => v).map(([k]) => k);

    if (selected.length === 0) return;

    if (exportFormat === 'excel') {
      // ── Excel export ─────────────────────────────────────────────────
      const allSheets: ExcelSheet[] = [];
      for (const section of selected) {
        const sheets = generateSectionExcel(section);
        if (sheets) {
          allSheets.push(...sheets);
        }
      }
      if (allSheets.length === 0) return;
      try {
        await exportToExcel(allSheets, `resolv_full_report_${deps.timeRange}_${now}.xlsx`, {
          title: 'Resolv Report',
          subtitle: `Time range: ${deps.timeRange === 'all' ? 'All time' : `Last ${deps.timeRange}`}`,
        });
      } catch (err) {
        console.error('Excel export failed:', err);
      }
    } else {
      // ── CSV export ───────────────────────────────────────────────────
      const parts: string[] = [];
      selected.forEach(section => {
        const csv = generateSectionCSV(section);
        if (csv) {
          parts.push(`=== ${section.toUpperCase()} ===`);
          parts.push('');
          parts.push(csv);
          parts.push('');
          parts.push('');
        }
      });
      if (parts.length === 0) return;
      const fullCsv = parts.join('\n');
      const blob = new Blob([fullCsv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `resolv_full_report_${deps.timeRange}_${now}.csv`;
      a.click(); URL.revokeObjectURL(url);
    }

    setShowExportModal(false);
  }, [exportSections, exportFormat, generateSectionCSV, generateSectionExcel, deps.timeRange]);

  const exportSavedReport = useCallback(async (id: string, format: string, name: string) => {
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const url = `${apiUrl}/reports/export/${id}?format=${format}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = blobUrl;
      a.download = `${name.replace(/[^a-z0-9]/gi, '_')}.${format === 'pdf' ? 'html' : format}`;
      a.click(); URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error('Export failed:', err);
    }
  }, []);

  return {
    showExportModal, setShowExportModal,
    exportFormat, setExportFormat,
    exportSections, setExportSections,
    toggleExportSection,
    generateSectionCSV,
    generateSectionExcel,
    exportSectionCSV,
    exportSectionExcel,
    exportAllSelected,
    exportSavedReport,
  };
}
