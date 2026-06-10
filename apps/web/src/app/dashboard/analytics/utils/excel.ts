'use client';

import type { ProblemReportData, ChangeReportData, ApprovalReportData, LicenseReportData } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ExcelSheet {
  name: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  columnWidths?: number[];
}

export interface ExportOptions {
  title?: string;
  subtitle?: string;
  sheetName?: string;
  conditionalFormatting?: boolean;
}

export const EXCEL_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ── Color map for conditional status formatting ─────────────────────────────────

const STATUS_COLOR_MAP: Record<string, string> = {
  open: 'FF3B82F6',
  in_progress: 'FFF59E0B',
  pending: 'FFF59E0B',
  resolved: 'FF10B981',
  closed: 'FF6B7280',
  approved: 'FF10B981',
  denied: 'FFEF4444',
  rejected: 'FFEF4444',
  cancelled: 'FF6B7280',
  draft: 'FF9CA3AF',
  submitted: 'FF3B82F6',
  implemented: 'FF8B5CF6',
  investigating: 'FF3B82F6',
  identified: 'FF8B5CF6',
  compliant: 'FF10B981',
  non_compliant: 'FFEF4444',
  expired: 'FF991B1B',
  warning: 'FFF59E0B',
  low: 'FF10B981',
  medium: 'FFF59E0B',
  high: 'FFF97316',
  critical: 'FFEF4444',
  standard: 'FF10B981',
  normal: 'FF3B82F6',
  emergency: 'FFEF4444',
};

function getStatusColor(value: string): string | null {
  const key = value.toLowerCase().trim();
  return STATUS_COLOR_MAP[key] || null;
}

// ── Workbook creation ──────────────────────────────────────────────────────────

/**
 * Create an ExcelJS Workbook from sheet definitions.
 * Dynamically imports exceljs to avoid bundling issues.
 */
export async function createWorkbook(
  sheets: ExcelSheet[],
  options?: ExportOptions
): Promise<any> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Resolv';
  workbook.created = new Date();

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name.slice(0, 31), {
      pageSetup: { orientation: 'landscape', fitToPage: true },
    });

    let rowOffset = 1;

    // ── Title row ─────────────────────────────────────────────────────────
    if (options?.title) {
      const titleRow = ws.getRow(rowOffset);
      titleRow.getCell(1).value = options.title;
      titleRow.font = { bold: true, size: 14, name: 'Calibri', color: { argb: 'FF1A202C' } };
      ws.mergeCells(rowOffset, 1, rowOffset, sheet.headers.length);
      titleRow.height = 30;
      rowOffset++;
    }

    // ── Subtitle row ──────────────────────────────────────────────────────
    if (options?.subtitle) {
      const subRow = ws.getRow(rowOffset);
      subRow.getCell(1).value = options.subtitle;
      subRow.font = { size: 10, name: 'Calibri', color: { argb: 'FF718096' } };
      ws.mergeCells(rowOffset, 1, rowOffset, sheet.headers.length);
      rowOffset++;
    }

    // ── Spacer between title and headers ──────────────────────────────────
    if (options?.title || options?.subtitle) {
      rowOffset++;
    }

    // ── Header row ────────────────────────────────────────────────────────
    const headerRow = ws.getRow(rowOffset);
    sheet.headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 11, name: 'Calibri', color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3748' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin', color: { argb: 'FF4A5568' } },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
    headerRow.height = 28;
    rowOffset++;

    // ── Data rows ─────────────────────────────────────────────────────────
    const dataStartRow = rowOffset;
    for (const row of sheet.rows) {
      const dataRow = ws.getRow(rowOffset);
      row.forEach((cellVal, ci) => {
        const cell = dataRow.getCell(ci + 1);
        cell.value = cellVal == null ? '' : cellVal;
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        // Number formatting for numeric cells
        if (typeof cellVal === 'number' && !Number.isInteger(cellVal)) {
          cell.numFmt = '#,##0.00';
        } else if (typeof cellVal === 'number' && Number.isInteger(cellVal)) {
          cell.numFmt = '#,##0';
        }
      });
      dataRow.height = 22;
      rowOffset++;
    }
    const dataEndRow = rowOffset - 1;

    // ── Conditional formatting (color-coded status columns) ──────────────
    if (options?.conditionalFormatting !== false) {
      const statusColIndex = sheet.headers.findIndex(
        h => h.toLowerCase() === 'status'
      );
      const priorityColIndex = sheet.headers.findIndex(
        h => h.toLowerCase() === 'priority'
      );
      const complianceColIndex = sheet.headers.findIndex(
        h => h.toLowerCase() === 'compliance'
      );

      for (const colIdx of [statusColIndex, priorityColIndex, complianceColIndex]) {
        if (colIdx < 0) continue;
        const colLetter = String.fromCharCode(65 + colIdx);
        const range = `${colLetter}${dataStartRow}:${colLetter}${dataEndRow}`;

        // Apply cell-level color based on value
        for (let r = dataStartRow; r <= dataEndRow; r++) {
          const cell = ws.getCell(`${colLetter}${r}`);
          const rawVal = cell.value;
          const strVal = typeof rawVal === 'string' ? rawVal : String(rawVal || '');
          const color = getStatusColor(strVal);
          if (color) {
            cell.font = {
              ...cell.font,
              color: { argb: color },
              bold: true,
            };
          }
        }
      }
    }

    // ── Auto-fit column widths ────────────────────────────────────────────
    const colWidths = sheet.columnWidths || autoFitColumnWidths(sheet.headers, sheet.rows);
    colWidths.forEach((width, i) => {
      const col = ws.getColumn(i + 1);
      col.width = Math.min(Math.max(width, 10), 60);
    });

    // ── Freeze header row ─────────────────────────────────────────────────
    ws.views = [{ state: 'frozen', ySplit: dataStartRow - 1 }];
  }

  return workbook;
}

