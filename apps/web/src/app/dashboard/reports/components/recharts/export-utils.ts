'use client';

import { toPng, toSvg } from 'html-to-image';

/**
 * Export a DOM element (containing a Recharts SVG) as a PNG file download.
 */
export async function exportToPng(
  element: HTMLElement | null,
  filename: string = 'chart.png'
): Promise<void> {
  if (!element) return;
  try {
    const dataUrl = await toPng(element, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#ffffff',
    });
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('Failed to export PNG:', err);
  }
}

/**
 * Export a DOM element (containing a Recharts SVG) as an SVG file download.
 */
export async function exportToSvg(
  element: HTMLElement | null,
  filename: string = 'chart.svg'
): Promise<void> {
  if (!element) return;
  try {
    const dataUrl = await toSvg(element, {
      pixelRatio: 1,
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#ffffff',
    });
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('Failed to export SVG:', err);
  }
}

/**
 * Return CSS variable value from the document root.
 */
export function cssVar(name: string, fallback: string = '#000'): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
