'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import {
  LayoutDashboard, Users, Layers, Clock, Settings, FileText,
  ShieldCheck, CalendarClock, Mail,
  LayoutGrid, Book, Sparkles,
  Search, Lock, Server, Database, Activity, X, AlertCircle, CheckCircle,
  RefreshCw, RotateCcw, ChevronLeft, ChevronRight, Filter, Calendar,
  UserPlus, MoreVertical, Edit2, Trash2, Plus, Save,
  AlertTriangle, Hash, Trash,
  Shield, Monitor, Download, GitBranch, Cloud, Package,
  KeyRound, Bell, ClipboardList, ShieldAlert, Radio,
  Bug, Wrench, CheckSquare, CalendarDays
} from 'lucide-react';
import { DirectorySyncTab } from './DirectorySyncTab';
import {
  OverviewTab, UsersTab,
  SettingsTab, RolesTab, AuditLogTab,
  PortalCustomizationTab,
  CannedResponsesTab, AssetGroupsTab, AgentSettingsTab,
  BackupRestoreTab,
  EmailTab,
  TicketsTab, SlaHoursTab, AiTab, ClassificationRulesTab,
  CustomFieldsTab, ServiceCatalogTab, WorkflowDesignerTab,
  AuthenticationTab, NotificationSettingsTab,
  ProblemMgmtTab, ChangeMgmtTab, ApprovalWorkflowsTab,
  CmdbTab, WebhooksTab, LicenseComplianceTab,
} from './components';
import { ConfirmModal, Alert, Modal } from './components/SharedUI';
import type {
  AdminStats, AuditEntry, UserProfile, Category, SLAPolicy, AdminSetting
} from './components/types';
import type { AutomationRule } from './components/types';

const EmailIcon = Mail;

function inferSettingType(value: string): 'string' | 'number' | 'boolean' {
  if (value === 'true' || value === 'false') return 'boolean';
  if (!isNaN(Number(value)) && value !== '') return 'number';
  return 'string';
}

function inferSettingGroup(key: string): string {
  if (key.includes('smtp') || key.includes('email') || key.includes('mail')) return 'Email / Notifications';
  if (key.includes('auth') || key.includes('security') || key.includes('password') || key.includes('session')) return 'Security';
  if (key.includes('sla') || key.includes('ticket') || key.includes('auto')) return 'Ticket Settings';
  return 'General';
}

const TAB_SUBTITLES: Record<string, string> = {
  overview: 'System monitoring, statistics, and recent activity overview',
  users: 'Manage user accounts, departments, and active statuses',
  authentication: 'Configure SSO providers, directory sync, and login mode for enterprise authentication',
  roles: 'Define security roles, access permissions, and privileges',
  tickets: 'Define ticket types, categories, workflow transitions, and status labels',
  'sla-hours': 'Set Service Level Agreement targets, business hours, and holiday calendars',
  'workflow-designer': 'Design visual workflows with triggers, conditions, and sequenced steps, or create quick single-rule automations',
  classification: 'Configure keyword rules to auto-classify tickets by type (incident, request, problem, change)',
  'custom-fields': 'Create and manage custom fields for tickets and assets',
  'service-catalog': 'Manage service catalog categories and items for user self-service',
  email: 'Configure outbound email, inbound email, templates, auto replies, and view email logs',
  ai: 'Configure the AI assistant, manage knowledge training sources, and RAG settings',
  'problem-mgmt': 'Configure problem management templates, auto-linking rules, and known error lifecycle',
  'change-mgmt': 'Configure change types, risk framework, and plan templates',
  'cmdb': 'Manage configuration items, CI relationships, and the configuration management database',
  'webhooks': 'Configure outbound webhook integrations and manage event delivery to external systems',
  'approval-workflows': 'Configure approval step templates, escalation rules, due date defaults, and routing rules',
  'notification-settings': 'Configure notification triggers, event alerts, and delivery channels for tickets and ITSM processes',
  'asset-groups': 'Manage asset groups, categories, software licenses, and compliance defaults',
  'portal-customization': 'Customize the self-service portal branding, hero, quick actions, and end-user experience',
  'canned-responses': 'Create and manage saved reply templates for faster, consistent ticket responses',
  'agent-settings': 'Configure and deploy the Windows desktop agent for asset discovery and monitoring',
  'license-compliance': 'Configure software license compliance thresholds, renewal notices, default currency, and license categories',
  settings: 'Manage global system configuration, integrations, and application-wide settings',
};