// ── Column width auto-fit ──────────────────────────────────────────────────────

function autoFitColumnWidths(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): number[] {
  return headers.map((header, i) => {
    let maxLen = header.length + 2;
    for (const row of rows) {
      const val = row[i];
      const len = val != null ? String(val).length + 2 : 4;
      if (len > maxLen) maxLen = len;
    }
    return maxLen;
  });
}

// ── Downloads ──────────────────────────────────────────────────────────────────

/**
 * Download an Excel workbook as a file in the browser.
 */
export async function downloadWorkbook(workbook: any, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: EXCEL_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Generate a Blob from a workbook for server-side / scheduled export use.
 */
export async function workbookToBlob(workbook: any): Promise<Blob> {
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: EXCEL_MIME_TYPE });
}

// ── High-level convenience ─────────────────────────────────────────────────────

/**
 * Export data to Excel with a single call.
 * Dynamically imports exceljs, creates workbook, triggers download.
 */
export async function exportToExcel(
  sheets: ExcelSheet[],
  filename: string,
  options?: ExportOptions
): Promise<void> {
  const workbook = await createWorkbook(sheets, options);
  await downloadWorkbook(workbook, filename);
}

// ── Section-specific sheet builders ────────────────────────────────────────────

export function buildProblemsSheet(
  data: ProblemReportData | null
): ExcelSheet | null {
  if (!data) return null;

  const rows: (string | number | null | undefined)[][] = [];

  // KPI summary rows
  rows.push(['Total Problems', data.total]);
  rows.push(['MTTR (hours)', data.mttr_hours > 0 ? parseFloat(data.mttr_hours.toFixed(2)) : 'N/A']);
  rows.push(['Incident Link Rate', `${Math.round(data.incident_link_rate)}%`]);

  // By status
  rows.push([]);
  rows.push(['--- Status Distribution ---']);
  Object.entries(data.by_status).forEach(([key, val]) => {
    rows.push([key.replace(/_/g, ' '), val]);
  });

  // By priority
  rows.push([]);
  rows.push(['--- Priority Distribution ---']);
  Object.entries(data.by_priority).forEach(([key, val]) => {
    rows.push([key, val]);
  });

  // Top root causes
  if (data.top_root_causes.length > 0) {
    rows.push([]);
    rows.push(['--- Top Root Causes ---']);
    rows.push(['Category', 'Count']);
    data.top_root_causes.forEach(r => {
      rows.push([r.category, r.count]);
    });
  }

  // Created trend
  if (data.created_trend.length > 0) {
    rows.push([]);
    rows.push(['--- Problem Creation Trend ---']);
    rows.push(['Date', 'Count']);
    data.created_trend.forEach(t => {
      rows.push([t.date, t.count]);
    });
  }

  return {
    name: 'Problems',
    headers: ['Metric / Category', 'Value / Count'],
    rows,
  };
}

