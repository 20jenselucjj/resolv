'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { Ticket } from '../types';

export interface CrossFilters {
  [key: string]: string;
}

export interface CrossFilterContextValue {
  crossFilters: CrossFilters;
  setCrossFilter: (key: string, value: string) => void;
  removeCrossFilter: (key: string) => void;
  clearCrossFilters: () => void;
  hasActiveFilters: boolean;
  /** Apply all active cross-filters to a tickets array */
  applyCrossFilters: (tickets: Ticket[]) => Ticket[];
}

const CrossFilterContext = createContext<CrossFilterContextValue>({
  crossFilters: {},
  setCrossFilter: () => {},
  removeCrossFilter: () => {},
  clearCrossFilters: () => {},
  hasActiveFilters: false,
  applyCrossFilters: (t) => t,
});

export function CrossFilterProvider({ children }: { children: React.ReactNode }) {
  const [crossFilters, setCrossFilters] = useState<CrossFilters>({});

  const setCrossFilter = useCallback((key: string, value: string) => {
    setCrossFilters(prev => {
      // Toggle off if same value is already set
      if (prev[key] === value) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const removeCrossFilter = useCallback((key: string) => {
    setCrossFilters(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clearCrossFilters = useCallback(() => {
    setCrossFilters({});
  }, []);

  const hasActiveFilters = Object.keys(crossFilters).length > 0;

  const applyCrossFilters = useCallback((tickets: Ticket[]) => {
    let data = tickets;
    if (crossFilters.status && crossFilters.status !== 'all') {
      data = data.filter(t => t.status === crossFilters.status);
    }
    if (crossFilters.priority && crossFilters.priority !== 'all') {
      data = data.filter(t => t.priority === crossFilters.priority);
    }
    if (crossFilters.category && crossFilters.category !== 'all') {
      data = data.filter(t => (t.category_name || 'Uncategorized') === crossFilters.category);
    }
    if (crossFilters.ticket_type && crossFilters.ticket_type !== 'all') {
      data = data.filter(t => (t.ticket_type || 'incident') === crossFilters.ticket_type);
    }
    if (crossFilters.assignee && crossFilters.assignee !== 'all') {
      data = data.filter(t => (t.assigned_to_name || 'Unassigned') === crossFilters.assignee);
    }
    return data;
  }, [crossFilters]);

  const value = useMemo(() => ({
    crossFilters,
    setCrossFilter,
    removeCrossFilter,
    clearCrossFilters,
    hasActiveFilters,
    applyCrossFilters,
  }), [crossFilters, setCrossFilter, removeCrossFilter, clearCrossFilters, hasActiveFilters, applyCrossFilters]);

  return (
    <CrossFilterContext.Provider value={value}>
      {children}
    </CrossFilterContext.Provider>
  );
}

export function useCrossFilter() {
  return useContext(CrossFilterContext);
}

/** Label helper for cross-filter display chips */
export const CROSS_FILTER_LABELS: Record<string, string> = {
  status: 'Status',
  priority: 'Priority',
  category: 'Category',
  ticket_type: 'Type',
  assignee: 'Assignee',
};
