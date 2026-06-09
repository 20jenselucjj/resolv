'use client';

import { Plus, Play, Trash2, Clock as ClockIcon, Activity, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { ReportSchedule, SavedReport } from '../types';

interface SchedulerStatus {
  is_running: boolean;
  last_check_at: string | null;
  next_run_at: string | null;
  active_schedules_count: number;
  recent_executions: {
    id: string;
    report_name: string | null;
    status: string;
    format: string;
    created_at: string;
    completed_at: string | null;
    error_message: string | null;
  }[];
}

interface SchedulesTabProps {
  reportSchedules: ReportSchedule[];
  savedReports: SavedReport[];
  schedulerStatus: SchedulerStatus | null;
  showScheduleForm: boolean;
  scheduleForm: {
    report_id: string;
    frequency: string;
    day_of_week: number;
    day_of_month: number;
    hour: number;
    recipients: string;
    format: string;
  };
  onToggleForm: (show: boolean) => void;
  onUpdateForm: (field: string, value: any) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRunNow: (id: string) => void;
}

export default function SchedulesTab({
  reportSchedules, savedReports, schedulerStatus, showScheduleForm, scheduleForm,
  onToggleForm, onUpdateForm, onCreate, onDelete, onRunNow,
}: SchedulesTabProps) {
  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Scheduler Status Card */}
      {schedulerStatus && (
        <div className="rp-card card" style={{ padding: 20, borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Activity size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Scheduler Status</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {schedulerStatus.is_running ? (
                <Loader2 size={14} className="animate-spin" style={{ color: 'var(--success)' }} />
              ) : (
                <CheckCircle2 size={14} style={{ color: 'var(--text-muted)' }} />
              )}
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>DAEMON</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: schedulerStatus.is_running ? 'var(--success)' : 'var(--text-muted)' }}>
                  {schedulerStatus.is_running ? 'Running' : 'Idle'}
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>ACTIVE SCHEDULES</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{schedulerStatus.active_schedules_count}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>LAST CHECK</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                {schedulerStatus.last_check_at ? new Date(schedulerStatus.last_check_at).toLocaleTimeString() : 'Never'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>NEXT RUN</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                {schedulerStatus.next_run_at ? new Date(schedulerStatus.next_run_at).toLocaleString() : 'None scheduled'}
              </div>
            </div>
          </div>
          {schedulerStatus.recent_executions.length > 0 && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>RECENT EXECUTIONS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {schedulerStatus.recent_executions.slice(0, 5).map(exec => (
                  <div key={exec.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                    {exec.status === 'completed' ? (
                      <CheckCircle2 size={12} style={{ color: 'var(--success)', flexShrink: 0 }} />
                    ) : exec.status === 'failed' ? (
                      <XCircle size={12} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                    ) : (
                      <Loader2 size={12} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                    )}
                    <span style={{ color: 'var(--text)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {exec.report_name || 'Unknown report'}
                    </span>
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                      {new Date(exec.created_at).toLocaleString()}
                    </span>
                    <span style={{
                      padding: '1px 6px', borderRadius: 6, fontSize: 9, fontWeight: 600, flexShrink: 0,
                      background: exec.status === 'completed' ? 'var(--success-bg)' : exec.status === 'failed' ? 'var(--danger-bg, rgba(239,68,68,0.1))' : 'var(--warning-bg, rgba(245,158,11,0.1))',
                      color: exec.status === 'completed' ? 'var(--success)' : exec.status === 'failed' ? 'var(--danger)' : 'var(--warning)',
                    }}>{exec.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {reportSchedules.length} schedule{reportSchedules.length !== 1 ? 's' : ''}
        </div>
        <button onClick={() => onToggleForm(true)} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> New Schedule
        </button>
      </div>

      {/* Create Schedule Form */}
      {showScheduleForm && (
        <div className="rp-card card" style={{ padding: 20, borderRadius: 14, border: '1px solid var(--accent-border)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Create Schedule</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Saved Report</div>
              <select className="select" value={scheduleForm.report_id} onChange={e => onUpdateForm('report_id', e.target.value)}
                style={{ width: '100%', fontSize: 12 }}>
                <option value="">Select a report...</option>
                {savedReports.map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({r.report_type.replace(/_/g, ' ')})</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Frequency</div>
              <select className="select" value={scheduleForm.frequency} onChange={e => onUpdateForm('frequency', e.target.value)}
                style={{ width: '100%', fontSize: 12 }}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            {scheduleForm.frequency === 'weekly' && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Day of Week</div>
                <select className="select" value={scheduleForm.day_of_week} onChange={e => onUpdateForm('day_of_week', parseInt(e.target.value))}
                  style={{ width: '100%', fontSize: 12 }}>
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </div>
            )}
            {scheduleForm.frequency === 'monthly' && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Day of Month</div>
                <select className="select" value={scheduleForm.day_of_month} onChange={e => onUpdateForm('day_of_month', parseInt(e.target.value))}
                  style={{ width: '100%', fontSize: 12 }}>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Hour</div>
              <select className="select" value={scheduleForm.hour} onChange={e => onUpdateForm('hour', parseInt(e.target.value))}
                style={{ width: '100%', fontSize: 12 }}>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Format</div>
              <select className="select" value={scheduleForm.format} onChange={e => onUpdateForm('format', e.target.value)}
                style={{ width: '100%', fontSize: 12 }}>
                <option value="email">Email</option>
                <option value="csv">CSV</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Recipients (comma-separated emails)</div>
              <input className="input" placeholder="admin@example.com, team@example.com" value={scheduleForm.recipients}
                onChange={e => onUpdateForm('recipients', e.target.value)}
                style={{ width: '100%', fontSize: 12 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            <button onClick={() => onToggleForm(false)} className="btn btn-ghost btn-sm">Cancel</button>
            <button onClick={onCreate} disabled={!scheduleForm.report_id || !scheduleForm.recipients.trim()} className="btn btn-primary btn-sm">
              Create Schedule
            </button>
          </div>
        </div>
      )}

      {/* Schedule List */}
      {reportSchedules.length === 0 && !showScheduleForm ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          <ClockIcon size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>No scheduled reports</div>
          <div style={{ fontSize: 12 }}>Create a schedule to automatically deliver reports via email.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reportSchedules.map(schedule => (
            <div key={schedule.id} className="rp-card card" style={{
              padding: '16px 20px', borderRadius: 14, border: '1px solid var(--border)',
              opacity: schedule.is_active ? 1 : 0.5,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{schedule.report_name}</span>
                    <span style={{
                      padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                      background: schedule.is_active ? 'var(--success-bg)' : 'var(--bg-tertiary)',
                      color: schedule.is_active ? 'var(--success)' : 'var(--text-muted)',
                    }}>{schedule.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>{schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1)} at {schedule.hour.toString().padStart(2, '0')}:00</span>
                    <span>Format: {schedule.format.toUpperCase()}</span>
                    <span>Next: {schedule.next_run_at ? new Date(schedule.next_run_at).toLocaleDateString() : 'Not scheduled'}</span>
                    <span>Recipients: {schedule.recipients?.length || 0}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => onRunNow(schedule.id)} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Play size={11} /> Run Now
                  </button>
                  <button onClick={() => { if (confirm('Delete this schedule?')) onDelete(schedule.id); }}
                    className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--danger)' }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
