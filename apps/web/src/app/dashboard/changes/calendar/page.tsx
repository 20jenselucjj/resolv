'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { ChevronLeft, ChevronRight, ArrowLeft, AlertCircle } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  submitted: '#7c3aed',
  under_review: '#f59e0b',
  approved: '#059669',
  scheduled: '#2563eb',
  in_progress: '#f59e0b',
  completed: '#059669',
  rejected: '#dc2626',
  rolled_back: '#dc2626',
  cancelled: '#6b7280',
};

const RISK_COLORS: Record<string, string> = {
  low: '#059669',
  medium: '#2563eb',
  high: '#f59e0b',
  critical: '#dc2626',
};

interface CalendarChange {
  id: string;
  number: number;
  title: string;
  status: string;
  change_type: string;
  risk_level: string;
  priority: string;
  scheduled_start: string;
  scheduled_end: string;
  assigned_to_name: string | null;
}

export default function ChangeCalendarPage() {
  const router = useRouter();
  const { user } = useStore();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [changes, setChanges] = useState<CalendarChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedDayChanges, setSelectedDayChanges] = useState<CalendarChange[]>([]);

  const isAdminOrAgent = user?.role === 'admin' || user?.role === 'agent';

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(year, month, 1 - firstDay.getDay());
  const endDate = new Date(year, month + 1, 6 - lastDay.getDay());

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const fetchCalendarChanges = useCallback(async () => {
    setLoading(true);
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];
    try {
      const res = await api.get<{ data: CalendarChange[] }>(`/changes/calendar?start=${start}&end=${end}`);
      setChanges(res.data);
    } catch (err) {
      console.error('Failed to load calendar changes', err);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    if (isAdminOrAgent) fetchCalendarChanges();
  }, [fetchCalendarChanges, isAdminOrAgent]);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
    setSelectedDayChanges([]);
  };
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
    setSelectedDayChanges([]);
  };

  const getChangesForDay = (day: number) => {
    const dateStr = new Date(year, month, day).toISOString().split('T')[0];
    return changes.filter(c => {
      const start = c.scheduled_start ? c.scheduled_start.split('T')[0] : '';
      const end = c.scheduled_end ? c.scheduled_end.split('T')[0] : '';
      return start <= dateStr && end >= dateStr;
    });
  };

  const handleDayClick = (day: number) => {
    const dayChanges = getChangesForDay(day);
    setSelectedDay(day);
    setSelectedDayChanges(dayChanges);
  };

  const weeks: Date[][] = [];
  let current = new Date(startDate);
  while (current <= endDate) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  if (!isAdminOrAgent) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <AlertCircle size={32} color="var(--danger)" style={{ margin: '0 auto 12px', display: 'block' }} />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Access Denied</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card)', flexShrink: 0 }}>
        <button onClick={() => router.push('/dashboard/changes')} className="btn btn-ghost btn-icon" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Change Calendar</h1>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevMonth} className="btn btn-ghost btn-icon"><ChevronLeft size={18} /></button>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', minWidth: 180, textAlign: 'center' }}>
            {monthNames[month]} {year}
          </span>
          <button onClick={nextMonth} className="btn btn-ghost btn-icon"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Calendar grid */}
        <div style={{ flex: 2, padding: 24, overflow: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: '#64748b' }}>
              Loading calendar...
            </div>
          ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 2,
            background: 'var(--border)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}>
            {/* Day headers */}
            {dayNames.map(d => (
              <div key={d} style={{
                background: 'var(--bg-secondary)',
                padding: '10px 8px',
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {d}
              </div>
            ))}

            {/* Day cells */}
            {weeks.flat().map((date, idx) => {
              const day = date.getDate();
              const isCurrentMonth = date.getMonth() === month;
              const isToday = date.toDateString() === new Date().toDateString();
              const dayChanges = getChangesForDay(day);
              const isSelected = selectedDay === day && isCurrentMonth;

              return (
                <div
                  key={idx}
                  onClick={() => isCurrentMonth && handleDayClick(day)}
                  style={{
                    minHeight: 100,
                    background: isSelected ? 'var(--accent-subtle)' : isCurrentMonth ? 'var(--card)' : 'var(--bg-secondary)',
                    padding: 6,
                    cursor: isCurrentMonth ? 'pointer' : 'default',
                    borderRight: idx % 7 === 6 ? 'none' : undefined,
                    transition: 'background 0.15s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => { if (isCurrentMonth && !isSelected) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                  onMouseLeave={e => { if (isCurrentMonth && !isSelected) e.currentTarget.style.background = 'var(--card)'; if (!isCurrentMonth) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                >
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    fontSize: 12,
                    fontWeight: isToday ? 700 : 500,
                  color: isToday ? 'white' : (isCurrentMonth ? 'var(--text)' : 'var(--text-muted)'),
                  background: isToday ? 'var(--accent)' : 'transparent',
                    marginBottom: 4,
                  }}>
                    {day}
                  </div>
                  {dayChanges.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1px 6px',
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 600,
                        background: 'var(--accent-subtle)',
                        color: 'var(--accent)',
                      }}>
                        {dayChanges.length} change{dayChanges.length !== 1 ? 's' : ''}
                      </span>
                      {dayChanges.slice(0, 2).map(c => (
                        <span key={c.id} style={{
                          display: 'block',
                          padding: '1px 4px',
                          borderRadius: 4,
                          fontSize: 9,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          background: `${RISK_COLORS[c.risk_level] || '#6b7280'}20`,
                          color: RISK_COLORS[c.risk_level] || '#6b7280',
                        }}>
                          #{c.number}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* Day detail panel */}
        <div style={{ flex: 1, borderLeft: '1px solid var(--border)', overflow: 'auto', background: 'var(--bg-secondary)' }}>
          <div style={{ padding: 20 }}>
            {selectedDay === null ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
                Click a day to see scheduled changes
              </div>
            ) : (
              <>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 16px' }}>
                  {monthNames[month]} {selectedDay}, {year}
                </h3>
                {selectedDayChanges.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No changes scheduled for this day.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedDayChanges.map(c => (
                      <div key={c.id} onClick={() => router.push(`/dashboard/changes/${c.id}`)}
                        style={{
                          padding: 12,
                          background: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          transition: 'box-shadow 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>#{c.number}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 6,
                            background: `${STATUS_COLORS[c.status]}15`, color: STATUS_COLORS[c.status],
                          }}>
                            {c.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.title}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 6,
                            background: `${RISK_COLORS[c.risk_level]}15`, color: RISK_COLORS[c.risk_level],
                          }}>
                            {c.risk_level}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            {c.assigned_to_name || 'Unassigned'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
