'use client';

import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { api } from '@/lib/api';

export function IntegrationsTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: Record<string, string> }>('/admin/settings')
      .then(res => {
        const s = res.data;
        setWebhookUrl(s.webhook_url || '');
        setSlackWebhook(s.slack_webhook_url || '');
        setSlackEnabled(s.slack_enabled === 'true');
        setWebhookEnabled(s.webhook_enabled === 'true');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        api.patch('/admin/settings', { key: 'webhook_url', value: webhookUrl }),
        api.patch('/admin/settings', { key: 'webhook_enabled', value: String(webhookEnabled) }),
        api.patch('/admin/settings', { key: 'slack_webhook_url', value: slackWebhook }),
        api.patch('/admin/settings', { key: 'slack_enabled', value: String(slackEnabled) }),
      ]);
      showAlert('Integration settings saved');
    } catch {
      showAlert('Failed to save integration settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  const integrations = [
    {
      id: 'slack',
      name: 'Slack',
      description: 'Send ticket notifications and alerts to a Slack channel via webhook.',
      icon: '💬',
      enabled: slackEnabled,
      onToggle: () => setSlackEnabled((v: boolean) => !v),
      fields: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Slack Webhook URL</label>
          <input className="input" value={slackWebhook} onChange={e => setSlackWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/..." />
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>Create an Incoming Webhook in your Slack workspace settings.</p>
        </div>
      )
    },
    {
      id: 'webhook',
      name: 'Custom Webhook',
      description: 'Send HTTP POST events to your own endpoint on ticket events.',
      icon: '🔗',
      enabled: webhookEnabled,
      onToggle: () => setWebhookEnabled((v: boolean) => !v),
      fields: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Webhook Endpoint URL</label>
          <input className="input" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://your-server.com/webhook" />
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>Receives POST requests with ticket event payloads (JSON).</p>
        </div>
      )
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Active Integrations */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {integrations.map(integration => (
          <div key={integration.id} className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: integration.enabled ? 20 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 24 }}>{integration.icon}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{integration.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{integration.description}</div>
                </div>
              </div>
              <div
                onClick={integration.onToggle}
                style={{
                  width: 44, height: 24, borderRadius: 12, cursor: 'pointer', flexShrink: 0,
                  background: integration.enabled ? 'var(--accent)' : 'var(--bg-tertiary)',
                  border: `1px solid ${integration.enabled ? 'var(--accent)' : 'var(--border)'}`,
                  position: 'relative', transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  position: 'absolute', top: 2, left: integration.enabled ? 22 : 2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: integration.enabled ? 'white' : 'var(--text-muted)',
                  transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </div>
            </div>
            {integration.enabled && integration.fields}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '10px 24px' }}>
          {saving ? 'Saving...' : 'Save Integration Settings'}
        </button>
      </div>
    </div>
  );
}
