'use strict';

/**
 * Resolv Agent — System Information Collector
 *
 * Collects hardware, OS, network, software, and environment data from the
 * local machine. Designed to work in both pkg-bundled Node.js binaries and
 * Electron environments.
 *
 * Uses `systeminformation` (si.*) for all hardware/OS queries and falls back
 * gracefully to partial data when individual calls fail.
 */

const os = require('os');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// ---------------------------------------------------------------------------
// Lazy-load systeminformation (it may not be available at require time in
// all bootstrap paths). The caller must ensure it is installed.
// ---------------------------------------------------------------------------
let _si = null;
function getSi() {
  if (!_si) {
    try {
      _si = require('systeminformation');
    } catch (e) {
      throw new Error(
        'systeminformation module not available. Install it with: npm install systeminformation'
      );
    }
  }
  return _si;
}

// ---------------------------------------------------------------------------
// Machine Fingerprint
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic machine fingerprint.
 *
 * fingerprint = SHA-256( serial | '|' | primary_mac )
 *
 * If serial is empty / unavailable the fallback is:
 *   fingerprint = SHA-256( hostname | '|' | primary_mac )
 *
 * @param {string} serial     Machine serial number (may be empty)
 * @param {string} mac        Primary MAC address
 * @param {string} hostname   Fallback hostname when serial is empty
 * @returns {string}          Hex-encoded SHA-256 hash (64 chars)
 */
