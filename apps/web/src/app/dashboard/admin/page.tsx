'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import {
  LayoutDashboard, Users, Layers, Clock, Settings, FileText,
  ShieldCheck, Building, Circle, CalendarClock, Zap, Mail,
  LayoutGrid, Book, Sparkles, Brain, BarChart3, Plug,
  Search, Lock, Server, Database, Activity, X, AlertCircle, CheckCircle,
  RefreshCw, RotateCcw, ChevronLeft, ChevronRight, Filter, Calendar,
  UserPlus, MoreVertical, Edit2, Trash2, Plus, Save,
  AlertTriangle, Hash, Trash, Play, Palette, User,
  Shield, Monitor, Download, Bell, GitBranch
} from 'lucide-react';
import { AITrainingTab } from './AITrainingTab';
import { DirectorySyncTab } from './DirectorySyncTab';
import {
  OverviewTab, UsersTab, CategoriesTab, SLAPoliciesTab, EmailTemplatesTab,
  SettingsTab, RolesTab, AutomationTab, WorkingHoursTab, AuditLogTab,
  ReportsTab, IntegrationsTab, PortalCustomizationTab, AIConfigTab,
  TicketStatusesTab, CannedResponsesTab, AssetGroupsTab, AgentSettingsTab,
  NotificationSettingsTab, WorkflowTab, BackupRestoreTab,
  EmailLogTab, EmailInboundTab
} from './components';
import { ConfirmModal, Alert, Modal } from './components/SharedUI';
import type {
  AdminStats, AuditEntry, UserProfile, Category, SLAPolicy, AdminSetting
} from './components/types';
import type { AutomationRule } from './components/types';

