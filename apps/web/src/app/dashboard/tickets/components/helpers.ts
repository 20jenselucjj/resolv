'use client';

export function getDueDateColor(dateStr?: string) {
  if (!dateStr) return 'var(--text-muted)';
  const due = new Date(dateStr);
  const now = new Date();
  const isToday = due.toDateString() === now.toDateString();
  const isOverdue = due < now && !isToday;
  if (isOverdue) return 'var(--danger)';
  if (isToday) return 'var(--warning)';
  return 'var(--text-secondary)';
}

export function timeAgo(dateStr: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}