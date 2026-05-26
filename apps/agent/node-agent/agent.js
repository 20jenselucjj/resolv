// Resolv Agent — Windows Service for Resolv ITSM
// Collects system inventory and reports to Resolv ITSM.
// CLI modes:
//   (no args, config.json exists) → run as agent
//   (no args, embedded config, no config.json) → auto-install as service (self-elevates)
//   --uninstall → remove service + files (self-elevates if needed)
'use strict';

// When launched as a Windows service via NSSM, process.argv[1] may be
// undefined inside a pkg-bundled binary, causing a Node.js startup crash
// (ERR_INVALID_ARG_TYPE). Guard against this before any other code runs.
if (!process.argv[1]) {
  process.argv[1] = process.execPath;
}

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, execSync } = require('child_process');
// NOTE: socket.io-client NOT used — we implement the Engine.IO/Socket.IO
//       protocol over raw `ws` (see connectSocket() below) because
//       socket.io-client's transports break inside pkg'd Node.js binaries.

// ---------------------------------------------------------------------------
// In a pkg'd .exe, __dirname points to the snapshot virtual filesystem.
// Use process.execPath (real path to the .exe) for file operations.
// ---------------------------------------------------------------------------
const AGENT_DIR = path.dirname(process.execPath);
const CONFIG_FILE = path.join(AGENT_DIR, 'config.json');

// ---------------------------------------------------------------------------
// CLI / Installer helpers (no npm deps needed)
// ---------------------------------------------------------------------------
function execAsync(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 15000, windowsHide: true }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout.trim());
    });
  });
}

/** Check if the process is running as Administrator */
function isAdmin() {
  try {
    const out = execSync(
      'powershell -NoProfile -Command "[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"',
      { stdio: 'pipe', windowsHide: true, timeout: 5000 }
    );
    return out.toString().trim() === 'True';
  } catch {
    return false;
  }
}

/** Self-elevate via UAC and exit the current process */
function elevate() {
  console.log('[Resolv Agent] Administrator privileges required. Requesting elevation...');
  const args = process.argv.slice(1).join(' ');
  const cmd = `powershell -NoProfile -Command "Start-Process -Verb RunAs -FilePath '${process.execPath}' -ArgumentList '${args}'"`;
  try {
    execSync(cmd, { stdio: 'ignore', windowsHide: true, timeout: 5000 });
  } catch {}
  // Give the elevated process a moment to start, then exit
  process.exit(0);
}

/** Read config embedded at the end of the running .exe by the download endpoint */
function readEmbeddedConfig() {
  try {
    // Must read as binary buffer — the exe is not valid UTF-8
    const buf = fs.readFileSync(process.execPath);
    const startMarker = Buffer.from('---RESOLV_CONFIG_START---\n');
    const endMarker = Buffer.from('\n---RESOLV_CONFIG_END---');
    // Search from the end of the file for efficiency
    let startIdx = -1;
    for (let i = buf.length - startMarker.length; i >= 0; i--) {
      if (buf[i] === startMarker[0] && buf.slice(i, i + startMarker.length).equals(startMarker)) {
        startIdx = i;
        break;
      }
    }
    if (startIdx === -1) return null;
    const jsonStart = startIdx + startMarker.length;
    let endIdx = -1;
    for (let i = buf.length - endMarker.length; i >= jsonStart; i--) {
      if (buf[i] === endMarker[0] && buf.slice(i, i + endMarker.length).equals(endMarker)) {
        endIdx = i;
        break;
      }
    }
    if (endIdx === -1) return null;
    return JSON.parse(buf.slice(jsonStart, endIdx).toString('utf8'));
  } catch {
    return null;
  }
}