const StackIcon = Layers;

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

  // Sidebar Search
  const [sidebarSearch, setSidebarSearch] = useState('');

  // System Health Status
  const [healthStatus, setHealthStatus] = useState({ api: true, db: true, queue: true });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await api.get<{ data: { api: boolean; db: boolean; queue: boolean } }>('/health');
        setHealthStatus(res.data || { api: true, db: true, queue: true });
      } catch {
        setHealthStatus({ api: false, db: false, queue: false });
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
    { tab: 'directory-sync', keywords: ['directory sync', 'directory', 'sync', 'provision', 'google workspace', 'azure ad', 'okta', 'ldap', 'active directory', 'scim', 'user provisioning', 'sso', 'single sign-on', 'oauth', 'identity', 'login', 'auth'] },
    { tab: 'categories', keywords: ['categories', 'category', 'ticket type', 'classification', 'routing', 'organize', 'color'] },
    { tab: 'ticket-statuses', keywords: ['ticket statuses', 'status labels', 'status names', 'progress text', 'open', 'in progress', 'waiting', 'closed', 'rename status'] },
    { tab: 'sla-policies', keywords: ['sla', 'service level', 'response time', 'resolution time', 'breach', 'priority', 'critical', 'high', 'medium', 'low', 'policies'] },
    { tab: 'working-hours', keywords: ['working hours', 'business hours', 'schedule', 'timezone', 'calendar', 'open', 'closed', 'monday', 'friday', 'weekend', 'operating'] },
    { tab: 'automation', keywords: ['automation', 'rules', 'trigger', 'workflow', 'escalate', 'escalation', 'auto', 'routing', 'condition', 'action', 'notify'] },
    { tab: 'email-templates', keywords: ['email', 'templates', 'template', 'notification', 'smtp', 'mail', 'subject', 'body', 'ticket created', 'ticket resolved', 'survey'] },
    { tab: 'portal-customization', keywords: ['portal', 'branding', 'hero', 'customize', 'customization', 'quick actions', 'company name', 'subtitle', 'end user', 'user portal'] },
    { tab: 'canned-responses', keywords: ['canned responses', 'canned', 'responses', 'quick replies', 'templates', 'reply templates', 'shortcuts'] },
    { tab: 'ai-config', keywords: ['ai', 'assistant', 'openai', 'gpt', 'model', 'temperature', 'tokens', 'api key', 'system prompt', 'provider', 'base url', 'allowed roles'] },
    { tab: 'ai-training', keywords: ['ai training', 'training', 'knowledge', 'rag', 'retrieval', 'vector', 'embedding', 'chunks', 'qa pairs', 'q&a', 'sources', 'documents', 'ingest', 'semantic', 'hybrid', 'keyword', 'similarity', 'top k', 'chunk size', 'chunk overlap', 'citation', 'analytics', 'test', 'evaluate', 'rag settings', 'knowledge sources', 'ticket sync', 'kb sync'] },
    { tab: 'reports', keywords: ['reports', 'report', 'analytics', 'charts', 'volume', 'performance', 'csat', 'export', 'csv', 'trends', 'breakdown'] },
    { tab: 'settings', keywords: ['settings', 'configuration', 'config', 'system', 'general', 'integrations key', 'variables', 'global'] },
    { tab: 'integrations', keywords: ['integrations', 'integration', 'slack', 'webhook', 'jira', 'teams', 'pagerduty', 'zapier', 'connect', 'third party', 'external'] },
    { tab: 'asset-groups', keywords: ['asset groups', 'groups', 'asset categories', 'asset classification', 'group color', 'organize assets'] },
    { tab: 'agent-settings', keywords: ['agent', 'agent settings', 'agent secret', 'deploy agent', 'download agent', 'agent key', 'agent deployment', 'gpo', 'silent install', 'agent installation', 'asset discovery', 'agent config'] },
    { tab: 'audit-log', keywords: ['audit', 'log', 'history', 'trail', 'audit log', 'operations', 'changes', 'who', 'actor', 'events'] },
    { tab: 'notification-settings', keywords: ['notifications', 'notification settings', 'alerts', 'channels', 'email alerts', 'in-app', 'slack alerts', 'webhook alerts', 'notify'] },
    { tab: 'workflow', keywords: ['workflow', 'transitions', 'status flow', 'ticket workflow', 'required fields', 'transition'] },
    { tab: 'backup-restore', keywords: ['backup', 'restore', 'database backup', 'dump', 'disaster recovery', 'export', 'sql dump'] },
    { tab: 'email-log', keywords: ['email log', 'email history', 'sent email', 'received email', 'delivery', 'outbound', 'inbound', 'smtp log'] },
    { tab: 'email-inbound', keywords: ['inbound email', 'imap', 'email polling', 'email routing', 'email ticket', 'gmail inbox', 'ticket from email'] },
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
      group: 'USERS & ACCESS',
      items: [
        { id: 'users', label: 'Users', icon: <Users size={15} /> },
        { id: 'roles', label: 'Roles & Permissions', icon: <ShieldCheck size={15} /> },
        { id: 'directory-sync', label: 'Directory Sync', icon: <Building size={15} /> },
      ]
    },
    {
      group: 'TICKETING',
      items: [
        { id: 'categories', label: 'Categories', icon: <Layers size={15} /> },
        { id: 'ticket-statuses', label: 'Ticket Statuses', icon: <Circle size={15} /> },
        { id: 'workflow', label: 'Ticket Workflow', icon: <GitBranch size={15} /> },
        { id: 'sla-policies', label: 'SLA Policies', icon: <Clock size={15} /> },
        { id: 'working-hours', label: 'Working Hours', icon: <CalendarClock size={15} /> },
        { id: 'automation', label: 'Automation', icon: <Zap size={15} /> },
      ]
    },
    {
      group: 'COMMUNICATION',
      items: [
        { id: 'email-templates', label: 'Email Templates', icon: <Mail size={15} /> },
        { id: 'email-inbound', label: 'Inbound Email', icon: <Mail size={15} /> },
        { id: 'email-log', label: 'Email Log', icon: <Mail size={15} /> },
        { id: 'notification-settings', label: 'Notification Settings', icon: <Bell size={15} /> },
        { id: 'portal-customization', label: 'Portal', icon: <LayoutGrid size={15} /> },
        { id: 'canned-responses', label: 'Canned Responses', icon: <Book size={15} /> },
      ]
    },
    {
      group: 'AI & INTELLIGENCE',
      items: [
        { id: 'ai-config', label: 'AI Assistant', icon: <Sparkles size={15} /> },
        { id: 'ai-training', label: 'AI Training', icon: <Brain size={15} /> },
      ]
    },
    {
      group: 'ASSETS',
      items: [
        { id: 'asset-groups', label: 'Asset Groups', icon: <Monitor size={15} /> },
        { id: 'agent-settings', label: 'Agent Settings', icon: <Download size={15} /> },
      ]
    },
    {
      group: 'REPORTS',
      items: [
        { id: 'reports', label: 'Reports', icon: <BarChart3 size={15} /> },
      ]
    },
    {
      group: 'SYSTEM',
      items: [
        { id: 'settings', label: 'Settings', icon: <Settings size={15} /> },
        { id: 'integrations', label: 'Integrations', icon: <Plug size={15} /> },
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

  const getTabSubtitle = (id: string) => {
    switch (id) {
      case 'overview': return 'System monitoring, statistics, and recent activity overview';
      case 'users': return 'Manage user accounts, departments, and active statuses';
      case 'roles': return 'Define security roles, access permissions, and privileges';
      case 'directory-sync': return 'Sync users and groups from your identity provider to automatically provision and manage accounts.';
      case 'categories': return 'Organize tickets into categories and define routing rules';
      case 'ticket-statuses': return 'Customize the display labels for ticket status values';
      case 'sla-policies': return 'Set Service Level Agreement response and resolution targets';
      case 'working-hours': return 'Configure business calendars, hours of operation, and holidays';
      case 'automation': return 'Create workflow triggers, automated actions, and conditions';
      case 'email-templates': return 'Design and manage notification templates for ticket lifecycle events';
      case 'email-inbound': return 'Set up IMAP email-to-ticket conversion (Gmail, Office 365, or custom IMAP)';
      case 'email-log': return 'Search and audit all incoming and outgoing email messages';
      default: return 'Manage system configuration and administrative policies';
    }
  };

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
      } else if (tab === 'categories') {
        const res = await api.get<{ data: Category[] }>('/categories');
        setCategories(res.data);
      } else if (tab === 'sla-policies') {
        const res = await api.get<{ data: SLAPolicy[] }>('/sla-policies');
        setSLAPolicies(res.data);
      } else if (tab === 'settings') {
        const res = await api.get<{ data: Record<string, string> }>('/admin/settings');
        const settingsArray: AdminSetting[] = Object.entries(res.data || {}).map(([key, value]) => {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          let type: 'string' | 'number' | 'boolean' = 'string';
          let group = 'General';
          if (value === 'true' || value === 'false') type = 'boolean';
          else if (!isNaN(Number(value)) && value !== '') type = 'number';
          if (key.includes('smtp') || key.includes('email') || key.includes('mail')) group = 'Email / Notifications';
          else if (key.includes('auth') || key.includes('security') || key.includes('password') || key.includes('session')) group = 'Security';
          else if (key.includes('slack') || key.includes('webhook') || key.includes('integration')) group = 'Integrations';
          else if (key.includes('sla') || key.includes('ticket') || key.includes('auto')) group = 'Ticket Settings';
          return { key, value: value ?? '', label, type, group };
        });
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
        const res = await api.get<{ data: AuditEntry[] }>(`/admin/audit-log?${params.toString()}`);
        setAuditLog(res.data);
      }
    } catch {
      showAlert('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [auditPage, auditFilterAction, auditFilterUser, showAlert]);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'agent') {
      loadTabData(activeTab);
    }
  }, [user, activeTab, auditPage, auditFilterAction, auditFilterUser, loadTabData]);

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
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: healthStatus.queue ? 'var(--success)' : 'var(--danger)' }} />
              <StackIcon size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>Queue</span>
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
          {activeTab === 'categories' && (
            <CategoriesTab
              categories={categories}
              onRefresh={() => loadTabData('categories')}
              showAlert={showAlert}
              setConfirmModal={setConfirmModal}
            />
          )}
          {activeTab === 'sla-policies' && (
            <SLAPoliciesTab
              policies={slaPolicies}
              onRefresh={() => loadTabData('sla-policies')}
              showAlert={showAlert}
              setConfirmModal={setConfirmModal}
            />
          )}
          {activeTab === 'email-templates' && (
            <EmailTemplatesTab showAlert={showAlert} setConfirmModal={setConfirmModal} />
          )}
          {activeTab === 'settings' && (
            <SettingsTab
              settings={settings}
              onRefresh={() => loadTabData('settings')}
              showAlert={showAlert}
            />
          )}
          {activeTab === 'ai-config' && <AIConfigTab showAlert={showAlert} />}
          {activeTab === 'ai-training' && <AITrainingTab showAlert={showAlert} />}
          {activeTab === 'directory-sync' && <DirectorySyncTab showAlert={showAlert} />}
          {activeTab === 'roles' && <RolesTab showAlert={showAlert} />}
          {activeTab === 'automation' && <AutomationTab showAlert={showAlert} setConfirmModal={setConfirmModal} />}
          {activeTab === 'working-hours' && <WorkingHoursTab showAlert={showAlert} />}
          {activeTab === 'portal-customization' && <PortalCustomizationTab showAlert={showAlert} />}
          {activeTab === 'ticket-statuses' && <TicketStatusesTab showAlert={showAlert} />}
          {activeTab === 'canned-responses' && <CannedResponsesTab showAlert={showAlert} />}
          {activeTab === 'reports' && <ReportsTab showAlert={showAlert} />}
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
          {activeTab === 'integrations' && <IntegrationsTab showAlert={showAlert} />}
          {activeTab === 'audit-log' && (
            <AuditLogTab
              auditLog={auditLog}
              page={auditPage}
              setPage={setAuditPage}
              filterAction={auditFilterAction}
              setFilterAction={setAuditFilterAction}
              filterUser={auditFilterUser}
              setFilterUser={setAuditFilterUser}
            />
          )}
          {activeTab === 'notification-settings' && <NotificationSettingsTab showAlert={showAlert} />}
          {activeTab === 'workflow' && <WorkflowTab showAlert={showAlert} setConfirmModal={setConfirmModal} />}
          {activeTab === 'backup-restore' && <BackupRestoreTab showAlert={showAlert} />}
          {activeTab === 'email-log' && <EmailLogTab showAlert={showAlert} />}
          {activeTab === 'email-inbound' && <EmailInboundTab showAlert={showAlert} />}
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
