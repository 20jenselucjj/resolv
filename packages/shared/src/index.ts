export enum UserRole {
  ADMIN = 'admin',
  AGENT = 'agent',
  USER = 'user'
}

export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type AssetType = 'workstation' | 'laptop' | 'server' | 'mobile' | 'printer' | 'network_device' | 'other';
export type AssetStatus = 'active' | 'inactive' | 'retired' | 'maintenance' | 'disposed';
export type AgentStatus = 'online' | 'offline' | 'unknown';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdById: string;
  assignedToId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface Asset {
  id: string;
  name: string;
  display_name?: string;
  asset_type: AssetType;
  status: AssetStatus;
  agent_status: AgentStatus;
  agent_version?: string;
  agent_last_seen?: string;
  serial_number?: string;
  manufacturer?: string;
  model?: string;
  ip_address?: string;
  mac_address?: string;
  hostname?: string;
  domain?: string;
  os_name?: string;
  os_version?: string;
  os_build?: string;
  os_arch?: string;
  asset_group_id?: string;
  group_name?: string;
  group_color?: string;
  assigned_to_id?: string;
  assigned_to_name?: string;
  assigned_to_email?: string;
  department?: string;
  location?: string;
  company?: string;
  purchase_date?: string;
  warranty_expiry?: string;
  purchase_cost?: number;
  vendor?: string;
  notes?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  // joined from hardware
  cpu_model?: string;
  ram_total_gb?: number;
  disk_total_gb?: number;
  disk_used_gb?: number;
}

export interface AssetHardware {
  id: string;
  asset_id: string;
  cpu_model?: string;
  cpu_manufacturer?: string;
  cpu_cores?: number;
  cpu_threads?: number;
  cpu_speed_mhz?: number;
  cpu_usage_percent?: number;
  ram_total_gb?: number;
  ram_used_gb?: number;
  ram_free_gb?: number;
  gpu_model?: string;
  gpu_vram_gb?: number;
  motherboard_manufacturer?: string;
  motherboard_model?: string;
  bios_version?: string;
  bios_release_date?: string;
  disk_total_gb?: number;
  disk_used_gb?: number;
  disk_free_gb?: number;
  disks: any[];
  updated_at: string;
}

export interface AssetGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  asset_count: number;
  created_at: string;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}


export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdById: string;
  assignedToId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Remote Desktop / Remote Sessions ─────────────────────────────────────

export type RemoteSessionStatus = 'pending' | 'active' | 'ended' | 'failed';

export interface AssetRemoteSession {
  id: string;
  asset_id: string;
  asset_name?: string;
  initiated_by: string;
  initiator_name?: string;
  status: RemoteSessionStatus;
  started_at?: string | null;
  ended_at?: string | null;
  duration_seconds?: number | null;
  created_at: string;
}
