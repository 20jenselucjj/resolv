'use client';

import { Circle, Clock, Pause, CheckCircle } from 'lucide-react';
import type { Option } from '@/components/SelectSearch';

export const TICKET_TYPES = ['incident', 'service_request', 'problem', 'change'] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const TICKET_TYPE_LABELS: Record<string, string> = {
  incident: 'Incident',
  service_request: 'Service Request',
  problem: 'Problem',
  change: 'Change',
};

// Default status options all ticket types can see
export const DEFAULT_STATUS_OPTIONS: Option[] = [
  { value: 'open',        label: 'Open',        icon: Circle,       color: 'var(--info)' },
  { value: 'in_progress', label: 'In Progress',  icon: Clock,        color: 'var(--warning)' },
  { value: 'waiting',     label: 'Waiting',      icon: Pause,        color: 'var(--text-muted)' },
  { value: 'resolved',    label: 'Resolved',     icon: CheckCircle,  color: 'var(--success)' },
  { value: 'closed',      label: 'Closed',       icon: CheckCircle,  color: 'var(--text-muted)' },
];

// Core status values (not custom)
export const CORE_STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];

/**
 * Filter status options by ticket type based on the admin-configured mapping.
 *
 * @param statuses - The full list of status options to filter
 * @param ticketType - The ticket type to filter for (incident, service_request, etc.)
 * @param typeMap - The admin-configured mapping: { status_value: ['incident', ...] }
 *                  If a status has no entry or an empty array, it's shown for ALL types.
 * @returns Filtered status options
 */
export function filterStatusesByType(
  statuses: Option[],
  ticketType: string | null | undefined,
  typeMap: Record<string, string[]>
): Option[] {
  if (!ticketType || !typeMap || Object.keys(typeMap).length === 0) return statuses;

  return statuses.filter(s => {
    const allowedTypes = typeMap[s.value];
    // No filter = show for all
    if (!allowedTypes || allowedTypes.length === 0) return true;
    return allowedTypes.includes(ticketType);
  });
}

/**
 * Creates a default type map where all statuses apply to all ticket types.
 */
export function getDefaultStatusTypeMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  CORE_STATUSES.forEach(s => { map[s] = [...TICKET_TYPES]; });
  return map;
}
