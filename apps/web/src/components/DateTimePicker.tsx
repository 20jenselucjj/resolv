'use client';
import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon, X } from 'lucide-react';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface DateTimePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
}

export function DateTimePicker({ value, onChange, placeholder = 'Select date & time...' }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => value ? new Date(value) : new Date());
  const [selectedTime, setSelectedTime] = useState(() => {
    if (value) {
      const d = new Date(value);
      return { hours: d.getHours(), minutes: d.getMinutes() };
    }
    return { hours: 9, minutes: 0 };
  });
  const [tab, setTab] = useState<'calendar' | 'time'>('calendar');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const calcPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight = 420;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < menuHeight ? rect.top - menuHeight - 4 : rect.bottom + 4;
    const left = Math.max(4, Math.min(rect.left, window.innerWidth - 320 - 4));
    setMenuPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (open) calcPos();
  }, [open, calcPos]);

  useLayoutEffect(() => {
    if (!open) return;
    const onScroll = () => calcPos();
    const onResize = () => calcPos();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, calcPos]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      queueMicrotask(() => {
        setViewDate(d);
        setSelectedTime({ hours: d.getHours(), minutes: d.getMinutes() });
      });
    }
  }, [value]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarDays: { day: number; current: boolean; date: Date }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarDays.push({ day: daysInPrevMonth - i, current: false, date: new Date(year, month - 1, daysInPrevMonth - i) });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({ day: i, current: true, date: new Date(year, month, i) });
  }
  const remaining = 42 - calendarDays.length;
  for (let i = 1; i <= remaining; i++) {
    calendarDays.push({ day: i, current: false, date: new Date(year, month + 1, i) });
  }

  const today = new Date();
  const isToday = (d: Date) => d.toDateString() === today.toDateString();
  const isSelected = (d: Date) => value && d.toDateString() === new Date(value).toDateString();

  function handleSelectDay(d: Date) {
    const newDate = new Date(d);
    newDate.setHours(selectedTime.hours, selectedTime.minutes);
    onChange(newDate.toISOString());
  }

  function handleClear() {
    onChange(null);
    setOpen(false);
  }

  function handleApply() {
    if (value) {
      const d = new Date(value);
      d.setHours(selectedTime.hours, selectedTime.minutes);
      onChange(d.toISOString());
    }
    setOpen(false);
  }

  function handlePreset(label: string) {
    const now = new Date();
    let d: Date;
    switch (label) {
      case 'Now': d = new Date(); break;
      case 'Today 5PM': d = new Date(); d.setHours(17, 0, 0, 0); break;
      case 'Tomorrow': d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); break;
      case 'Next Week': d = new Date(); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); break;
      case 'End of Month': d = new Date(); d.setMonth(d.getMonth() + 1, 0); d.setHours(17, 0, 0, 0); break;
      default: d = new Date();
    }
    setSelectedTime({ hours: d.getHours(), minutes: d.getMinutes() });
    setViewDate(d);
    onChange(d.toISOString());
    setOpen(false);
  }

  const presets = ['Now', 'Today 5PM', 'Tomorrow', 'Next Week', 'End of Month'];

  const displayValue = value ? (() => {
    const d = new Date(value);
    const now = new Date();
    const isTodayDate = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();

    let dateStr: string;
    if (isTodayDate) dateStr = 'Today';
    else if (isTomorrow) dateStr = 'Tomorrow';
    else dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });

    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${dateStr} at ${timeStr}`;
  })() : '';

  const menu = open ? createPortal(
    <div ref={menuRef} style={{
      position: 'fixed',
      top: menuPos.top,
      left: menuPos.left,
      width: 320,
      zIndex: 999999,
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
      overflow: 'hidden',
    }}>
      {/* Presets */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {presets.map(p => (
          <button
            key={p}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handlePreset(p); }}
            style={{
              padding: '4px 10px', fontSize: 11, fontWeight: 600,
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-full)', cursor: 'pointer',
              color: 'var(--text-secondary)', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-subtle)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        <button
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setTab('calendar'); }}
          style={{
            flex: 1, padding: '10px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: tab === 'calendar' ? 600 : 500,
            color: tab === 'calendar' ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: `2px solid ${tab === 'calendar' ? 'var(--accent)' : 'transparent'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <CalendarIcon size={14} /> Date
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setTab('time'); }}
          style={{
            flex: 1, padding: '10px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: tab === 'time' ? 600 : 500,
            color: tab === 'time' ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: `2px solid ${tab === 'time' ? 'var(--accent)' : 'transparent'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <Clock size={14} /> Time
        </button>
      </div>

      {tab === 'calendar' ? (
        <div style={{ padding: '12px' }}>
          {/* Month/Year nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setViewDate(new Date(year, month - 1, 1)); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex', borderRadius: 4 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              {MONTHS[month]} {year}
            </span>
            <button
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setViewDate(new Date(year, month + 1, 1)); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex', borderRadius: 4 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          {/* Days */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {calendarDays.map((d, i) => {
              const selected = isSelected(d.date);
              const todayDate = isToday(d.date);
              return (
                <button
                  key={i}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); if (d.current) handleSelectDay(d.date); }}
                  style={{
                    width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: selected ? 700 : 500,
                    color: !d.current ? 'var(--text-muted)' : selected ? '#fff' : todayDate ? 'var(--accent)' : 'var(--text)',
                    background: selected ? 'var(--accent)' : todayDate ? 'var(--accent-subtle)' : 'transparent',
                    border: 'none', borderRadius: 'var(--radius-sm)', cursor: d.current ? 'pointer' : 'default',
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={e => { if (d.current && !selected) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                  onMouseLeave={e => { if (!selected) e.currentTarget.style.background = todayDate ? 'var(--accent-subtle)' : 'transparent'; }}
                >
                  {d.day}
                </button>
              );
            })}
          </div>

          {/* Today button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleSelectDay(new Date()); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--accent)', padding: '4px 8px' }}
            >
              Today
            </button>
          </div>
        </div>
      ) : (
        /* Time picker */
        <div style={{ padding: '24px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {/* Hours */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedTime(t => ({ ...t, hours: (t.hours + 1) % 24 })); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
              >
                <ChevronLeft size={20} style={{ transform: 'rotate(-90deg)' }} />
              </button>
              <div style={{
                width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 700, color: 'var(--text)',
                background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
              }}>
                {String(selectedTime.hours).padStart(2, '0')}
              </div>
              <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedTime(t => ({ ...t, hours: (t.hours - 1 + 24) % 24 })); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
              >
                <ChevronLeft size={20} style={{ transform: 'rotate(90deg)' }} />
              </button>
            </div>

            <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-muted)' }}>:</span>

            {/* Minutes */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedTime(t => ({ ...t, minutes: (t.minutes + 5) % 60 })); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
              >
                <ChevronLeft size={20} style={{ transform: 'rotate(-90deg)' }} />
              </button>
              <div style={{
                width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 700, color: 'var(--text)',
                background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
              }}>
                {String(selectedTime.minutes).padStart(2, '0')}
              </div>
              <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedTime(t => ({ ...t, minutes: (t.minutes - 5 + 60) % 60 })); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
              >
                <ChevronLeft size={20} style={{ transform: 'rotate(90deg)' }} />
              </button>
            </div>
          </div>

          {/* Quick time presets */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
            {[
              { label: '9:00 AM', h: 9, m: 0 },
              { label: '12:00 PM', h: 12, m: 0 },
              { label: '5:00 PM', h: 17, m: 0 },
              { label: 'EOD', h: 17, m: 0 },
            ].map(t => (
              <button
                key={t.label}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedTime({ hours: t.h, minutes: t.m }); }}
                style={{
                  padding: '6px 12px', fontSize: 12, fontWeight: 600,
                  background: selectedTime.hours === t.h && selectedTime.minutes === t.m ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                  border: `1px solid ${selectedTime.hours === t.h && selectedTime.minutes === t.m ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  color: selectedTime.hours === t.h && selectedTime.minutes === t.m ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <button
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleClear(); }}
          style={{
            padding: '6px 16px', fontSize: 13, fontWeight: 500,
            background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            cursor: 'pointer', color: 'var(--text-secondary)',
          }}
        >
          Clear
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleApply(); }}
          style={{
            padding: '6px 16px', fontSize: 13, fontWeight: 600,
            background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)',
            cursor: 'pointer', color: '#fff',
          }}
        >
          Apply
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 4px',
          background: 'transparent',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          fontSize: 13,
          color: displayValue ? 'var(--text)' : 'var(--text-muted)',
          cursor: 'pointer',
          minHeight: 28,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'transparent'; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
          {displayValue || placeholder}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {value && (
            <span
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleClear(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--text-muted)' }}
            >
              <X size={12} />
            </span>
          )}
          <CalendarIcon size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
        </div>
      </button>
      {menu}
    </>
  );
}
