'use client';
import { VIEWS } from './constants';

export function TicketViewsBar({
  currentView,
  setCurrentView,
  viewCounts,
}: {
  currentView: string;
  setCurrentView: (v: string) => void;
  viewCounts: Record<string, number>;
}) {
  return (
    <div style={{ padding: '20px 24px 0 24px', background: 'var(--bg-secondary)' }}>
      <div style={{ 
        display: 'flex', gap: 6, background: 'var(--bg-tertiary)', 
        padding: 6, borderRadius: 'var(--radius-full)', width: 'fit-content', 
        border: '1px solid var(--border)',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
      }}>
        {VIEWS.map(v => {
          const isActive = currentView === v;
          const count = viewCounts[v];
          return (
            <button
              key={v}
              onClick={() => setCurrentView(v)}
              style={{
                background: isActive ? 'var(--card)' : 'transparent',
                border: 'none',
                boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' : 'none',
                padding: '6px 16px', borderRadius: 'var(--radius-full)',
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--text)' : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex', alignItems: 'center', gap: 8
              }}
              className="ticket-view-tab"
            >
              {v}
              {count > 0 && (
                <span style={{ 
                  fontSize: 10, padding: '1px 6px', 
                  background: isActive ? 'var(--accent)' : 'var(--bg-secondary)', 
                  color: isActive ? '#fff' : 'var(--text-muted)', 
                  borderRadius: '10px', fontWeight: 700,
                  minWidth: 18, textAlign: 'center'
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  );
}
