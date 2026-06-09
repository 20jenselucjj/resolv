'use client';

import { useEffect } from 'react';

export function PWARegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silent fail — PWA is optional
      });
    }
  }, []);

  return null;
}
