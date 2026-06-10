'use client';

import { useState, useCallback, useMemo } from 'react';
import type { Ticket, DrillDownLevel, DrillDownState } from '../types';

interface UseDrillDownOptions {
  /** All available tickets (unfiltered) */
  allTickets: Ticket[];
}

export function useDrillDown({ allTickets }: UseDrillDownOptions) {
  const [levels, setLevels] = useState<DrillDownLevel[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Compute tickets that match the current drill-down path
  const tickets = useMemo(() => {
    if (levels.length === 0) return [];
    return allTickets.filter(t => {
      return levels.every(level => {
        switch (level.filterKey) {
          case 'status':
            return t.status === level.filterValue;
          case 'priority':
            return t.priority === level.filterValue;
          case 'ticket_type':
            return (t.ticket_type || 'incident') === level.filterValue;
          case 'category':
            return (t.category_name || 'Uncategorized') === level.filterValue;
          case 'assignee':
            return (t.assigned_to_id || 'unassigned') === level.filterValue;
          default:
            return true;
        }
      });
    });
  }, [allTickets, levels]);

  /** Open the drill-down modal at a given level */
  const drillTo = useCallback((level: DrillDownLevel) => {
    setLevels(prev => [...prev, level]);
    setIsOpen(true);
  }, []);

  /** Navigate up one level (pop breadcrumb) */
  const drillUp = useCallback(() => {
    setLevels(prev => {
      const next = prev.slice(0, -1);
      if (next.length === 0) {
        setIsOpen(false);
      }
      return next;
    });
  }, []);

  /** Reset drill-down entirely */
  const resetDrillDown = useCallback(() => {
    setLevels([]);
    setIsOpen(false);
    setLoading(false);
  }, []);

  /** Close the modal (without resetting path) */
  const closeDrillDown = useCallback(() => {
    setIsOpen(false);
  }, []);

  const state: DrillDownState = {
    levels,
    isOpen,
    tickets,
    loading,
  };

  return {
    drillDownState: state,
    drillTo,
    drillUp,
    resetDrillDown,
    closeDrillDown,
    setDrillDownLoading: setLoading,
  };
}