export function buildChangesSheet(
  data: ChangeReportData | null
): ExcelSheet | null {
  if (!data) return null;

  const rows: (string | number | null | undefined)[][] = [];

  rows.push(['Total Changes', data.total]);
  rows.push(['Success Rate', `${Math.round(data.success_rate)}%`]);
  rows.push(['Rollback Rate', `${Math.round(data.rollback_rate)}%`]);
  rows.push(['Avg Implementation (hours)', data.avg_implementation_hours > 0 ? parseFloat(data.avg_implementation_hours.toFixed(2)) : 'N/A']);
  rows.push(['Emergency Count', data.emergency_count]);
  rows.push(['Emergency Rate', `${Math.round(data.emergency_rate)}%`]);
  rows.push(['PIR Completion Rate', `${Math.round(data.pir_completion_rate)}%`]);

  // By status
  rows.push([]);
  rows.push(['--- Status Distribution ---']);
  rows.push(['Status', 'Count', 'Percentage']);
  const statusTotal = Object.values(data.by_status).reduce((a, b) => a + b, 0);
  Object.entries(data.by_status).forEach(([key, val]) => {
    const pct = statusTotal ? Math.round((val / statusTotal) * 100) : 0;
    rows.push([key.replace(/_/g, ' '), val, `${pct}%`]);
  });

  // By type
  rows.push([]);
  rows.push(['--- Type Distribution ---']);
  Object.entries(data.by_type).forEach(([key, val]) => {
    rows.push([key, val]);
  });

  // By risk
  rows.push([]);
  rows.push(['--- Risk Distribution ---']);
  Object.entries(data.by_risk).forEach(([key, val]) => {
    rows.push([key, val]);
  });

  // Trend
  if (data.created_trend.length > 0) {
    rows.push([]);
    rows.push(['--- Change Creation Trend ---']);
    rows.push(['Date', 'Count']);
    data.created_trend.forEach(t => {
      rows.push([t.date, t.count]);
    });
  }

  return {
    name: 'Changes',
    headers: ['Metric / Category', 'Value / Count'],
    rows,
  };
}

export function buildApprovalsSheet(
  data: ApprovalReportData | null
): ExcelSheet | null {
  if (!data) return null;

  const rows: (string | number | null | undefined)[][] = [];

  rows.push(['Total Approvals', data.total]);
  rows.push(['Avg Time to Decide (hours)', data.avg_time_to_decide_hours > 0 ? parseFloat(data.avg_time_to_decide_hours.toFixed(2)) : 'N/A']);
  rows.push(['Approval Rate', `${Math.round(data.approval_rate)}%`]);
  rows.push(['Overdue', data.overdue_count]);

  // By status
  rows.push([]);
  rows.push(['--- Status Distribution ---']);
  const statusTotal = Object.values(data.by_status).reduce((a, b) => a + b, 0);
  Object.entries(data.by_status).forEach(([key, val]) => {
    const pct = statusTotal ? Math.round((val / statusTotal) * 100) : 0;
    rows.push([key.replace(/_/g, ' '), val, `${pct}%`]);
  });

  // By entity type
  rows.push([]);
  rows.push(['--- By Entity Type ---']);
  Object.entries(data.by_entity_type).forEach(([key, val]) => {
    rows.push([key.replace(/_/g, ' '), val]);
  });

  // Trend
  if (data.created_trend.length > 0) {
    rows.push([]);
    rows.push(['--- Approval Request Trend ---']);
    rows.push(['Date', 'Count']);
    data.created_trend.forEach(t => {
      rows.push([t.date, t.count]);
    });
  }

  return {
    name: 'Approvals',
    headers: ['Metric / Category', 'Value / Count'],
    rows,
  };
}

export function buildLicensesSheet(
  data: LicenseReportData | null
): ExcelSheet | null {
  if (!data) return null;

  const rows: (string | number | null | undefined)[][] = [];

  rows.push(['Total Licenses', data.total]);
  rows.push(['Total Cost', data.total_cost]);
  rows.push(['Avg Cost per Seat', data.cost_per_seat_avg]);
  rows.push(['Total Seats', data.total_seats]);
  rows.push(['Used Seats', data.used_seats]);
  rows.push(['Utilization Rate', `${Math.round(data.utilization_rate)}%`]);
  rows.push(['Expiring Soon', data.expiring_soon]);
  rows.push(['Over-allocated', data.over_allocated]);

  // By compliance
  rows.push([]);
  rows.push(['--- Compliance Status ---']);
  const complianceTotal = Object.values(data.by_compliance).reduce((a, b) => a + b, 0);
  Object.entries(data.by_compliance).forEach(([key, val]) => {
    const pct = complianceTotal ? Math.round((val / complianceTotal) * 100) : 0;
    rows.push([key.replace(/_/g, ' '), val, `${pct}%`]);
  });

  // By publisher
  if (data.by_publisher.length > 0) {
    rows.push([]);
    rows.push(['--- Top Publishers ---']);
    rows.push(['Publisher', 'Licenses', 'Total Cost']);
    data.by_publisher
      .sort((a, b) => b.total_cost - a.total_cost)
      .slice(0, 10)
      .forEach(p => {
        rows.push([p.publisher, p.count, p.total_cost]);
      });
  }

  // By type
  rows.push([]);
  rows.push(['--- By Type ---']);
  Object.entries(data.by_type).forEach(([key, val]) => {
    rows.push([key.replace(/_/g, ' '), val]);
  });

  return {
    name: 'Licenses',
    headers: ['Metric / Category', 'Value / Count'],
    rows,
  };
}
