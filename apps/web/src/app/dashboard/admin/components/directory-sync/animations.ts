'use client';

export const STYLE_ID = 'directory-sync-animations';

export function ensureAnimations() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes ds-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    @keyframes ds-shimmer {
      0% { background-position: -400px 0; }
      100% { background-position: 400px 0; }
    }
    @keyframes ds-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes ds-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .ds-skeleton {
      background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--border-subtle) 50%, var(--bg-tertiary) 75%);
      background-size: 800px 100%;
      animation: ds-shimmer 1.5s ease-in-out infinite;
      border-radius: var(--radius-md);
    }
    .ds-fade-in { animation: ds-fade-in 0.3s ease-out both; }
    .ds-spin { animation: ds-spin 1s linear infinite; }
  `;
  document.head.appendChild(style);
}