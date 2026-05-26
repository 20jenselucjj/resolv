import * as si from 'systeminformation';
import { execSync } from 'child_process';
import * as os from 'os';

export interface SystemInfo {
  hostname: string;
  agent_version: string;
  ip_address: string;
  mac_address: string;
  domain: string;
  os: {
    platform: string;
    distro: string;
    release: string;
    build: string;
    arch: string;
  };
  hardware: {
    cpu: {
      manufacturer: string;
      brand: string;
      cores: number;
      physicalCores: number;
      speed: number;
      currentLoad: number;
    };
    mem: {
      total: number;
      used: number;
      free: number;
    };
    graphics: {
      controllers: Array<{ model: string; vram: number }>;
    };
    system: {
      manufacturer: string;
      model: string;
      serial: string;
    };
    bios: {
      vendor: string;
      version: string;
      releaseDate: string;
    };
    diskLayout: Array<{
      name: string;
      type: string;
      size: number;
      vendor: string;
    }>;
    fsSize: Array<{
      fs: string;
      size: number;
      used: number;
      available: number;
      mount: string;
    }>;
  };
  network_adapters: Array<{
    iface: string;
    ip4: string;
    mac: string;
    type: string;
    speed: number;
    virtual: boolean;
    operstate: string;
  }>;
  software: Array<{
    name: string;
    version: string;
    publisher: string;
    installDate: string;
    sizeMB: number;
  }>;
  current_user: {
    username: string;
    domain: string;
  };
}

export async function collectSystemInfo(): Promise<SystemInfo> {
  const AGENT_VERSION = '1.0.0';

  const [osInfo, cpuInfo, cpuLoad, memInfo, gfxInfo, sysInfo, biosInfo, diskLayoutInfo, fsSizeInfo, netInfo, userInfo] =
    await Promise.all([
      si.osInfo(),
      si.cpu(),
      si.currentLoad(),
      si.mem(),
      si.graphics(),
      si.system(),
      si.bios(),
      si.diskLayout(),
      si.fsSize(),
      si.networkInterfaces(),
      si.users(),
    ]);

  // Filter out loopback adapters and build network adapters array
  const networkAdapters = netInfo
    .filter((n) => n.iface !== 'lo' && n.ip4 !== '127.0.0.1')
    .map((n) => ({
      iface: n.iface,
      ip4: n.ip4 || '',
      mac: n.mac || '',
      type: n.type || '',
      speed: n.speed || 0,
      virtual: n.virtual || false,
      operstate: n.operstate || 'unknown',
    }));

  // Collect software from Windows registry
  let softwareList: Array<{
    name: string;
    version: string;
    publisher: string;
    installDate: string;
    sizeMB: number;
  }> = [];

  if (process.platform === 'win32') {
    try {
      softwareList = collectWindowsSoftware();
    } catch (err) {
      console.error('Failed to collect Windows software list:', err);
    }
  }

  // Determine primary IP and MAC
  const primaryAdapter = networkAdapters.find((a) => a.ip4 && a.ip4 !== '127.0.0.1' && !a.virtual) || networkAdapters[0];

  // Current user
  const currentUser = userInfo && userInfo.length > 0
    ? userInfo[0]
    : { user: os.userInfo().username, tty: '' };

  const hostname = osInfo.hostname || os.hostname();
  const domain = (osInfo as any).domain || '';

  return {
    hostname,
    agent_version: AGENT_VERSION,
    ip_address: primaryAdapter?.ip4 || '',
    mac_address: primaryAdapter?.mac || '',
    domain: typeof domain === 'string' ? domain : '',
    os: {
      platform: osInfo.platform || process.platform,
      distro: osInfo.distro || '',
      release: osInfo.release || '',
      build: osInfo.build || '',
      arch: osInfo.arch || process.arch,
    },
    hardware: {
      cpu: {
        manufacturer: cpuInfo.manufacturer || '',
        brand: cpuInfo.brand || '',
        cores: cpuInfo.cores || 0,
        physicalCores: cpuInfo.physicalCores || 0,
        speed: cpuInfo.speed || 0,
        currentLoad: cpuLoad.currentLoad || 0,
      },
      mem: {
        total: memInfo.total || 0,
        used: memInfo.used || 0,
        free: memInfo.free || 0,
      },
      graphics: {
        controllers: (gfxInfo.controllers || []).map((c) => ({
          model: c.model || '',
          vram: c.vram || 0,
        })),
      },
      system: {
        manufacturer: sysInfo.manufacturer || '',
        model: sysInfo.model || '',
        serial: sysInfo.serial || '',
      },
      bios: {
        vendor: biosInfo.vendor || '',
        version: biosInfo.version || '',
        releaseDate: biosInfo.releaseDate || '',
      },
      diskLayout: (diskLayoutInfo || []).map((d) => ({
        name: d.name || '',
        type: d.type || '',
        size: d.size || 0,
        vendor: d.vendor || '',
      })),
      fsSize: (fsSizeInfo || []).map((f) => ({
        fs: f.fs || '',
        size: f.size || 0,
        used: f.used || 0,
        available: f.available || 0,
        mount: f.mount || '',
      })),
    },
    network_adapters: networkAdapters,
    software: softwareList,
    current_user: {
      username: currentUser.user || '',
      domain: typeof domain === 'string' ? domain : '',
    },
  };
}

function collectWindowsSoftware(): Array<{
  name: string;
  version: string;
  publisher: string;
  installDate: string;
  sizeMB: number;
}> {
  const softwareMap = new Map<string, {
    name: string;
    version: string;
    publisher: string;
    installDate: string;
    sizeMB: number;
  }>();

  const registryPaths = [
    'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
    'HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  ];

  for (const regPath of registryPaths) {
    try {
      const psScript = `Get-ItemProperty ${regPath} | Select-Object DisplayName,DisplayVersion,Publisher,InstallDate,EstimatedSize | Where-Object {$_.DisplayName -ne $null} | ConvertTo-Json -Compression`;
      const output = execSync(
        `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`,
        { timeout: 30000, encoding: 'utf-8' }
      );

      if (!output || output.trim().length === 0) continue;

      const parsed = JSON.parse(output.trim());
      const items: any[] = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        const name = item.DisplayName;
        if (!name || softwareMap.has(name)) continue;
        softwareMap.set(name, {
          name,
          version: item.DisplayVersion || '',
          publisher: item.Publisher || '',
          installDate: item.InstallDate || '',
          sizeMB: item.EstimatedSize ? Math.round(item.EstimatedSize / 1024) : 0,
        });
      }
    } catch {
      // Registry path may not exist, skip silently
    }
  }

  return Array.from(softwareMap.values());
}
