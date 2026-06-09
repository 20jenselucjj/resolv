'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Brain, Sparkles, Shield, Search, User, Book, BarChart3,
  Plug, Save, RefreshCw, AlertTriangle, ChevronDown, ChevronRight, ExternalLink, Settings,
  Ticket, List, UserPlus
} from 'lucide-react';
import { api } from '@/lib/api';
import type { AIConfig, AiGuidelinesSection } from './types';

// ─── Guideline section metadata ──────────────────────────────────────────
interface GuidelineSectionDef {
  key: keyof AiGuidelinesSection;
  label: string;
  description: string;
  forRole: 'both' | 'agent' | 'portal';
}
const GUIDELINE_SECTIONS: GuidelineSectionDef[] = [
  { key: 'ticketLookup', label: 'Ticket Lookup Rule', description: 'How the AI must handle ticket number lookups', forRole: 'both' },
  { key: 'autonomousExecution', label: 'Autonomous Execution Rules', description: 'Tool authority, announcing actions, chain-of-thought policy', forRole: 'agent' },
  { key: 'conversationalTone', label: 'Conversational Tone', description: 'How the AI should communicate with users', forRole: 'both' },
  { key: 'ticketCreationWorkflow', label: 'Ticket Creation Workflow', description: 'Step-by-step flow with troubleshooting', forRole: 'both' },
  { key: 'priorityGuidelines', label: 'Priority Guidelines', description: 'How to determine ticket priority levels', forRole: 'agent' },
  { key: 'ticketTypeGuidelines', label: 'Ticket Type Guidelines', description: 'How to determine ticket types', forRole: 'agent' },
  { key: 'categoryGuidelines', label: 'Category Guidelines', description: 'Category mapping for common IT issues', forRole: 'agent' },
  { key: 'ticketEditingWorkflow', label: 'Ticket Editing Workflow', description: 'How to handle ticket update requests', forRole: 'agent' },
  { key: 'commentWorkflow', label: 'Comment Workflow', description: 'How to handle adding comments to tickets', forRole: 'both' },
  { key: 'enumRule', label: 'Enum Values Rule', description: 'Casing requirements for enum fields', forRole: 'agent' },
  { key: 'hallucinationGuard', label: 'Hallucination Guard', description: 'Rules to prevent fabricating ticket data', forRole: 'agent' },
  { key: 'toolUsageRules', label: 'Tool Usage Rules', description: 'When and how the AI must use tools for factual queries', forRole: 'both' },
];

