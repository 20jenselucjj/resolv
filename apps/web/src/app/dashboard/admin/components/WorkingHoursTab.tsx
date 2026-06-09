'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, RotateCcw, Save } from 'lucide-react';
import { api } from '@/lib/api';
import type { WorkingHour, WorkingHourAPI } from './types';

export function WorkingHoursTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const [hours, setHours] = useState<WorkingHour[]>([]);
  const [timezone, setTimezone] = useState('America/New_York');
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<{ id: string; name: string; date: string }[]>([]);
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [hoursRes, settingsRes, holidaysRes] = await Promise.all([
        api.get<{ data: WorkingHourAPI[] }>('/admin/working-hours'),
        api.get<{ data: Record<string, string> }>('/admin/settings'),
        api.get<{ data: any[] }>('/admin/holidays')
      ]);
      setHours(hoursRes.data.map(h => ({
        day: h.day,
        enabled: h.enabled,
        start: h.start_time,
        end: h.end_time
      })));
      setTimezone(settingsRes.data.timezone || 'America/New_York');
      setHolidays(holidaysRes.data);
    } catch {
      showAlert('Failed to load working hours', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const TIMEZONES = [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore',
    'Australia/Sydney', 'UTC'
  ];

  const handleSave = async () => {
    try {
      await api.put('/admin/working-hours', {
        timezone,
        hours: hours.map(h => ({
          day: h.day,
          enabled: h.enabled,
          start_time: h.start,
          end_time: h.end
        }))
      });
      showAlert('Working hours saved successfully');
    } catch {
      showAlert('Failed to save working hours', 'error');
    }
  };

  const handleAddHoliday = async () => {
    if (!newHolidayName.trim() || !newHolidayDate) return;
    try {
      await api.post('/admin/holidays', { name: newHolidayName.trim(), date: newHolidayDate });
      showAlert('Holiday added');
      setNewHolidayName('');
      setNewHolidayDate('');
      loadData();
    } catch {
      showAlert('Failed to add holiday', 'error');
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      await api.delete(`/admin/holidays/${id}`);
      loadData();
      showAlert('Holiday removed');
    } catch {
      showAlert('Failed to remove holiday', 'error');
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}><RotateCcw className="spin" size={32} /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Timezone</label>
          <select className="select" value={timezone} onChange={e => setTimezone(e.target.value)} style={{ maxWidth: '300px' }}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {hours.map((h, idx) => (
            <div key={h.day} style={{
              display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px',
              background: h.enabled ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
              opacity: h.enabled ? 1 : 0.6
            }}>
              <div style={{ width: '100px', fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{h.day}</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={h.enabled}
                  onChange={e => setHours(prev => prev.map((d, i) => i === idx ? { ...d, enabled: e.target.checked } : d))}
                  style={{ accentColor: 'var(--accent)', transform: 'scale(1.2)' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{h.enabled ? 'Open' : 'Closed'}</span>
              </label>
              {h.enabled && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="time"
                      value={h.start}
                      onChange={e => setHours(prev => prev.map((d, i) => i === idx ? { ...d, start: e.target.value } : d))}
                      className="input"
                      style={{ width: '120px', height: '32px', fontSize: '13px' }}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>to</span>
                    <input
                      type="time"
                      value={h.end}
                      onChange={e => setHours(prev => prev.map((d, i) => i === idx ? { ...d, end: e.target.value } : d))}
                      className="input"
                      style={{ width: '120px', height: '32px', fontSize: '13px' }}
                    />
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {(() => {
                      const [sh, sm] = h.start.split(':').map(Number);
                      const [eh, em] = h.end.split(':').map(Number);
                      const mins = (eh * 60 + em) - (sh * 60 + sm);
                      return mins > 0 ? `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ''}` : '';
                    })()}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>Holiday Calendar</h4>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-muted)' }}>Add company holidays. SLA timers will pause on these dates.</p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Holiday Name</label>
              <input className="input" value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)} placeholder="e.g. New Year's Day" onKeyDown={e => { if (e.key === 'Enter') handleAddHoliday(); }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Date</label>
              <input type="date" className="input" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleAddHoliday} style={{ height: 36 }}><Plus size={14} style={{ marginRight: 4 }} /> Add</button>
          </div>

          {holidays.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {holidays.map(h => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{h.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  </div>
                  <button onClick={() => handleDeleteHoliday(h.id)} className="btn btn-ghost" style={{ padding: '2px 6px', color: 'var(--danger)', fontSize: 11 }}>Remove</button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px dashed var(--border)', fontSize: 12 }}>No holidays configured</div>
          )}
        </div>

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className="btn btn-ghost" onClick={() => setHours(DAYS.map((day, i) => ({ day, enabled: i < 5, start: '08:00', end: '17:00' })))}>
            <RotateCcw size={14} /> Reset to Default
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={14} /> Save Working Hours
          </button>
        </div>
      </div>
    </div>
  );
}
