'use client';

import { CardSection, MiniTable } from './Charts';
import { ScorecardWidget } from './recharts';
import { BarChart2, Users, ThumbsUp, Ticket, UserPlus } from 'lucide-react';

interface PortalReportProps {
  totalUsers: number;
  userRegistrations30d: number;
  totalTickets: number;
  serviceRequestCount: number;
  csatAvg?: number;
  csatCount?: number;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

function pinProps(key: string, label: string, isPinnedFn?: (k: string) => boolean, pinFn?: (k: string, l: string, t?: string) => void, unpinFn?: (k: string) => void) {
  return (isPinnedFn && pinFn && unpinFn) ? {
    metricKey: key, metricLabel: label,
    isPinned: isPinnedFn(key),
    onPin: () => pinFn(key, label, 'kpi'),
    onUnpin: () => unpinFn(key),
  } : {};
}

export default function PortalReports({ totalUsers, userRegistrations30d, totalTickets, serviceRequestCount, csatAvg, csatCount, isMetricPinned, handlePin, handleUnpin }: PortalReportProps) {
  const selfServicePct = totalTickets ? Math.round((serviceRequestCount / totalTickets) * 100) : 0;

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <ScorecardWidget
          label="Total Users"
          value={totalUsers}
          icon={Users}
          iconColor="var(--accent)"
          iconBg="var(--accent-subtle)"
          accentColor="var(--accent)"
          change={{
            value: userRegistrations30d,
            label: 'new in 30d',
            isPositive: userRegistrations30d > 0,
          }}
          {...pinProps('portal_total_users', 'Total Users', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Service Requests"
          value={serviceRequestCount}
          icon={Ticket}
          iconColor="var(--info)"
          iconBg="var(--info-bg)"
          accentColor="var(--info)"
          {...pinProps('portal_service_requests', 'Service Requests', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="CSAT Score"
          value={csatAvg ? `${csatAvg.toFixed(1)} / 5` : 'N/A'}
          icon={ThumbsUp}
          iconColor={csatAvg && csatAvg >= 4 ? 'var(--success)' : csatAvg && csatAvg >= 3 ? 'var(--warning)' : 'var(--text)'}
          iconBg={csatAvg && csatAvg >= 4 ? 'var(--success-bg)' : csatAvg && csatAvg >= 3 ? 'var(--warning-bg)' : 'var(--bg-tertiary)'}
          accentColor={csatAvg && csatAvg >= 4 ? 'var(--success)' : csatAvg && csatAvg >= 3 ? 'var(--warning)' : 'var(--border)'}
          {...pinProps('portal_csat', 'CSAT Score', isMetricPinned, handlePin, handleUnpin)}
        />
        <ScorecardWidget
          label="Self-Service Rate"
          value={selfServicePct}
          unit="%"
          icon={UserPlus}
          iconColor="var(--info)"
          iconBg="var(--info-bg)"
          accentColor="var(--info)"
          {...pinProps('portal_self_service_rate', 'Self-Service Rate', isMetricPinned, handlePin, handleUnpin)}
        />
      </div>

      <CardSection title="Portal Insights" icon={BarChart2}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={14} /> User Registration
            </div>
            <div style={{ background: 'var(--accent-subtle)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent)' }}>{totalUsers}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Registered Users</div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                {userRegistrations30d > 0 ? `+${userRegistrations30d} new this month` : 'No new registrations this period'}
              </div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Ticket size={14} /> Service Requests vs Incidents
            </div>
            <MiniTable
              headers={['Type', 'Count', '% of Total']}
              rows={[
                [
                  <span key="sr" style={{ color: 'var(--info)', fontWeight: 600 }}>Service Request</span>,
                  <span key="sr-n" style={{ fontWeight: 700 }}>{serviceRequestCount}</span>,
                  `${selfServicePct}%`,
                ],
                [
                  <span key="inc" style={{ color: 'var(--danger)', fontWeight: 600 }}>Incidents</span>,
                  <span key="inc-n" style={{ fontWeight: 700 }}>{totalTickets - serviceRequestCount}</span>,
                  `${100 - selfServicePct}%`,
                ],
              ]}
            />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ThumbsUp size={14} /> Customer Satisfaction
            </div>
            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
              {csatAvg ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 8 }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <span key={s} style={{ fontSize: 22, opacity: Math.round(csatAvg!) >= s ? 1 : 0.2 }}>★</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{csatAvg.toFixed(1)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{csatCount} rating{csatCount !== 1 ? 's' : ''}</div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 16 }}>
                  No satisfaction ratings yet. Ratings appear when tickets are resolved.
                </div>
              )}
            </div>
          </div>
        </div>
      </CardSection>
    </div>
  );
}
