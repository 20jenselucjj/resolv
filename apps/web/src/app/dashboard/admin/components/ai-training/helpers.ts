'use client';

export const getClassificationStyles = (classification: string) => {
  const map: Record<string, { bg: string, text: string, border: string }> = {
    unclassified: { bg: 'var(--bg-tertiary)', text: 'var(--text-secondary)', border: 'var(--border)' },
    sensitive: { bg: 'var(--warning-bg)', text: 'var(--warning)', border: 'var(--warning-border)' },
    confidential: { bg: 'rgba(249, 115, 22, 0.1)', text: '#f97316', border: 'rgba(249, 115, 22, 0.2)' },
    secret: { bg: 'var(--danger-bg)', text: 'var(--danger)', border: 'var(--danger-border)' },
  };
  return map[classification.toLowerCase()] || map.unclassified;
};

export const getStatusStyles = (status: string) => {
  const map: Record<string, { bg: string, text: string, border: string }> = {
    pending: { bg: 'var(--bg-tertiary)', text: 'var(--text-muted)', border: 'var(--border)' },
    processing: { bg: 'var(--accent-subtle)', text: 'var(--accent)', border: 'var(--accent-border)' },
    ready: { bg: 'var(--success-bg)', text: 'var(--success)', border: 'var(--success-border)' },
    error: { bg: 'var(--danger-bg)', text: 'var(--danger)', border: 'var(--danger-border)' },
  };
  return map[status.toLowerCase()] || map.pending;
};

export const getSourceTypeStyles = (type: string) => {
  const map: Record<string, { bg: string, text: string, border: string }> = {
    file: { bg: 'rgba(147, 51, 234, 0.1)', text: '#9333ea', border: 'rgba(147, 51, 234, 0.2)' },
    url: { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.2)' },
    manual: { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', border: 'rgba(16, 185, 129, 0.2)' },
    kb_sync: { bg: 'rgba(79, 70, 229, 0.1)', text: '#4f46e5', border: 'rgba(79, 70, 229, 0.2)' },
    ticket_sync: { bg: 'rgba(234, 88, 12, 0.1)', text: '#ea580c', border: 'rgba(234, 88, 12, 0.2)' },
  };
  return map[type.toLowerCase()] || map.manual;
};