'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Share2, Search, Plus, Edit2, Trash2, Save, X,
  ChevronDown, ExternalLink, Filter, Server, Database,
  Globe, Monitor, HardDrive, Network, Cloud, Container,
  Shield, Link2, Unlink, Loader, ChevronLeft, ChevronRight,
  User as UserIcon, Tag, Map as MapIcon, Info, HelpCircle,
  Layers, GitBranch, ArrowRight, CheckCircle, AlertCircle,
  SlidersHorizontal, Activity, Clock, GitCompare, List
} from 'lucide-react';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CI {
  id: string;
  name: string;
  description: string;
  ci_type: string;
  asset_id: string | null;
  department: string | null;
  location: string | null;
  owner_id: string | null;
  owner_name: string | null;
  status: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  asset_name: string | null;
  asset_type: string | null;
  version?: string | null;
  last_seen?: string | null;
  health_score?: number | null;
  health_status?: string | null;
  last_assessed_at?: string | null;
  relationships?: Relationship[];
}

interface Relationship {
  id: string;
  source_id: string;
  target_id: string;
  relationship_type: string;
  description: string;
  created_at: string;
  source_name: string;
  source_type: string;
  target_name: string;
  target_type: string;
}

interface GraphRelationship {
  source: { id: string; name: string; ci_type: string };
  target: { id: string; name: string; ci_type: string };
  type: string;
  direction: 'outgoing' | 'incoming';
}

interface GraphData {
  center: CI;
  relationships: GraphRelationship[];
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface SingleResponse<T> {
  data: T;
}

interface Baseline {
  id: string;
  ci_id: string;
  label: string;
  snapshot: Record<string, any>;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  notes: string;
}

interface HealthSummary {
  total: number;
  assessed: number;
  average_health_score: number;
  health_status_breakdown: Record<string, number>;
}

interface DiffEntry {
  field: string;
  old_value: any;
  new_value: any;
  type: 'changed' | 'added' | 'removed';
}

interface CompareData {
  baseline_label: string;
  baseline_created_at: string;
  baseline_notes: string;
  diffs: DiffEntry[];
}

const HEALTH_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: '#fef2f2', text: '#dc2626', label: 'Critical' },
  poor: { bg: '#fff7ed', text: '#ea580c', label: 'Poor' },
  fair: { bg: '#fefce8', text: '#ca8a04', label: 'Fair' },
  good: { bg: '#f0fdf4', text: '#16a34a', label: 'Good' },
  excellent: { bg: '#eff6ff', text: '#2563eb', label: 'Excellent' },
  unknown: { bg: '#f3f4f6', text: '#6b7280', label: 'Unknown' },
};

const CI_TYPES = [
  { value: 'server', label: 'Server' },
  { value: 'workstation', label: 'Workstation' },
  { value: 'laptop', label: 'Laptop' },
  { value: 'network_device', label: 'Network Device' },
  { value: 'storage', label: 'Storage' },
  { value: 'database', label: 'Database' },
  { value: 'application', label: 'Application' },
  { value: 'service', label: 'Service' },
  { value: 'virtual_machine', label: 'Virtual Machine' },
  { value: 'container', label: 'Container' },
  { value: 'middleware', label: 'Middleware' },
  { value: 'load_balancer', label: 'Load Balancer' },
  { value: 'firewall', label: 'Firewall' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'dns_record', label: 'DNS Record' },
  { value: 'cloud_resource', label: 'Cloud Resource' },
  { value: 'kubernetes_cluster', label: 'Kubernetes Cluster' },
  { value: 'other', label: 'Other' },
];

const CI_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
];

const RELATIONSHIP_TYPES = [
  { value: 'depends_on', label: 'Depends On' },
  { value: 'runs_on', label: 'Runs On' },
  { value: 'connects_to', label: 'Connects To' },
  { value: 'contains', label: 'Contains' },
  { value: 'member_of', label: 'Member Of' },
  { value: 'provides', label: 'Provides' },
  { value: 'uses', label: 'Uses' },
  { value: 'backed_by', label: 'Backed By' },
];

const STATUS_FILTERS = ['all', 'active', 'inactive', 'maintenance', 'retired'] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ciTypeColor(type: string): string {
  const map: Record<string, string> = {
    server: '#2563eb',
    workstation: '#059669',
    laptop: '#7c3aed',
    network_device: '#0891b2',
    storage: '#d97706',
    database: '#ea580c',
    application: '#9333ea',
    service: '#65a30d',
    virtual_machine: '#4f46e5',
    container: '#0ea5e9',
    middleware: '#db2777',
    load_balancer: '#ca8a04',
    firewall: '#dc2626',
    certificate: '#14b8a6',
    dns_record: '#6366f1',
    cloud_resource: '#2dd4bf',
    kubernetes_cluster: '#3b82f6',
    other: '#6b7280',
  };
  return map[type] || '#6b7280';
}

function ciTypeBg(type: string): string {
  const color = ciTypeColor(type);
  return `${color}18`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'active': return 'var(--success)';
    case 'inactive': return 'var(--text-muted)';
    case 'maintenance': return 'var(--warning)';
    case 'retired': return 'var(--danger)';
    default: return 'var(--text-muted)';
  }
}

function statusBg(status: string): string {
  switch (status) {
    case 'active': return 'var(--success-bg)';
    case 'inactive': return 'var(--bg-tertiary)';
    case 'maintenance': return 'var(--warning-bg)';
    case 'retired': return 'var(--danger-bg)';
    default: return 'var(--bg-tertiary)';
  }
}

function statusBorder(status: string): string {
  switch (status) {
    case 'active': return 'var(--success-border)';
    case 'inactive': return 'var(--border)';
    case 'maintenance': return 'var(--warning-border)';
    case 'retired': return 'var(--danger-border)';
    default: return 'var(--border)';
  }
}