/** Install the agent as a Windows Service using nssm */
async function runInstall(config) {
  const { serverUrl, agentSecret } = config;
  if (!serverUrl || !agentSecret) {
    console.error('[Resolv Agent] Invalid config — missing serverUrl or agentSecret.');
    process.exit(1);
  }

  // Self-elevate if not already running as admin
  if (!isAdmin()) {
    elevate();
    return; // never reached
  }

  const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
  const destDir = path.join(programData, 'Resolv', 'Agent');
  const destExe = path.join(destDir, 'ResolvAgent.exe');
  const destNssm = path.join(destDir, 'nssm.exe');
  const logDir = path.join(destDir, 'logs');

  console.log('[Resolv Agent] Installing to ' + destDir);

  // Create destination directories
  fs.mkdirSync(destDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });

  // Copy ourselves to ProgramData
  try { fs.copyFileSync(process.execPath, destExe); } catch (e) {
    console.error('[Resolv Agent] Failed to copy exe to ' + destDir + ': ' + e.message);
    process.exit(1);
  }

  // Extract embedded nssm.exe alongside the exe.
  // Tries two sources in order:
  //   1. nssm/nssm.exe from pkg snapshot or dev filesystem (path.join(__dirname, ...))
  //   2. nssm-bundle.js — pre-built base64 bundle (generated by scripts/bundle-nssm.js)
  // This avoids reliance on pkg's `assets` config which is unreliable in v5.8.1.
  let nssmExtracted = false;
  // Attempt 1: pkg asset / dev filesystem path
  try {
    const nssmSrc = path.join(__dirname, 'nssm', 'nssm.exe');
    const data = fs.readFileSync(nssmSrc);
    fs.writeFileSync(destNssm, data);
    console.log('[Resolv Agent] nssm extracted from package snapshot');
    nssmExtracted = true;
  } catch {}
  // Attempt 2: base64 bundle
  if (!nssmExtracted) {
    try {
      const nssmData = require('./nssm-bundle');
      fs.writeFileSync(destNssm, nssmData);
      console.log('[Resolv Agent] nssm extracted from base64 bundle');
      nssmExtracted = true;
    } catch {}
  }
  if (!nssmExtracted) {
    console.error('[Resolv Agent] FATAL: nssm.exe could not be extracted from any source.');
    console.error('[Resolv Agent] Rebuild the agent with: npm run build');
    process.exit(1);
  }

  // Write config.json alongside the installed exe
  fs.writeFileSync(path.join(destDir, 'config.json'), JSON.stringify({ serverUrl, agentSecret }, null, 2));

  // Remove any previous service/scheduled task
  try { await execAsync('sc stop ResolvAgent'); } catch {}
  try { await execAsync('sc delete ResolvAgent'); } catch {}
  try { await execAsync('"' + destNssm + '" stop ResolvAgent'); } catch {}
  try { await execAsync('"' + destNssm + '" remove ResolvAgent confirm'); } catch {}
  try { await execAsync('schtasks /delete /tn "Resolv Agent" /f'); } catch {}

  if (fs.existsSync(destNssm)) {
    // --- Install with nssm (handles SCM protocol properly) ---
    console.log('[Resolv Agent] Creating service with nssm...');
    await execAsync('"' + destNssm + '" install ResolvAgent "' + destExe + '"');

    // Configure nssm service parameters
    await execAsync('"' + destNssm + '" set ResolvAgent DisplayName "Resolv ITSM Agent"');
    await execAsync('"' + destNssm + '" set ResolvAgent Description "Collects system inventory and enables remote desktop for Resolv ITSM."');
    await execAsync('"' + destNssm + '" set ResolvAgent Start SERVICE_AUTO_START');
    await execAsync('"' + destNssm + '" set ResolvAgent AppStdout "' + path.join(logDir, 'agent-stdout.log') + '"');
    await execAsync('"' + destNssm + '" set ResolvAgent AppStderr "' + path.join(logDir, 'agent-stderr.log') + '"');
    await execAsync('"' + destNssm + '" set ResolvAgent AppRotateFiles 1');
    await execAsync('"' + destNssm + '" set ResolvAgent AppRotateOnline 1');
    await execAsync('"' + destNssm + '" set ResolvAgent AppRotateBytes 1048576'); // 1MB per log
    await execAsync('"' + destNssm + '" set ResolvAgent AppThrottle 0'); // No restart throttle

    console.log('[Resolv Agent] nssm service configured.');
  } else {
    // --- Fallback to sc.exe (may not show as "Running" in services.msc) ---
    console.warn('[Resolv Agent] Falling back to sc.exe for service creation.');
    const binPath = '"' + destExe + '"';
    await execAsync('sc create ResolvAgent binPath= ' + binPath + ' start=auto DisplayName="Resolv ITSM Agent" obj="NT AUTHORITY\\SYSTEM" type=own');
    await execAsync('sc failure ResolvAgent reset=86400 actions=restart/5000/restart/10000/restart/30000');
    await execAsync('sc description ResolvAgent "Collects system inventory and enables remote desktop for Resolv ITSM."');
  }

  // Create Add/Remove Programs registry entry
  const uninstallKey = 'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ResolvAgent';
  const uninstallCmd = '"' + destExe + '" --uninstall';
  try {
    await execAsync('reg add "' + uninstallKey + '" /v "DisplayName" /t REG_SZ /d "Resolv ITSM Agent" /f');
    await execAsync('reg add "' + uninstallKey + '" /v "UninstallString" /t REG_SZ /d "' + uninstallCmd + '" /f');
    await execAsync('reg add "' + uninstallKey + '" /v "DisplayIcon" /t REG_SZ /d "' + destExe + '" /f');
    await execAsync('reg add "' + uninstallKey + '" /v "Publisher" /t REG_SZ /d "Resolv" /f');
    await execAsync('reg add "' + uninstallKey + '" /v "DisplayVersion" /t REG_SZ /d "1.0.0" /f');
  } catch (e) {
    console.warn('[Resolv Agent] Warning: could not create uninstall registry: ' + e.message);
  }

  // Start the service
  try {
    if (fs.existsSync(destNssm)) {
      await execAsync('"' + destNssm + '" start ResolvAgent');
    } else {
      await execAsync('sc start ResolvAgent');
    }
    console.log('[Resolv Agent] ✓ Service started successfully.');
  } catch (e) {
    console.error('[Resolv Agent] Warning: service created but start failed: ' + e.message);
    console.error('[Resolv Agent] You can start it manually from services.msc');
  }

  console.log('');
  console.log('==================================================');
  console.log('  Resolv ITSM Agent installed successfully!');
  console.log('==================================================');
  console.log('  Service name: ResolvAgent');
  console.log('  Display name: Resolv ITSM Agent');
  console.log('  View in:     services.msc');
  console.log('  Logs:        ' + logDir);
  console.log('  Uninstall:   ' + destExe + ' --uninstall');
  console.log('               or via Apps & Features');
  console.log('==================================================');
}

