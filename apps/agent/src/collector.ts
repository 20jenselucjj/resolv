// Re-export from shared library — all collection logic is in shared/collector.js
const shared = require('../shared/collector');
export const collectSystemInfo = shared.collectSystemInfo;
export const computeFingerprint = shared.computeFingerprint;
export const getInstalledSoftware = shared.getInstalledSoftware;

// Re-export the SystemInfo type for backward compatibility
export interface SystemInfo {
  hostname: string;
  agent_version: string;
  ip_address: string;
  mac_address: string;
  domain: string;
  machine_fingerprint: string;
  os: { platform: string; distro: string | null; release: string | null; build: string | null; arch: string | null };
  hardware: {
    cpu: { manufacturer: string | null; brand: string | null; cores: number; physicalCores: number; speed: number | null; currentLoad: number | null };
    mem: { total: number; used: number; free: number };
    graphics: { controllers: Array<{ model: string | null; vram: number }> };
    system: { manufacturer: string | null; model: string | null; serial: string | null };
    bios: { vendor: string | null; version: string | null; releaseDate: string | null };
    diskLayout: Array<{ name: string | null; type: string | null; size: number; vendor: string | null }>;
    fsSize: Array<{ fs: string | null; size: number; used: number; available: number; mount: string | null }>;
  };
  network_adapters: Array<{ iface: string | null; ip4: string | null; mac: string | null; netmask: string | null; gateway: string | null; type: string | null; speed: number | null; virtual: boolean; operstate: string | null }>;
  software: Array<{ name: string; version: string | null; publisher: string | null; installDate: string | null; installLocation: string | null; sizeMB: number | null }>;
  current_user: { username: string; domain: string | null } | null;
  users: Array<{ username: string; domain: string | null; session_type: string | null; session_host: string | null; logged_in_at: string | null }>;
  encryption: Array<{ drive_letter: string; protection_status?: string; encryption_method?: string; volume_status?: string; encryption_percentage?: number }>;
  battery: { hasBattery: boolean; design_capacity_mwh?: number; full_charge_capacity_mwh?: number; health_percent?: number | null; cycle_count?: number | null; is_charging?: boolean; remaining_percent?: number | null };
  usb_devices: Array<{ name: string | null; manufacturer: string | null; serial: string | null; type: string | null; device_id: string | null }>;
  usb_changes: { new_devices: Array<any>; removed_devices: Array<any> };
}
