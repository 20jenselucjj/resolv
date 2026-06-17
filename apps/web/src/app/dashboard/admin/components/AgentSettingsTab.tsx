'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Download, Eye, EyeOff, Copy, RefreshCw, Monitor, Wifi, WifiOff,
  HelpCircle, CheckCircle, AlertTriangle
} from 'lucide-react';
import { api, API_BASE, getToken } from '@/lib/api';
import { toast } from '@/components/Toast';

interface AgentStats {
  total: number;
  online: number;
  offline: number;
  never_connected: number;
}

interface AgentStatsResponse extends AgentStats {
  agentStatus?: Array<{ agent_status: string; count: number }>;
}

interface LatestVersion {
  version: string;
  file_size_bytes: number | null;
  changelog: string | null;
  created_at: string;
}

export function AgentSettingsTab({ showAlert }: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
}) {
  const [agentSecret, setAgentSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [loadingSecret, setLoadingSecret] = useState(true);
  const [agentStats, setAgentStats] = useState<AgentStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [latestVersion, setLatestVersion] = useState<LatestVersion | null>(null);
  const [deployTab, setDeployTab] = useState<'manual' | 'gpo' | 'silent'>(() => {
    try { return (localStorage.getItem('resolv_agent_deploy_tab') as 'manual' | 'gpo' | 'silent') || 'manual' } catch { return 'manual' }
  });

  useEffect(() => { localStorage.setItem('resolv_agent_deploy_tab', deployTab) }, [deployTab]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/assets/agent/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Use server-provided filename from Content-Disposition, or default
      const disposition = res.headers.get('content-disposition');
      const match = disposition && disposition.match(/filename="?(.+?)"?$/);
      a.download = match ? match[1] : 'ResolvAgent-Setup.exe';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      showAlert(err instanceof Error ? err.message : 'Download failed', 'error');
    } finally {
      setDownloading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    Promise.all([
      api.get<{ data: Record<string, string> }>('/admin/settings').then(res => {
        const secret = res.data?.agent_secret_key || '';
        setAgentSecret(secret);
      }).catch((err) => toast.error('Failed to load agent settings', err instanceof Error ? err.message : 'Please try again')).finally(() => setLoadingSecret(false)),
      api.get<{ data: AgentStatsResponse }>('/assets/stats').then(res => {
        if (res.data) {
          const d = res.data;
          const byStatus = d.agentStatus || [];
          setAgentStats({
            total: d.total || 0,
            online: byStatus.find((s) => s.agent_status === 'online')?.count || 0,
            offline: byStatus.find((s) => s.agent_status === 'offline')?.count || 0,
            never_connected: byStatus.find((s) => s.agent_status === 'never')?.count || 0,
          });
        }
      }).catch((err) => toast.error('Failed to load agent stats', err instanceof Error ? err.message : 'Please try again')).finally(() => setLoadingStats(false)),
      api.get<{ data: LatestVersion | null }>('/agent-versions/latest').then(res => {
        setLatestVersion(res.data || null);
      }).catch((err) => toast.error('Failed to load latest version', err instanceof Error ? err.message : 'Please try again')),
    ]);
  }, []);

  const handleRegenerate = async () => {
    if (!confirm('Regenerating the secret will require re-registering all agents. Continue?')) return;
    setRegenerating(true);
    try {
      const res = await api.patch<{ data: { agent_secret_key: string } }>('/admin/settings/agent_secret_key', {});
      const newSecret = res.data?.agent_secret_key || '';
      setAgentSecret(newSecret);
      showAlert('Agent secret key regenerated');
    } catch {
      showAlert('Failed to regenerate agent secret', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  const copyToClipboard = async (text: string, index?: number) => {
    try {
      await navigator.clipboard.writeText(text);
      if (index !== undefined) {
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
      }
      showAlert('Copied to clipboard');
    } catch {
      showAlert('Failed to copy', 'error');
    }
  };

  const codeBlocks: Record<string, { label: string; content: string }[]> = {
    manual: [
      {
        label: 'Manual Installation Steps',
        content: `1. Click "Download for Windows" — the .exe is pre-configured with your server URL and secret
2. Right-click ResolvAgent-Setup.exe → Run as Administrator
3. The agent installs as a Windows Service and starts automatically
4. Open services.msc to see "Resolv ITSM Agent" running
5. Return to the Assets page — your machine should appear within 60 seconds`,
      },
    ],
    gpo: [
      {
        label: 'GPO / Bulk Deployment',
        content: `1. Download ResolvAgent-Setup.exe (pre-configured with server URL and secret)
2. Copy the .exe to a network share accessible by target machines
3. Create a GPO startup script:
   Computer Configuration > Windows Settings > Scripts > Startup
   Command: "%SHARE%\\ResolvAgent-Setup.exe"
4. Or use a software deployment tool (SCCM, PDQ Deploy, Intune) to deploy:
   - Copy ResolvAgent-Setup.exe to the target machine
   - Run: ResolvAgent-Setup.exe`,
      },
    ],
    silent: [
      {
        label: 'Silent / Scripted Install',
        content: `:: No Node.js required — single self-contained .exe
:: No extraction or npm needed — just copy and run

copy "\\\\server\\share\\ResolvAgent-Setup.exe" "C:\\ProgramData\\Resolv\\Agent-Setup.exe"
C:\\ProgramData\\Resolv\\Agent-Setup.exe

:: The agent auto-installs as a Windows Service
:: Visible in services.msc as "Resolv ITSM Agent"
:: Uninstall via: "C:\\ProgramData\\Resolv\\Agent\\ResolvAgent.exe" --uninstall`,
      },
    ],
  };

  const sectionStyle: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px',
  };

  const sectionDesc: React.CSSProperties = {
    fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Section 1: Agent Secret Key */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h3 style={sectionTitle}>Agent Secret Key</h3>
            <p style={sectionDesc}>
              Used to authenticate agent installations. Keep this key secret.
            </p>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '16px',
        }}>
          {loadingSecret ? (
            <div className="skeleton" style={{ height: 20, width: '60%', borderRadius: 4 }} />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <code style={{
                  flex: 1, fontSize: '14px', fontWeight: 700, fontFamily: 'monospace',
                  color: 'var(--accent)', letterSpacing: '0.5px', wordBreak: 'break-all',
                }}>
                  {showSecret ? agentSecret : agentSecret ? '•'.repeat(Math.min(40, agentSecret.length)) : 'No secret configured'}
                </code>
                <button
                  onClick={() => setShowSecret(v => !v)}
                  className="btn btn-ghost"
                  style={{ padding: '6px', flexShrink: 0 }}
                  title={showSecret ? 'Hide secret' : 'Show secret'}
                >
                  {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                {agentSecret && (
                  <button
                    onClick={() => copyToClipboard(agentSecret)}
                    className="btn btn-ghost"
                    style={{ padding: '6px', flexShrink: 0 }}
                    title="Copy to clipboard"
                  >
                    <Copy size={16} />
                  </button>
                )}
              </div>
              {agentSecret && (
                <div style={{
                  marginTop: 12, display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', background: 'var(--warning-bg)',
                  border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-md)',
                  fontSize: '12px', color: 'var(--warning)',
                }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                  <span>Regenerating the secret will require re-registering all agents</span>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ marginTop: '12px' }}>
          <button
            onClick={handleRegenerate}
            disabled={regenerating || loadingSecret}
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--warning)' }}
          >
            <RefreshCw size={14} style={{ animation: regenerating ? 'spin 1s linear infinite' : undefined }} />
            {regenerating ? 'Regenerating...' : 'Regenerate Key'}
          </button>
        </div>
      </div>

      {/* Section 2: Agent Download */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Resolv Agent</h3>
        <p style={sectionDesc}>
          Download and deploy the Resolv Agent to monitor your Windows endpoints.
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{
              background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '20px',
              textAlign: 'center',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 12,
                background: 'linear-gradient(135deg, #0078D4, #50E6FF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <Monitor size={28} color="var(--text-inverse)" />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                Windows Agent
              </div>
              <div style={{
                display: 'inline-block', fontSize: 11, fontWeight: 600,
                padding: '2px 8px', borderRadius: 'var(--radius-full)',
                background: 'var(--accent-subtle)', color: 'var(--accent)',
                border: '1px solid var(--accent-border)', marginBottom: 12,
              }}>
                v{latestVersion?.version || '1.0.0'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                {latestVersion?.file_size_bytes
                  ? `Single .exe \u2022 ${(latestVersion.file_size_bytes / 1048576).toFixed(1)} MB \u2022 Windows Service via nssm`
                  : 'Single .exe \u2022 Windows Service via nssm'}
              </div>
              <button
                onClick={handleDownload}
                disabled={downloading}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 24px', borderRadius: 'var(--radius-md)',
                  background: 'var(--accent)', color: 'var(--text-inverse)', border: 'none',
                  fontSize: 14, fontWeight: 600, cursor: downloading ? 'default' : 'pointer',
                  opacity: downloading ? 0.7 : 1,
                }}
              >
                <Download size={16} />
                {downloading ? 'Downloading…' : 'Download for Windows'}
              </button>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                <div><strong style={{ color: 'var(--text)' }}>Requirements:</strong> Windows 10/11 64-bit, 2GB RAM</div>
                <div><strong style={{ color: 'var(--text)' }}>Runtime:</strong> None — fully self-contained .exe</div>
                <div><strong style={{ color: 'var(--text)' }}>Type:</strong> Single .exe, auto-installs as Windows Service</div>
                <div style={{
                  padding: '10px 14px', background: 'var(--accent-subtle)',
                  border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-md)',
                  fontSize: 12, color: 'var(--accent)', marginTop: 4,
                }}>
                  <CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  The agent runs as a Windows Service and automatically reports asset information. View in services.msc.
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Deployment Instructions */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Deployment Instructions</h3>
        <p style={sectionDesc}>
          Choose a deployment method below to install the Resolv Agent across your organization.
        </p>

        {/* Tab buttons */}
        <div style={{
          display: 'flex', gap: 4,
          background: 'var(--bg-tertiary)', padding: 4,
          borderRadius: 'var(--radius-md)',
          marginBottom: 16,
        }}>
          {(['manual', 'gpo', 'silent'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setDeployTab(tab)}
              style={{
                flex: 1, padding: '8px 16px', border: 'none', cursor: 'pointer',
                borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600,
                background: deployTab === tab ? 'var(--accent-subtle)' : 'transparent',
                color: deployTab === tab ? 'var(--accent)' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              {tab === 'manual' ? 'Manual' : tab === 'gpo' ? 'GPO Deployment' : 'Silent Install'}
            </button>
          ))}
        </div>

        {/* Code block */}
        {codeBlocks[deployTab].map((block, idx) => (
          <div key={idx} style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 14px', background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {block.label}
              </span>
              <button
                onClick={() => copyToClipboard(block.content, idx)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 'var(--radius-md)',
                  background: copiedIndex === idx ? 'var(--success-bg)' : 'var(--bg-secondary)',
                  border: 'none', cursor: 'pointer', color: copiedIndex === idx ? 'var(--success)' : 'var(--text-secondary)',
                  fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
                }}
              >
                {copiedIndex === idx ? <CheckCircle size={12} /> : <Copy size={12} />}
                {copiedIndex === idx ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre style={{
              margin: 0, padding: '16px', overflowX: 'auto',
              fontSize: '13px', lineHeight: 1.6,
              color: 'var(--text)', fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace",
            }}>
              {block.content}
            </pre>
          </div>
        ))}

        <div style={{
          marginTop: 16, display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: 'var(--text-muted)',
        }}>
          <HelpCircle size={14} />
          For deployment issues, check that the server URL is reachable from target machines and the agent secret matches.
        </div>
      </div>

      {/* Section 4: Agent Status Summary */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Agent Status</h3>
        <p style={sectionDesc}>
          Overview of deployed agents and their current connection status.
        </p>

        {loadingStats ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-md)' }} />
            ))}
          </div>
        ) : agentStats ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            {[
              { label: 'Total Agents', value: agentStats.total, icon: Monitor, color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
              { label: 'Online', value: agentStats.online, icon: Wifi, color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
              { label: 'Offline', value: agentStats.offline, icon: WifiOff, color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
              { label: 'Never Connected', value: agentStats.never_connected, icon: HelpCircle, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
            ].map((stat, i) => (
              <div key={i} style={{
                background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: '16px',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>{stat.label}</span>
                  <div style={{
                    width: 32, height: 32, borderRadius: 'var(--radius-md)',
                    background: stat.bg, color: stat.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <stat.icon size={16} />
                  </div>
                </div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>
            Unable to load agent statistics
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
