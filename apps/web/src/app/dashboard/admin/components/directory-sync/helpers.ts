export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '\u2014';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export function formatRelativeTime(dateStr?: string): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDateTime(dateStr);
  } catch {
    return formatDateTime(dateStr);
  }
}

export function formatDuration(seconds?: number): string {
  if (!seconds) return '\u2014';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export function getTokenExpiryInfo(config: { tokenExpiresAt?: string }): {
  expiry: Date;
  hoursLeft: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
} | null {
  if (!config.tokenExpiresAt) return null;
  try {
    const expiry = new Date(config.tokenExpiresAt);
    const now = new Date();
    const hoursLeft = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isExpired = hoursLeft <= 0;
    const isExpiringSoon = hoursLeft > 0 && hoursLeft <= 48;
    return { expiry, hoursLeft, isExpired, isExpiringSoon };
  } catch {
    return null;
  }
}
