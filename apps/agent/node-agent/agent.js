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
  // Preserve any existing assetId/agentToken for seamless upgrades
  const destConfig = path.join(destDir, 'config.json');
  let existingAssetId = null;
  let existingAgentToken = null;
  try {
    const raw = fs.readFileSync(destConfig, 'utf8');
    const content = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
    const existing = JSON.parse(content);
    if (existing.assetId) existingAssetId = existing.assetId;
    if (existing.agentToken) existingAgentToken = existing.agentToken;
  } catch (_) { /* no existing config — first install */ }
  fs.writeFileSync(destConfig, JSON.stringify({
    serverUrl,
    agentSecret,
    ...(existingAssetId ? { assetId: existingAssetId } : {}),
    ...(existingAgentToken ? { agentToken: existingAgentToken } : {}),
  }, null, 2), 'utf8');

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
  const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
  // Strip UTF-8 BOM if present (PowerShell Set-Content -Encoding UTF8 adds it)
  const content = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
  return JSON.parse(content);
}

function saveConfig(cfg) {
  // Merge with existing config to preserve fields like serverUrl, agentSecret
  let existing = {};
  try { existing = loadConfig(); } catch {}
  const merged = Object.assign({}, existing, cfg);
  // Write without BOM (explicitly use utf8 encoding, which doesn't add BOM)
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Start agent using shared lifecycle
// ---------------------------------------------------------------------------
const { AgentLifecycle } = require('../shared');

const config = loadConfig();
const serverUrl = config.serverUrl;
const agentSecret = config.agentSecret;

const lifecycle = new AgentLifecycle({
  serverUrl: serverUrl,
  agentSecret: agentSecret,
  agentVersion: '1.0.0',
  checkinIntervalMs: config.checkinIntervalMs || 5 * 60 * 1000,
  heartbeatIntervalMs: config.heartbeatIntervalMs || 30 * 1000,
  getConfig: function () {
    try {
      var cfg = loadConfig();
      return { assetId: cfg.assetId || null, agentToken: cfg.agentToken || null };
    } catch (_) {
      return { assetId: null, agentToken: null };
    }
  },
  saveConfig: function (partial) {
    saveConfig(partial);
  },
  onStatusChange: function (status) {
    // Could be used for tray icon updates in the future
  },
  log: function (msg) {
    console.log('[Resolv Agent]', msg);
  },
});

// Handle graceful shutdown
process.on('SIGTERM', function () {
  console.log('[Resolv Agent] Received SIGTERM, shutting down...');
  lifecycle.stop().then(function () { process.exit(0); });
});

process.on('SIGINT', function () {
  console.log('[Resolv Agent] Received SIGINT, shutting down...');
  lifecycle.stop().then(function () { process.exit(0); });
});

// Start the lifecycle
lifecycle.start().catch(function (err) {
  console.error('[Resolv Agent] Fatal error:', err.message);
  process.exit(1);
});

} // end if (!handleCLI())
