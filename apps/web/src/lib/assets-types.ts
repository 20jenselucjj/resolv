import { Laptop, Monitor, Network, Package, Printer, Server, Smartphone } from 'lucide-react';

export interface AssetHardware {
  cpu_usage_percent?: number | null;
  ram_used_gb?: number | null;
  ram_total_gb?: number | null;
}

export interface Asset {
  id: string;
  name: string;
  display_name?: string;
  asset_type: string;
  status: string;
  agent_status: string;
  agent_last_seen?: string;
  serial_number?: string;
  manufacturer?: string;
  model?: string;
  ip_address?: string;
  hostname?: string;
  os_name?: string;
  asset_group_id?: string | null;
  group_name?: string | null;
  group_color?: string | null;
  assigned_to_id?: string | null;
  assigned_to_name?: string | null;
  assigned_to_avatar?: string | null;
  department?: string;
  location?: string;
  company?: string;
  vendor?: string;
  purchase_date?: string | null;
  warranty_expiry?: string | null;
  purchase_cost?: number | null;
  notes?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  hardware?: AssetHardware | null;
  cpu_model?: string;
  ram_total_gb?: number;
  mac_address?: string;
  domain?: string;
  os_version?: string;
  os_build?: string;
  os_arch?: string;
  agent_version?: string;
  disk_total_gb?: number;
  disk_used_gb?: number;
}

export interface AssetGroup {
  id: string;
  name: string;
  color: string;
  asset_count?: number;
}

export interface StatsData {
  total: number;
  online: number;
  offline: number;
  by_status: Array<{ status: string; count: number }>;
  by_type: Array<{ asset_type: string; count: number }>;
}

export interface AssetListResponse {
  data?: Asset[];
  assets?: Asset[];
  total?: number;
  page?: number;
  limit?: number;
}

export interface AssetGroupsResponse {
  data?: AssetGroup[];
  groups?: AssetGroup[];
}

export interface RawStatsResponse {
  data?: {
    total?: number;
    byStatus?: Array<{ status: string; count: number }>;
    byType?: Array<{ asset_type: string; count: number }>;
    agentStatus?: Array<{ agent_status: string; count: number }>;
  };
  total?: number;
  online?: number;
  offline?: number;
  by_status?: Array<{ status: string; count: number }>;
  by_type?: Array<{ asset_type: string; count: number }>;
}

export interface AssetFormState {
  name: string;
  display_name: string;
  asset_type: string;
  status: string;
  serial_number: string;
  manufacturer: string;
  model: string;
  ip_address: string;
  os_name: string;
  hostname: string;
  department: string;
  location: string;
  company: string;
  asset_group_id: string;
  vendor: string;
  purchase_date: string;
  warranty_expiry: string;
  purchase_cost: string;
  notes: string;
}

export const PAGE_SIZE = 50;

export interface SavedView {
  name: string;
  filters: { asset_type: string; status: string; group_id: string; agent_status: string };
  search: string;
}

export const DEFAULT_VIEWS: SavedView[] = [
  { name: 'All Assets', filters: { asset_type: '', status: '', group_id: '', agent_status: '' }, search: '' },
  { name: 'Online', filters: { asset_type: '', status: '', group_id: '', agent_status: 'online' }, search: '' },
  { name: 'Needs Attention', filters: { asset_type: '', status: 'maintenance', group_id: '', agent_status: '' }, search: '' },
  { name: 'Workstations', filters: { asset_type: 'workstation', status: '', group_id: '', agent_status: '' }, search: '' },
  { name: 'Servers', filters: { asset_type: 'server', status: '', group_id: '', agent_status: '' }, search: '' },
];

export const EMPTY_FORM: AssetFormState = {
  name: '',
  display_name: '',
  asset_type: 'workstation',
  status: 'active',
  serial_number: '',
  manufacturer: '',
  model: '',
  ip_address: '',
  os_name: '',
  hostname: '',
  department: '',
  location: '',
  company: '',
  asset_group_id: '',
  vendor: '',
  purchase_date: '',
  warranty_expiry: '',
  purchase_cost: '',
  notes: ''
};

export const ASSET_TYPE_ICONS: Record<string, typeof Monitor> = {
  workstation: Monitor,
  laptop: Laptop,
  server: Server,
  mobile: Smartphone,
  printer: Printer,
  network_device: Network,
  other: Package
};

export const ASSET_TYPE_LABELS: Record<string, string> = {
  workstation: 'Workstation',
  laptop: 'Laptop',
  server: 'Server',
  mobile: 'Mobile',
  printer: 'Printer',
  network_device: 'Network Device',
  other: 'Other'
};

