'use client';

import { useReportWebVitals } from 'next/web-vitals';

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    console.log('Web Vitals:', metric);

    // Optional: send to backend analytics endpoint
    // Uncomment when an analytics endpoint exists:
    // const body = JSON.stringify(metric);
    // if (navigator.sendBeacon) {
    //   navigator.sendBeacon('/api/analytics/web-vitals', body);
    // } else {
    //   fetch('/api/analytics/web-vitals', { method: 'POST', body, keepalive: true }).catch(() => {});
    // }
  });

  return null;
}
