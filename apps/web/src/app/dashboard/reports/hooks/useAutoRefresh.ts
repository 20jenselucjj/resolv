'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AutoRefreshInterval } from '../types';

interface UseAutoRefreshOptions {
  /** Function to call on refresh */
  onRefresh: () => void | Promise<void>;
  /** Whether to initially enable auto-refresh */
  initialEnabled?: boolean;
  /** Initial interval in seconds */
  initialInterval?: AutoRefreshInterval;
  /** Ref to the filter/builder form container for detecting user interaction */
  formRef?: React.RefObject<HTMLElement | null>;
}

export function useAutoRefresh({
  onRefresh,
  initialEnabled = false,
  initialInterval = 60,
  formRef,
}: UseAutoRefreshOptions) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [interval, setIntervalState] = useState<AutoRefreshInterval>(initialInterval);
  const [countdown, setCountdown] = useState(initialInterval);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);

  const intervalRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const onRefreshRef = useRef(onRefresh);
  const isPausedRef = useRef(false);

  // Keep ref fresh
  onRefreshRef.current = onRefresh;

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const startTimers = useCallback(() => {
    clearTimers();

    if (!enabled || interval === 0) {
      setIsLive(false);
      return;
    }

    setIsLive(true);
    setCountdown(interval);

    // Countdown timer (tick every second)
    countdownRef.current = window.setInterval(() => {
      setCountdown((prev): 0 | 30 | 60 | 300 => {
        if (prev <= 1) {
          // Time to refresh
          if (!isPausedRef.current) {
            onRefreshRef.current();
          }
          return interval as 0 | 30 | 60 | 300; // Reset countdown
        }
        return (prev - 1) as 0 | 30 | 60 | 300;
      });
    }, 1000);
  }, [enabled, interval, clearTimers]);

  // Start/stop timers when state changes
  useEffect(() => {
    startTimers();
    return clearTimers;
  }, [enabled, interval, startTimers, clearTimers]);

  // Track last updated time whenever refresh occurs
  const refresh = useCallback(() => {
    if (isPausedRef.current) return;
    setLastUpdated(new Date());
    onRefreshRef.current();
  }, []);

  // Handle visibility changes
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        isPausedRef.current = false;
        // Immediate refresh when tab becomes visible
        onRefreshRef.current();
        // Restart timers
        startTimers();
      } else {
        isPausedRef.current = true;
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [startTimers]);

  // Pause when user is interacting with forms
  useEffect(() => {
    if (!formRef?.current) return;

    const formEl = formRef.current;
    const handleFocus = () => { isPausedRef.current = true; };
    const handleBlur = () => { isPausedRef.current = false; };

    formEl.addEventListener('focusin', handleFocus);
    formEl.addEventListener('focusout', handleBlur);

    return () => {
      formEl.removeEventListener('focusin', handleFocus);
      formEl.removeEventListener('focusout', handleBlur);
    };
  }, [formRef]);

  const setEnabledAndReset = useCallback((val: boolean) => {
    setEnabled(val);
    if (!val) {
      setIsLive(false);
      setCountdown(0);
    }
  }, []);

  const setIntervalAndReset = useCallback((val: AutoRefreshInterval) => {
    setIntervalState(val);
    setCountdown(val);
  }, []);

  return {
    enabled,
    setEnabled: setEnabledAndReset,
    interval,
    setInterval: setIntervalAndReset,
    countdown,
    lastUpdated,
    isLive,
    refresh,
  };
}
