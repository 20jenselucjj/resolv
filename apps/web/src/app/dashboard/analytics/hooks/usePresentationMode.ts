'use client';

import { useState, useCallback, useEffect } from 'react';

export function usePresentationMode() {
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  const togglePresentationMode = useCallback(() => {
    setIsPresentationMode(prev => !prev);
  }, []);

  const exitPresentationMode = useCallback(() => {
    setIsPresentationMode(false);
  }, []);

  // Fullscreen API integration
  useEffect(() => {
    if (isPresentationMode) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  }, [isPresentationMode]);

  // Exit presentation mode when user exits fullscreen via browser UI
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsPresentationMode(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return {
    isPresentationMode,
    togglePresentationMode,
    exitPresentationMode,
  };
}
