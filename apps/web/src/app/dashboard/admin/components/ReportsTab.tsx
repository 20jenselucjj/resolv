'use client';

import { useRouter } from 'next/navigation';
import {
  BarChart2, TrendingUp, Target, Activity, Shield, FileText,
  ArrowRight, ExternalLink, Layers, PieChart
} from 'lucide-react';

export function ReportsTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const router = useRouter();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Hero card — redirect to standalone reports */}
      <div style={{
        padding: '32px',
        borderRadius: 'var(--radius-lg)',
        background: 'linear-gradient(135deg, var(--accent-subtle) 0%, var(--bg) 100%)',
        border: '1px solid var(--accent-border)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
          boxShadow: '0 8px 24px rgba(37,99,235,0.25)',
        }}>
          <BarChart2 size={28} color="white" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.01em' }}>
          Reports & Analytics
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto 20px', lineHeight: 1.6 }}>
          Reports have moved to a dedicated page with richer visualizations,
          role-aware filtering, and interactive analytics. Access the full reports dashboard for:
        </p>

        {/* Feature badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
          {[
            { icon: PieChart, label: 'Status & Type Breakdowns', color: 'var(--accent)', bg: 'var(--accent-subtle)' },
            { icon: TrendingUp, label: 'Volume Trends', color: 'var(--success)', bg: 'var(--success-bg)' },
            { icon: Target, label: 'SLA Compliance', color: 'var(--warning)', bg: 'var(--warning-bg)' },
            { icon: Shield, label: 'SLA Breach Tracking', color: 'var(--danger)', bg: 'var(--danger-bg)' },
            { icon: Activity, label: 'Response Times', color: '#7c3aed', bg: '#ede9fe' },
            { icon: Layers, label: 'Category Breakdowns', color: '#0891b2', bg: '#ecfeff' },
          ].map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 'var(--radius-full)',
              background: f.bg, border: `1px solid ${f.color}20`,
              fontSize: 11, fontWeight: 600, color: f.color,
            }}>
              <f.icon size={12} />
              {f.label}
            </div>
          ))}
        </div>

        <button
          onClick={() => router.push('/dashboard/reports')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 28px', borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
            color: 'white', border: 'none', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 4px 16px rgba(37,99,235,0.3)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(37,99,235,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(37,99,235,0.3)'; }}
        >
          Open Reports Dashboard <ArrowRight size={16} />
        </button>

        <div style={{ marginTop: 16 }}>
          <a
            href="/dashboard/reports"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12, color: 'var(--accent)', textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontWeight: 500,
            }}
          >
            Open in new tab <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* Quick summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[
          { icon: PieChart, label: 'Distribution Charts', desc: 'Status, type, priority, and category breakdowns with donut charts' },
          { icon: TrendingUp, label: 'Time-Series Trends', desc: 'Ticket volume over time for created vs resolved comparisons' },
          { icon: Shield, label: 'SLA Analytics', desc: 'Compliance rates, breach tracking, and at-risk monitoring' },
          { icon: Activity, label: 'Agent Performance', desc: 'Resolution rates, average times, and workload distribution' },
          { icon: FileText, label: 'Ticket Browser', desc: 'Filtered ticket view with priority distribution and category filters' },
          { icon: Target, label: 'CSV Export', desc: 'Export any view as CSV for external analysis and reporting' },
        ].map((card, i) => (
          <div key={i} className="card" style={{
            padding: '20px', borderRadius: 'var(--radius-lg)',
            display: 'flex', flexDirection: 'column', gap: 8,
            cursor: 'pointer', transition: 'all 0.15s ease',
          }}
            onClick={() => router.push('/dashboard/reports')}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <card.icon size={16} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{card.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{card.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
