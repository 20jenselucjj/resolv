'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';
import type { PinnedMetric } from '../types';

export function usePinboard() {
  const [pins, setPins] = useState<PinnedMetric[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [pinsError, setPinsError] = useState<string | null>(null);
  const [pinnedKeys, setPinnedKeys] = useState<Set<string>>(new Set());

  const fetchPins = useCallback(async () => {
    setPinsLoading(true);
    setPinsError(null);
    try {
      const res = await api.get<{ data: PinnedMetric[] }>('/dashboard/pins');
      const list = res.data || [];
      setPins(list);
      setPinnedKeys(new Set(list.map(p => p.metric_key)));
    } catch (err: any) {
      setPinsError(err.message || 'Failed to load pins');
      toast.error('Failed to fetch pins', err instanceof Error ? err.message : 'Please try again');
    } finally {
      setPinsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPins();
  }, [fetchPins]);

  const pinMetric = useCallback(async (metric: {
    metric_key: string;
    metric_label: string;
    metric_type: 'kpi' | 'chart' | 'table';
    config?: any;
  }) => {
    try {
      const res = await api.post<{ data: PinnedMetric }>('/dashboard/pins', {
        metric_key: metric.metric_key,
        metric_label: metric.metric_label,
        metric_type: metric.metric_type,
        config: metric.config || null,
      });
      setPins(prev => [...prev, res.data]);
      setPinnedKeys(prev => new Set(prev).add(metric.metric_key));
      return res.data;
    } catch (err: any) {
      toast.error('Failed to pin metric', err instanceof Error ? err.message : 'Please try again');
      throw err;
    }
  }, []);

  const unpinMetric = useCallback(async (id: string, metricKey: string) => {
    try {
      await api.delete(`/dashboard/pins/${id}`);
      setPins(prev => prev.filter(p => p.id !== id));
      setPinnedKeys(prev => {
        const next = new Set(prev);
        next.delete(metricKey);
        return next;
      });
    } catch (err: any) {
      toast.error('Failed to unpin metric', err instanceof Error ? err.message : 'Please try again');
      throw err;
    }
  }, []);

  const isPinned = useCallback((metricKey: string) => {
    return pinnedKeys.has(metricKey);
  }, [pinnedKeys]);

  const updatePosition = useCallback(async (id: string, position: number) => {
    try {
      await api.patch(`/dashboard/pins/${id}`, { position });
      setPins(prev => prev.map(p => p.id === id ? { ...p, position } : p));
    } catch (err: any) {
      toast.error('Failed to update pin position', err instanceof Error ? err.message : 'Please try again');
    }
  }, []);

  const updateConfig = useCallback(async (id: string, config: any) => {
    try {
      await api.patch(`/dashboard/pins/${id}`, { config });
      setPins(prev => prev.map(p => p.id === id ? { ...p, config } : p));
    } catch (err: any) {
      toast.error('Failed to update pin config', err instanceof Error ? err.message : 'Please try again');
    }
  }, []);

  const reorderPins = useCallback(async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const reordered = [...pins];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    // Update positions
    const updated = reordered.map((pin, idx) => ({ ...pin, position: idx }));
    setPins(updated);

    // Persist to backend (fire-and-forget)
    updated.forEach(pin => {
      api.patch(`/dashboard/pins/${pin.id}`, { position: pin.position }).catch(() => {});
    });
  }, [pins]);

  return {
    pins,
    pinsLoading,
    pinsError,
    isPinned,
    pinMetric,
    unpinMetric,
    updatePosition,
    updateConfig,
    reorderPins,
    fetchPins,
  };
}
