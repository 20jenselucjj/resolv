'use client';

/**
 * Escape a string for CSV (wrap in quotes, escape inner quotes).
 */
export function csvEscape(val: string | number | null | undefined): string {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate CSV content from headers and rows.
 */
export function generateCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerLine = headers.map(h => csvEscape(h)).join(',');
  const dataLines = rows.map(row => row.map(cell => csvEscape(cell)).join(','));
  return [headerLine, ...dataLines].join('\n');
}

/**
 * Download a CSV string as a file.
 */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Create a CSV Blob URL for programmatic use.
 */
export function createCSVUrl(csv: string): string {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  return URL.createObjectURL(blob);
}
