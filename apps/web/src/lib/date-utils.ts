// ─── Timezone-aware date formatting ────────────────────────────────────────
// Reads the user's chosen timezone from localStorage (set via settings page)
// and applies it to all displayed dates. Falls back to browser default.

function getTimezone(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem('resolv_timezone') || undefined;
}

export function formatDate(value?: string | null): string {
  if (!value) return '\u2014';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '\u2014';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: getTimezone(),
  });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '\u2014';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '\u2014';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: getTimezone(),
  });
}