function healthColor(score: number | null | undefined): { bg: string; text: string; border: string } {
  if (score === null || score === undefined) return { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' };
  if (score < 31) return { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
  if (score < 51) return { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' };
  if (score < 71) return { bg: '#fefce8', text: '#ca8a04', border: '#fde68a' };
  if (score < 86) return { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' };
  return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
}

function healthStatusLabel(status: string | null | undefined): string {
  return HEALTH_COLORS[status || 'unknown']?.label || 'Unknown';
}

function formatDate(d: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getCiIcon(type: string, size: number = 16) {
  const icons: Record<string, React.ReactNode> = {
    server: <Server size={size} />,
    workstation: <Monitor size={size} />,
    laptop: <Monitor size={size} />,
    network_device: <Network size={size} />,
    storage: <HardDrive size={size} />,
    database: <Database size={size} />,
    application: <Box size={size} />,
    service: <Box size={size} />,
    virtual_machine: <Container size={size} />,
    container: <Container size={size} />,
    middleware: <Layers size={size} />,
    load_balancer: <GitBranch size={size} />,
    firewall: <Shield size={size} />,
    certificate: <Shield size={size} />,
    dns_record: <Globe size={size} />,
    cloud_resource: <Cloud size={size} />,
    kubernetes_cluster: <Server size={size} />,
    other: <Box size={size} />,
  };
  return icons[type] || <Box size={size} />;
}

function relationshipDirectionLabel(type: string): string {
  const map: Record<string, string> = {
    depends_on: 'depends on',
    runs_on: 'runs on',
    connects_to: 'connects to',
    contains: 'contains',
    member_of: 'member of',
    provides: 'provides',
    uses: 'uses',
    backed_by: 'backed by',
  };
  return map[type] || type;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CmdbTab({
  showAlert,
  setConfirmModal,
}: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (m: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
}) {
  // ── Sub-mode ──
  const [subMode, setSubMode] = useState<'cis' | 'relationships'>('cis');

  // ── Style constants ──
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

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', fontSize: '13px',
    background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', color: 'var(--text)', outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 600,
    color: 'var(--text-secondary)', marginBottom: '4px',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle, cursor: 'pointer',
  };

  const subsectionStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', padding: '16px', marginTop: '12px',
  };

  const subsectionTitle: React.CSSProperties = {
    fontSize: '13px', fontWeight: 700, color: 'var(--text)', margin: '0 0 12px',
  };

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', background: 'var(--accent)', color: '#fff',
    border: 'none', borderRadius: 'var(--radius-md)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    opacity: 1, whiteSpace: 'nowrap',
  };

  const btnDisabledStyle: React.CSSProperties = {
    ...btnStyle, opacity: 0.6, cursor: 'default',
  };

  const btnGhostStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '5px 10px', fontSize: '12px', fontWeight: 500,
    background: 'transparent', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)',
    cursor: 'pointer', whiteSpace: 'nowrap',
  };

  const btnDangerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 10px', background: 'var(--danger)', color: '#fff',
    border: 'none', borderRadius: 'var(--radius-md)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%', borderCollapse: 'collapse', fontSize: '13px',
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '10px 12px', fontSize: '11px',
    fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)',
    textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: '10px 12px', borderBottom: '1px solid var(--border)',
    color: 'var(--text)', verticalAlign: 'middle',
  };

  // ── CI list state ──
  const [cis, setCis] = useState<CI[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCi, setSelectedCi] = useState<CI | null>(null);
  const [selectedCiLoading, setSelectedCiLoading] = useState(false);

  // ── Create/Edit modal ──
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ci_type: 'server',
    status: 'active' as string,
    department: '',
    location: '',
    owner_id: '',
    tags: '',
    asset_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [ownerSearchResults, setOwnerSearchResults] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
  const [ownerSearchTimeout, setOwnerSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [assetSearchResults, setAssetSearchResults] = useState<Array<{ id: string; name: string; asset_type: string }>>([]);
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);
  const [assetSearchTimeout, setAssetSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // ── Relationship state ──
  const [relSearch, setRelSearch] = useState('');
  const [relSearchInput, setRelSearchInput] = useState('');
  const [relResults, setRelResults] = useState<Relationship[]>([]);
  const [relCiName, setRelCiName] = useState('');
  const [relLoading, setRelLoading] = useState(false);
  const [showRelForm, setShowRelForm] = useState(false);
  const [relFormData, setRelFormData] = useState({
    source_id: '',
    source_name: '',
    target_id: '',
    target_name: '',
    relationship_type: 'depends_on',
    description: '',
  });
  const [relSaving, setRelSaving] = useState(false);
  const [relSourceSearch, setRelSourceSearch] = useState('');
  const [relTargetSearch, setRelTargetSearch] = useState('');
  const [relSourceResults, setRelSourceResults] = useState<Array<{ id: string; name: string; ci_type: string }>>([]);
  const [relTargetResults, setRelTargetResults] = useState<Array<{ id: string; name: string; ci_type: string }>>([]);
  const [showRelSourceDropdown, setShowRelSourceDropdown] = useState(false);
  const [showRelTargetDropdown, setShowRelTargetDropdown] = useState(false);
  const [relSourceTimeout, setRelSourceTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [relTargetTimeout, setRelTargetTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [relDeleting, setRelDeleting] = useState<string | null>(null);

  // ── Health scoring state ──
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [healthSummaryLoading, setHealthSummaryLoading] = useState(false);
  const [needsAttentionCis, setNeedsAttentionCis] = useState<Array<{ id: string; name: string; health_score: number; health_status: string }>>([]);
  const [assessingHealth, setAssessingHealth] = useState(false);
  const [assessProgress, setAssessProgress] = useState<string | null>(null);

  // ── Baseline state ──
  const [showBaselineForm, setShowBaselineForm] = useState(false);
  const [baselineFormData, setBaselineFormData] = useState({ label: '', notes: '' });
  const [baselineSaving, setBaselineSaving] = useState(false);
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [baselinesTotal, setBaselinesTotal] = useState(0);
  const [baselinesPage, setBaselinesPage] = useState(1);
  const [baselinesLoading, setBaselinesLoading] = useState(false);
  const [showBaselines, setShowBaselines] = useState(false);

  // ── Compare state ──
  const [compareData, setCompareData] = useState<CompareData | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  // ── ──────────────────────────────────────────────────────────────────────────
  //  Data fetching
  // ── ──────────────────────────────────────────────────────────────────────────

  const loadCis = useCallback(async (p: number = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('pageSize', String(pageSize));
      if (search) params.set('search', search);
      if (typeFilter) params.set('ci_type', typeFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await api.get<PaginatedResponse<CI>>(`/cmdb?${params.toString()}`);
      setCis(res.data);
      setTotal(res.total);
      setPage(res.page);
      setTotalPages(Math.ceil(res.total / res.pageSize) || 1);
    } catch {
      showAlert('Failed to load configuration items', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, typeFilter, statusFilter, showAlert]);

  useEffect(() => {
    loadCis(1);
  }, [search, typeFilter, statusFilter]);

  const loadCiDetail = async (ci: CI) => {
    setSelectedCiLoading(true);
    setSelectedCi(ci);
    try {
      const res = await api.get<SingleResponse<CI & { relationships: Relationship[] }>>(`/cmdb/${ci.id}`);
      setSelectedCi(res.data);
    } catch {
      showAlert('Failed to load CI details', 'error');
    } finally {
      setSelectedCiLoading(false);
    }
  };

  const loadRelationships = async () => {
    if (!relSearch) {
      setRelResults([]);
      setRelCiName('');
      return;
    }
    setRelLoading(true);
    try {
      const res = await api.get<PaginatedResponse<CI>>(`/cmdb?search=${encodeURIComponent(relSearch)}&pageSize=5`);
      if (res.data.length > 0) {
        const ci = res.data[0];
        setRelCiName(ci.name);
        const detail = await api.get<SingleResponse<CI & { relationships: Relationship[] }>>(`/cmdb/${ci.id}`);
        setRelResults(detail.data.relationships || []);
      } else {
        setRelResults([]);
        setRelCiName('');
      }
    } catch {
      showAlert('Failed to load relationships', 'error');
    } finally {
      setRelLoading(false);
    }
  };

  // ── Health summary ──
  const loadHealthSummary = async () => {
    setHealthSummaryLoading(true);
    try {
      const res = await api.get<{ data: HealthSummary; needs_attention: Array<{ id: string; name: string; health_score: number; health_status: string }> }>('/cmdb/health-summary');
      setHealthSummary(res.data);
      setNeedsAttentionCis(res.needs_attention);
    } catch {
      // silently fail — health summary is non-critical
    } finally {
      setHealthSummaryLoading(false);
    }
  };

  useEffect(() => {
    loadHealthSummary();
  }, []);

  const assessAllHealth = async () => {
    setAssessingHealth(true);
    setAssessProgress('Assessing all CIs...');
    try {
      const res = await api.post<{ assessed: number; results: any[] }>('/cmdb/assess-all-health', {});
      setAssessProgress(`Assessed ${res.assessed} CIs`);
      await loadHealthSummary();
      if (selectedCi) loadCiDetail(selectedCi);
      loadCis(page);
      showAlert(`Health assessment complete: ${res.assessed} CIs evaluated`);
    } catch {
      showAlert('Failed to assess CI health', 'error');
    } finally {
      setAssessingHealth(false);
      setAssessProgress(null);
    }
  };

  const assessSingleCi = async (ciId: string) => {
    try {
      await api.post(`/cmdb/ci/${ciId}/assess-health`, {});
      if (selectedCi?.id === ciId) loadCiDetail(selectedCi);
      loadCis(page);
      loadHealthSummary();
      showAlert('Health assessment complete');
    } catch {
      showAlert('Failed to assess CI health', 'error');
    }
  };

  // ── Baselines ──
  const loadBaselines = async (ciId: string, p: number = 1) => {
    setBaselinesLoading(true);
    try {
      const res = await api.get<{ data: Baseline[]; total: number; page: number; pageSize: number }>(`/cmdb/ci/${ciId}/baselines?page=${p}&pageSize=20`);
      setBaselines(res.data);
      setBaselinesTotal(res.total);
      setBaselinesPage(res.page);
    } catch {
      showAlert('Failed to load baselines', 'error');
    } finally {
      setBaselinesLoading(false);
    }
  };

  const saveBaseline = async () => {
    if (!baselineFormData.label.trim()) {
      showAlert('Label is required', 'error');
      return;
    }
    if (!selectedCi) return;
    setBaselineSaving(true);
    try {
      await api.post(`/cmdb/ci/${selectedCi.id}/baseline`, {
        label: baselineFormData.label.trim(),
        notes: baselineFormData.notes.trim(),
      });
      showAlert('Baseline created');
      setShowBaselineForm(false);
      setBaselineFormData({ label: '', notes: '' });
      loadCis(page);
      if (selectedCi) loadCiDetail(selectedCi);
    } catch {
      showAlert('Failed to create baseline', 'error');
    } finally {
      setBaselineSaving(false);
    }
  };

  const loadCompare = async (ciId: string, baselineId: string) => {
    setCompareLoading(true);
    setShowCompare(true);
    try {
      const res = await api.get<{ data: CompareData }>(`/cmdb/ci/${ciId}/compare/${baselineId}`);
      setCompareData(res.data);
    } catch {
      showAlert('Failed to load comparison', 'error');
      setShowCompare(false);
    } finally {
      setCompareLoading(false);
    }
  };

  // ── Owner search ──
  const searchOwners = async (q: string) => {
    if (q.length < 2) { setOwnerSearchResults([]); return; }
    try {
      const res = await api.get<{ data: Array<{ id: string; name: string; email: string }> }>(`/users?search=${encodeURIComponent(q)}&limit=8`);
      setOwnerSearchResults(res.data || []);
    } catch { setOwnerSearchResults([]); }
  };

  // ── Asset search ──
  const searchAssets = async (q: string) => {
    if (q.length < 2) { setAssetSearchResults([]); return; }
    try {
      const res = await api.get<PaginatedResponse<{ id: string; name: string; asset_type: string }>>(`/assets?search=${encodeURIComponent(q)}&limit=8`);
      setAssetSearchResults(res.data || []);
    } catch { setAssetSearchResults([]); }
  };

  // ── CI search for relationship form ──
  const searchCis = async (q: string): Promise<Array<{ id: string; name: string; ci_type: string }>> => {
    if (q.length < 2) return [];
    try {
      const res = await api.get<PaginatedResponse<{ id: string; name: string; ci_type: string }>>(`/cmdb?search=${encodeURIComponent(q)}&pageSize=10`);
      return res.data || [];
    } catch { return []; }
  };

  // ── ──────────────────────────────────────────────────────────────────────────
  //  CRUD Operations
  // ── ──────────────────────────────────────────────────────────────────────────

  const openCreateForm = () => {
    setFormMode('create');
    setFormData({
      name: '',
      description: '',
      ci_type: 'server',
      status: 'active',
      department: '',
      location: '',
      owner_id: '',
      tags: '',
      asset_id: '',
    });
    setOwnerSearchResults([]);
    setAssetSearchResults([]);
    setShowForm(true);
  };

  const openEditForm = (ci: CI) => {
    setFormMode('edit');
    setFormData({
      name: ci.name,
      description: ci.description || '',
      ci_type: ci.ci_type,
      status: ci.status,
      department: ci.department || '',
      location: ci.location || '',
      owner_id: ci.owner_id || '',
      tags: (ci.tags || []).join(', '),
      asset_id: ci.asset_id || '',
    });
    if (ci.owner_name) {
      setOwnerSearchResults([{ id: ci.owner_id!, name: ci.owner_name, email: '' }]);
    } else {
      setOwnerSearchResults([]);
    }
    if (ci.asset_name) {
      setAssetSearchResults([{ id: ci.asset_id!, name: ci.asset_name, asset_type: ci.asset_type || '' }]);
    } else {
      setAssetSearchResults([]);
    }
    setShowForm(true);
  };

  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleOwnerSearch = (q: string) => {
    handleFormChange('owner_id', '');
    if (ownerSearchTimeout) clearTimeout(ownerSearchTimeout);
    const t = setTimeout(() => searchOwners(q), 300);
    setOwnerSearchTimeout(t);
  };

  const handleAssetSearch = (q: string) => {
    handleFormChange('asset_id', '');
    if (assetSearchTimeout) clearTimeout(assetSearchTimeout);
    const t = setTimeout(() => searchAssets(q), 300);
    setAssetSearchTimeout(t);
  };

  const saveCi = async () => {
    if (!formData.name.trim()) {
      showAlert('Name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, any> = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        ci_type: formData.ci_type,
        status: formData.status,
        department: formData.department.trim() || null,
        location: formData.location.trim() || null,
        owner_id: formData.owner_id || null,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        asset_id: formData.asset_id || null,
      };

      if (formMode === 'create') {
        await api.post<SingleResponse<CI>>('/cmdb', body);
        showAlert('Configuration item created');
      } else {
        await api.patch<SingleResponse<CI>>(`/cmdb/${selectedCi?.id}`, body);
        showAlert('Configuration item updated');
      }

      setShowForm(false);
      loadCis(page);
      if (selectedCi) loadCiDetail(selectedCi);
    } catch {
      showAlert(`Failed to ${formMode} configuration item`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteCi = (ci: CI) => {
    setConfirmModal({
      open: true,
      title: 'Delete Configuration Item',
      message: `Are you sure you want to delete "${ci.name}"? This action cannot be undone. All relationships associated with this CI will also be deleted.`,
      onConfirm: async () => {
        try {
          await api.delete(`/cmdb/${ci.id}`);
          showAlert('Configuration item deleted');
          if (selectedCi?.id === ci.id) setSelectedCi(null);
          loadCis(page);
        } catch {
          showAlert('Failed to delete configuration item', 'error');
        } finally {
          setConfirmModal(null);
        }
      },
    });
  };

  // ── Relationship CRUD ──
  const openRelForm = () => {
    setRelFormData({
      source_id: '',
      source_name: '',
      target_id: '',
      target_name: '',
      relationship_type: 'depends_on',
      description: '',
    });
    setRelSourceSearch('');
    setRelTargetSearch('');
    setRelSourceResults([]);
    setRelTargetResults([]);
    setShowRelForm(true);
  };

  const handleRelSourceSearch = (q: string) => {
    setRelSourceSearch(q);
    setRelFormData(prev => ({ ...prev, source_id: '', source_name: '' }));
    if (relSourceTimeout) clearTimeout(relSourceTimeout);
    const t = setTimeout(async () => {
      const results = await searchCis(q);
      setRelSourceResults(results);
      setShowRelSourceDropdown(true);
    }, 300);
    setRelSourceTimeout(t);
  };

  const handleRelTargetSearch = (q: string) => {
    setRelTargetSearch(q);
    setRelFormData(prev => ({ ...prev, target_id: '', target_name: '' }));
    if (relTargetTimeout) clearTimeout(relTargetTimeout);
    const t = setTimeout(async () => {
      const results = await searchCis(q);
      setRelTargetResults(results);
      setShowRelTargetDropdown(true);
    }, 300);
    setRelTargetTimeout(t);
  };

  const saveRelationship = async () => {
    if (!relFormData.source_id || !relFormData.target_id) {
      showAlert('Please select both source and target CI', 'error');
      return;
    }
    if (relFormData.source_id === relFormData.target_id) {
      showAlert('A CI cannot have a relationship with itself', 'error');
      return;
    }
    setRelSaving(true);
    try {
      await api.post<SingleResponse<Relationship>>('/cmdb/relationships', {
        source_id: relFormData.source_id,
        target_id: relFormData.target_id,
        relationship_type: relFormData.relationship_type,
        description: relFormData.description.trim(),
      });
      showAlert('Relationship created');
      setShowRelForm(false);
      loadRelationships();
      if (selectedCi) loadCiDetail(selectedCi);
    } catch {
      showAlert('Failed to create relationship', 'error');
    } finally {
      setRelSaving(false);
    }
  };

  const deleteRelationship = (rel: Relationship) => {
    setConfirmModal({
      open: true,
      title: 'Delete Relationship',
      message: `Are you sure you want to delete the "${relationshipDirectionLabel(rel.relationship_type)}" relationship between "${rel.source_name}" and "${rel.target_name}"?`,
      onConfirm: async () => {
        setRelDeleting(rel.id);
        try {
          await api.delete(`/cmdb/relationships/${rel.id}`);
          showAlert('Relationship deleted');
          loadRelationships();
          if (selectedCi) loadCiDetail(selectedCi);
        } catch {
          showAlert('Failed to delete relationship', 'error');
        } finally {
          setRelDeleting(null);
          setConfirmModal(null);
        }
      },
    });
  };

  const quickAddRel = (ciId: string) => {
    setRelFormData({
      source_id: ciId,
      source_name: selectedCi?.name || '',
      target_id: '',
      target_name: '',
      relationship_type: 'depends_on',
      description: '',
    });
    setRelSourceSearch(selectedCi?.name || '');
    setRelTargetSearch('');
    setRelSourceResults([]);
    setRelTargetResults([]);
    setShowRelForm(true);
  };

  // ── ──────────────────────────────────────────────────────────────────────────
  //  Search handlers
  // ── ──────────────────────────────────────────────────────────────────────────

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') setSearch(searchInput);
  };

  const handleRelSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') setRelSearch(relSearchInput);
  };

  // ── ──────────────────────────────────────────────────────────────────────────
  //  Render: Sub-mode tabs
  // ── ──────────────────────────────────────────────────────────────────────────

  const renderSubTabs = () => (
    <div style={{
      display: 'flex', gap: 0, marginBottom: '24px',
      borderBottom: '1px solid var(--border)',
    }}>
      <button
        onClick={() => setSubMode('cis')}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 20px', fontSize: '13px', fontWeight: 600,
          background: 'transparent',
          border: 'none',
          borderBottom: subMode === 'cis' ? '2px solid var(--accent)' : '2px solid transparent',
          color: subMode === 'cis' ? 'var(--accent)' : 'var(--text-secondary)',
          cursor: 'pointer', marginBottom: '-1px',
          transition: 'color 0.15s, border-color 0.15s',
        }}
      >
        <Box size={16} />
        Configuration Items
      </button>
      <button
        onClick={() => setSubMode('relationships')}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 20px', fontSize: '13px', fontWeight: 600,
          background: 'transparent',
          border: 'none',
          borderBottom: subMode === 'relationships' ? '2px solid var(--accent)' : '2px solid transparent',
          color: subMode === 'relationships' ? 'var(--accent)' : 'var(--text-secondary)',
          cursor: 'pointer', marginBottom: '-1px',
          transition: 'color 0.15s, border-color 0.15s',
        }}
      >
        <Share2 size={16} />
        Relationship Map
      </button>
    </div>
  );

  // ── ──────────────────────────────────────────────────────────────────────────
  //  Render: CI Badge
  // ── ──────────────────────────────────────────────────────────────────────────

  const renderCiTypeBadge = (type: string) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: '11px', fontWeight: 600, padding: '2px 8px',
      borderRadius: 'var(--radius-full)', textTransform: 'capitalize',
      background: ciTypeBg(type), color: ciTypeColor(type),
    }}>
      {getCiIcon(type, 12)}
      {CI_TYPES.find(t => t.value === type)?.label || type}
    </span>
  );

  const renderStatusBadge = (status: string) => (
    <span style={{
      display: 'inline-block', fontSize: '11px', fontWeight: 600,
      padding: '2px 8px', borderRadius: 'var(--radius-full)',
      background: statusBg(status), color: statusColor(status),
      border: `1px solid ${statusBorder(status)}`,
      textTransform: 'capitalize',
    }}>
      {status}
    </span>
  );

  // ── ──────────────────────────────────────────────────────────────────────────
  //  Render: CI List View
  // ── ──────────────────────────────────────────────────────────────────────────

  const renderCiList = () => (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h3 style={sectionTitle}>Configuration Items</h3>
          <p style={sectionDesc}>
            Manage configuration items that represent the IT infrastructure components under configuration management.
            Total: <strong>{total}</strong> items
          </p>
        </div>
        <button onClick={openCreateForm} style={btnStyle}>
          <Plus size={14} />
          Add CI
        </button>
      </div>

      {/* Search & Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search CIs by name or description..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            style={{ ...inputStyle, paddingLeft: 32 }}
          />
        </div>
        <div style={{ width: 160 }}>
          <select
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
            style={selectStyle}
          >
            <option value="">All Types</option>
            {CI_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              style={{
                padding: '5px 10px', fontSize: '11px', fontWeight: 600,
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                background: statusFilter === s ? 'var(--accent-subtle)' : 'transparent',
                color: statusFilter === s ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer', textTransform: 'capitalize',
                borderColor: statusFilter === s ? 'var(--accent)' : 'var(--border)',
              }}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div>
          <div className="skeleton" style={{ height: 40, borderRadius: 'var(--radius-md)', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 40, borderRadius: 'var(--radius-md)', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 40, borderRadius: 'var(--radius-md)', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 40, borderRadius: 'var(--radius-md)', marginBottom: 8 }} />
        </div>
      ) : cis.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <Box size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>No configuration items found</p>
          <p style={{ fontSize: 12, margin: 0 }}>
            {search || typeFilter || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Click "Add CI" to create your first configuration item'}
          </p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Owner</th>
                  <th style={thStyle}>Department</th>
                  <th style={thStyle}>Tags</th>
                  <th style={thStyle}>Health</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cis.map(ci => (
                  <tr
                    key={ci.id}
                    onClick={() => loadCiDetail(ci)}
                    style={{
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                      background: selectedCi?.id === ci.id ? 'var(--accent-subtle)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (selectedCi?.id !== ci.id) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                    onMouseLeave={e => { if (selectedCi?.id !== ci.id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 'var(--radius-md)',
                          background: ciTypeBg(ci.ci_type), color: ciTypeColor(ci.ci_type),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {getCiIcon(ci.ci_type, 14)}
                        </div>
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{ci.name}</span>
                          {ci.description && (
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ci.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>{renderCiTypeBadge(ci.ci_type)}</td>
                    <td style={tdStyle}>{renderStatusBadge(ci.status)}</td>
                    <td style={{ ...tdStyle, color: ci.owner_name ? 'var(--text)' : 'var(--text-muted)' }}>
                      {ci.owner_name || '—'}
                    </td>
                    <td style={{ ...tdStyle, color: ci.department ? 'var(--text)' : 'var(--text-muted)' }}>
                      {ci.department || '—'}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(ci.tags || []).length > 0 ? ci.tags.slice(0, 3).map((tag, i) => (
                          <span key={i} style={{
                            fontSize: 10, fontWeight: 600, padding: '1px 6px',
                            borderRadius: 'var(--radius-full)',
                            background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                          }}>
                            {tag}
                          </span>
                        )) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                        {(ci.tags || []).length > 3 && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{ci.tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      {ci.health_score !== null && ci.health_score !== undefined ? (
                        <span
                          title={`Score: ${ci.health_score}/100 — ${healthStatusLabel(ci.health_status)}`}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 11, fontWeight: 700, padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            background: healthColor(ci.health_score).bg,
                            color: healthColor(ci.health_score).text,
                            border: `1px solid ${healthColor(ci.health_score).border}`,
                            cursor: 'default',
                          }}
                        >
                          <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: healthColor(ci.health_score).text,
                          }} />
                          {ci.health_score}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => openEditForm(ci)}
                          style={btnGhostStyle}
                          title="Edit CI"
                        >
                          <Edit2 size={12} />
                          Edit
                        </button>
                        <button
                          onClick={() => deleteCi(ci)}
                          style={btnDangerStyle}
                          title="Delete CI"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 0' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => loadCis(page - 1)}
                  disabled={page <= 1}
                  style={{
                    ...btnGhostStyle, opacity: page <= 1 ? 0.4 : 1,
                    cursor: page <= 1 ? 'default' : 'pointer',
                  }}
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .map((p, idx, arr) => (
                    <span key={p} style={{ display: 'flex', alignItems: 'center' }}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span style={{ padding: '0 4px', color: 'var(--text-muted)', fontSize: 12 }}>...</span>
                      )}
                      <button
                        onClick={() => loadCis(p)}
                        style={{
                          width: 28, height: 28, borderRadius: 'var(--radius-md)', border: 'none',
                          background: page === p ? 'var(--accent)' : 'transparent',
                          color: page === p ? '#fff' : 'var(--text-secondary)',
                          fontSize: 12, fontWeight: page === p ? 700 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {p}
                      </button>
                    </span>
                  ))}
                <button
                  onClick={() => loadCis(page + 1)}
                  disabled={page >= totalPages}
                  style={{
                    ...btnGhostStyle, opacity: page >= totalPages ? 0.4 : 1,
                    cursor: page >= totalPages ? 'default' : 'pointer',
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  // ── ──────────────────────────────────────────────────────────────────────────
  //  Render: CI Detail Panel
  // ── ──────────────────────────────────────────────────────────────────────────

  const renderCiDetail = () => {
    if (!selectedCi) return null;

    const ci = selectedCi;

    return (
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 'var(--radius-lg)',
              background: ciTypeBg(ci.ci_type), color: ciTypeColor(ci.ci_type),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {getCiIcon(ci.ci_type, 20)}
            </div>
            <div>
              <h3 style={{ ...sectionTitle, margin: 0 }}>{ci.name}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                {renderCiTypeBadge(ci.ci_type)}
                {renderStatusBadge(ci.status)}
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Created {formatDate(ci.created_at)}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => openEditForm(ci)} style={btnGhostStyle}>
              <Edit2 size={13} />
              Edit
            </button>
            <button onClick={() => quickAddRel(ci.id)} style={btnGhostStyle}>
              <Link2 size={13} />
              Add Relationship
            </button>
            <button onClick={() => assessSingleCi(ci.id)} style={btnGhostStyle}>
              <Activity size={13} />
              Assess Health
            </button>
            <button onClick={() => { setShowBaselineForm(true); setBaselineFormData({ label: '', notes: '' }); }} style={btnGhostStyle}>
              <Save size={13} />
              Create Baseline
            </button>
            <button onClick={async () => {
              setShowBaselines(true);
              await loadBaselines(ci.id);
            }} style={btnGhostStyle}>
              <Clock size={13} />
              Baselines
            </button>
          </div>
        </div>

        {/* Details grid */}
        {selectedCiLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 60, borderRadius: 'var(--radius-md)' }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Description</label>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                {ci.description || 'No description'}
              </p>
            </div>
            <div>
              <label style={labelStyle}>Department</label>
              <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>
                {ci.department || '—'}
              </p>
            </div>
            <div>
              <label style={labelStyle}>Location</label>
              <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>
                {ci.location || '—'}
              </p>
            </div>
            <div>
              <label style={labelStyle}>Owner</label>
              <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                {ci.owner_name ? (
                  <>
                    <UserIcon size={13} color="var(--text-muted)" />
                    {ci.owner_name}
                  </>
                ) : '—'}
              </p>
            </div>
            <div>
              <label style={labelStyle}>Linked Asset</label>
              <p style={{ fontSize: 13, color: ci.asset_name ? 'var(--accent)' : 'var(--text-muted)', margin: 0 }}>
                {ci.asset_name ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ExternalLink size={12} />
                    {ci.asset_name}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                      ({ci.asset_type || 'unknown type'})
                    </span>
                  </span>
                ) : 'Not linked to any asset'}
              </p>
            </div>
            <div>
              <label style={labelStyle}>Tags</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {(ci.tags || []).length > 0 ? ci.tags.map((tag, i) => (
                  <span key={i} style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                  }}>
                    <Tag size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                    {tag}
                  </span>
                )) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No tags</span>}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Health Score</label>
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                {ci.health_score !== null && ci.health_score !== undefined ? (
                  <>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 14, fontWeight: 700, padding: '3px 12px',
                      borderRadius: 'var(--radius-full)',
                      background: healthColor(ci.health_score).bg,
                      color: healthColor(ci.health_score).text,
                      border: `1px solid ${healthColor(ci.health_score).border}`,
                    }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: healthColor(ci.health_score).text,
                      }} />
                      {ci.health_score}/100
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      textTransform: 'uppercase', letterSpacing: '0.03em',
                      background: HEALTH_COLORS[ci.health_status || 'unknown']?.bg || '#f3f4f6',
                      color: HEALTH_COLORS[ci.health_status || 'unknown']?.text || '#6b7280',
                    }}>
                      {healthStatusLabel(ci.health_status)}
                    </span>
                    {ci.last_assessed_at && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Last assessed: {formatDate(ci.last_assessed_at)}
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Not assessed yet — click "Assess Health" to evaluate
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Relationships section in detail */}
        {!selectedCiLoading && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ ...subsectionTitle, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Share2 size={14} />
                Relationships
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>
                  ({(ci.relationships || []).length})
                </span>
              </h4>
            </div>

            {(ci.relationships || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                <Share2 size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
                <p style={{ fontSize: 12, margin: 0 }}>No relationships defined for this CI</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ci.relationships!.map(rel => (
                  <div
                    key={rel.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                      background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 12 }}>{rel.source_name}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '1px 6px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--accent-subtle)', color: 'var(--accent)',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {relationshipDirectionLabel(rel.relationship_type)}
                      </span>
                      <ArrowRight size={12} color="var(--text-muted)" />
                      <span style={{ fontWeight: 600, fontSize: 12 }}>{rel.target_name}</span>
                      {rel.description && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          — {rel.description}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => deleteRelationship(rel)}
                      style={{ ...btnGhostStyle, padding: '3px 6px', color: 'var(--danger)' }}
                      title="Delete relationship"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Baseline Form */}
        {showBaselineForm && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
            <h4 style={{ ...subsectionTitle, margin: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Save size={14} />
              Create Baseline
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Label *</label>
                <input
                  type="text"
                  value={baselineFormData.label}
                  onChange={e => setBaselineFormData(prev => ({ ...prev, label: e.target.value }))}
                  style={inputStyle}
                  placeholder="e.g., Pre-deployment snapshot"
                />
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <input
                  type="text"
                  value={baselineFormData.notes}
                  onChange={e => setBaselineFormData(prev => ({ ...prev, notes: e.target.value }))}
                  style={inputStyle}
                  placeholder="Optional context for this baseline..."
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowBaselineForm(false); setBaselineFormData({ label: '', notes: '' }); }}
                  style={btnGhostStyle}
                >
                  Cancel
                </button>
                <button
                  onClick={saveBaseline}
                  style={baselineSaving ? btnDisabledStyle : btnStyle}
                  disabled={baselineSaving}
                >
                  <Save size={14} />
                  {baselineSaving ? 'Saving...' : 'Save Baseline'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Baselines List */}
        {showBaselines && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ ...subsectionTitle, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} />
                Baselines
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>
                  ({baselinesTotal})
                </span>
              </h4>
              <button
                onClick={() => { setShowBaselines(false); setBaselines([]); }}
                style={btnGhostStyle}
              >
                <X size={12} />
                Close
              </button>
            </div>

            {baselinesLoading ? (
              <div className="skeleton" style={{ height: 40, borderRadius: 'var(--radius-md)', marginBottom: 8 }} />
            ) : baselines.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: 12 }}>
                No baselines captured yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {baselines.map(b => (
                  <div
                    key={b.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                      background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>{b.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {formatDate(b.created_at)}
                        {b.created_by_name ? ` by ${b.created_by_name}` : ''}
                        {b.notes ? ` — ${b.notes}` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => loadCompare(ci.id, b.id)}
                      style={btnGhostStyle}
                      title="Compare with current"
                    >
                      <GitCompare size={12} />
                      Compare
                    </button>
                  </div>
                ))}
              </div>
            )}

            {baselinesTotal > 20 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => loadBaselines(ci.id, baselinesPage - 1)}
                  disabled={baselinesPage <= 1}
                  style={btnGhostStyle}
                >
                  <ChevronLeft size={14} />
                  Previous
                </button>
                <button
                  onClick={() => loadBaselines(ci.id, baselinesPage + 1)}
                  style={btnGhostStyle}
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── ──────────────────────────────────────────────────────────────────────────
  //  Render: Relationship Map View
  // ── ──────────────────────────────────────────────────────────────────────────

  const renderRelationshipMap = () => (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h3 style={sectionTitle}>Relationship Map</h3>
          <p style={sectionDesc}>
            Browse relationships between configuration items. Search for a CI to see all its
            connections to other items in the CMDB.
          </p>
        </div>
        <button onClick={openRelForm} style={btnStyle}>
          <Plus size={14} />
          Add Relationship
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Search for a CI to view its relationships..."
          value={relSearchInput}
          onChange={e => setRelSearchInput(e.target.value)}
          onKeyDown={handleRelSearchKeyDown}
          style={{ ...inputStyle, paddingLeft: 32 }}
        />
      </div>

      {relLoading ? (
        <div>
          <div className="skeleton" style={{ height: 40, borderRadius: 'var(--radius-md)', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 40, borderRadius: 'var(--radius-md)', marginBottom: 8 }} />
        </div>
      ) : !relSearch ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <MapIcon size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>Enter a CI name to explore relationships</p>
          <p style={{ fontSize: 12, margin: 0 }}>
            Type a CI name above to see how it connects to other items
          </p>
        </div>
      ) : relResults.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <Share2 size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>
            No relationships found for "{relSearch}"
          </p>
          <p style={{ fontSize: 12, margin: 0 }}>
            {relCiName ? 'This CI has no relationships defined yet.' : 'No CI found matching that name.'}
          </p>
        </div>
      ) : (
        <>
          {/* Summary card for the CI */}
          {relCiName && (
            <div style={{
              ...subsectionStyle, marginTop: 0, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 'var(--radius-md)',
                background: 'var(--accent-subtle)', color: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Box size={16} />
              </div>
              <div>
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  Relationships for <strong style={{ color: 'var(--accent)' }}>{relCiName}</strong>
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                  {relResults.length} connection{relResults.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}

          {/* Relationships table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Source</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Target</th>
                  <th style={thStyle}>Description</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {relResults.map(rel => (
                  <tr key={rel.id} style={{ transition: 'background 0.1s' }}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: 'var(--radius-sm)',
                          background: ciTypeBg(rel.source_type), color: ciTypeColor(rel.source_type),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {getCiIcon(rel.source_type, 12)}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{rel.source_name}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          ({CI_TYPES.find(t => t.value === rel.source_type)?.label || rel.source_type})
                        </span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px',
                        borderRadius: 'var(--radius-full)', textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        background: 'var(--accent-subtle)', color: 'var(--accent)',
                      }}>
                        {relationshipDirectionLabel(rel.relationship_type)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: 'var(--radius-sm)',
                          background: ciTypeBg(rel.target_type), color: ciTypeColor(rel.target_type),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {getCiIcon(rel.target_type, 12)}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{rel.target_name}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          ({CI_TYPES.find(t => t.value === rel.target_type)?.label || rel.target_type})
                        </span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: rel.description ? 'var(--text-secondary)' : 'var(--text-muted)', fontSize: 12 }}>
                      {rel.description || '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button
                        onClick={() => deleteRelationship(rel)}
                        style={{
                          ...btnGhostStyle, padding: '3px 6px',
                          color: relDeleting === rel.id ? 'var(--text-muted)' : 'var(--danger)',
                          opacity: relDeleting === rel.id ? 0.5 : 1,
                        }}
                        disabled={relDeleting === rel.id}
                        title="Delete relationship"
                      >
                        {relDeleting === rel.id ? <Loader size={12} /> : <Trash2 size={12} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );

  // ── ──────────────────────────────────────────────────────────────────────────
  //  Render: Add/Edit CI Modal
  // ── ──────────────────────────────────────────────────────────────────────────

  const renderFormModal = () => {
    if (!showForm) return null;

    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}>
        <div style={{
          width: '100%', maxWidth: 520, background: 'var(--card)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 20px', borderBottom: '1px solid var(--border)',
          }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              {formMode === 'create' ? 'Add Configuration Item' : 'Edit Configuration Item'}
            </h3>
            <button
              onClick={() => setShowForm(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Name */}
            <div>
              <label style={labelStyle}>Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => handleFormChange('name', e.target.value)}
                style={inputStyle}
                placeholder="e.g., Production Web Server 01"
              />
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                value={formData.description}
                onChange={e => handleFormChange('description', e.target.value)}
                style={{ ...inputStyle, minHeight: 70, fontSize: 12, lineHeight: 1.5, resize: 'vertical' }}
                placeholder="Purpose and role of this configuration item..."
              />
            </div>

            {/* CI Type & Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>CI Type</label>
                <select
                  value={formData.ci_type}
                  onChange={e => handleFormChange('ci_type', e.target.value)}
                  style={selectStyle}
                >
                  {CI_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select
                  value={formData.status}
                  onChange={e => handleFormChange('status', e.target.value)}
                  style={selectStyle}
                >
                  {CI_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Department & Location */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={e => handleFormChange('department', e.target.value)}
                  style={inputStyle}
                  placeholder="e.g., Engineering"
                />
              </div>
              <div>
                <label style={labelStyle}>Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={e => handleFormChange('location', e.target.value)}
                  style={inputStyle}
                  placeholder="e.g., Data Center A, Rack 12"
                />
              </div>
            </div>

            {/* Owner */}
            <div>
              <label style={labelStyle}>Owner</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={
                    formData.owner_id && ownerSearchResults.length > 0
                      ? ownerSearchResults.find(u => u.id === formData.owner_id)?.name || ''
                      : ''
                  }
                  onChange={e => {
                    handleOwnerSearch(e.target.value);
                    (document.activeElement as HTMLInputElement)?.setAttribute('data-search', e.target.value);
                  }}
                  onFocus={() => {
                    const q = (document.activeElement as HTMLInputElement)?.getAttribute('data-search') || '';
                    if (q.length >= 2) { setShowOwnerDropdown(true); }
                  }}
                  placeholder="Search by name or email..."
                  style={{ ...inputStyle, paddingRight: 30 }}
                  autoComplete="off"
                />
                {formData.owner_id && (
                  <button
                    onClick={() => {
                      handleFormChange('owner_id', '');
                      setOwnerSearchResults([]);
                    }}
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                      padding: 0,
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
                {showOwnerDropdown && ownerSearchResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', marginTop: 4,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxHeight: 200, overflowY: 'auto',
                  }}>
                    {ownerSearchResults.map(u => (
                      <div
                        key={u.id}
                        onClick={() => {
                          handleFormChange('owner_id', u.id);
                          setOwnerSearchResults([u]);
                          setShowOwnerDropdown(false);
                        }}
                        style={{
                          padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                          borderBottom: '1px solid var(--border-subtle)',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{u.name}</span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{u.email}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label style={labelStyle}>Tags</label>
              <input
                type="text"
                value={formData.tags}
                onChange={e => handleFormChange('tags', e.target.value)}
                style={inputStyle}
                placeholder="production, web, critical (comma-separated)"
              />
              <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Separate tags with commas
              </p>
            </div>

            {/* Link to Asset */}
            <div>
              <label style={labelStyle}>Link to Asset (optional)</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={
                    formData.asset_id && assetSearchResults.length > 0
                      ? assetSearchResults.find(a => a.id === formData.asset_id)?.name || ''
                      : ''
                  }
                  onChange={e => {
                    handleAssetSearch(e.target.value);
                    (document.activeElement as HTMLInputElement)?.setAttribute('data-search', e.target.value);
                  }}
                  onFocus={() => {
                    const q = (document.activeElement as HTMLInputElement)?.getAttribute('data-search') || '';
                    if (q.length >= 2) { setShowAssetDropdown(true); }
                  }}
                  placeholder="Search assets by name..."
                  style={{ ...inputStyle, paddingRight: 30 }}
                  autoComplete="off"
                />
                {formData.asset_id && (
                  <button
                    onClick={() => {
                      handleFormChange('asset_id', '');
                      setAssetSearchResults([]);
                    }}
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                      padding: 0,
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
                {showAssetDropdown && assetSearchResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', marginTop: 4,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxHeight: 200, overflowY: 'auto',
                  }}>
                    {assetSearchResults.map(a => (
                      <div
                        key={a.id}
                        onClick={() => {
                          handleFormChange('asset_id', a.id);
                          setAssetSearchResults([a]);
                          setShowAssetDropdown(false);
                        }}
                        style={{
                          padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                          borderBottom: '1px solid var(--border-subtle)',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{a.name}</span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                          ({a.asset_type})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 8,
            padding: '16px 20px', borderTop: '1px solid var(--border)',
          }}>
            <button
              onClick={() => setShowForm(false)}
              style={btnGhostStyle}
            >
              Cancel
            </button>
            <button
              onClick={saveCi}
              style={saving ? btnDisabledStyle : btnStyle}
              disabled={saving}
            >
              <Save size={14} />
              {saving ? 'Saving...' : formMode === 'create' ? 'Create CI' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── ──────────────────────────────────────────────────────────────────────────
  //  Render: Add Relationship Modal
  // ── ──────────────────────────────────────────────────────────────────────────

  const renderRelFormModal = () => {
    if (!showRelForm) return null;

    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}>
        <div style={{
          width: '100%', maxWidth: 520, background: 'var(--card)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 20px', borderBottom: '1px solid var(--border)',
          }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              <Share2 size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Add Relationship
            </h3>
            <button
              onClick={() => setShowRelForm(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Source CI */}
            <div>
              <label style={labelStyle}>Source CI</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={
                    relFormData.source_id && relFormData.source_name
                      ? relFormData.source_name
                      : relSourceSearch
                  }
                  onChange={e => handleRelSourceSearch(e.target.value)}
                  onFocus={() => { if (relSourceSearch.length >= 2) setShowRelSourceDropdown(true); }}
                  placeholder="Search for source CI..."
                  style={{ ...inputStyle, paddingRight: 30 }}
                  autoComplete="off"
                />
                {relFormData.source_id && (
                  <button
                    onClick={() => {
                      setRelFormData(prev => ({ ...prev, source_id: '', source_name: '' }));
                      setRelSourceSearch('');
                      setRelSourceResults([]);
                    }}
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                      padding: 0,
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
                {showRelSourceDropdown && relSourceResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', marginTop: 4,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxHeight: 200, overflowY: 'auto',
                  }}>
                    {relSourceResults.map(ci => (
                      <div
                        key={ci.id}
                        onClick={() => {
                          setRelFormData(prev => ({ ...prev, source_id: ci.id, source_name: ci.name }));
                          setRelSourceSearch('');
                          setRelSourceResults([]);
                          setShowRelSourceDropdown(false);
                        }}
                        style={{
                          padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                          borderBottom: '1px solid var(--border-subtle)',
                          display: 'flex', alignItems: 'center', gap: 8,
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{
                          width: 22, height: 22, borderRadius: 'var(--radius-sm)',
                          background: ciTypeBg(ci.ci_type), color: ciTypeColor(ci.ci_type),
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          {getCiIcon(ci.ci_type, 11)}
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{ci.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          ({CI_TYPES.find(t => t.value === ci.ci_type)?.label || ci.ci_type})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Relationship Type */}
            <div>
              <label style={labelStyle}>Relationship Type</label>
              <select
                value={relFormData.relationship_type}
                onChange={e => setRelFormData(prev => ({ ...prev, relationship_type: e.target.value }))}
                style={selectStyle}
              >
                {RELATIONSHIP_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Target CI */}
            <div>
              <label style={labelStyle}>Target CI</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={
                    relFormData.target_id && relFormData.target_name
                      ? relFormData.target_name
                      : relTargetSearch
                  }
                  onChange={e => handleRelTargetSearch(e.target.value)}
                  onFocus={() => { if (relTargetSearch.length >= 2) setShowRelTargetDropdown(true); }}
                  placeholder="Search for target CI..."
                  style={{ ...inputStyle, paddingRight: 30 }}
                  autoComplete="off"
                />
                {relFormData.target_id && (
                  <button
                    onClick={() => {
                      setRelFormData(prev => ({ ...prev, target_id: '', target_name: '' }));
                      setRelTargetSearch('');
                      setRelTargetResults([]);
                    }}
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                      padding: 0,
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
                {showRelTargetDropdown && relTargetResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', marginTop: 4,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxHeight: 200, overflowY: 'auto',
                  }}>
                    {relTargetResults.map(ci => (
                      <div
                        key={ci.id}
                        onClick={() => {
                          setRelFormData(prev => ({ ...prev, target_id: ci.id, target_name: ci.name }));
                          setRelTargetSearch('');
                          setRelTargetResults([]);
                          setShowRelTargetDropdown(false);
                        }}
                        style={{
                          padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                          borderBottom: '1px solid var(--border-subtle)',
                          display: 'flex', alignItems: 'center', gap: 8,
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{
                          width: 22, height: 22, borderRadius: 'var(--radius-sm)',
                          background: ciTypeBg(ci.ci_type), color: ciTypeColor(ci.ci_type),
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          {getCiIcon(ci.ci_type, 11)}
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{ci.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          ({CI_TYPES.find(t => t.value === ci.ci_type)?.label || ci.ci_type})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description (optional)</label>
              <input
                type="text"
                value={relFormData.description}
                onChange={e => setRelFormData(prev => ({ ...prev, description: e.target.value }))}
                style={inputStyle}
                placeholder="e.g., Primary database for the payment service"
              />
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 8,
            padding: '16px 20px', borderTop: '1px solid var(--border)',
          }}>
            <button
              onClick={() => setShowRelForm(false)}
              style={btnGhostStyle}
            >
              Cancel
            </button>
            <button
              onClick={saveRelationship}
              style={relSaving ? btnDisabledStyle : btnStyle}
              disabled={relSaving}
            >
              <Link2 size={14} />
              {relSaving ? 'Creating...' : 'Create Relationship'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── ──────────────────────────────────────────────────────────────────────────
  //  Render: Health Summary Widget
  // ── ──────────────────────────────────────────────────────────────────────────

  const renderHealthSummary = () => {
    if (healthSummaryLoading && !healthSummary) {
      return (
        <div style={sectionStyle}>
          <div className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-md)' }} />
        </div>
      );
    }
    if (!healthSummary) return null;

    const breakdown = healthSummary.health_status_breakdown || {};
    const total = healthSummary.total || 1;
    const segments: Array<{ status: string; count: number; pct: number; color: string }> = [];
    const colors: Record<string, string> = {
      excellent: '#2563eb',
      good: '#16a34a',
      fair: '#ca8a04',
      poor: '#ea580c',
      critical: '#dc2626',
      unknown: '#6b7280',
    };
    let cumulativePct = 0;
    const order = ['excellent', 'good', 'fair', 'poor', 'critical', 'unknown'];
    for (const s of order) {
      const count = breakdown[s] || 0;
      if (count > 0) {
        const pct = (count / total) * 100;
        segments.push({ status: s, count, pct, color: colors[s] || '#6b7280' });
      }
    }

    const conicGradient = segments.map((s, i) => {
      const start = cumulativePct;
      const end = cumulativePct + s.pct;
      cumulativePct = end;
      return `${s.color} ${start}% ${end}%`;
    }).join(', ');

    return (
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={16} />
              CI Health Overview
            </h3>
            <p style={sectionDesc}>
              Health scores assess CI data completeness and quality. Higher scores indicate better-maintained records.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {assessProgress && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{assessProgress}</span>
            )}
            <button
              onClick={assessAllHealth}
              style={assessingHealth ? btnDisabledStyle : btnStyle}
              disabled={assessingHealth}
            >
              <Activity size={14} />
              {assessingHealth ? 'Assessing...' : 'Assess All Health'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, alignItems: 'stretch' }}>
          {/* Donut chart */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{
              width: 120, height: 120, borderRadius: '50%',
              background: `conic-gradient(${conicGradient || '#e5e7eb'})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'var(--bg-elevated)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
                  {healthSummary.average_health_score}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>avg</span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center', minWidth: 160 }}>
            {segments.filter(s => s.count > 0).map(s => (
              <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: 3, flexShrink: 0,
                  background: s.color,
                }} />
                <span style={{ fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize', width: 70 }}>{s.status}</span>
                <span style={{ color: 'var(--text-muted)', flex: 1 }}>{s.count} CI{s.count !== 1 ? 's' : ''}</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{Math.round(s.pct)}%</span>
              </div>
            ))}
            {segments.length === 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No CIs assessed yet</span>
            )}
          </div>

          {/* Needs attention */}
          {needsAttentionCis.length > 0 && (
            <div style={{
              flex: 1, borderLeft: '1px solid var(--border)', paddingLeft: 20,
              maxHeight: 130, overflowY: 'auto',
            }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={13} />
                Needs Attention ({needsAttentionCis.length})
              </h4>
              {needsAttentionCis.map(ci => (
                <div
                  key={ci.id}
                  onClick={() => {
                    const found = cis.find(c => c.id === ci.id);
                    if (found) loadCiDetail(found);
                  }}
                  style={{
                    fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: healthColor(ci.health_score).text,
                  }} />
                  <span style={{ flex: 1 }}>{ci.name}</span>
                  <span style={{ fontWeight: 600, fontSize: 11, color: healthColor(ci.health_score).text }}>
                    {ci.health_score}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── ──────────────────────────────────────────────────────────────────────────
  //  Render: Compare Modal
  // ── ──────────────────────────────────────────────────────────────────────────

  const renderCompareModal = () => {
    if (!showCompare) return null;

    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}>
        <div style={{
          width: '100%', maxWidth: 640, background: 'var(--card)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 20px', borderBottom: '1px solid var(--border)',
          }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <GitCompare size={16} />
              Compare: {compareData?.baseline_label || 'Baseline'}
            </h3>
            <button
              onClick={() => { setShowCompare(false); setCompareData(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          {compareLoading ? (
            <div style={{ padding: 20 }}>
              <div className="skeleton" style={{ height: 40, borderRadius: 'var(--radius-md)', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 40, borderRadius: 'var(--radius-md)', marginBottom: 8 }} />
            </div>
          ) : compareData ? (
            <div style={{ padding: 20, overflowY: 'auto' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                Captured: {formatDate(compareData.baseline_created_at)}
                {compareData.baseline_notes ? ` — ${compareData.baseline_notes}` : ''}
              </div>

              {compareData.diffs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                  <CheckCircle size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                  <p style={{ fontSize: 13, margin: 0 }}>No changes detected — CI matches the baseline exactly.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {compareData.diffs.map((diff, i) => {
                    let rowBg = 'transparent';
                    let labelText = 'Changed';
                    if (diff.type === 'added') { rowBg = '#f0fdf4'; labelText = 'Added'; }
                    else if (diff.type === 'removed') { rowBg = '#fef2f2'; labelText = 'Removed'; }
                    else { rowBg = '#fefce8'; labelText = 'Changed'; }

                    return (
                      <div
                        key={i}
                        style={{
                          padding: '10px 12px', borderRadius: 'var(--radius-md)',
                          background: rowBg, border: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', textTransform: 'capitalize' }}>
                            {diff.field.replace(/_/g, ' ')}
                          </span>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '1px 6px',
                            borderRadius: 'var(--radius-full)', textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            background: diff.type === 'added' ? '#dcfce7' : diff.type === 'removed' ? '#fecaca' : '#fef9c3',
                            color: diff.type === 'added' ? '#16a34a' : diff.type === 'removed' ? '#dc2626' : '#ca8a04',
                          }}>
                            {labelText}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 2 }}>Baseline</span>
                            <span style={{ color: diff.type === 'removed' ? 'var(--danger)' : 'var(--text-secondary)' }}>
                              {diff.old_value !== null && diff.old_value !== undefined
                                ? typeof diff.old_value === 'object' ? JSON.stringify(diff.old_value) : String(diff.old_value)
                                : <em style={{ color: 'var(--text-muted)' }}>not set</em>}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 2 }}>Current</span>
                            <span style={{ color: diff.type === 'added' ? 'var(--success)' : diff.type === 'removed' ? 'var(--text-muted)' : 'var(--text)' }}>
                              {diff.new_value !== null && diff.new_value !== undefined
                                ? typeof diff.new_value === 'object' ? JSON.stringify(diff.new_value) : String(diff.new_value)
                                : <em style={{ color: 'var(--text-muted)' }}>not set</em>}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
              <p>Failed to load comparison data.</p>
            </div>
          )}

          {/* Footer */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 8,
            padding: '16px 20px', borderTop: '1px solid var(--border)',
          }}>
            <button
              onClick={() => { setShowCompare(false); setCompareData(null); }}
              style={btnGhostStyle}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── ──────────────────────────────────────────────────────────────────────────
  //  Main Render
  // ── ──────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Sub-mode tabs */}
      {renderSubTabs()}

      {/* Main content based on sub-mode */}
      {subMode === 'cis' ? (
        <>
          {renderHealthSummary()}
          {renderCiList()}
          {renderCiDetail()}
        </>
      ) : (
        renderRelationshipMap()
      )}

      {/* Modals */}
      {renderCompareModal()}

      {/* Info card */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Info size={18} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent)' }} />
          <div>
            <h3 style={{ ...sectionTitle, marginBottom: 6 }}>About Configuration Management</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              The Configuration Management Database (CMDB) maintains records of configuration items (CIs)
              and their relationships. CIs represent any component that needs to be managed to deliver an IT service,
              including hardware, software, networks, and documentation. Managing relationships between CIs
              helps understand service impact, track dependencies, and support change management processes.
              A well-maintained CMDB is essential for effective incident, problem, and change management.
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      {renderFormModal()}
      {renderRelFormModal()}
    </div>
  );
}