function computeFingerprint(serial, mac, hostname) {
  var raw = (serial && serial.trim())
    ? serial.trim() + '|' + (mac || '')
    : (hostname || 'unknown') + '|' + (mac || '');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ---------------------------------------------------------------------------
// Installed Software (Windows registry)
// ---------------------------------------------------------------------------

/**
 * Query installed software from the Windows registry via PowerShell.
 * Checks both 64-bit (HKLM:\Software\...) and 32-bit (Wow6432Node) paths.
 *
 * Returns a deduplicated array sorted by name.
 *
 * @returns {Promise<Array<{name, version, publisher, installDate, installLocation, sizeMB}>>}
 */
function getInstalledSoftware() {
  return new Promise(function (resolve) {
    if (process.platform !== 'win32') {
      return resolve([]);
    }

    var psScript = [
      'Get-ItemProperty',
      'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
      '| Select-Object DisplayName,DisplayVersion,Publisher,InstallDate,InstallLocation,EstimatedSize',
      '| ConvertTo-Json -Compress'
    ].join(' ');

    exec(
      'powershell -NoProfile -NonInteractive -Command "' + psScript.replace(/"/g, '\\"') + '"',
      { timeout: 30000, maxBuffer: 1024 * 1024, windowsHide: true },
      function (err, stdout) {
        if (err) {
          // Attempt Wow6432Node path before giving up
          return getInstalledSoftwareWow64(resolve);
        }
        try {
          var result = parseSoftwareOutput(stdout);
          if (result.length > 0) return resolve(result);
        } catch (_) { /* fall through to Wow6432Node */ }
        getInstalledSoftwareWow64(resolve);
      }
    );
  });
}

/**
 * Query the 32-bit (Wow6432Node) registry path for software inventory.
 * @param {Function} resolve  Outer promise resolver
 * @private
 */
function getInstalledSoftwareWow64(resolve) {
    var psScript = [
      'Get-ItemProperty',
      'HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
      '| Select-Object DisplayName,DisplayVersion,Publisher,InstallDate,InstallLocation,EstimatedSize',
      '| ConvertTo-Json -Compress'
    ].join(' ');

  exec(
    'powershell -NoProfile -NonInteractive -Command "' + psScript.replace(/"/g, '\\"') + '"',
    { timeout: 30000, maxBuffer: 1024 * 1024, windowsHide: true },
    function (err, stdout) {
      if (err) return resolve([]);
      try {
        resolve(parseSoftwareOutput(stdout));
      } catch (_) {
        resolve([]);
      }
    }
  );
}

/**
 * Parse PowerShell JSON output into a normalised software array.
 * @param {string} stdout  Raw PowerShell stdout
 * @returns {Array}        Normalised software items
 * @private
 */
function parseSoftwareOutput(stdout) {
  var trimmed = (stdout || '').trim();
  if (!trimmed) return [];

  var parsed = JSON.parse(trimmed);
  var items = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
  var seen = Object.create(null);
  var result = [];

  items.forEach(function (item) {
    var name = item && item.DisplayName;
    if (!name || seen[name]) return;
    seen[name] = true;
    result.push({
      name: String(name),
      version: item.DisplayVersion || null,
      publisher: item.Publisher || null,
      installDate: item.InstallDate || null,
      installLocation: item.InstallLocation || null,
      sizeMB: item.EstimatedSize != null
        ? parseFloat((item.EstimatedSize / 1024).toFixed(2))
        : null,
    });
  });

  return result;
}

// ---------------------------------------------------------------------------
// BitLocker status (Windows only)
// ---------------------------------------------------------------------------

/**
 * Query BitLocker encryption status via manage-bde.exe.
 *
 * Parses `manage-bde -status` output for every drive letter found and returns
 * an array of encryption status objects.
 *
 * @returns {Promise<Array<{drive_letter, protection_status, encryption_method, volume_status, encryption_percentage}>>}
 * @private
 */
function getBitLockerStatus() {
  return new Promise(function (resolve) {
    if (process.platform !== 'win32') return resolve([]);

    exec(
      'powershell -NoProfile -NonInteractive -Command "manage-bde -status"',
      { timeout: 30000, windowsHide: true },
      function (err, stdout) {
        if (err) return resolve([]);
        try {
          resolve(parseBitLockerOutput(stdout));
        } catch (_) {
          resolve([]);
        }
      }
    );
  });
}

/**
 * Parse manage-bde.exe output.
 *
 * Example output structure:
 *   Volume C: [OS Volume]
 *     Protection Status: Protection On
 *     Encryption Method: XTS-AES 128
 *     Volume Status: Fully Encrypted
 *     Percentage Encrypted: 100.0%
 *
 * @param {string} raw  Raw stdout from manage-bde -status
 * @returns {Array}     Parsed encryption status array
 * @private
 */
function parseBitLockerOutput(raw) {
  var lines = raw.split('\n');
  var results = [];
  var current = null;

  lines.forEach(function (line) {
    var volumeMatch = line.match(/^Volume\s+([A-Z]):/i);
    if (volumeMatch) {
      if (current) results.push(current);
      current = { drive_letter: volumeMatch[1].toUpperCase() };
      return;
    }

    if (!current) return;

    var protectionMatch = line.match(/Protection\s+Status:\s*(.+)/i);
    if (protectionMatch) {
      current.protection_status = protectionMatch[1].trim();
      return;
    }

    var encMethodMatch = line.match(/Encryption\s+Method:\s*(.+)/i);
    if (encMethodMatch) {
      current.encryption_method = encMethodMatch[1].trim();
      return;
    }

    var volStatusMatch = line.match(/Volume\s+Status:\s*(.+)/i);
    if (volStatusMatch) {
      current.volume_status = volStatusMatch[1].trim();
      return;
    }

    var pctMatch = line.match(/Percentage\s+Encrypted:\s*([\d.]+)/i);
    if (pctMatch) {
      current.encryption_percentage = parseFloat(pctMatch[1]);
      return;
    }
  });

  if (current) results.push(current);
  return results;
}

// ---------------------------------------------------------------------------
// USB device tracking
// ---------------------------------------------------------------------------

/**
 * Query USB devices via systeminformation, filtering to relevant fields.
 * If a usbCachePath is provided the function also returns a diff:
 *   - `new_devices`: devices seen now but not in the previous snapshot
 *   - `removed_devices`: devices in the snapshot but not seen now
 *
 * @param {string} [cachePath]  Optional path to a JSON cache file
 * @returns {Promise<{usb_devices: Array, new_devices?: Array, removed_devices?: Array}>}
 * @private
 */
async function getUsbDevices(cachePath) {
  var si = getSi();
  var result = { usb_devices: [] };

  try {
    var devices = await si.usb();
    var mapped = (devices || []).map(function (d) {
      return {
        name: d.name || null,
        manufacturer: d.manufacturer || null,
        serial: d.serial || null,
        type: (d.type || '').toLowerCase() || null,
        device_id: d.id != null ? String(d.id) : null,
      };
    });

    result.usb_devices = mapped;

    // Diff tracking against a cached snapshot
    if (cachePath) {
      var previous = [];
      try {
        var cacheRaw = fs.readFileSync(cachePath, 'utf8');
        previous = JSON.parse(cacheRaw);
      } catch (_) { /* no cache yet */ }

      var currentSet = new Set(mapped.map(function (d) { return d.serial || d.device_id || d.name; }));
      var prevSet = new Set(previous.map(function (d) { return d.serial || d.device_id || d.name; }));

      result.new_devices = mapped.filter(function (d) {
        var key = d.serial || d.device_id || d.name;
        return key && !prevSet.has(key);
      });

      result.removed_devices = previous.filter(function (d) {
        var key = d.serial || d.device_id || d.name;
        return key && !currentSet.has(key);
      });

      // Persist current snapshot
      try {
        fs.writeFileSync(cachePath, JSON.stringify(mapped, null, 2), 'utf8');
      } catch (_) { /* best-effort write */ }
    }
  } catch (_) {
    // USB collection is best-effort — return empty
  }

  return result;
}

// ---------------------------------------------------------------------------
// Safe wrapper for si.* calls (never throw)
// ---------------------------------------------------------------------------

/**
 * Call an si.* async function and return its result, or a fallback value on
 * failure. Never throws — the agent must never crash on a collection failure.
 *
 * @param {Function} fn       Async function to call (e.g. si.cpu)
 * @param {*}        fallback Value to return on failure
 * @returns {Promise<*>}
 * @private
 */
async function safeSi(fn, fallback) {
  try {
    var val = await fn();
    return val != null ? val : fallback;
  } catch (_) {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Main collection entry point
// ---------------------------------------------------------------------------

/**
 * Collect comprehensive system information from the local machine.
 *
 * Gathers OS, hardware, network, software, BitLocker, battery, and USB data.
 * Handles failures gracefully — partial data is acceptable.
 *
 * @param {Object}  [options]                Optional parameters
 * @param {string}  [options.agentVersion]   Agent version string (default '1.0.0')
 * @param {string}  [options.usbCachePath]   Path to JSON cache for USB tracking
 * @returns {Promise<Object>}  SystemInfo object (see fields below)
 */
async function collectSystemInfo(options) {
  options = options || {};
  var agentVersion = options.agentVersion || '1.0.0';
  var usbCachePath = options.usbCachePath || null;

  var si = getSi();

  // Collect hardware/OS in parallel — each wrapped in safeSi so a single
  // failure does not prevent the rest of the data from being gathered.
  var [
    osInfo,
    cpuInfo,
    loadInfo,
    memInfo,
    gfxInfo,
    sysInfo,
    biosInfo,
    diskLayoutInfo,
    fsSizeInfo,
    netInfo,
    userInfo,
    batteryInfo,
    usbResult,
    encryptionInfo,
    defaultGatewayInfo,
  ] = await Promise.all([
    safeSi(function () { return si.osInfo(); }, {}),
    safeSi(function () { return si.cpu(); }, {}),
    safeSi(function () { return si.currentLoad(); }, {}),
    safeSi(function () { return si.mem(); }, {}),
    safeSi(function () { return si.graphics(); }, { controllers: [] }),
    safeSi(function () { return si.system(); }, {}),
    safeSi(function () { return si.bios(); }, {}),
    safeSi(function () { return si.diskLayout(); }, []),
    safeSi(function () { return si.fsSize(); }, []),
    safeSi(function () { return si.networkInterfaces(); }, []),
    safeSi(function () { return si.users(); }, []),
    safeSi(function () { return si.battery(); }, {}),
    safeSi(async function () {
      var usb = await getUsbDevices(usbCachePath);
      return usb;
    }, { usb_devices: [] }),
    safeSi(function () { return getBitLockerStatus(); }, []),
    safeSi(function () { return si.networkGatewayDefault(); }, null),
  ]);

  // Normalise network interfaces
  var adapters = Array.isArray(netInfo) ? netInfo : [];
  var physicalAdapter = adapters.find(function (a) {
    return a.ip4 && !a.virtual;
  }) || adapters.find(function (a) { return a.ip4; }) || {};

  var primaryIp = physicalAdapter.ip4 || null;
  var primaryMac = physicalAdapter.mac || null;

  var hostname = osInfo.hostname || os.hostname();
  var domain = osInfo.domain || process.env.USERDOMAIN || null;

  // Default gateway (si.networkInterfaces doesn't return gateway, use separate call)
  var defaultGateway = (typeof defaultGatewayInfo === 'string' && defaultGatewayInfo.trim())
    ? defaultGatewayInfo.trim()
    : null;

  // Network adapters array
  var networkAdapters = adapters.map(function (a) {
    return {
      iface: a.iface || null,
      ip4: a.ip4 || null,
      mac: a.mac || null,
      netmask: a.ip4subnet || null,
      gateway: a.default && defaultGateway ? defaultGateway : null,
      type: a.type || null,
      speed: a.speed || null,
      virtual: !!a.virtual,
      operstate: a.operstate || null,
    };
  });

  // Software inventory
  var software = [];
  try {
    software = await getInstalledSoftware();
  } catch (_) { /* best-effort */ }

  // Active user sessions
  var currentUser = null;
  var users = (userInfo || []).map(function (u) {
    var entry = {
      username: u.user || 'unknown',
      domain: domain,
      session_type: u.tty || null,
      session_host: u.ip || null,
      logged_in_at: null,
    };
    if (u.date && u.time) {
      try {
        entry.logged_in_at = new Date(u.date + ' ' + u.time).toISOString();
      } catch (_) {
        entry.logged_in_at = new Date().toISOString();
      }
    }
    return entry;
  });
  if (users.length > 0) currentUser = users[0];

  // Battery — systeminformation doesn't parse CycleCount on Windows, query ROOT/WMI namespace
  if (batteryInfo && batteryInfo.hasBattery && os.platform() === 'win32') {
    try {
      var ccRaw = await new Promise(function (resolve) {
        exec('powershell -NoProfile -Command "(Get-CimInstance -Namespace ROOT/WMI -ClassName BatteryCycleCount).CycleCount"', { timeout: 10000, windowsHide: true }, function (err, stdout) {
          if (err) return resolve(null);
          resolve(stdout);
        });
      });
      if (ccRaw) {
        var trimmed = ccRaw.toString().trim();
        if (trimmed) {
          var parsed = parseInt(trimmed, 10);
          if (!isNaN(parsed)) {
            batteryInfo.cycleCount = parsed;
          }
        }
      }
    } catch (_) {}
  }

  // Battery
  var battery = { hasBattery: false };
  if (batteryInfo && batteryInfo.hasBattery) {
    var designCap = batteryInfo.designedCapacity || 0;
    var fullCharge = batteryInfo.maxCapacity || 0;
    battery = {
      hasBattery: true,
      design_capacity_mwh: designCap,
      full_charge_capacity_mwh: fullCharge,
      health_percent: designCap > 0
        ? parseFloat(((fullCharge / designCap) * 100).toFixed(1))
        : null,
      cycle_count: batteryInfo.cycleCount != null ? batteryInfo.cycleCount : null,
      is_charging: batteryInfo.isCharging || false,
      remaining_percent: batteryInfo.percent != null
        ? parseFloat(batteryInfo.percent.toFixed(1))
        : null,
    };
  }

  // Machine fingerprint
  var serial = (sysInfo && sysInfo.serial) || '';
  var machineFingerprint = computeFingerprint(serial, primaryMac, hostname);

  // -----------------------------------------------------------------------
  // Assemble final SystemInfo object
  // -----------------------------------------------------------------------
  return {
    hostname: hostname,
    agent_version: agentVersion,
    ip_address: primaryIp,
    mac_address: primaryMac,
    domain: domain,
    default_gateway: defaultGateway,
    machine_fingerprint: machineFingerprint,

    os: {
      platform: osInfo.platform || process.platform,
      distro: osInfo.distro || null,
      release: osInfo.release || null,
      build: osInfo.build || null,
      arch: osInfo.arch || process.arch,
    },

    hardware: {
      cpu: {
        manufacturer: cpuInfo.manufacturer || null,
        brand: cpuInfo.brand || null,
        cores: cpuInfo.cores || 0,
        physicalCores: cpuInfo.physicalCores || 0,
        speed: cpuInfo.speed || null,
        currentLoad: loadInfo.currentLoad != null
          ? Math.round(loadInfo.currentLoad * 100) / 100
          : null,
      },
      mem: {
        total: memInfo.total || 0,
        used: memInfo.used || 0,
        free: memInfo.free || 0,
      },
      graphics: {
        controllers: (gfxInfo.controllers || []).map(function (c) {
          return { model: c.model || null, vram: c.vram || 0 };
        }),
      },
      system: {
        manufacturer: sysInfo.manufacturer || null,
        model: sysInfo.model || null,
        serial: serial || null,
      },
      bios: {
        vendor: biosInfo.vendor || null,
        version: biosInfo.version || null,
        releaseDate: biosInfo.releaseDate || null,
      },
      diskLayout: (diskLayoutInfo || []).map(function (d) {
        return {
          name: d.name || null,
          type: d.type || null,
          size: d.size || 0,
          vendor: d.vendor || null,
        };
      }),
      fsSize: (fsSizeInfo || []).map(function (f) {
        return {
          fs: f.fs || null,
          size: f.size || 0,
          used: f.used || 0,
          available: f.available || 0,
          mount: f.mount || null,
        };
      }),
    },

    network_adapters: networkAdapters,
    software: software,
    current_user: currentUser,
    users: users,

    // ── Phase 2 fields ──────────────────────────────────────────────────
    encryption: encryptionInfo,
    battery: battery,
    usb_devices: usbResult.usb_devices,
    usb_changes: {
      new_devices: usbResult.new_devices || [],
      removed_devices: usbResult.removed_devices || [],
    },
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  collectSystemInfo: collectSystemInfo,
  computeFingerprint: computeFingerprint,
  getInstalledSoftware: getInstalledSoftware,
};