/** Remove the agent from the system */
async function runUninstall() {
  console.log('[Resolv Agent] Uninstalling...');

  // Self-elevate if not already running as admin (uninstall needs admin rights)
  if (!isAdmin()) {
    elevate();
    return;
  }

  const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
  const agentDir = path.join(programData, 'Resolv', 'Agent');
  const nssmExe = path.join(agentDir, 'nssm.exe');

  // Use nssm if installed, fallback to sc.exe
  if (fs.existsSync(nssmExe)) {
    console.log('[Resolv Agent] Stopping and removing nssm service...');
    try { await execAsync('"' + nssmExe + '" stop ResolvAgent'); } catch {}
    try { await execAsync('"' + nssmExe + '" remove ResolvAgent confirm'); } catch {}
  } else {
    try { await execAsync('sc stop ResolvAgent'); } catch {}
    try { await execAsync('sc delete ResolvAgent'); } catch {}
  }

  try { await execAsync('reg delete "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ResolvAgent" /f'); } catch {}
  try { await execAsync('schtasks /delete /tn "Resolv Agent" /f'); } catch {}

  // Remove all installed files
  try { fs.rmSync(path.join(programData, 'Resolv'), { recursive: true, force: true }); } catch {}

  console.log('[Resolv Agent] ✓ Resolv ITSM Agent has been uninstalled.');
}

// ---------------------------------------------------------------------------
// CLI dispatch — these run BEFORE loading heavy npm deps.
// Returns true if a CLI mode was handled (exits the process), false if
// execution should continue to agent mode.
// ---------------------------------------------------------------------------
function handleCLI() {
  if (process.argv.includes('--uninstall')) {
    runUninstall().then(() => process.exit(0)).catch((err) => {
      console.error('[Resolv Agent] Uninstall failed:', err.message);
      process.exit(1);
    });
    return true;
  }

  const embeddedConfig = readEmbeddedConfig();
  if (embeddedConfig && !fs.existsSync(CONFIG_FILE)) {
    runInstall(embeddedConfig).then(() => process.exit(0)).catch((err) => {
      console.error('[Resolv Agent] Install failed:', err.message);
      process.exit(1);
    });
    return true;
  }

  return false;
}

