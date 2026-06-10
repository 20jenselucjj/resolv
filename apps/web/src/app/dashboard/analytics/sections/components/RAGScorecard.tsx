'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, Activity, Wrench, Bug, BookOpen, CheckSquare, Users, Shield } from 'lucide-react';
import { cssVar } from '../../components/recharts/export-utils';

// ── Types ──────────────────────────────────────────────────────

export type RAGStatus = 'green' | 'yellow' | 'red';

export interface DomainMetric {
  label: string;
  value: string | number;
  unit?: string;
}

export interface DomainHealth {
  name: string;
  status: RAGStatus;
  metrics: DomainMetric[];
  trend: 'up' | 'down' | 'flat';
  icon?: React.ComponentType<{ size?: number; color?: string }>;
}

export interface RAGScorecardProps {
  domains: DomainHealth[];
  onDomainClick?: (domainName: string) => void;
}

// ── RAG Backgrounds ──────────────────────────────────────────

const RAG_BG: Record<RAGStatus, string> = {
  green: 'rgba(22, 163, 74, 0.08)',
  yellow: 'rgba(245, 158, 11, 0.08)',
  red: 'rgba(239, 68, 68, 0.08)',
};

const RAG_BORDER: Record<RAGStatus, string> = {
  green: 'rgba(22, 163, 74, 0.35)',
  yellow: 'rgba(245, 158, 11, 0.35)',
  red: 'rgba(239, 68, 68, 0.35)',
};

const RAG_TEXT: Record<RAGStatus, string> = {
  green: '#16A34A',
  yellow: '#B45309',
  red: '#DC2626',
};

const RAG_LABEL: Record<RAGStatus, string> = {
  green: 'Healthy',
  yellow: 'At Risk',
  red: 'Critical',
};

const DOMAIN_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  'Incident Management': Shield,
  'Service Requests': Wrench,
  'Problem Management': Bug,
  'Change Management': CheckSquare,
  'Knowledge Base': BookOpen,
  'Agent Performance': Users,
};

// ── Trend Icon ─────────────────────────────────────────────────

const TrendIcon: React.FC<{ trend: 'up' | 'down' | 'flat'; status: RAGStatus }> = ({ trend, status }) => {
  const color = trend === 'up'
    ? (status === 'red' ? '#DC2626' : '#16A34A')
    : trend === 'down'
      ? (status === 'green' ? '#DC2626' : '#16A34A')
      : cssVar('--text-muted', '#6B7280');

  if (trend === 'up') return <TrendingUp size={14} color={color} aria-label="Improving" />;
  if (trend === 'down') return <TrendingDown size={14} color={color} aria-label="Declining" />;
  return <Minus size={14} color={color} aria-label="Stable" />;
};

// ── Component ──────────────────────────────────────────────────

const RAGScorecard: React.FC<RAGScorecardProps> = ({ domains, onDomainClick }) => {
  if (!domains.length) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: 'center',
          color: cssVar('--text-muted', '#6B7280'),
          fontSize: 14,
          border: `1px dashed ${cssVar('--border', '#e5e7eb')}`,
          borderRadius: 12,
        }}
      >
        No service health data available.
      </div>
    );
  }

  return (
    <div
      role="list"
      aria-label="Service health scorecard"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 16,
      }}
    >
      {domains.map((domain) => {
        const Icon = domain.icon || DOMAIN_ICONS[domain.name] || Activity;
        return (
          <div
            key={domain.name}
            role="listitem"
            tabIndex={onDomainClick ? 0 : -1}
            onClick={() => onDomainClick?.(domain.name)}
            onKeyDown={(e) => {
              if (onDomainClick && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onDomainClick(domain.name);
              }
            }}
            style={{
              background: RAG_BG[domain.status],
              border: `1px solid ${RAG_BORDER[domain.status]}`,
              borderRadius: 12,
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              cursor: onDomainClick ? 'pointer' : 'default',
              transition: 'box-shadow 0.2s ease, transform 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'var(--bg-elevated, rgba(255,255,255,0.6))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={14} color={RAG_TEXT[domain.status]} />
                </div>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: cssVar('--text', '#1f2937'),
                  }}
                >
                  {domain.name}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: RAG_TEXT[domain.status],
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'var(--bg-secondary, rgba(255,255,255,0.5))',
                  }}
                >
                  {RAG_LABEL[domain.status]}
                </span>
                <TrendIcon trend={domain.trend} status={domain.status} />
              </div>
            </div>

            {/* Metrics */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {domain.metrics.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, color: cssVar('--text-secondary', '#4b5563') }}>
                    {m.label}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: cssVar('--text', '#1f2937') }}>
                    {m.value}
                    {m.unit && (
                      <span style={{ fontSize: 11, fontWeight: 500, color: cssVar('--text-muted', '#6B7280'), marginLeft: 2 }}>
                        {m.unit}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RAGScorecard;
