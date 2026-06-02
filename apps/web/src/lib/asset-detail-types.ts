import { Monitor, Cpu, Package, Wifi, Activity } from 'lucide-react';
import type React from 'react';

export interface AssetDisk {
  name?: string | null;
  size?: number | null;
  type?: string | null;
  vendor?: string | null;
  mount?: string | null;
  serial_number?: string | null;
}

export interface AssetDisplay {
  name?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  resolution?: string | null;
  refresh_rate_hz?: number | null;
  is_primary?: boolean | null;
}

export interface AssetHardware {
  cpu_model?: string | null;
  cpu_cores?: number | null;
  cpu_threads?: number | null;
  cpu_speed_mhz?: number | null;
  cpu_usage_percent?: number | null;
  ram_total_gb?: number | null;
  ram_used_gb?: number | null;
  ram_free_gb?: number | null;
  disk_total_gb?: number | null;
  disk_used_gb?: number | null;
  disk_free_gb?: number | null;
  gpu_model?: string | null;
  gpu_vram_gb?: number | null;
  motherboard_manufacturer?: string | null;
  bios_version?: string | null;
  bios_release_date?: string | null;
  disks?: AssetDisk[] | null;
  displays?: AssetDisplay[] | null;
}

export interface AssetSoftware {
  id?: string;
  name: string;
  version?: string | null;
  publisher?: string | null;
  install_date?: string | null;
  size_mb?: number | null;
}

export interface AssetNetworkAdapter {
  id?: string;
  adapter_name?: string | null;
  name?: string | null;
  ip_address?: string | null;
  mac_address?: string | null;
  subnet?: string | null;
  subnet_mask?: string | null;
  gateway?: string | null;
  dns_servers?: string[] | string | null;
  adapter_type?: string | null;
  speed_mbps?: number | null;
  is_virtual?: boolean | null;
  is_active?: boolean | null;
}

export interface AssetUser {
  id?: string;
  username?: string | null;
  display_name?: string | null;
  domain?: string | null;
  user_id?: string | null;
  user_email?: string | null;
  user_avatar?: string | null;
  session_type?: string | null;
  session_host?: string | null;
  is_current?: boolean | null;
  logged_in_at?: string | null;
}

export interface AssetActivityEntry {
  id?: string;
  action: string;
  actor_name?: string | null;
  details?: string | null;
  created_at: string;
}

export interface AssetDetail {
  id: string;
  name?: string | null;
  hostname?: string | null;
  display_name?: string | null;
  asset_type: string;
  agent_status: 'online' | 'offline' | string;
  agent_last_seen?: string | null;
  agent_version?: string | null;
  serial_number?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  ip_address?: string | null;
  mac_address?: string | null;
  domain?: string | null;
  group_name?: string | null;
  assigned_to_name?: string | null;
  owner_name?: string | null;
  department?: string | null;
  location?: string | null;
  company?: string | null;
  vendor?: string | null;
  purchase_date?: string | null;
  warranty_expiry?: string | null;
  purchase_cost?: number | null;
  notes?: string | null;
  tags?: string[] | null;
  os_name?: string | null;
  os_version?: string | null;
  hardware?: AssetHardware | null;
  software?: AssetSoftware[] | null;
  network_adapters?: AssetNetworkAdapter[] | null;
  users?: AssetUser[] | null;
  logged_users?: AssetUser[] | null;
  activity?: AssetActivityEntry[] | null;
}

export interface AssetResponse {
  data: AssetDetail;
}

export type TabId = 'overview' | 'hardware' | 'software' | 'network' | 'activity';
export type NoticeTone = 'success' | 'warning' | 'danger' | 'accent';

export const DISPLAY_FONT = 'var(--font-display, var(--font-inter), system-ui, sans-serif)';
export const BODY_FONT = 'var(--font-body, var(--font-inter), system-ui, sans-serif)';

export const TABS: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: 'overview', label: 'Overview', icon: Monitor },
  { id: 'hardware', label: 'Hardware', icon: Cpu },
  { id: 'software', label: 'Software', icon: Package },
  { id: 'network', label: 'Network', icon: Wifi },
  { id: 'activity', label: 'Activity', icon: Activity }
];