if (!handleCLI()) {

// ---------------------------------------------------------------------------
// Agent mode — load optional dependencies
// ---------------------------------------------------------------------------
let si, io;
try {
  si = require('systeminformation');
  io = require('socket.io-client');
} catch (e) {
  console.error('');
  console.error('[Resolv Agent] ERROR: Missing Node.js dependencies.');
  console.error('[Resolv Agent] If using the standalone .exe, rebuild with: npm run build');
  console.error('[Resolv Agent] If using the source files, run: npm install');
  console.error('[Resolv Agent] Original error:', e.message);
  console.error('');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error('[Resolv Agent] config.json not found in ' + AGENT_DIR);
    console.error('[Resolv Agent] Download a fresh installer from the Resolv web UI.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

let config = loadConfig();
const { serverUrl, agentSecret } = config;
let agentToken = config.agentToken || null;
let assetId = config.assetId || null;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let socket = null;

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------
function request(method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(urlPath, serverUrl);
    const mod = fullUrl.protocol === 'https:' ? require('https') : require('http');
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    headers['Host'] = fullUrl.hostname; // Preserve original hostname for Host header

    // Resolve all DNS addresses and try them with IPv4 preference.
    // This fixes the common case where Node resolves `localhost` to `::1`
    // (IPv6) but the server only listens on IPv4 (127.0.0.1).
    require('dns').lookup(fullUrl.hostname, { all: true }, (err, addresses) => {
      if (err) return reject(err);
      // Try IPv4 first, then IPv6
      addresses.sort((a, b) => a.family === 4 ? -1 : 1);

      function attempt(idx) {
        if (idx >= addresses.length) {
          return reject(new Error('All addresses failed for ' + fullUrl.hostname));
        }
        const addr = addresses[idx];
        const opts = {
          hostname: addr.address,
          port: fullUrl.port || (fullUrl.protocol === 'https:' ? 443 : 80),
          path: fullUrl.pathname + fullUrl.search,
          method,
          headers,
        };
        const req = mod.request(opts, (res) => {
          let raw = '';
          res.on('data', (c) => (raw += c));
          res.on('end', () => {
            try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
            catch { resolve({ status: res.statusCode, body: raw }); }
          });
        });
        req.on('error', (err) => {
          console.error('[Resolv Agent] HTTP error (' + addr.address + '):', err.message);
          attempt(idx + 1); // Try next address (IPv6 fallback)
        });
        if (data) req.write(data);
        req.end();
      }
      attempt(0);
    });
  });
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
async function register() {
  const hostname = os.hostname();
  console.log('[Resolv Agent] Registering with server...');
  try {
    const res = await request('POST', '/api/assets/agent/register', {
      hostname,
      agent_version: '1.0.0',
      agent_secret: agentSecret,
    });
    if (res.status === 200 || res.status === 201) {
      const d = res.body.data || res.body;
      assetId = d.asset_id || d.id;
      agentToken = d.agent_token || d.token;
      if (assetId && agentToken) {
        config.assetId = assetId;
        config.agentToken = agentToken;
        saveConfig(config);
        console.log('[Resolv Agent] Registered. Asset ID:', assetId);
      } else {
        console.error('[Resolv Agent] Registration response missing asset_id or agent_token:', d);
      }
    } else {
      console.error('[Resolv Agent] Registration failed:', res.status, JSON.stringify(res.body));
    }
  } catch (err) {
    console.error('[Resolv Agent] Registration error:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Software list via PowerShell
// ---------------------------------------------------------------------------
function getInstalledSoftware() {
  return new Promise((resolve) => {
    const ps = 'Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Select-Object DisplayName,DisplayVersion,Publisher,InstallDate,InstallLocation,EstimatedSize | ConvertTo-Json';
    exec('powershell -NoProfile -Command "' + ps + '"', { timeout: 15000, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) { console.error('[Resolv Agent] Software query failed:', err.message); resolve([]); return; }
      try {
        let data = JSON.parse(stdout.trim());
        if (!Array.isArray(data)) data = data ? [data] : [];
        resolve(data.filter((i) => i.DisplayName).map((i) => ({
          name: i.DisplayName,
          version: i.DisplayVersion || null,
          publisher: i.Publisher || null,
          installDate: i.InstallDate || null,
          installLocation: i.InstallLocation || null,
          sizeMB: i.EstimatedSize != null ? parseFloat((i.EstimatedSize / 1024).toFixed(2)) : null,
        })));
      } catch (e) { console.error('[Resolv Agent] Software parse error:', e.message); resolve([]); }
    });
  });
}

// ---------------------------------------------------------------------------
// System info collection and check-in
// ---------------------------------------------------------------------------
async function collectAndCheckin() {
  if (!agentToken || !assetId) await register();
  if (!agentToken || !assetId) { console.warn('[Resolv Agent] Skipping check-in — not registered yet.'); return; }

  let cpuInfo, memInfo, diskLayoutInfo, osInfo, netInfo, graphicsInfo, systemInfo, biosInfo, loadInfo, fsSizeInfo, usersInfo;
  try {
    [cpuInfo, memInfo, diskLayoutInfo, osInfo, netInfo, graphicsInfo, systemInfo, biosInfo, loadInfo, fsSizeInfo, usersInfo] = await Promise.all([
      si.cpu(), si.mem(), si.diskLayout(), si.osInfo(), si.networkInterfaces(),
      si.graphics(), si.system(), si.bios(), si.currentLoad(), si.fsSize(),
      si.users(),
    ]);
  } catch (err) { console.error('[Resolv Agent] Failed to collect system info:', err.message); return; }

  const adapters = Array.isArray(netInfo) ? netInfo : (netInfo ? [netInfo] : []);
  const firstPhysical = adapters.find((a) => a.ip4 && !a.virtual);
  const ipAddress = firstPhysical ? firstPhysical.ip4 : (adapters.find((a) => a.ip4) ? adapters.find((a) => a.ip4).ip4 : undefined);
  const macAddress = adapters.find((a) => a.mac && !a.virtual)?.mac || adapters.find((a) => a.mac)?.mac || undefined;
  const domain = process.env.USERDOMAIN || undefined;

  const networkAdapters = adapters.map((a) => ({
    iface: a.iface, ip4: a.ip4 || null, mac: a.mac || null, netmask: a.ip4subnet || null,
    gateway: a.gateway4 || null, type: a.type || null, speed: a.speed || null,
    virtual: !!a.virtual, operstate: a.operstate || null,
  }));

  const software = await getInstalledSoftware();

  // Collect active user sessions from the Windows machine
  // si.users() runs 'query user' on Windows and returns all interactive sessions (console, RDP, etc.)
  const activeUsers = (usersInfo || []).map((u) => ({
    username: u.user || 'unknown',
    domain: domain || null,
    session_type: u.tty || null,
    session_host: u.host === 'console' ? null : (u.ip || u.host || null),
    logged_in_at: u.date && u.time ? new Date(`${u.date} ${u.time}`).toISOString() : new Date().toISOString(),
  }));

  const checkinBody = {
    hostname: os.hostname(),
    agent_version: '1.0.0',
    ip_address: ipAddress, mac_address: macAddress, domain,
    os: { platform: osInfo.platform, distro: osInfo.distro, release: osInfo.release, build: osInfo.build || null, arch: osInfo.arch },
    hardware: {
      cpu: { manufacturer: cpuInfo.manufacturer, brand: cpuInfo.brand, cores: cpuInfo.cores, physicalCores: cpuInfo.physicalCores, speed: cpuInfo.speed, currentLoad: Math.round((loadInfo.currentLoad || 0) * 100) / 100 },
      mem: { total: memInfo.total, used: memInfo.used, free: memInfo.free },
      graphics: { controllers: (graphicsInfo.controllers || []).map((c) => ({ model: c.model, vram: c.vram || 0 })) },
      system: { manufacturer: systemInfo.manufacturer || null, model: systemInfo.model || null, serial: systemInfo.serial || null },
      bios: { vendor: biosInfo.vendor || null, version: biosInfo.version || null, releaseDate: biosInfo.releaseDate || null },
      diskLayout: (diskLayoutInfo || []).map((d) => ({ name: d.name, type: d.type, size: d.size, vendor: d.vendor })),
      fsSize: (fsSizeInfo || []).map((f) => ({ fs: f.fs, size: f.size, used: f.used, available: f.available, mount: f.mount })),
    },
    network_adapters: networkAdapters,
    software: software,
    current_user: activeUsers.length > 0 ? activeUsers[0] : null,
    users: activeUsers,
  };

  try {
    const res = await request('POST', '/api/assets/agent/checkin', checkinBody, agentToken);
    if (res.status === 200 || res.status === 201) {
      console.log('[Resolv Agent] Check-in OK at', new Date().toISOString());
    } else {
      console.warn('[Resolv Agent] Check-in failed:', res.status, JSON.stringify(res.body));
      if (res.status === 401) { agentToken = null; assetId = null; }
    }
  } catch (err) { console.error('[Resolv Agent] Check-in error:', err.message); }
}

// ---------------------------------------------------------------------------
// Socket.IO connection
//
// The socket.io-client npm package's transports (fetch / XMLHttpRequest /
// ws detection) can break inside the pkg Node.js snapshot. We work around
// this by explicitly setting globalThis.WebSocket to the `ws` module and
// using only the WebSocket transport (skipping HTTP polling which relies on
// fetch / XMLHttpRequest).
// ---------------------------------------------------------------------------
function connectSocket() {
  if (!agentToken || !assetId) { console.warn('[Resolv Agent] Cannot connect socket — not registered.'); return; }

  // Make the `ws` module discoverable by engine.io-client inside the pkg snapshot
  try {
    globalThis.WebSocket = require('ws');
  } catch (e) {
    console.warn('[Resolv Agent] Could not load ws module:', e.message);
  }

  // Build socket URL with IPv4 address to avoid localhost→::1 issues
  function socketUrl(raw) {
    var url = raw.replace('//localhost', '//127.0.0.1');
    // Also try DNS resolution for non-localhost hostnames
    try {
      var parsed = new URL(url);
      var host = parsed.hostname;
      if (!/^\d/.test(host)) {
        var dns = require('dns');
        var addrs = dns.lookupSync(host, { all: true });
        if (addrs && addrs.length > 0) {
          var v4 = addrs.find(function (a) { return a.family === 4; });
          if (v4) parsed.hostname = v4.address;
        }
      }
      return parsed.toString();
    } catch { return url; }
  }

  var sUrl = socketUrl(serverUrl);
  console.log('[Resolv Agent] Connecting socket to', sUrl);

  socket = io(sUrl, {
    auth: { agentToken: agentToken, assetId: assetId },
    transports: ['websocket'],
    reconnectionDelay: 5000,
  });

  socket.on('connect', function () {
    console.log('[Resolv Agent] Socket connected:', socket.id);
    socket.emit('agent:join', { assetId: assetId, agentToken: agentToken });
  });
  socket.on('disconnect', function (reason) { console.log('[Resolv Agent] Socket disconnected:', reason); });
  socket.on('connect_error', function (err) { console.error('[Resolv Agent] Socket connection error:', err.message); });

  socket.on('agent:request-checkin', function () {
    console.log('[Resolv Agent] Immediate check-in requested from web UI');
    collectAndCheckin().catch(function (err) { return console.error('[Resolv Agent] Forced check-in error:', err.message); });
  });
}

// ---------------------------------------------------------------------------
// Main agent loop
// ---------------------------------------------------------------------------
async function main() {
  console.log('[Resolv Agent] Starting — Server:', serverUrl);

  if (!agentToken || !assetId) await register();
  connectSocket();
  await collectAndCheckin().catch((err) => console.error('[Resolv Agent] Initial check-in error:', err.message));

  setInterval(() => {
    collectAndCheckin().catch((err) => console.error('[Resolv Agent] Periodic check-in error:', err.message));
  }, 5 * 60 * 1000);

  setInterval(async () => {
    if (!agentToken || !assetId) { console.log('[Resolv Agent] Not registered — attempting registration...'); await register(); return; }
    try {
      const res = await request('POST', '/api/assets/agent/heartbeat', {}, agentToken);
      if (res.status === 401) { console.warn('[Resolv Agent] Heartbeat rejected — clearing for re-registration'); agentToken = null; assetId = null; }
    } catch {}
  }, 30 * 1000);

  console.log('[Resolv Agent] Running. Check-in every 5 min, heartbeat every 30s.');
}

main().catch((err) => {
  console.error('[Resolv Agent] Fatal error:', err.message);
  process.exit(1);
});

} // end if (!handleCLI())
