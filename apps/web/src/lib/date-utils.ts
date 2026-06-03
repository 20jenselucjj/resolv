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

export function formatDateTimeSeconds(value?: string | null): string {
  if (!value) return '\u2014';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '\u2014';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZone: getTimezone(),
  });
}

export function timeAgo(value?: string | null): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}
