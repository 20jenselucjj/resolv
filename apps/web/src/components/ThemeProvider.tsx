'use client';

/**
 * ThemeProvider — Dark-only theme wrapper.
 * No toggle, no persistence, no system detection.
 * The CSS is permanently dark via :root variables in globals.css.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
