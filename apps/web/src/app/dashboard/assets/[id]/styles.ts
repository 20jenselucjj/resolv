'use client';

import type { CSSProperties } from 'react';
import { DISPLAY_FONT, BODY_FONT } from '@/lib/asset-detail-types';

export const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: 'var(--bg)',
  fontFamily: BODY_FONT
};

export const headerStyle: CSSProperties = {
  background: 'var(--bg)',
  borderBottom: '1px solid var(--border)',
  position: 'sticky',
  top: 0,
  zIndex: 30
};

export const headerInnerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '16px 24px',
  maxWidth: 1440,
  margin: '0 auto'
};

export const headerLeftStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16
};

export const headerRightStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10
};

export const backButtonStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text-muted)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background 140ms ease'
};

export const assetTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: 'var(--text)',
  letterSpacing: '-0.02em',
  fontFamily: DISPLAY_FONT,
  lineHeight: 1.2
};

export const assetSubtitleStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--text-muted)',
  marginTop: 2
};

export const tabsContainerStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  padding: '0 24px',
  maxWidth: 1440,
  margin: '0 auto',
  overflowX: 'auto',
  scrollbarWidth: 'none'
};

export const tabButtonBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 16px',
  borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
  border: 'none',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'color 140ms ease, background 140ms ease, border-color 140ms ease',
  borderBottomWidth: 2,
  borderBottomStyle: 'solid',
  borderBottomColor: 'transparent',
  marginBottom: -1
};

export const tabButtonActive: CSSProperties = {
  ...tabButtonBase,
  color: 'var(--accent)',
  borderBottomColor: 'var(--accent)',
  background: 'var(--accent-subtle)'
};

export const contentAreaStyle: CSSProperties = {
  display: 'flex',
  gap: 24,
  padding: 24,
  maxWidth: 1440,
  margin: '0 auto'
};

export const mainContentStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  minWidth: 0
};

export const sidebarStyle: CSSProperties = {
  width: 380,
  flexShrink: 0
};

export const spinnerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '80px 24px',
  color: 'var(--text-muted)',
  gap: 12,
  fontSize: 14,
  fontWeight: 600
};

export const errorContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '80px 24px',
  gap: 16
};

export const searchInputStyle: CSSProperties = {
  width: '100%',
  height: 42,
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  padding: '0 12px 0 40px',
  fontSize: 13,
  fontFamily: BODY_FONT,
  outline: 'none',
  boxSizing: 'border-box'
};

export const sectionTitleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--text)',
  fontFamily: DISPLAY_FONT,
  letterSpacing: '-0.01em',
  marginBottom: 16
};

export const grid2Style: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16
};

export const dividerStyle: CSSProperties = {
  height: 1,
  background: 'var(--border)',
  margin: '0'
};