// ── Column Configuration ──

export type ColumnId =
  | 'asset' | 'status' | 'type' | 'location' | 'network' | 'os'
  | 'cpu' | 'ram' | 'disk' | 'owner' | 'group' | 'last_seen'
  | 'serial_number' | 'manufacturer' | 'model' | 'hostname' | 'mac_address'
  | 'domain' | 'os_version' | 'department' | 'company' | 'vendor'
  | 'purchase_date' | 'warranty_expiry' | 'purchase_cost'
  | 'agent_version' | 'agent_status' | 'tags' | 'created_at' | 'updated_at';

export interface ColumnConfig {
  id: ColumnId;
  label: string;
  category: 'core' | 'hardware' | 'network' | 'ownership' | 'lifecycle' | 'system';
  defaultVisible: boolean;
  pinned?: boolean; // cannot be hidden
}

export const COLUMN_DEFINITIONS: ColumnConfig[] = [
  // Core (always relevant)
  { id: 'asset',          label: 'Asset',           category: 'core',     defaultVisible: true,  pinned: true },
  { id: 'status',         label: 'Status',          category: 'core',     defaultVisible: true },
  { id: 'type',           label: 'Type',            category: 'core',     defaultVisible: true },
  { id: 'group',          label: 'Group',           category: 'core',     defaultVisible: true },
  { id: 'owner',          label: 'Owner',           category: 'ownership',defaultVisible: true },
  { id: 'last_seen',      label: 'Last Seen',       category: 'core',     defaultVisible: true },

  // Hardware
  { id: 'os',             label: 'Operating System',category: 'hardware', defaultVisible: true },
  { id: 'os_version',     label: 'OS Version',      category: 'hardware', defaultVisible: false },
  { id: 'cpu',            label: 'CPU Usage',       category: 'hardware', defaultVisible: false },
  { id: 'ram',            label: 'RAM Usage',       category: 'hardware', defaultVisible: false },
  { id: 'disk',           label: 'Disk Usage',      category: 'hardware', defaultVisible: false },
  { id: 'serial_number',  label: 'Serial Number',   category: 'hardware', defaultVisible: true },
  { id: 'manufacturer',   label: 'Manufacturer',    category: 'hardware', defaultVisible: false },
  { id: 'model',          label: 'Model',           category: 'hardware', defaultVisible: false },

  // Network
  { id: 'network',        label: 'IP Address',      category: 'network',  defaultVisible: true },
  { id: 'hostname',       label: 'Hostname',        category: 'network',  defaultVisible: false },
  { id: 'mac_address',    label: 'MAC Address',     category: 'network',  defaultVisible: false },
  { id: 'domain',         label: 'Domain',          category: 'network',  defaultVisible: false },

  // Ownership / Location
  { id: 'location',       label: 'Location',        category: 'ownership',defaultVisible: true },
  { id: 'department',     label: 'Department',      category: 'ownership',defaultVisible: false },
  { id: 'company',        label: 'Company',         category: 'ownership',defaultVisible: false },

  // Lifecycle / Procurement
  { id: 'vendor',             label: 'Vendor',          category: 'lifecycle', defaultVisible: false },
  { id: 'purchase_date',      label: 'Purchase Date',   category: 'lifecycle', defaultVisible: false },
  { id: 'warranty_expiry',    label: 'Warranty Expiry', category: 'lifecycle', defaultVisible: false },
  { id: 'purchase_cost',      label: 'Purchase Cost',   category: 'lifecycle', defaultVisible: false },

  // System / Agent
  { id: 'agent_status',   label: 'Agent Status',    category: 'system',   defaultVisible: false },
  { id: 'agent_version',  label: 'Agent Version',   category: 'system',   defaultVisible: false },
  { id: 'tags',           label: 'Tags',            category: 'system',   defaultVisible: false },
  { id: 'created_at',     label: 'Created',         category: 'system',   defaultVisible: false },
  { id: 'updated_at',     label: 'Updated',         category: 'system',   defaultVisible: false },
];

export const COLUMN_CATEGORIES: { id: ColumnConfig['category']; label: string }[] = [
  { id: 'core',      label: 'Core' },
  { id: 'hardware',  label: 'Hardware & OS' },
  { id: 'network',   label: 'Network' },
  { id: 'ownership', label: 'Ownership & Location' },
  { id: 'lifecycle', label: 'Procurement' },
  { id: 'system',    label: 'System & Agent' },
];

export const DEFAULT_VISIBLE_COLUMNS: Set<ColumnId> = new Set(
  COLUMN_DEFINITIONS.filter(c => c.defaultVisible).map(c => c.id)
);
