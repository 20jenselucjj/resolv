'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Brain, Sparkles, Shield, Search, Plus, FileText, User, Book, BarChart3,
  Plug, Save, RefreshCw, X, AlertTriangle
} from 'lucide-react';
import { api } from '@/lib/api';
import type { AIConfig } from './types';

export function AIConfigTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [config, setConfig] = useState<AIConfig>({
    enabled: false,
    provider: 'openai',
    base_url: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 2048,
    system_prompt: '',
    allowed_roles: ['admin', 'agent'],
    max_messages_per_day: 50,

  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [activeSection, setActiveSection] = useState<'general' | 'behavior' | 'tools' | 'security'>('general');

  // Tool toggles
  const [tools, setTools] = useState({
    searchTickets: true,
    createTickets: true,
    getTicketDetails: true,
    getMyTickets: true,
    searchKnowledge: true,
    getStats: true,
  });

  // Response behavior
  const [behavior, setBehavior] = useState({
    responseLength: 'medium',
    includeCitations: true,
    includeSources: true,
    fallbackToWeb: false,
    maxCitations: 3,
  });

  // Custom rules
  const [rules, setRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState('');

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get<{ data: Partial<AIConfig> & { tools?: any; behavior?: any; rules?: string[] } }>('/ai/config');
      if (res.data) {
        setConfig(prev => ({ ...prev, ...res.data }));
        if (res.data.tools) setTools(res.data.tools);
        if (res.data.behavior) setBehavior(res.data.behavior);
        if (res.data.rules) setRules(res.data.rules);
      }
    } catch (err) {
      console.error('Failed to fetch AI config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...config,
        tools,
        behavior,
        rules,
      };
      if (newApiKey.trim()) {
        (payload as any).api_key = newApiKey.trim();
      }
      await api.put('/ai/config', payload);
      showAlert('AI configuration saved successfully');
      setNewApiKey('');
      fetchConfig();
    } catch (err: any) {
      showAlert(err.message || 'Failed to save AI configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (role: string) => {
    const roles = (config.allowed_roles || []).includes(role)
      ? config.allowed_roles.filter(r => r !== role)
      : [...(config.allowed_roles || []), role];
    setConfig({ ...config, allowed_roles: roles });
  };

  const addRule = () => {
    if (newRule.trim() && !rules.includes(newRule.trim())) {
      setRules([...rules, newRule.trim()]);
      setNewRule('');
    }
  };

  const removeRule = (rule: string) => {
    setRules(rules.filter(r => r !== rule));
  };

  if (loading) return (
    <div style={{ padding: '60px 40px', textAlign: 'center' }}>
      <Sparkles size={32} className="animate-spin" style={{ margin: '0 auto 16px', color: 'var(--accent)' }} />
      <div style={{ fontSize: '14px', fontWeight: 600 }}>Loading AI configuration...</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{
        padding: '24px', background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, var(--bg) 100%)',
        borderRadius: 'var(--radius-lg)', border: '1px solid rgba(37, 99, 235, 0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, #2563eb, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Brain size={24} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>AI Assistant Configuration</h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Configure AI capabilities, behavior, and tool access</p>
          </div>
        </div>

        {/* Enable Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div
            onClick={() => setConfig({ ...config, enabled: !config.enabled })}
            style={{
              width: 48, height: 26, borderRadius: 13, cursor: 'pointer',
              background: config.enabled ? 'var(--accent)' : 'var(--bg-tertiary)',
              border: `1px solid ${config.enabled ? 'var(--accent)' : 'var(--border)'}`,
              position: 'relative', transition: 'all 0.2s ease', flexShrink: 0
            }}
          >
            <div style={{
              position: 'absolute', top: 2,
              left: config.enabled ? 24 : 2,
              width: 20, height: 20, borderRadius: '50%',
              background: config.enabled ? 'white' : 'var(--text-muted)',
              transition: 'left 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Enable AI Assistant</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Allow AI to help agents with ticket summaries, replies, and automation</div>
          </div>
          {config.enabled && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', background: 'var(--success-bg)', borderRadius: 'var(--radius-full)', fontSize: '12px', fontWeight: 600, color: 'var(--success)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
              Active
            </div>
          )}
        </div>

        {/* Section Navigation */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
          {([
            { key: 'general' as const, label: 'General' },

            { key: 'behavior' as const, label: 'Behavior' },
            { key: 'tools' as const, label: 'Tools' },
            { key: 'security' as const, label: 'Rules & Security' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              style={{
                padding: '10px 16px', fontSize: '13px', fontWeight: 600,
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: `2px solid ${activeSection === key ? 'var(--accent)' : 'transparent'}`,
                color: activeSection === key ? 'var(--accent)' : 'var(--text-muted)',
                marginBottom: '-1px', transition: 'color 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* GENERAL SECTION */}
        {activeSection === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Model Settings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={14} color="var(--accent)" />
                </div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Model & Provider</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingLeft: '36px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Provider</label>
                  <select
                    className="input"
                    value={config.provider}
                    onChange={e => setConfig({ ...config, provider: e.target.value })}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google</option>
                    <option value="custom">Custom / Self-hosted</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Model</label>
                  <input
                    className="input"
                    value={config.model}
                    onChange={e => setConfig({ ...config, model: e.target.value })}
                    placeholder="e.g. gpt-4o-mini"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Base URL</label>
                  <input
                    className="input"
                    value={config.base_url}
                    onChange={e => setConfig({ ...config, base_url: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
              </div>
            </div>

            {/* API Key */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '36px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>API Key</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showApiKey ? 'text' : 'password'}
                  value={newApiKey}
                  onChange={e => setNewApiKey(e.target.value)}
                  placeholder={config.api_key ? '••••••••••••••••••••••••• (leave blank to keep current)' : 'Enter API key'}
                  style={{ paddingRight: '80px' }}
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  style={{
                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', padding: '4px 8px',
                  }}
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Stored securely. Leave blank to keep existing key.</span>
            </div>

            {/* Temperature & Tokens */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingLeft: '36px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Temperature ({config.temperature})
                </label>
                <input
                  type="range" min="0" max="2" step="0.1"
                  value={config.temperature}
                  onChange={e => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>Precise</span><span>Creative</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Max Tokens: {config.max_tokens}
                </label>
                <input
                  type="range" min="256" max="8192" step="256"
                  value={config.max_tokens}
                  onChange={e => setConfig({ ...config, max_tokens: parseInt(e.target.value) })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>256</span><span>8192</span>
                </div>
              </div>
            </div>

            {/* Access Control */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Shield size={14} color="var(--accent)" />
                </div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Access Control</span>
              </div>
              <div style={{ paddingLeft: '36px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Allowed Roles (Admin/Agent AI)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['admin', 'agent', 'user'].map(role => (
                    <button
                      key={role}
                      onClick={() => toggleRole(role)}
                      style={{
                        padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600,
                        border: `2px solid ${(config.allowed_roles || []).includes(role) ? 'var(--accent)' : 'var(--border)'}`,
                        background: (config.allowed_roles || []).includes(role) ? 'var(--accent-subtle)' : 'transparent',
                        color: (config.allowed_roles || []).includes(role) ? 'var(--accent)' : 'var(--text)', cursor: 'pointer', textTransform: 'capitalize',
                      }}
                    >
                      {role}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Daily Message Limit: {config.max_messages_per_day}
                  </label>
                  <input
                    type="range" min="1" max="500" step="1"
                    value={config.max_messages_per_day}
                    onChange={e => setConfig({ ...config, max_messages_per_day: parseInt(e.target.value) })}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>1/day</span><span>500/day</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BEHAVIOR SECTION */}
        {activeSection === 'behavior' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Response Length</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {['short', 'medium', 'long'].map(len => (
                  <button key={len} onClick={() => setBehavior({ ...behavior, responseLength: len })}
                    style={{
                      flex: 1, padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600,
                      border: `2px solid ${behavior.responseLength === len ? 'var(--accent)' : 'var(--border)'}`,
                      background: behavior.responseLength === len ? 'var(--accent-subtle)' : 'transparent',
                      color: behavior.responseLength === len ? 'var(--accent)' : 'var(--text)', cursor: 'pointer', textTransform: 'capitalize'
                    }}>
                    {len}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Response Options</label>
              {[
                { key: 'includeCitations', label: 'Include citations in responses', desc: 'Reference knowledge base sources' },
                { key: 'includeSources', label: 'Show source names', desc: 'Display which KB articles were used' },
                { key: 'fallbackToWeb', label: 'Allow web search fallback', desc: 'Search the web if KB is empty' },
              ].map(({ key, label, desc }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input type="checkbox" checked={behavior[key as keyof typeof behavior] as boolean}
                    onChange={e => setBehavior({ ...behavior, [key]: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>{label}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Max Citations: {behavior.maxCitations}
              </label>
              <input type="range" min="1" max="10" value={behavior.maxCitations}
                onChange={e => setBehavior({ ...behavior, maxCitations: parseInt(e.target.value) })}
                style={{ accentColor: 'var(--accent)' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>System Prompt</label>
              <textarea className="input" rows={6} style={{ resize: 'vertical', minHeight: '150px' }}
                value={config.system_prompt}
                onChange={e => setConfig({ ...config, system_prompt: e.target.value })}
                placeholder="You are a helpful IT support assistant..." />
            </div>
          </div>
        )}

        {/* TOOLS SECTION */}
        {activeSection === 'tools' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Plug size={18} color="var(--accent)" />
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Enabled Tools</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Control what actions the AI can perform</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { key: 'searchTickets' as const, label: 'Search Tickets', desc: 'Find and filter tickets', icon: Search },
                { key: 'createTickets' as const, label: 'Create Tickets', desc: 'Create new support tickets', icon: Plus },
                { key: 'getTicketDetails' as const, label: 'Get Ticket Details', desc: 'View full ticket information', icon: FileText },
                { key: 'getMyTickets' as const, label: 'Get My Tickets', desc: "View user's assigned tickets", icon: User },
                { key: 'searchKnowledge' as const, label: 'Search Knowledge Base', desc: 'Query KB articles', icon: Book },
                { key: 'getStats' as const, label: 'Get Statistics', desc: 'View ticket statistics', icon: BarChart3 },
              ].map(({ key, label, desc, icon: Icon }) => (
                <div key={key} style={{ padding: '16px', background: tools[key] ? 'var(--bg-secondary)' : 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: `1px solid ${tools[key] ? 'var(--border)' : 'var(--border-subtle)'}`, display: 'flex', alignItems: 'flex-start', gap: '12px', opacity: tools[key] ? 1 : 0.6 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: tools[key] ? 'var(--accent-subtle)' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} color={tools[key] ? 'var(--accent)' : 'var(--text-muted)'} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{label}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{desc}</div>
                  </div>
                  <input type="checkbox" checked={tools[key]}
                    onChange={e => setTools({ ...tools, [key]: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', marginTop: '2px' }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECURITY & RULES SECTION */}
        {activeSection === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'block' }}>
                <Shield size={14} style={{ display: 'inline', marginRight: '6px' }} />
                AI Behavior Rules
              </label>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Add rules to control how the AI responds in specific situations</p>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input className="input" value={newRule} onChange={e => setNewRule(e.target.value)}
                  placeholder="e.g. Never suggest deleting tickets"
                  onKeyDown={e => { if (e.key === 'Enter') addRule(); }}
                  style={{ flex: 1 }} />
                <button onClick={addRule} style={{ padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  Add Rule
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {rules.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
                    <Shield size={24} style={{ margin: '0 auto 8px', color: 'var(--text-muted)' }} />
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>No rules defined yet. Add rules to constrain AI behavior.</p>
                  </div>
                ) : (
                  rules.map((rule, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                      <Shield size={16} color="var(--accent)" />
                      <span style={{ flex: 1, fontSize: '14px', color: 'var(--text)' }}>{rule}</span>
                      <button onClick={() => removeRule(rule)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px', transition: 'all 0.15s ease' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.borderRadius = 'var(--radius-sm)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ padding: '16px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--warning-border)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <AlertTriangle size={18} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '13px', color: 'var(--text)' }}>
                <strong>Security Note:</strong> The AI has access to ticket data based on user permissions. Always review AI-generated responses before sending to customers.
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '8px' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}
            style={{ padding: '12px 32px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