export default function AdminPage() {
  const { user } = useStore();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const tabFromUrl = searchParams?.get('tab');
    if (tabFromUrl) return tabFromUrl;
    if (typeof window !== 'undefined') {
      try { return localStorage.getItem('resolv_admin_tab') || 'overview'; } catch { return 'overview'; }
    }
    return 'overview';
  });
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  // Tab Data
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [slaPolicies, setSLAPolicies] = useState<SLAPolicy[]>([]);
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [assetGroups, setAssetGroups] = useState<any[]>([]);

  // Forms/Modals
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditFilterAction, setAuditFilterAction] = useState('');
  const [auditFilterUser, setAuditFilterUser] = useState('');
  const [auditFilterEntityType, setAuditFilterEntityType] = useState('');
  const [auditFilterSearch, setAuditFilterSearch] = useState('');
  const [auditDateRange, setAuditDateRange] = useState('');
  const [auditTotalPages, setAuditTotalPages] = useState(0);
  const [auditTotal, setAuditTotal] = useState(0);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);

  // Sidebar Search
  const [sidebarSearch, setSidebarSearch] = useState('');

  // System Health Status
  const [healthStatus, setHealthStatus] = useState({ api: true, db: true, email: true });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await api.get<{ data: { api: boolean; db: boolean; email: boolean } }>('/health');
        setHealthStatus(res.data || { api: true, db: true, email: true });
      } catch {
        setHealthStatus({ api: false, db: false, email: false });
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Deep search index: maps keywords/phrases to tab IDs
  const searchIndex = useMemo(() => [
    { tab: 'overview', keywords: ['overview', 'dashboard', 'stats', 'statistics', 'summary', 'activity', 'monitor', 'health', 'kpi', 'metrics'] },
    { tab: 'users', keywords: ['users', 'user', 'invite', 'accounts', 'people', 'members', 'staff', 'deactivate', 'activate', 'password', 'reset', 'department', 'bulk'] },
    { tab: 'roles', keywords: ['roles', 'permissions', 'access', 'rbac', 'admin', 'agent', 'privileges', 'security', 'manage users', 'delete tickets', 'assign tickets'] },
    { tab: 'authentication', keywords: ['authentication', 'sso', 'single sign-on', 'saml', 'ldap', 'directory sync', 'directory', 'sync', 'provision', 'google workspace', 'active directory', 'scim', 'identity', 'login', 'auth', 'login mode', 'emergency access', 'entra id', 'azure ad', 'oauth', 'identity provider', 'idp', 'role rules', 'role mapping', 'auto role', 'role assignment'] },
    { tab: 'tickets', keywords: ['tickets', 'ticket types', 'ticket statuses', 'categories', 'category', 'ticket type', 'classification', 'routing', 'organize', 'color', 'workflow', 'transitions', 'status flow', 'ticket workflow', 'required fields', 'transition', 'ticket statuses', 'status labels', 'status names', 'progress text', 'open', 'in progress', 'waiting', 'closed', 'rename status'] },
    { tab: 'sla-hours', keywords: ['sla', 'service level', 'response time', 'resolution time', 'breach', 'priority', 'critical', 'high', 'medium', 'low', 'policies', 'working hours', 'business hours', 'schedule', 'timezone', 'calendar', 'open', 'closed', 'monday', 'friday', 'weekend', 'operating'] },
    { tab: 'workflow-designer', keywords: ['workflow designer', 'visual workflow', 'automation', 'rules', 'flowchart', 'steps', 'conditions', 'trigger', 'escalate', 'escalation', 'auto', 'routing', 'condition', 'action', 'notify', 'automation workflow', 'pipeline', 'sequence', 'action chain', 'quick rule', 'simple rule', 'single rule'] },
    { tab: 'classification', keywords: ['classification', 'auto-classification', 'auto classify', 'classify', 'ticket type', 'incident', 'service request', 'detect', 'recognize', 'keyword', 'rule', 'categorize'] },
    { tab: 'custom-fields', keywords: ['custom fields', 'custom field', 'form', 'fields', 'extra fields', 'metadata', 'eav', 'additional data', 'ticket fields', 'asset fields', 'dynamic form'] },
    { tab: 'email', keywords: ['email', 'templates', 'template', 'notification', 'smtp', 'mail', 'subject', 'body', 'ticket created', 'ticket resolved', 'survey', 'auto reply', 'auto-reply', 'autoreply', 'automatic reply', 'reply rule', 'trigger reply', 'auto responder', 'auto-responder', 'inbound', 'gmail', 'email log', 'email history', 'sent email', 'received email', 'delivery', 'outbound', 'smtp log', 'email server', 'imap', 'email polling', 'email routing', 'email ticket', 'gmail inbox'] },
    { tab: 'portal-customization', keywords: ['portal', 'self-service portal', 'branding', 'hero', 'customize', 'customization', 'quick actions', 'company name', 'subtitle', 'end user', 'user portal'] },
    { tab: 'canned-responses', keywords: ['canned responses', 'canned', 'saved replies', 'saved reply', 'responses', 'quick replies', 'templates', 'reply templates', 'shortcuts'] },
    { tab: 'ai', keywords: ['ai', 'ai assistant', 'assistant', 'openai', 'gpt', 'model', 'temperature', 'tokens', 'api key', 'system prompt', 'provider', 'base url', 'allowed roles', 'ai training', 'training', 'knowledge', 'rag', 'retrieval', 'vector', 'embedding', 'chunks', 'qa pairs', 'q&a', 'sources', 'documents', 'ingest', 'semantic', 'hybrid', 'keyword', 'similarity', 'top k', 'chunk size', 'chunk overlap', 'citation', 'analytics', 'test', 'evaluate', 'rag settings', 'knowledge sources', 'ticket sync', 'kb sync'] },
    { tab: 'asset-groups', keywords: ['asset groups', 'asset classification', 'classification', 'groups', 'asset categories', 'group color', 'organize assets', 'auto-join', 'auto join rules'] },
    { tab: 'license-compliance', keywords: ['license', 'compliance', 'software license', 'license defaults', 'currency', 'alert threshold', 'renewal notice', 'categories', 'SaaS', 'perpetual', 'subscription', 'financial', 'cost'] },
    { tab: 'agent-settings', keywords: ['agent', 'desktop agent', 'agent settings', 'agent secret', 'deploy agent', 'download agent', 'agent key', 'agent deployment', 'gpo', 'silent install', 'agent installation', 'asset discovery', 'agent config'] },
    { tab: 'audit-log', keywords: ['audit', 'log', 'history', 'trail', 'audit log', 'operations', 'changes', 'who', 'actor', 'events'] },
    { tab: 'settings', keywords: ['settings', 'system settings', 'configuration', 'config', 'system', 'general', 'integrations key', 'variables', 'global', 'notifications', 'notification settings', 'alerts', 'channels', 'email alerts', 'in-app', 'notify', 'events', 'triggers'] },
    { tab: 'backup-restore', keywords: ['backup', 'restore', 'database backup', 'dump', 'disaster recovery', 'export', 'sql dump'] },
    { tab: 'problem-mgmt', keywords: ['problem', 'problem management', 'root cause', 'known error', 'kedb', 'auto-link', 'incident link', 'problem lifecycle', 'known error database', 'workaround', 'problem template', 'RCA'] },
    { tab: 'cmdb', keywords: ['cmdb', 'configuration management', 'configuration item', 'ci', 'cmdb management', 'relationship', 'dependency', 'ci type', 'ci status', 'configuration database', 'asset management', 'inventory', 'service map', 'it infrastructure'] },
    { tab: 'webhooks', keywords: ['webhook', 'webhooks', 'integration', 'event', 'callback', 'outbound', 'notification', 'endpoint', 'delivery', 'http hook', 'api hook', 'event driven', 'webhook config', 'webhook settings'] },
    { tab: 'change-mgmt', keywords: ['change', 'change management', 'risk', 'risk framework', 'maintenance window', 'blackout', 'PIR', 'post implementation', 'implementation plan', 'rollback', 'standard change', 'normal change', 'emergency change', 'auto approve'] },
    { tab: 'approval-workflows', keywords: ['approval', 'approval workflow', 'approve', 'deny', 'escalation', 'due date', 'approval chain', 'approval step', 'approval template', 'pending approval', 'approval notification', 'routing rules', 'approver', 'manager approval', 'approval conditions', 'approval routing', 'approval rule', 'step template'] },
    { tab: 'notification-settings', keywords: ['notification', 'notifications', 'notification channels', 'email notification', 'in-app', 'alert', 'alerts', 'event notification', 'ticket notification', 'SLA breach notification', 'problem notification', 'change notification', 'approval notification', 'license notification'] },
  ], []);

  // Smart search: find matching tabs from the deep index
  const searchResults = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return [];
    return searchIndex
      .filter(entry => entry.keywords.some(kw => kw.includes(q) || q.includes(kw)))
      .map(entry => entry.tab);
  }, [sidebarSearch, searchIndex]);

  const navGroups = useMemo(() => [
    {
      group: '',
      items: [
        { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={15} /> },
      ]
    },
    {
      group: 'PEOPLE & ACCESS',
      items: [
        { id: 'users', label: 'Users', icon: <Users size={15} /> },
        { id: 'roles', label: 'Roles & Permissions', icon: <ShieldCheck size={15} /> },
        { id: 'authentication', label: 'Authentication', icon: <KeyRound size={15} /> },
      ]
    },
    {
      group: 'TICKETS & SERVICE',
      items: [
        { id: 'tickets', label: 'Ticket Types & Statuses', icon: <Layers size={15} /> },
        { id: 'sla-hours', label: 'SLA & Business Hours', icon: <Clock size={15} /> },
        { id: 'custom-fields', label: 'Custom Fields', icon: <FileText size={15} /> },
        { id: 'service-catalog', label: 'Service Catalog', icon: <Package size={15} /> },
        { id: 'classification', label: 'Auto-Classification', icon: <Hash size={15} /> },
        { id: 'canned-responses', label: 'Saved Replies', icon: <Book size={15} /> },
      ]
    },
    {
      group: 'ITSM PROCESSES',
      items: [
        { id: 'cmdb', label: 'CMDB', icon: <Server size={15} /> },
        { id: 'problem-mgmt', label: 'Problem Management', icon: <Bug size={15} /> },
        { id: 'change-mgmt', label: 'Change Management', icon: <Wrench size={15} /> },
      ]
    },
    {
      group: 'AUTOMATION',
      items: [
        { id: 'workflow-designer', label: 'Workflow Designer', icon: <GitBranch size={15} /> },
        { id: 'approval-workflows', label: 'Approval Workflows', icon: <CheckSquare size={15} /> },
      ]
    },
    {
      group: 'COMMUNICATIONS',
      items: [
        { id: 'email', label: 'Email', icon: <Mail size={15} /> },
        { id: 'portal-customization', label: 'Self-Service Portal', icon: <LayoutGrid size={15} /> },
        { id: 'notification-settings', label: 'Notifications', icon: <Bell size={15} /> },
      { id: 'webhooks', label: 'Webhooks', icon: <Activity size={15} /> },
      ]
    },
    {
      group: 'AI & INTELLIGENCE',
      items: [
        { id: 'ai', label: 'AI Assistant', icon: <Sparkles size={15} /> },
      ]
    },
    {
      group: 'ASSETS',
      items: [
        { id: 'asset-groups', label: 'Asset Groups & Classification', icon: <Monitor size={15} /> },
        { id: 'license-compliance', label: 'License Compliance', icon: <Shield size={15} /> },
        { id: 'agent-settings', label: 'Desktop Agent', icon: <Download size={15} /> },
      ]
    },
    {
      group: 'SYSTEM',
      items: [
        { id: 'settings', label: 'System Settings', icon: <Settings size={15} /> },
        { id: 'backup-restore', label: 'Backup & Restore', icon: <Database size={15} /> },
        { id: 'audit-log', label: 'Audit Log', icon: <FileText size={15} /> },
      ]
    }
  ], []);

  const filteredNavGroups = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return navGroups;
    const matchedTabIds = new Set(searchResults);
    return navGroups.map(group => {
      const items = group.items.filter(item =>
        item.label.toLowerCase().includes(q) || matchedTabIds.has(item.id)
      );
      return { ...group, items };
    }).filter(group => group.items.length > 0);
  }, [sidebarSearch, navGroups, searchResults]);

  const activeNavItem = useMemo(() => {
    for (const group of navGroups) {
      const item = group.items.find(i => i.id === activeTab);
      if (item) return item;
    }
    return null;
  }, [activeTab, navGroups]);

  const getTabSubtitle = (id: string) => TAB_SUBTITLES[id] || 'Manage system configuration and administrative policies';

  const showAlert = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  }, []);

  const loadTabData = useCallback(async (tab: string) => {
    setLoading(true);
    try {
      if (tab === 'overview') {
        const statsRes = await api.get<{ data: AdminStats }>('/admin/stats');
        setStats(statsRes.data);
        setAuditLog(statsRes.data.recent_activity || []);
      } else if (tab === 'users') {
        const res = await api.get<{ data: UserProfile[] }>('/users');
        setUsers(res.data);
      } else if (tab === 'tickets') {
        const res = await api.get<{ data: Category[] }>('/categories');
        setCategories(res.data);
      } else if (tab === 'sla-hours') {
        const res = await api.get<{ data: SLAPolicy[] }>('/sla-policies');
        setSLAPolicies(res.data);
      } else if (tab === 'settings') {
        const res = await api.get<{ data: Record<string, string> }>('/admin/settings');
        const settingsArray: AdminSetting[] = Object.entries(res.data || {}).map(([key, value]) => ({
          key,
          value: value ?? '',
          label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          type: inferSettingType(value ?? ''),
          group: inferSettingGroup(key),
        }));
        setSettings(settingsArray);
      } else if (tab === 'asset-groups') {
        const res = await api.get<{ data: any[] }>('/asset-groups');
        setAssetGroups(res.data);
      } else if (tab === 'audit-log') {
        const params = new URLSearchParams();
        params.set('page', String(auditPage));
        params.set('pageSize', '50');
        if (auditFilterAction) params.set('action', auditFilterAction);
        if (auditFilterUser) params.set('actor_name', auditFilterUser);
        if (auditFilterEntityType) params.set('entity_type', auditFilterEntityType);
        if (auditFilterSearch) params.set('search', auditFilterSearch);
        if (auditDateRange) {
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (auditDateRange === 'today') {
            params.set('date_from', today.toISOString());
          } else if (auditDateRange === 'yesterday') {
            const yesterday = new Date(today.getTime() - 86400000);
            params.set('date_from', yesterday.toISOString());
            params.set('date_to', today.toISOString());
          } else if (auditDateRange === '7d') {
            params.set('date_from', new Date(today.getTime() - 7 * 86400000).toISOString());
          } else if (auditDateRange === '30d') {
            params.set('date_from', new Date(today.getTime() - 30 * 86400000).toISOString());
          }
        }
        const res = await api.get<{ data: AuditEntry[]; total: number; totalPages: number; entity_types: string[] }>(`/admin/audit-log?${params.toString()}`);
        setAuditLog(res.data);
        setAuditTotal(res.total || 0);
        setAuditTotalPages(res.totalPages || 0);
        setEntityTypes(res.entity_types || []);
      }
    } catch {
      showAlert('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [auditPage, auditFilterAction, auditFilterUser, auditFilterEntityType, auditFilterSearch, auditDateRange, showAlert]);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'agent') {
      loadTabData(activeTab);
    }
  }, [user, activeTab, auditPage, auditFilterAction, auditFilterUser, auditFilterEntityType, auditFilterSearch, auditDateRange, loadTabData]);

  // Persist active admin tab across refreshes
  useEffect(() => {
    localStorage.setItem('resolv_admin_tab', activeTab);
  }, [activeTab]);

  if (!user) return null;
  if (user.role !== 'admin' && user.role !== 'agent') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--critical-bg)', color: 'var(--critical)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Lock size={32} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text)' }}>Access Denied</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <div style={{
        width: '240px', flexShrink: 0, height: '100%', overflowY: 'auto',
        background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* App Title & Search Area */}
        <div style={{ padding: '20px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Admin Settings</span>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text" placeholder="Search..." value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              style={{
                width: '100%', padding: '6px 10px 6px 32px', fontSize: '12px',
                background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', color: 'var(--text)', outline: 'none',
              }}
            />
          </div>
          {sidebarSearch.trim() && searchResults.length > 0 && (() => {
            const topTabId = searchResults[0];
            const allItems = navGroups.flatMap(g => g.items);
            const topItem = allItems.find(i => i.id === topTabId);
            if (!topItem) return null;
            return (
              <div style={{ marginTop: '6px' }}>
                <button
                  onClick={() => { setActiveTab(topItem.id); setSidebarSearch(''); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 10px', fontSize: '11px', fontWeight: 500,
                    color: 'var(--accent)', background: 'var(--accent-subtle)',
                    border: '1px solid var(--accent)', borderRadius: 'var(--radius-md)',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{ opacity: 0.7, fontSize: '10px' }}>Jump to</span>
                  <span style={{ fontWeight: 600 }}>{topItem.label}</span>
                  {searchResults.length > 1 && (
                    <span style={{ marginLeft: 'auto', opacity: 0.6 }}>+{searchResults.length - 1} more</span>
                  )}
                </button>
              </div>
            );
          })()}
        </div>

        {/* Grouped Nav Items */}
        <div style={{ flex: 1, paddingBottom: '20px' }}>
          {filteredNavGroups.map(g => (
            <div key={g.group || 'no-header'}>
              {g.group && (
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '16px 16px 6px' }}>
                  {g.group}
                </div>
              )}
              {g.items.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: isActive ? '8px 16px 8px 13px' : '8px 16px',
                      fontSize: '13px', fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer', borderRadius: 0, width: '100%', boxSizing: 'border-box',
                      background: isActive ? 'var(--accent-subtle)' : 'transparent',
                      color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                      borderLeft: isActive ? '3px solid var(--accent)' : 'none',
                      transition: 'background 0.2s, color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text)'; }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }
                    }}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Right Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 32px 80px', display: 'flex', flexDirection: 'column' }}>
        {/* System Health Widget at Top */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
          <div style={{
            display: 'flex', gap: '16px', padding: '12px 20px',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', alignItems: 'center'
          }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>SYSTEM HEALTH</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: healthStatus.api ? 'var(--success)' : 'var(--danger)' }} />
              <Server size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>API</span>
            </div>
            <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: healthStatus.db ? 'var(--success)' : 'var(--danger)' }} />
              <Database size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>DB</span>
            </div>
            <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: healthStatus.email ? 'var(--success)' : 'var(--danger)' }} />
              <EmailIcon size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>Email</span>
            </div>
          </div>
        </div>

        <header style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
            {activeNavItem?.label || 'Admin Control Panel'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '4px' }}>
            {getTabSubtitle(activeTab)}
          </p>
        </header>

        <div style={{ position: 'relative', minHeight: '400px' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', opacity: 0.7, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-lg)' }}>
              <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
            </div>
          )}

          {activeTab === 'overview' && <OverviewTab stats={stats} auditLog={auditLog} />}
          {activeTab === 'users' && (
            <UsersTab
              users={users}
              onRefresh={() => loadTabData('users')}
              onShowPassword={(pw) => setTempPassword(pw)}
              showAlert={showAlert}
              setConfirmModal={setConfirmModal}
            />
          )}
          {activeTab === 'tickets' && (
            <TicketsTab
              showAlert={showAlert}
              setConfirmModal={setConfirmModal}
              categories={categories}
              onRefreshCategories={() => loadTabData('tickets')}
            />
          )}
          {activeTab === 'sla-hours' && (
            <SlaHoursTab
              showAlert={showAlert}
              setConfirmModal={setConfirmModal}
              policies={slaPolicies}
              onRefresh={() => loadTabData('sla-hours')}
            />
          )}
          {activeTab === 'email' && (
            <EmailTab showAlert={showAlert} setConfirmModal={setConfirmModal} />
          )}
          {activeTab === 'settings' && (
            <SettingsTab
              settings={settings}
              onRefresh={() => loadTabData('settings')}
              showAlert={showAlert}
            />
          )}
          {activeTab === 'ai' && <AiTab showAlert={showAlert} />}
          {activeTab === 'authentication' && <AuthenticationTab showAlert={showAlert} />}
          {activeTab === 'roles' && <RolesTab showAlert={showAlert} />}
          {activeTab === 'workflow-designer' && <WorkflowDesignerTab showAlert={showAlert} setConfirmModal={setConfirmModal} />}
          {activeTab === 'classification' && <ClassificationRulesTab showAlert={showAlert} />}
          {activeTab === 'custom-fields' && <CustomFieldsTab showAlert={showAlert} setConfirmModal={setConfirmModal} />}

          {activeTab === 'portal-customization' && <PortalCustomizationTab showAlert={showAlert} />}
          {activeTab === 'canned-responses' && <CannedResponsesTab showAlert={showAlert} />}
          {activeTab === 'asset-groups' && (
            <AssetGroupsTab
              groups={assetGroups}
              onRefresh={() => loadTabData('asset-groups')}
              showAlert={showAlert}
              setConfirmModal={setConfirmModal}
            />
          )}
          {activeTab === 'agent-settings' && (
            <AgentSettingsTab showAlert={showAlert} />
          )}
          {activeTab === 'license-compliance' && (
            <LicenseComplianceTab showAlert={showAlert} />
          )}

          {activeTab === 'audit-log' && (
            <AuditLogTab
              auditLog={auditLog}
              page={auditPage}
              setPage={setAuditPage}
              totalPages={auditTotalPages}
              total={auditTotal}
              filterAction={auditFilterAction}
              setFilterAction={setAuditFilterAction}
              filterUser={auditFilterUser}
              setFilterUser={setAuditFilterUser}
              filterEntityType={auditFilterEntityType}
              setFilterEntityType={setAuditFilterEntityType}
              filterSearch={auditFilterSearch}
              setFilterSearch={setAuditFilterSearch}
              dateRange={auditDateRange}
              setDateRange={setAuditDateRange}
              entityTypes={entityTypes}
            />
          )}
          {activeTab === 'backup-restore' && <BackupRestoreTab showAlert={showAlert} />}
          {activeTab === 'service-catalog' && <ServiceCatalogTab showAlert={showAlert} />}
          {activeTab === 'problem-mgmt' && <ProblemMgmtTab showAlert={showAlert} />}
          {activeTab === 'cmdb' && (
            <CmdbTab
              showAlert={showAlert}
              setConfirmModal={setConfirmModal}
            />
          )}
          {activeTab === 'change-mgmt' && <ChangeMgmtTab showAlert={showAlert} />}
          {activeTab === 'approval-workflows' && <ApprovalWorkflowsTab showAlert={showAlert} />}
          {activeTab === 'notification-settings' && <NotificationSettingsTab showAlert={showAlert} />}
          {activeTab === 'webhooks' && <WebhooksTab showAlert={showAlert} />}
        </div>
      </div>

      {alert && <Alert message={alert.message} type={alert.type} onClose={() => setAlert(null)} />}

      {tempPassword && (
        <Modal title="Temporary Password" onClose={() => setTempPassword(null)}>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            A temporary password has been generated. Please provide it to the user. They will be asked to change it on their next login.
          </p>
          <div style={{
            background: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <code style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '1px' }}>{tempPassword}</code>
            <button
              className="btn btn-ghost"
              onClick={() => { navigator.clipboard.writeText(tempPassword); showAlert('Copied to clipboard'); }}
            >
              Copy
            </button>
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '24px', padding: '12px' }}
            onClick={() => setTempPassword(null)}
          >
            Done
          </button>
        </Modal>
      )}

      {confirmModal && (
        <ConfirmModal
          open={confirmModal.open}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