// ─── Reusable subsection header ─────────────────────────────────────────
function SubHeader({ icon, label, badge, color }: { icon: React.ReactNode; label: string; badge?: string; color?: string }) {
  const c = color || 'var(--accent)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
      <div style={{ width: 26, height: 26, borderRadius: 'var(--radius-sm)', background: `${c}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{label}</span>
      {badge && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: `${c}15`, color: c, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{badge}</span>}
    </div>
  );
}

// ─── Reusable behavior card ──────────────────────────────────────────────
function BehaviorCard({ behavior, onChange, color }: { behavior: Record<string, any>; onChange: (b: any) => void; color?: string }) {
  const ac = color || 'var(--accent)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Response Length</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['short', 'medium', 'long'].map(len => (
            <button key={len} onClick={() => onChange({ ...behavior, responseLength: len })}
              style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, textTransform: 'capitalize', border: `2px solid ${behavior.responseLength === len ? ac : 'var(--border)'}`, background: behavior.responseLength === len ? `${ac}12` : 'transparent', color: behavior.responseLength === len ? ac : 'var(--text)', cursor: 'pointer' }}
            >{len}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        {[
          { key: 'includeCitations' as const, label: 'Include citations', desc: 'Reference knowledge base sources' },
          { key: 'includeSources' as const, label: 'Show source names', desc: 'Display which KB articles were used' },
          { key: 'fallbackToWeb' as const, label: 'Web search fallback', desc: 'Search the web if KB is empty' },
        ].map(({ key, label: lbl, desc }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0' }}>
            <input type="checkbox" checked={!!behavior[key]} onChange={e => onChange({ ...behavior, [key]: e.target.checked })} style={{ width: '16px', height: '16px', accentColor: ac }} />
            <div><div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{lbl}</div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{desc}</div></div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max Citations: {behavior.maxCitations}</label>
        <input type="range" min="1" max="10" value={behavior.maxCitations ?? 3} onChange={e => onChange({ ...behavior, maxCitations: parseInt(e.target.value) })} style={{ accentColor: ac }} />
      </div>
    </div>
  );
}

// ─── Reusable tools toggle grid (grouped) ────────────────────────────────
function GroupedToolsGrid({ tools, onChange, color, showAll }: { tools: Record<string, boolean>; onChange: (t: any) => void; color?: string; showAll?: boolean }) {
  const ac = color || 'var(--accent)';

  const groups = showAll ? [
    {
      label: 'Ticket Management', icon: '\u{1F527}',
      items: [
        { key: 'searchTickets', label: 'Search Tickets', desc: 'Find and filter tickets by keyword, status, priority' },
        { key: 'getTicketDetails', label: 'Get Ticket Details', desc: 'View full ticket info, comments, and activity' },
        { key: 'createTickets', label: 'Create Tickets', desc: 'Create new support tickets' },
        { key: 'updateTickets', label: 'Update Tickets', desc: 'Modify status, priority, assignment, and fields' },
        { key: 'addComments', label: 'Add Comments', desc: 'Add public replies or internal notes' },
        { key: 'addAttachments', label: 'Add Attachments', desc: 'Attach uploaded files to existing tickets' },
      ]
    },
    {
      label: 'Knowledge', icon: '\u{1F4DA}',
      items: [
        { key: 'searchKnowledge', label: 'Search Knowledge Base', desc: 'Query articles and RAG documents' },
      ]
    },
    {
      label: 'Users', icon: '\u{1F464}',
      items: [
        { key: 'searchUsers', label: 'Search Users', desc: 'Look up users by name or email' },
      ]
    },
    {
      label: 'Analytics', icon: '\u{1F4CA}',
      items: [
        { key: 'getStats', label: 'Get Statistics', desc: 'View ticket counts and metrics' },
      ]
    },
    {
      label: 'My Tickets', icon: '\u{1F3AB}',
      items: [
        { key: 'getMyTickets', label: 'My Tickets', desc: 'View tickets you submitted' },
      ]
    },
  ] : [
    {
      label: 'Ticket Management', icon: '\u{1F527}',
      items: [
        { key: 'getTicketDetails', label: 'Get Ticket Details', desc: 'View full ticket info' },
        { key: 'createTickets', label: 'Create Tickets', desc: 'Create new support tickets' },
        { key: 'addComments', label: 'Add Comments', desc: 'Add replies to your tickets' },
        { key: 'searchTickets', label: 'Search Tickets', desc: 'Search your own tickets by keyword or status' },
        { key: 'addAttachments', label: 'Add Attachments', desc: 'Attach uploaded files to tickets' },
      ]
    },
    {
      label: 'Knowledge', icon: '\u{1F4DA}',
      items: [
        { key: 'searchKnowledge', label: 'Search Knowledge Base', desc: 'Find answers from KB' },
      ]
    },
    {
      label: 'Users', icon: '\u{1F464}',
      items: [
        { key: 'searchUsers', label: 'Search Users', desc: 'Look up users by name' },
      ]
    },
    {
      label: 'My Tickets', icon: '\u{1F3AB}',
      items: [
        { key: 'getMyTickets', label: 'My Tickets', desc: 'View your tickets' },
      ]
    },
    {
      label: 'Analytics', icon: '\u{1F4CA}',
      items: [
        { key: 'getStats', label: 'Get Statistics', desc: 'View your ticket counts, SLA status, and metrics' },
      ]
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {groups.map(group => (
        <div key={group.label} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{group.icon}</span>
            <span>{group.label}</span>
          </div>
          <div style={{ padding: '8px' }}>
            {group.items.map(({ key, label, desc }) => {
              const isOn = tools[key] !== false;
              return (
                <div key={key} style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: 'var(--radius-sm)' }}>
                  <input type="checkbox" checked={isOn} onChange={e => onChange({ ...tools, [key]: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: ac, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: isOn ? 'var(--text)' : 'var(--text-muted)' }}>{label}</div>
                    <div style={{ fontSize: '11px', color: isOn ? 'var(--text-muted)' : 'var(--text-muted)' }}>{desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Suggestion defaults ─────────────────────────────────────────────────
const DEFAULT_PORTAL_SUGGESTIONS: Record<string, { enabled: boolean; label: string; prompt: string; icon: string }> = {
  createTicket: { enabled: true, label: 'Create Ticket', prompt: 'I need to create a support ticket', icon: 'ticket' },
  viewTickets: { enabled: true, label: 'My Tickets', prompt: 'Show my open tickets', icon: 'list' },
  searchKB: { enabled: true, label: 'Search KB', prompt: 'Search the knowledge base for answers', icon: 'search' },
  contactSupport: { enabled: true, label: 'Contact Support', prompt: 'I need to speak with a support agent', icon: 'user' },
};

const DEFAULT_AGENT_SUGGESTIONS: Record<string, { enabled: boolean; label: string; prompt: string; icon: string }> = {
  createTicket: { enabled: true, label: 'Create Ticket', prompt: 'I need to create a support ticket', icon: 'ticket' },
  searchTickets: { enabled: true, label: 'Search Tickets', prompt: 'Find tickets by keyword or status', icon: 'search' },
  viewStats: { enabled: true, label: 'View Stats', prompt: 'Show me ticket statistics and metrics', icon: 'stats' },
  searchKB: { enabled: true, label: 'Search KB', prompt: 'Search the knowledge base for answers', icon: 'book' },
  assignToMe: { enabled: true, label: 'Assign to Me', prompt: 'Assign open tickets to myself', icon: 'userPlus' },
};

const ICON_OPTIONS = [
  { value: 'ticket', Icon: Ticket },
  { value: 'list', Icon: List },
  { value: 'search', Icon: Search },
  { value: 'user', Icon: User },
  { value: 'stats', Icon: BarChart3 },
  { value: 'book', Icon: Book },
  { value: 'userPlus', Icon: UserPlus },
];

// ─── Reusable suggestion config card ────────────────────────────────────
function SuggestionConfigCard({ item, onChange, color }: { item: { enabled: boolean; label: string; prompt: string; icon: string }; onChange: (v: any) => void; color?: string }) {
  const ac = color || 'var(--accent)';
  return (
    <div style={{ padding: '14px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        {/* Toggle */}
        <div onClick={() => onChange({ ...item, enabled: !item.enabled })}
          style={{ width: 36, height: 20, borderRadius: 10, cursor: 'pointer', background: item.enabled ? ac : 'var(--bg-tertiary)', border: `1px solid ${item.enabled ? ac : 'var(--border)'}`, position: 'relative', transition: 'all 0.2s ease', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: 2, left: item.enabled ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: item.enabled ? 'white' : 'var(--text-muted)', transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
        </div>
        {/* Icon picker */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {ICON_OPTIONS.map(opt => {
            const IconComp = opt.Icon;
            const selected = item.icon === opt.value;
            return (
              <button key={opt.value} onClick={() => onChange({ ...item, icon: opt.value })}
                style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${selected ? ac : 'var(--border)'}`, background: selected ? `${ac}15` : 'transparent', cursor: 'pointer' }}
                title={opt.value}
              ><IconComp size={14} color={selected ? ac : 'var(--text-muted)'} /></button>
            );
          })}
        </div>
        {/* Label */}
        <input className="input" value={item.label} onChange={e => onChange({ ...item, label: e.target.value })}
          style={{ flex: 1, fontSize: '13px', padding: '6px 10px' }} placeholder="Button label" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Prompt:</label>
        <input className="input" value={item.prompt} onChange={e => onChange({ ...item, prompt: e.target.value })}
          style={{ flex: 1, fontSize: '13px', padding: '6px 10px' }} placeholder="What the suggestion does" />
      </div>
    </div>
  );
}

