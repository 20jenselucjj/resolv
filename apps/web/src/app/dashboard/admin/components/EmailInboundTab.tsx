'use client';

import { useEffect, useState, useRef } from 'react';
import { Mail, Save, ChevronDown, X, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

interface InboundConfig {
  enabled: string;
  protocol: string;
  poll_interval: string;
  label: string;
  inbound_email_address: string;
  ticket_creation_enabled: string;
  reply_enabled: string;
  require_known_sender: string;
  default_priority: string;
  default_type: string;
  default_status: string;
  auto_reopen_on_reply: string;
}

interface TicketTypeDefault {
  due_hours: number;
}

interface GmailStatus {
  connected: boolean;
  email?: string;
  scopes?: string[];
}

export function EmailInboundTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [config, setConfig] = useState<InboundConfig>({
    enabled: 'false',
    protocol: 'gmail_api',
    poll_interval: '60',
    label: 'INBOX',
    inbound_email_address: '',
    ticket_creation_enabled: 'false',
    reply_enabled: 'false',
    require_known_sender: 'true',
    default_priority: 'medium',
    default_type: 'incident',
    default_status: 'open',
    auto_reopen_on_reply: 'false',
  });
  const [typeDefaults, setTypeDefaults] = useState<Record<string, TicketTypeDefault>>({});
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [emailDropdownOpen, setEmailDropdownOpen] = useState(false);
  const emailDropdownRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    Promise.all([
      api.get<{ data: Record<string, string> & { gmail_status?: GmailStatus } }>('/admin/email/inbound/config'),
      api.get<{ data: Record<string, any> }>('/admin/email/inbound/parsing'),
      api.get<{ data: Record<string, TicketTypeDefault> }>('/admin/email/ticket-type-defaults'),
    ])
      .then(([inboundRes, parsingRes, typeDefaultsRes]) => {
        if (inboundRes.data) {
          setConfig(prev => ({
            ...prev,
            enabled: inboundRes.data.enabled ?? prev.enabled,
            protocol: inboundRes.data.protocol ?? prev.protocol,
            poll_interval: inboundRes.data.poll_interval ?? prev.poll_interval,
            label: inboundRes.data.label ?? prev.label,
            inbound_email_address: inboundRes.data.inbound_email_address ?? prev.inbound_email_address,
            ticket_creation_enabled: inboundRes.data.ticket_creation_enabled ?? prev.ticket_creation_enabled,
            reply_enabled: inboundRes.data.reply_enabled ?? prev.reply_enabled,
          }));
          if (inboundRes.data.gmail_status) {
            setGmailStatus(inboundRes.data.gmail_status);
          }
        }
        if (parsingRes.data) {
          setConfig(prev => ({
            ...prev,
            require_known_sender: parsingRes.data.require_known_sender !== undefined ? String(parsingRes.data.require_known_sender) : prev.require_known_sender,
            default_priority: parsingRes.data.default_priority ?? prev.default_priority,
            default_type: parsingRes.data.default_type ?? prev.default_type,
            default_status: parsingRes.data.default_status ?? prev.default_status,
            auto_reopen_on_reply: parsingRes.data.auto_reopen_on_reply !== undefined ? String(parsingRes.data.auto_reopen_on_reply) : prev.auto_reopen_on_reply,
          }));
        }
        if (typeDefaultsRes.data) {
          setTypeDefaults(typeDefaultsRes.data);
        }
      })
      .catch(() => showAlert('Failed to load inbound email config', 'error'))
      .finally(() => setLoading(false));
  }, []);

  // Close email dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emailDropdownRef.current && !emailDropdownRef.current.contains(e.target as Node)) {
        setEmailDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Build email suggestions from OAuth connection
  const emailSuggestions = gmailStatus?.email ? [gmailStatus.email] : [];
  const filteredEmails = config.inbound_email_address
    ? emailSuggestions.filter(e => e.toLowerCase().includes(config.inbound_email_address.toLowerCase()))
    : emailSuggestions;

  const update = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save main inbound config
      const inboundPayload = {
        enabled: config.enabled,
        protocol: config.protocol,
        poll_interval: config.poll_interval,
        label: config.label,
        inbound_email_address: config.inbound_email_address,
        ticket_creation_enabled: config.ticket_creation_enabled,
        reply_enabled: config.reply_enabled,
      };
      await api.post('/admin/email/inbound/config', inboundPayload);

      // Save parsing config separately
      const parsingPayload = {
        require_known_sender: config.require_known_sender === 'true',
        default_priority: config.default_priority,
        default_type: config.default_type,
        default_status: config.default_status,
        auto_reopen_on_reply: config.auto_reopen_on_reply === 'true',
      };
      await api.post('/admin/email/inbound/parsing', parsingPayload);

      // Save ticket type due date defaults
      await api.post('/admin/email/ticket-type-defaults', { ticket_type_defaults: typeDefaults });

      showAlert('Inbound email settings saved');
    } catch {
      showAlert('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>('/admin/email/inbound/test', {});
      if (res.success) {
        showAlert('Inbound poll complete');
      } else {
        showAlert(res.message || 'Poll failed', 'error');
      }
    } catch (err: any) {
      showAlert(err.message || 'Test failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Gmail API Connection */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mail size={14} color="var(--accent)" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>Connection &amp; Status</div>
          <button
            onClick={() => update('enabled', config.enabled === 'true' ? 'false' : 'true')}
            style={{
              width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', flexShrink: 0,
              background: config.enabled === 'true' ? 'var(--accent)' : 'var(--bg-tertiary)',
              position: 'relative', transition: 'background 0.2s',
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: '50%', background: 'var(--text-inverse)',
              position: 'absolute', top: 3,
              left: config.enabled === 'true' ? 25 : 3,
              transition: 'left 0.2s ease',
            }} />
          </button>
        </div>

        {gmailStatus?.connected ? (
          <div style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.25)',
            color: '#16a34a',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Connected</div>
            <div style={{ fontSize: 12 }}>{config.inbound_email_address || gmailStatus.email}</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>
              {config.inbound_email_address
                ? `Monitoring inbound to ${config.inbound_email_address}`
                : 'Monitoring all inbound (no address filter set)'}
            </div>
          </div>
        ) : (
          <div style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            color: '#d97706',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Gmail not connected</div>
            <div style={{ fontSize: 12 }}>Set up Google OAuth in the Directory Sync tab first.</div>
          </div>
        )}
      </div>

      {/* Polling Settings */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Polling Settings</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Poll Interval (seconds)</label>
            <input style={inputStyle} type="number" value={config.poll_interval} onChange={e => update('poll_interval', e.target.value)} min="10" placeholder="60" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Label to Watch</label>
            <input style={inputStyle} value={config.label} onChange={e => update('label', e.target.value)} placeholder="INBOX" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Inbound Email Address</label>
            <div ref={emailDropdownRef} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: 60 }}
                  type="email"
                  value={config.inbound_email_address}
                  onChange={e => { update('inbound_email_address', e.target.value); setEmailDropdownOpen(true); }}
                  onFocus={() => setEmailDropdownOpen(true)}
                  placeholder={gmailStatus?.email || 'Search or type an email...'}
                />
                <div style={{ position: 'absolute', right: 4, display: 'flex', gap: 2 }}>
                  {config.inbound_email_address && (
                    <button
                      onClick={() => { update('inbound_email_address', ''); setEmailDropdownOpen(false); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-muted)' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => setEmailDropdownOpen(!emailDropdownOpen)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-muted)' }}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
              {emailDropdownOpen && filteredEmails.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', marginTop: 2,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 160, overflowY: 'auto',
                }}>
                  {filteredEmails.map(email => (
                    <div
                      key={email}
                      onClick={() => { update('inbound_email_address', email); setEmailDropdownOpen(false); }}
                      style={{
                        padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                        color: 'var(--text)',
                        background: email === config.inbound_email_address ? 'var(--accent-subtle)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (email !== config.inbound_email_address) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                      onMouseLeave={e => { if (email !== config.inbound_email_address) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {email}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Only process emails sent to this address (leave empty to process all)
            </div>
          </div>
        </div>
      </div>

      {/* Email Processing Rules */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Email Processing Rules</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Create tickets from emails without a ticket number</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Emails with no ticket # in the subject will create new tickets automatically</div>
            </div>
            <button
              onClick={() => update('ticket_creation_enabled', config.ticket_creation_enabled === 'true' ? 'false' : 'true')}
              style={{
                width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', flexShrink: 0,
                background: config.ticket_creation_enabled === 'true' ? 'var(--accent)' : 'var(--bg-tertiary)',
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: 'var(--text-inverse)',
                position: 'absolute', top: 3,
                left: config.ticket_creation_enabled === 'true' ? 25 : 3,
                transition: 'left 0.2s ease',
              }} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Process replies to existing tickets</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Emails with a ticket number in the subject (e.g., &quot;Re: Ticket #1042&quot;) will add comments</div>
            </div>
            <button
              onClick={() => update('reply_enabled', config.reply_enabled === 'true' ? 'false' : 'true')}
              style={{
                width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', flexShrink: 0,
                background: config.reply_enabled === 'true' ? 'var(--accent)' : 'var(--bg-tertiary)',
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: 'var(--text-inverse)',
                position: 'absolute', top: 3,
                left: config.reply_enabled === 'true' ? 25 : 3,
                transition: 'left 0.2s ease',
              }} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Auto-reopen closed tickets on reply</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>When the reporter replies to a closed/resolved ticket (via email or portal), automatically reopen it</div>
            </div>
            <button
              onClick={() => update('auto_reopen_on_reply', config.auto_reopen_on_reply === 'true' ? 'false' : 'true')}
              style={{
                width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', flexShrink: 0,
                background: config.auto_reopen_on_reply === 'true' ? 'var(--accent)' : 'var(--bg-tertiary)',
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: 'var(--text-inverse)',
                position: 'absolute', top: 3,
                left: config.auto_reopen_on_reply === 'true' ? 25 : 3,
                transition: 'left 0.2s ease',
              }} />
            </button>
          </div>
        </div>
      </div>

      {/* Side-by-side: Email Parsing + Due Dates */}
      <style>{`
        .config-side-by-side {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }
        @media (min-width: 768px) {
          .config-side-by-side {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
      <div className="config-side-by-side">

        {/* Email Parsing Configuration */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Email Parsing Configuration</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Configure how incoming emails are converted into tickets</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Require Known Sender</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Only create tickets from recognized users (email must match a user in the system)</div>
              </div>
              <button
                onClick={() => update('require_known_sender', config.require_known_sender === 'true' ? 'false' : 'true')}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', flexShrink: 0,
                  background: config.require_known_sender === 'true' ? 'var(--accent)' : 'var(--bg-tertiary)',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: 'var(--text-inverse)',
                  position: 'absolute', top: 3,
                  left: config.require_known_sender === 'true' ? 25 : 3,
                  transition: 'left 0.2s ease',
                }} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Default Priority</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Default priority for new tickets created from email</div>
              </div>
              <select
                value={config.default_priority}
                onChange={e => update('default_priority', e.target.value)}
                style={{ ...inputStyle, width: 140 }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Default Ticket Type</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Default type for new tickets created from email</div>
              </div>
              <select
                value={config.default_type}
                onChange={e => update('default_type', e.target.value)}
                style={{ ...inputStyle, width: 140 }}
              >
                <option value="incident">Incident</option>
                <option value="service_request">Service Request</option>
                <option value="problem">Problem</option>
                <option value="change">Change</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Default Status</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Default status for new tickets created from email</div>
              </div>
              <select
                value={config.default_status}
                onChange={e => update('default_status', e.target.value)}
                style={{ ...inputStyle, width: 140 }}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting">Waiting</option>
              </select>
            </div>
          </div>
        </div>

        {/* Ticket Type Due Date Configuration */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Ticket Type Due Dates</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Set how many hours from creation until each ticket type is due. Applies to tickets created from email.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(['incident', 'service_request', 'problem', 'change'] as const).map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
                  {t.replace('_', ' ')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    min={1}
                    max={8760}
                    value={typeDefaults[t]?.due_hours ?? 0}
                    onChange={e => setTypeDefaults(prev => ({
                      ...prev,
                      [t]: { due_hours: parseInt(e.target.value) || 0 },
                    }))}
                    style={{ ...inputStyle, width: 80, textAlign: 'center' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>hours</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={handleTest} disabled={testing} style={{ border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} className={testing ? 'spin' : ''} />
          {testing ? 'Pulling...' : 'Pull New Emails'}
        </button>
        <button className={`btn btn-primary btn-save${saving ? ' saving' : ''}`} onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Save size={14} />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
