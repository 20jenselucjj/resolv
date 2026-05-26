'use client';

import { useEffect, useState, useCallback } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { api } from '@/lib/api';
import type { WorkingHour, WorkingHourAPI } from './types';

export function WorkingHoursTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const [hours, setHours] = useState<WorkingHour[]>([]);
  const [timezone, setTimezone] = useState('America/New_York');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [hoursRes, settingsRes] = await Promise.all([
        api.get<{ data: WorkingHourAPI[] }>('/admin/working-hours'),
        api.get<{ data: Record<string, string> }>('/admin/settings')
      ]);
      setHours(hoursRes.data.map(h => ({
        day: h.day,
        enabled: h.enabled,
        start: h.start_time,
        end: h.end_time
      })));
      setTimezone(settingsRes.data.timezone || 'America/New_York');
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

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}><RotateCcw className="spin" size={32} /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>Working Hours & Operating Times</h3>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
          Define when your support team is available. SLA timers pause outside working hours.
        </p>
      </div>

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
