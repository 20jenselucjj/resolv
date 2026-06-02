'use client';

import { CardSection, MiniTable } from './Charts';
import { BarChart2, Users, ThumbsUp, Ticket } from 'lucide-react';

interface PortalReportProps {
  totalUsers: number;
  userRegistrations30d: number;
  totalTickets: number;
  serviceRequestCount: number;
  csatAvg?: number;
  csatCount?: number;
}

export default function PortalReports({ totalUsers, userRegistrations30d, totalTickets, serviceRequestCount, csatAvg, csatCount }: PortalReportProps) {
  const selfServicePct = totalTickets ? Math.round((serviceRequestCount / totalTickets) * 100) : 0;

  return (
    <div className="rp-fade" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div className="rp-card card" style={{ padding: '20px 24px', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Users</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1, marginTop: 8 }}>{totalUsers}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {userRegistrations30d > 0 ? `+${userRegistrations30d} in last 30d` : '0 new registrations'}
          </div>
        </div>
        <div className="rp-card card" style={{ padding: '20px 24px', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Service Requests</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1, marginTop: 8 }}>{serviceRequestCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{selfServicePct}% of all tickets</div>
        </div>
        <div className="rp-card card" style={{ padding: '20px 24px', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CSAT Score</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: csatAvg && csatAvg >= 4 ? 'var(--success)' : csatAvg && csatAvg >= 3 ? 'var(--warning)' : 'var(--text)', lineHeight: 1, marginTop: 8 }}>
            {csatAvg ? `${csatAvg.toFixed(1)} / 5` : 'N/A'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {csatCount ? `Based on ${csatCount} rating${csatCount !== 1 ? 's' : ''}` : 'No ratings yet'}
          </div>
        </div>
        <div className="rp-card card" style={{ padding: '20px 24px', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Self-Service Rate</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--info)', lineHeight: 1, marginTop: 8 }}>{selfServicePct}%</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Tickets submitted via portal</div>
        </div>
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