export function AIConfigTab({ showAlert }: { showAlert: (m: string, t?: 'success' | 'error') => void }) {
  const [config, setConfig] = useState<AIConfig>({
    enabled: false, provider: 'openai', base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini', temperature: 0.7, max_tokens: 2048,
    system_prompt: '', allowed_roles: ['admin', 'agent'], max_messages_per_day: 50,
    portal_enabled: false, portal_model: 'gpt-4o-mini', portal_temperature: 0.7, portal_max_tokens: 1024,
    portal_system_prompt: 'You are a helpful customer support assistant. Help customers find answers to their questions and resolve common issues on their own.',
    portal_allowed_roles: ['user'],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [activeSection, setActiveSection] = useState<'general' | 'agent' | 'portal' | 'guidelines'>(() => {
    try { return (localStorage.getItem('resolv_ai_config_section') as 'general' | 'agent' | 'portal' | 'guidelines') || 'general' } catch { return 'general' }
  });

  useEffect(() => { localStorage.setItem('resolv_ai_config_section', activeSection) }, [activeSection]);

  // Agent tools & behavior
  const [tools, setTools] = useState({ searchTickets: true, createTickets: true, getTicketDetails: true, getMyTickets: true, searchKnowledge: true, getStats: true, updateTickets: true, addComments: true, searchUsers: true, addAttachments: true });
  const [behavior, setBehavior] = useState({ responseLength: 'medium', includeCitations: true, includeSources: true, fallbackToWeb: false, maxCitations: 3 });

  // Portal tools & behavior (separate!)
  const [portalTools, setPortalTools] = useState({ getTicketDetails: true, createTickets: true, getMyTickets: true, searchKnowledge: true, addComments: true, searchUsers: true, searchTickets: true, addAttachments: true, getStats: true });
  const [portalBehavior, setPortalBehavior] = useState({ responseLength: 'medium', includeCitations: true, includeSources: true, fallbackToWeb: false, maxCitations: 3 });

  // Suggestion buttons
  const [portalSuggestions, setPortalSuggestions] = useState(DEFAULT_PORTAL_SUGGESTIONS);
  const [agentSuggestions, setAgentSuggestions] = useState(DEFAULT_AGENT_SUGGESTIONS);

  // Guidelines
  const [guidelines, setGuidelines] = useState<{ agent: AiGuidelinesSection; portal: AiGuidelinesSection }>({
    agent: { ticketLookup: '', autonomousExecution: '', conversationalTone: '', ticketCreationWorkflow: '', priorityGuidelines: '', ticketTypeGuidelines: '', categoryGuidelines: '', ticketEditingWorkflow: '', commentWorkflow: '', enumRule: '', hallucinationGuard: '', toolUsageRules: '' },
    portal: { ticketLookup: '', conversationalTone: '', ticketCreationWorkflow: '', commentWorkflow: '', toolUsageRules: '' },
  });
  const [guidelinesSubTab, setGuidelinesSubTab] = useState<'agent' | 'portal'>(() => {
    try { return (localStorage.getItem('resolv_ai_guidelines_subtab') as 'agent' | 'portal') || 'agent' } catch { return 'agent' }
  });

  useEffect(() => { localStorage.setItem('resolv_ai_guidelines_subtab', guidelinesSubTab) }, [guidelinesSubTab]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(
    GUIDELINE_SECTIONS.filter(s => s.forRole === 'agent' || s.forRole === 'both').map(s => `agent.${s.key}`)
  ));
  const toggleExpanded = (id: string) => {
    setExpandedSections(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  // ─── Fetch config ─────────────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get<{ data: any }>('/ai/config');
      if (res.data) {
        setConfig(prev => ({ ...prev, ...res.data }));
        if (res.data.tools) setTools(res.data.tools);
        if (res.data.behavior) setBehavior(res.data.behavior);
        if (res.data.portal_tools) setPortalTools(res.data.portal_tools);
        if (res.data.portal_behavior) setPortalBehavior(res.data.portal_behavior);
        if (res.data.portal_suggestions) setPortalSuggestions(res.data.portal_suggestions);
        if (res.data.agent_suggestions) setAgentSuggestions(res.data.agent_suggestions);
        if (res.data.guidelines) setGuidelines(res.data.guidelines);
      }
    } catch (err) {
      console.error('Failed to fetch AI config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchConfig(), 0);
    return () => clearTimeout(timer);
  }, [fetchConfig]);

  // ─── Save ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/ai/config', { ...config, tools, behavior, portal_tools: portalTools, portal_behavior: portalBehavior, portal_suggestions: portalSuggestions, agent_suggestions: agentSuggestions, guidelines });
      showAlert('AI configuration saved successfully');
      fetchConfig();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to save AI configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateGuideline = (type: 'agent' | 'portal', key: string, value: string) => {
    setGuidelines(prev => ({ ...prev, [type]: { ...prev[type], [key]: value as any } }));
  };

  // ─── Loading ───────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: '60px 40px', textAlign: 'center' }}>
      <Sparkles size={32} className="animate-spin" style={{ margin: '0 auto 16px', color: 'var(--accent)' }} />
      <div style={{ fontSize: '14px', fontWeight: 600 }}>Loading AI configuration...</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, var(--bg) 100%)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(37, 99, 235, 0.2)' }}>

        {/* ── Tab Navigation ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
          {([
            { key: 'general' as const, label: 'General', icon: Settings },
            { key: 'agent' as const, label: 'Agent AI', icon: Brain },
            { key: 'portal' as const, label: 'Portal AI', icon: ExternalLink },
            { key: 'guidelines' as const, label: 'Guidelines', icon: Shield },
          ]).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveSection(key)}
              style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: `2px solid ${activeSection === key ? 'var(--accent)' : 'transparent'}`, color: activeSection === key ? 'var(--accent)' : 'var(--text-muted)', marginBottom: '-1px', transition: 'color 0.15s' }}
            ><Icon size={14} />{label}</button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* GENERAL — Shared provider & API key                             */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeSection === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '20px' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                style={{ width: 48, height: 26, borderRadius: 13, cursor: 'pointer', background: config.enabled ? 'var(--accent)' : 'var(--bg-tertiary)', border: `1px solid ${config.enabled ? 'var(--accent)' : 'var(--border)'}`, position: 'relative', transition: 'all 0.2s ease', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: config.enabled ? 24 : 2, width: 20, height: 20, borderRadius: '50%', background: config.enabled ? 'white' : 'var(--text-muted)', transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Enable AI Assistant</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Master switch — when off, all AI features are disabled</div>
              </div>
              {config.enabled && <div style={{ marginLeft: 'auto', padding: '4px 12px', background: 'var(--success-bg)', borderRadius: 'var(--radius-full)', fontSize: '12px', fontWeight: 600, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />Active</div>}
            </div>

            <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <SubHeader icon={<Settings size={14} color="var(--accent)" />} label="Shared Provider &amp; API" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Provider</label>
                  <select className="input" value={config.provider} onChange={e => setConfig({ ...config, provider: e.target.value })}>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google</option>
                    <option value="custom">Custom / Self-hosted</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Base URL</label>
                  <input className="input" value={config.base_url} onChange={e => setConfig({ ...config, base_url: e.target.value })} placeholder="https://api.openai.com/v1" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>API Key</label>
                  <div style={{ position: 'relative' }}>
                    <input className="input" type={showApiKey ? 'text' : 'password'} value={config.api_key || ''} onChange={e => setConfig({ ...config, api_key: e.target.value })} placeholder="Enter API key" style={{ paddingRight: '80px' }} />
                    <button onClick={() => setShowApiKey(!showApiKey)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', padding: '4px 8px' }}>{showApiKey ? 'Hide' : 'Show'}</button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '14px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--warning-border)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <AlertTriangle size={15} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '12px', color: 'var(--text)' }}>
                <strong>One provider for all AI.</strong> Configure the model, behavior, tools, and guidelines for each AI persona separately on the <strong>Agent AI</strong> and <strong>Portal AI</strong> tabs.
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* AGENT AI — Model, behavior, tools                                */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeSection === 'agent' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '20px' }}>

            <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <SubHeader icon={<Brain size={14} color="var(--accent)" />} label="Model &amp; Access" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Model</label>
                    <input className="input" value={config.model} onChange={e => setConfig({ ...config, model: e.target.value })} placeholder="e.g. gpt-4o-mini" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max Tokens: {config.max_tokens}</label>
                    <input type="range" min="256" max="8192" step="256" value={config.max_tokens} onChange={e => setConfig({ ...config, max_tokens: parseInt(e.target.value) })} style={{ accentColor: 'var(--accent)' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Temperature ({config.temperature})</label>
                  <input type="range" min="0" max="2" step="0.1" value={config.temperature} onChange={e => setConfig({ ...config, temperature: parseFloat(e.target.value) })} style={{ accentColor: 'var(--accent)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>System Prompt</label>
                  <textarea className="input" rows={3} value={config.system_prompt} onChange={e => setConfig({ ...config, system_prompt: e.target.value })} placeholder="You are a helpful IT support assistant..." style={{ resize: 'vertical', minHeight: '60px', fontSize: '13px', fontFamily: 'monospace' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Allowed Roles</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['admin', 'agent', 'user'].map(role => {
                      const isOn = (config.allowed_roles || []).includes(role);
                      return <button key={role} onClick={() => setConfig({ ...config, allowed_roles: isOn ? config.allowed_roles.filter(r => r !== role) : [...(config.allowed_roles || []), role] })}
                        style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, textTransform: 'capitalize', border: `2px solid ${isOn ? 'var(--accent)' : 'var(--border)'}`, background: isOn ? 'var(--accent-subtle)' : 'transparent', color: isOn ? 'var(--accent)' : 'var(--text)', cursor: 'pointer' }}
                      >{role}</button>;
                    })}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Daily Message Limit: {config.max_messages_per_day}</label>
                  <input type="range" min="1" max="500" step="1" value={config.max_messages_per_day} onChange={e => setConfig({ ...config, max_messages_per_day: parseInt(e.target.value) })} style={{ accentColor: 'var(--accent)' }} />
                </div>
              </div>
            </div>

            <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <SubHeader icon={<RefreshCw size={14} color="var(--accent)" />} label="Response Behavior" />
              <BehaviorCard behavior={behavior} onChange={setBehavior} />
            </div>

            <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <SubHeader icon={<Sparkles size={14} color="var(--accent)" />} label="Suggestion Buttons" badge="Agent" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                {Object.entries(agentSuggestions).map(([key, item]) => (
                  <SuggestionConfigCard key={key} item={item} onChange={updated => setAgentSuggestions(prev => ({ ...prev, [key]: updated }))} />
                ))}
              </div>
            </div>

            <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <SubHeader icon={<Plug size={14} color="var(--accent)" />} label="Enabled Tools" badge="Agent" />
              <GroupedToolsGrid tools={tools} onChange={setTools} showAll />
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* PORTAL AI — Separate model, behavior, tools                      */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeSection === 'portal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '20px' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div onClick={() => setConfig({ ...config, portal_enabled: !config.portal_enabled })}
                style={{ width: 48, height: 26, borderRadius: 13, cursor: 'pointer', background: config.portal_enabled ? '#10b981' : 'var(--bg-tertiary)', border: `1px solid ${config.portal_enabled ? '#10b981' : 'var(--border)'}`, position: 'relative', transition: 'all 0.2s ease', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: config.portal_enabled ? 24 : 2, width: 20, height: 20, borderRadius: '50%', background: config.portal_enabled ? 'white' : 'var(--text-muted)', transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Enable Portal AI</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Allow end-users to interact with the AI from the self-service portal</div>
              </div>
              {config.portal_enabled && <div style={{ marginLeft: 'auto', padding: '4px 12px', background: 'rgba(16,185,129,0.1)', borderRadius: 'var(--radius-full)', fontSize: '12px', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />Active</div>}
            </div>

            {config.portal_enabled && (
              <>
                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <SubHeader icon={<ExternalLink size={14} color="#10b981" />} label="Model &amp; Access" badge="Portal" color="#10b981" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Model</label>
                        <input className="input" value={config.portal_model} onChange={e => setConfig({ ...config, portal_model: e.target.value })} placeholder="e.g. gpt-4o-mini" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max Tokens: {config.portal_max_tokens}</label>
                        <input type="range" min="256" max="8192" step="256" value={config.portal_max_tokens} onChange={e => setConfig({ ...config, portal_max_tokens: parseInt(e.target.value) })} style={{ accentColor: '#10b981' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Temperature ({config.portal_temperature})</label>
                      <input type="range" min="0" max="2" step="0.1" value={config.portal_temperature} onChange={e => setConfig({ ...config, portal_temperature: parseFloat(e.target.value) })} style={{ accentColor: '#10b981' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>System Prompt</label>
                      <textarea className="input" rows={3} value={config.portal_system_prompt} onChange={e => setConfig({ ...config, portal_system_prompt: e.target.value })} placeholder="You are a helpful customer support assistant..." style={{ resize: 'vertical', minHeight: '60px', fontSize: '13px', fontFamily: 'monospace' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Allowed Roles</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {['admin', 'agent', 'user'].map(role => {
                          const roles = config.portal_allowed_roles || [];
                          const isOn = roles.includes(role);
                          return <button key={role} onClick={() => setConfig({ ...config, portal_allowed_roles: isOn ? roles.filter(r => r !== role) : [...roles, role] })}
                            style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, textTransform: 'capitalize', border: `2px solid ${isOn ? '#10b981' : 'var(--border)'}`, background: isOn ? 'rgba(16,185,129,0.08)' : 'transparent', color: isOn ? '#10b981' : 'var(--text)', cursor: 'pointer' }}
                          >{role}</button>;
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <SubHeader icon={<RefreshCw size={14} color="#10b981" />} label="Response Behavior" badge="Portal" color="#10b981" />
                  <BehaviorCard behavior={portalBehavior} onChange={setPortalBehavior} color="#10b981" />
                </div>

                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <SubHeader icon={<Sparkles size={14} color="#10b981" />} label="Suggestion Buttons" badge="Portal" color="#10b981" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                    {Object.entries(portalSuggestions).map(([key, item]) => (
                      <SuggestionConfigCard key={key} item={item} onChange={updated => setPortalSuggestions(prev => ({ ...prev, [key]: updated }))} color="#10b981" />
                    ))}
                  </div>
                </div>

                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <SubHeader icon={<Plug size={14} color="#10b981" />} label="Enabled Tools" badge="Portal" color="#10b981" />
                  <GroupedToolsGrid tools={portalTools} onChange={setPortalTools} color="#10b981" />
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Portal AI has a subset of tools appropriate for self-service users. Search Tickets is scoped to the user's own tickets. Get Statistics is agent-only.</p>
                </div>

              </>
            )}

            {!config.portal_enabled && (
              <div style={{ padding: '30px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
                <ExternalLink size={24} style={{ margin: '0 auto 8px', color: 'var(--text-muted)' }} />
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Portal AI is disabled. Toggle the switch above to configure it separately from the Agent AI.</p>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* GUIDELINES — Behavioral instructions for each AI                 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeSection === 'guidelines' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '20px' }}>
            <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
              {(['agent', 'portal'] as const).map(sub => (
                <button key={sub} onClick={() => setGuidelinesSubTab(sub)}
                  style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: `2px solid ${guidelinesSubTab === sub ? 'var(--accent)' : 'transparent'}`, color: guidelinesSubTab === sub ? 'var(--accent)' : 'var(--text-muted)', marginBottom: '-1px', transition: 'color 0.15s', textTransform: 'capitalize' }}
                >{sub === 'agent' ? <><Brain size={13} />Agent AI</> : <><ExternalLink size={13} />Portal AI</>}</button>
              ))}
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              These instructions are injected into the AI's system prompt. Edit them to control how the <strong>{guidelinesSubTab === 'agent' ? 'Agent' : 'Portal'}</strong> AI behaves. Each section is a category of behavioral rules.
            </p>

            {GUIDELINE_SECTIONS.filter(s => s.forRole === guidelinesSubTab || s.forRole === 'both').map(section => {
              const id = `${guidelinesSubTab}.${section.key}`;
              const isOpen = expandedSections.has(id);
              const value = guidelines[guidelinesSubTab][section.key] as string || '';
              return (
                <div key={id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <button onClick={() => toggleExpanded(id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--text)', textAlign: 'left' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                  >
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span style={{ flex: 1 }}>{section.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>{section.description}</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
                      <textarea className="input" rows={8} value={value}
                        onChange={e => updateGuideline(guidelinesSubTab, section.key, e.target.value)}
                        style={{ width: '100%', resize: 'vertical', minHeight: '120px', fontSize: '13px', fontFamily: 'monospace', lineHeight: '1.5' }}
                        placeholder={`Enter ${section.label.toLowerCase()}...`}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ padding: '14px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--warning-border)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <AlertTriangle size={15} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '12px', color: 'var(--text)' }}>
                <strong>Security Note:</strong> The AI follows these behavioral rules within its system prompt. Keep instructions clear and specific to avoid unexpected behavior.
              </div>
            </div>
          </div>
        )}

        {/* ── Save Button ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '20px' }}>
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