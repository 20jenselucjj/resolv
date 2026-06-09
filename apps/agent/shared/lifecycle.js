'use strict';

/**
 * Resolv Agent — Lifecycle Manager
 *
 * Orchestrates registration, periodic check-in, heartbeat, and Socket.IO
 * connectivity for the agent. Designed to run in both pkg-bundled Node.js
 * binaries and Electron environments.
 *
 * The lifecycle manager handles:
 *   1. Registration with the server (if no existing token/assetId)
 *   2. Socket.IO connection for real-time agent:request-checkin events
 *   3. Periodic heartbeat (30s default) to signal liveness
 *   4. Periodic full check-ins (5 min default) with system information
 *   5. Re-registration on 401 (token expired/invalid)
 *   6. Graceful disconnect and cleanup on stop
 */

const protocol = require('./protocol');
const { CommandExecutor } = require('./commands');

// ---------------------------------------------------------------------------
// Lazy-load socket.io-client
// ---------------------------------------------------------------------------
let _io = null;
function getIO() {
  if (!_io) {
    try {
      // In pkg'd environments, socket.io-client needs a WebSocket polyfill.
      // engine.io-client detects globalThis.WebSocket at connect-time, so
      // we pre-load the ws module here if available.
      try {
        var ws = require('ws');
        if (ws && typeof ws === 'function') {
          globalThis.WebSocket = ws;
        }
      } catch (_) {
        // ws is optional (not available in Electron environment by default)
      }

      _io = require('socket.io-client');
    } catch (e) {
      throw new Error(
        'socket.io-client module not available. Install it with: npm install socket.io-client'
      );
    }
  }
  return _io;
}

/**
 * Build a Socket.IO URL that resolves to an IPv4 address when possible.
 * This avoids localhost → ::1 issues on machines where the server only
 * listens on IPv4.
 *
 * @param {string} rawUrl  Original server URL
 * @returns {string}       URL with hostname replaced by IPv4 address
 * @private
 */
function resolveSocketUrl(rawUrl) {
  try {
    var parsed = require('url').parse(rawUrl);
    var hostname = parsed.hostname;

    // Skip if already an IP address
    if (/^\d/.test(hostname)) return rawUrl;

    var dns = require('dns');
    var addrs = dns.lookupSync(hostname, { all: true });
    if (addrs && addrs.length > 0) {
      var v4 = addrs.find(function (a) { return a.family === 4; });
      if (v4) {
        parsed.hostname = v4.address;
        // Rebuild URL without the port in hostname
        return parsed.protocol + '//' + v4.address +
          (parsed.port ? ':' + parsed.port : '') +
          (parsed.path || '');
      }
    }
  } catch (_) { /* best-effort */ }

  return rawUrl;
}

// ---------------------------------------------------------------------------
// AgentLifecycle
// ---------------------------------------------------------------------------

/**
 * Manages the complete lifecycle of a Resolv agent process.
 *
 * @class
 */
class AgentLifecycle {
  /**
   * @param {Object}   options
   * @param {string}   options.serverUrl          Server base URL
   * @param {string}   options.agentSecret        Shared secret for registration
   * @param {Function} options.getConfig          Read current config (returns {assetId, agentToken, ...})
   * @param {Function} options.saveConfig         Persist config changes (receives partial config object)
   * @param {Function} [options.onStatusChange]   Callback fired when status changes
   * @param {number}   [options.checkinIntervalMs]  Check-in interval in ms (default 300000)
   * @param {number}   [options.heartbeatIntervalMs] Heartbeat interval in ms (default 30000)
   * @param {string}   [options.agentVersion]     Version string (default '1.0.0')
   * @param {Function} [options.log]              Logging function (default console.log with prefix)
   */
  constructor(options) {
    this._serverUrl = options.serverUrl;
    this._agentSecret = options.agentSecret;
    this._getConfig = options.getConfig;
    this._saveConfig = options.saveConfig;
    this._onStatusChange = options.onStatusChange || function () {};
    this._checkinIntervalMs = options.checkinIntervalMs || 300000;   // 5 min
    this._heartbeatIntervalMs = options.heartbeatIntervalMs || 30000; // 30 s
    this._agentVersion = options.agentVersion || '1.0.0';
    this._log = options.log || function (msg) {
      console.log('[Resolv Agent]', msg);
    };

    // ── Internal state ───────────────────────────────────────────────
    this._socket = null;
    this._heartbeatTimer = null;
    this._checkinTimer = null;
    this._commandTimer = null;
    this._commandExecutor = null;

    this._isOnline = false;
    this._lastCheckin = null;
    this._assetId = null;
    this._agentToken = null;
    this._stopped = false;
    this._updating = false;
    this._currentVersion = options.agentVersion || '1.0.0';
  }

  // ── Public API ─────────────────────────────────────────────────────

  /**
   * Start the agent lifecycle.
   *
   * 1. Reads current config for existing token/assetId
   * 2. If missing, registers with the server
   * 3. Connects Socket.IO
   * 4. Performs an initial check-in
   * 5. Starts periodic heartbeat and check-in intervals
   *
   * @returns {Promise<void>}
   */
  async start() {
    this._stopped = false;

    this._readConfig();

    // Register if we do not yet have credentials
    if (!this._agentToken || !this._assetId) {
      this._log('No existing credentials found. Registering...');
      var registered = await this._register();
      if (!registered) {
        this._log('Registration failed. Will retry in ' + (this._heartbeatIntervalMs / 1000) + 's.');
        // Retry registration on next heartbeat
      }
    }

    // Connect Socket.IO for real-time events
    this._connectSocket();

    // Clean up stale .old files from previous updates
    this._cleanupStaleFiles();

    // Initialize command executor BEFORE starting intervals
    this._commandExecutor = new CommandExecutor({
      serverUrl: this._serverUrl,
      getAgentToken: function () { return this._agentToken; }.bind(this),
      getAssetId: function () { return this._assetId; }.bind(this),
      log: this._log,
    });

    // Start periodic intervals (heartbeat, checkin, command poll)
    this._startIntervals();

    this._log('Agent lifecycle started. Check-in every ' +
      (this._checkinIntervalMs / 1000) + 's, heartbeat every ' +
      (this._heartbeatIntervalMs / 1000) + 's.');

    // Fire initial check-in in background — don't block startup on it
    // since collectSystemInfo can take 30+ seconds and NSSM has a startup timeout.
    this.forceCheckin().catch(function (err) {
      this._log('Initial check-in failed: ' + (err.message || 'unknown'));
    }.bind(this));

    // Poll for pending commands immediately on startup
    this._commandExecutor.pollAndExecute().catch(function (err) {
      this._log('Initial command poll failed: ' + (err.message || 'unknown'));
    }.bind(this));
  }

  /**
   * Gracefully stop the agent lifecycle.
   * Sends disconnect, clears timers, disconnects socket.
   *
   * @returns {Promise<void>}
   */
  async stop() {
    this._stopped = true;
    this._log('Stopping agent lifecycle...');

    // Clear timers first to prevent races
    this._clearIntervals();

    // Send disconnect notification
    if (this._agentToken) {
      await protocol.disconnect(this._serverUrl, this._agentToken);
    }

    // Disconnect socket
    if (this._socket) {
      this._socket.disconnect();
      this._socket = null;
    }

    this._commandExecutor = null;

    this._updating = false;
    this._isOnline = false;
    this._triggerStatusChange();
    this._log('Agent lifecycle stopped.');
  }

  /**
   * Stop and restart the lifecycle (useful after config changes).
   */
  restart() {
    this.stop().then(function () {
      this.start().catch(function (err) {
        this._log('Restart failed: ' + err.message);
      }.bind(this));
    }.bind(this)).catch(function (err) {
      this._log('Stop during restart failed: ' + err.message);
    }.bind(this));
  }

  /**
   * Trigger an immediate system information check-in.
   *
   * @returns {Promise<boolean>} True if check-in succeeded
   */
  async forceCheckin() {
    if (!this._agentToken || !this._assetId) {
      this._log('Cannot check-in: not registered. Attempting registration...');
      var ok = await this._register();
      if (!ok) return false;
    }

    try {
      var collector = require('./collector');
      var systemInfo = await collector.collectSystemInfo({
        agentVersion: this._agentVersion,
      });

      var result = await protocol.checkin(
        this._serverUrl,
        this._agentToken,
        systemInfo
      );

      if (result && result.ok) {
        this._lastCheckin = new Date();
        this._isOnline = true;
        this._triggerStatusChange();
        return true;
      }

      // Only clear credentials on 401 (token expired/invalid)
      if (result && result.status === 401) {
        this._log('Check-in rejected (401) — clearing credentials for re-registration.');
        this._clearCredentials();
      } else {
        this._log('Check-in failed (status ' + (result ? result.status : 'unknown') + ') — will retry.');
      }
      return false;
    } catch (err) {
      this._log('Check-in error: ' + err.message);
      return false;
    }
  }

  /**
   * Get the current agent status.
   *
   * @returns {{isOnline: boolean, lastCheckin: Date|null, assetId: string|null, agentToken: string|null}}
   */
  getStatus() {
    return {
      isOnline: this._isOnline,
      lastCheckin: this._lastCheckin,
      assetId: this._assetId,
      agentToken: !!this._agentToken,
    };
  }

  // ── Internal: Config ───────────────────────────────────────────────

  /**
   * Read current credentials from the config store.
   * @private
   */
  _readConfig() {
    try {
      var cfg = this._getConfig();
      this._assetId = cfg.assetId || null;
      this._agentToken = cfg.agentToken || null;
    } catch (err) {
      this._log('Failed to read config: ' + err.message);
      this._assetId = null;
      this._agentToken = null;
    }
  }

  /**
   * Persist credentials to the config store.
   * @param {string} assetId
   * @param {string} agentToken
   * @private
   */
  _persistCredentials(assetId, agentToken) {
    this._assetId = assetId;
    this._agentToken = agentToken;
    try {
      this._saveConfig({ assetId: assetId, agentToken: agentToken });
    } catch (err) {
      this._log('Failed to persist credentials: ' + err.message);
    }
  }

  /**
   * Clear stored credentials and schedule re-registration.
   * @private
   */
  _clearCredentials() {
    this._assetId = null;
    this._agentToken = null;
    this._isOnline = false;
    try {
      this._saveConfig({ assetId: null, agentToken: null });
    } catch (_) { /* best-effort */ }
    this._triggerStatusChange();
  }

  // ── Internal: Registration ─────────────────────────────────────────

  /**
   * Register this agent with the server.
   * @returns {Promise<boolean>} True if registration succeeded
   * @private
   */
  async _register() {
    if (!this._agentSecret) {
      this._log('Cannot register: no agent_secret configured.');
      return false;
    }

    var hostname;
    try {
      hostname = require('os').hostname();
    } catch (_) {
      hostname = 'unknown';
    }

    // Compute machine fingerprint for deduplication
    var fingerprint = '';
    try {
      var collector = require('./collector');
      var si = require('systeminformation');
      var sysInfo = await si.system().catch(function () { return {}; });
      var netInfo = await si.networkInterfaces().catch(function () { return []; });
      var adapters = Array.isArray(netInfo) ? netInfo : [];
      var phys = adapters.find(function (a) { return a.ip4 && !a.virtual; }) ||
                 adapters.find(function (a) { return a.ip4; }) || {};
      fingerprint = collector.computeFingerprint(
        (sysInfo && sysInfo.serial) || '',
        phys.mac || '',
        hostname
      );
    } catch (_) {
      // Proceed without fingerprint if we cannot compute it
    }

    var result = await protocol.register(
      this._serverUrl,
      hostname,
      this._agentVersion,
      this._agentSecret,
      fingerprint
    );

    if (result && result.asset_id && result.agent_token) {
      this._persistCredentials(result.asset_id, result.agent_token);
      this._isOnline = true;
      this._triggerStatusChange();
      this._log('Registered successfully. Asset ID: ' + result.asset_id);
      return true;
    }

    this._log('Registration failed.');
    return false;
  }

  // ── Internal: Socket.IO ────────────────────────────────────────────

  /**
   * Connect the Socket.IO client for real-time events.
   * Inherits credentials from the current state.
   * @private
   */
  _connectSocket() {
    if (this._socket) {
      this._socket.disconnect();
      this._socket = null;
    }

    if (!this._agentToken || !this._assetId) {
      this._log('Cannot connect socket: not registered.');
      return;
    }

    var io = getIO();
    var socketUrl = resolveSocketUrl(this._serverUrl);

    this._log('Connecting socket to ' + socketUrl);

    this._socket = io(socketUrl, {
      auth: {
        agentToken: this._agentToken,
        assetId: this._assetId,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 5000,
    });

    this._socket.on('connect', function () {
      this._log('Socket connected: ' + this._socket.id);
      this._socket.emit('agent:join', {
        assetId: this._assetId,
        agentToken: this._agentToken,
      });
      this._isOnline = true;
      this._triggerStatusChange();
    }.bind(this));

    this._socket.on('disconnect', function (reason) {
      this._log('Socket disconnected: ' + reason);
      this._isOnline = false;
      this._triggerStatusChange();
    }.bind(this));

    this._socket.on('connect_error', function (err) {
      this._log('Socket connection error: ' + err.message);
    }.bind(this));

    // Listen for server-requested check-in
    this._socket.on('agent:request-checkin', function () {
      this._log('Immediate check-in requested from server.');
      this.forceCheckin().catch(function (err) {
        this._log('Forced check-in error: ' + err.message);
      }.bind(this));
    }.bind(this));

    // Listen for online confirmation
    this._socket.on('agent:online', function (data) {
      this._log('Agent confirmed online on server: ' +
        (data && data.assetId ? data.assetId : 'unknown'));
      this._isOnline = true;
      this._triggerStatusChange();
    }.bind(this));

    // Listen for new command notification — poll immediately
    this._socket.on('agent:command:new', function () {
      this._log('New command notification received — polling immediately.');
      if (this._commandExecutor) {
        this._commandExecutor.pollAndExecute().catch(function (err) {
          this._log('Immediate command poll error: ' + err.message);
        }.bind(this));
      }
    }.bind(this));
  }

  // ── Internal: Intervals ────────────────────────────────────────────

  /**
   * Start periodic heartbeat and check-in intervals.
   * @private
   */
  _startIntervals() {
    this._clearIntervals();

    // Heartbeat: 30s default
    this._heartbeatTimer = setInterval(function () {
      this._doHeartbeat().catch(function (err) {
        this._log('Heartbeat error: ' + err.message);
      }.bind(this));
    }.bind(this), this._heartbeatIntervalMs);

    // Check-in: 5 min default
    this._checkinTimer = setInterval(function () {
      this.forceCheckin().catch(function (err) {
        this._log('Periodic check-in error: ' + err.message);
      }.bind(this));
    }.bind(this), this._checkinIntervalMs);

    // Command poll: every 60s
    this._commandTimer = setInterval(function () {
      if (this._commandExecutor) {
        this._commandExecutor.pollAndExecute().catch(function (err) {
          this._log('Command poll error: ' + err.message);
        }.bind(this));
      }
    }.bind(this), 60000);
  }

  /**
   * Clear both heartbeat and check-in intervals.
   * @private
   */
  _clearIntervals() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
    if (this._checkinTimer) {
      clearInterval(this._checkinTimer);
      this._checkinTimer = null;
    }
    if (this._commandTimer) {
      clearInterval(this._commandTimer);
      this._commandTimer = null;
    }
  }

  /**
   * Send a heartbeat and handle 401 (re-register).
   * @returns {Promise<void>}
   * @private
   */
  async _doHeartbeat() {
    if (this._stopped) return;

    // If we have no credentials, attempt registration
    if (!this._agentToken || !this._assetId) {
      this._log('No credentials — attempting re-registration on heartbeat cycle.');
      await this._register();
      return;
    }

    var result = await protocol.heartbeat(this._serverUrl, this._agentToken);

    if (result.ok) {
      this._isOnline = true;

      // Check heartbeat response for update availability
      // Server wraps responses in { data: { ... } }, unwrap here
      var body = (result.body && result.body.data) || {};
      if (body.update_available && !this._updating) {
        this._log('Update available: ' + (body.latest_version || 'unknown'));
        this._performUpdate(body).catch(function (err) {
          this._log('Auto-update failed: ' + err.message);
          this._updating = false;
        }.bind(this));
      }

      // Check for pending commands — poll immediately
      if (body.has_pending_commands && this._commandExecutor) {
        this._commandExecutor.pollAndExecute().catch(function (err) {
          this._log('Command poll from heartbeat error: ' + err.message);
        }.bind(this));
      }
    } else if (result.status === 401) {
      this._log('Heartbeat rejected (401) — clearing credentials for re-registration.');
      this._clearCredentials();
    } else {
      // Non-401 failure (network error, server down) — just mark offline
      this._isOnline = false;
    }

    this._triggerStatusChange();
  }

  /**
   * Download and apply an agent update.
   *
   * Process:
   *   1. Download new exe to temp location
   *   2. Verify checksum if provided
   *   3. Create a helper batch script that:
   *      a. Waits for current process to exit
   *      b. Copies new exe over current exe
   *      c. Restarts the service (or process)
   *   4. Launch the helper script and exit
   *
   * @param {Object} updateInfo  Update info from heartbeat response
   * @returns {Promise<void>}
   * @private
   */
  async _performUpdate(updateInfo) {
    this._updating = true;
    var downloadUrl = updateInfo.download_url;
    var expectedChecksum = updateInfo.checksum_sha256;
    var newVersion = updateInfo.latest_version || 'unknown';

    if (!downloadUrl) {
      this._log('No download URL provided for update. Skipping.');
      this._updating = false;
      return;
    }

    this._log('Starting auto-update to version ' + newVersion + '...');

    var path = require('path');
    var fs = require('fs');
    var os = require('os');
    var crypto = require('crypto');
    var http = require('http');
    var https = require('https');
    var { exec } = require('child_process');

    // Determine paths
    var currentExe = process.execPath;
    var tempDir = os.tmpdir();
    var newExePath = path.join(tempDir, 'resolv-agent-update-' + Date.now() + '.exe');
    var helperPath = path.join(tempDir, 'resolv-agent-update-' + Date.now() + '.bat');

    // Download new binary
    this._log('Downloading update from ' + downloadUrl + '...');
    var downloaded;

    // Always download from this server's /api/assets/agent/download/update endpoint
    // which auto-resolves to the latest version for this agent token.
    // The downloadBinary function handles DNS resolution and Bearer auth.
    downloaded = await protocol.downloadBinary(this._serverUrl, this._agentToken, newExePath);
    if (!downloaded && downloadUrl && downloadUrl.indexOf('://') > 0) {
      // Fallback: external URL (CDN, S3, etc.) — use raw HTTP download
      this._log('External download fallback...');
      downloaded = await this._downloadToFile(downloadUrl, newExePath);
    }
    if (!downloaded) {
      this._log('Failed to download update.');
      this._updating = false;
      return;
    }

    // Verify checksum if provided
    if (expectedChecksum) {
      this._log('Verifying checksum...');
      var fileBuffer = fs.readFileSync(newExePath);
      var actualChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      if (actualChecksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
        this._log('Checksum mismatch! Expected: ' + expectedChecksum + ', Got: ' + actualChecksum);
        this._log('Aborting update for security.');
        try { fs.unlinkSync(newExePath); } catch (_) {}
        this._updating = false;
        return;
      }
      this._log('Checksum verified.');
    }

    // Determine if running as a service (NSSM) or standalone
    var isService = false;
    try {
      var scQuery = require('child_process').execSync('sc query ResolvAgent 2>nul', { encoding: 'utf8', timeout: 5000 });
      isService = scQuery.indexOf('RUNNING') !== -1 || scQuery.indexOf('STOPPED') !== -1;
    } catch (_) {}

    // Create helper batch script
    var helperScript;
    if (isService) {
      // Service mode: rename running binary → copy new binary → exit.
      // Windows allows renaming a running executable. After rename, the
      // original path is free — we copy the new binary in its place.
      // NSSM restarts immediately (AppThrottle=0) from the NEW binary.
      // No helper script, no job object issues, no SIGINT races.
      this._log('Replacing binary (rename + copy)...');
      var oldExePath = currentExe + '.old';
      try {
        fs.renameSync(currentExe, oldExePath);
        fs.copyFileSync(newExePath, currentExe);
      } catch (err) {
        this._log('Binary replacement failed: ' + err.message);
        try { if (fs.existsSync(oldExePath)) fs.renameSync(oldExePath, currentExe); } catch (_) {}
        try { fs.unlinkSync(newExePath); } catch (_) {}
        this._updating = false;
        return;
      }
      // Cleanup old + temp binaries
      try { fs.unlinkSync(oldExePath); } catch (_) {}
      try { fs.unlinkSync(newExePath); } catch (_) {}
      this._log('Binary replaced. Restarting...');
      this._clearIntervals();
      if (this._socket) { this._socket.disconnect(); this._socket = null; }
      process.exit(0);
    } else {
      // Standalone mode: wait for exit → swap exe → relaunch
      helperScript = [
        '@echo off',
        'echo Update helper started > "%TEMP%\\resolv-update.log" 2>&1',
        'echo Waiting for agent to exit... >> "%TEMP%\\resolv-update.log" 2>&1',
        'timeout /t 5 /nobreak >nul',
        '',
        'echo Replacing binary... >> "%TEMP%\\resolv-update.log" 2>&1',
        'copy /y "' + newExePath + '" "' + currentExe + '" >> "%TEMP%\\resolv-update.log" 2>&1',
        'if errorlevel 1 (',
        '  echo FAILED to replace binary >> "%TEMP%\\resolv-update.log" 2>&1',
        '  exit /b 1',
        ')',
        '',
        'echo Relaunching agent... >> "%TEMP%\\resolv-update.log" 2>&1',
        'start "" "' + currentExe + '"',
        '',
        'echo Update complete. Version ' + newVersion + ' >> "%TEMP%\\resolv-update.log" 2>&1',
        'timeout /t 3 /nobreak >nul',
        '',
        'del "' + newExePath + '" 2>nul',
        'del "%~f0" 2>nul',
      ].join('\r\n');
    }

    // Write helper script
    fs.writeFileSync(helperPath, helperScript, 'utf8');

    // Launch helper script fully detached (orphan process, no stdio inheritance)
    this._log('Launching update helper...');
    var spawn = require('child_process').spawn;
    spawn('cmd.exe', ['/c', helperPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();

    // The helper calls 'net stop ResolvAgent' which sends SIGINT.
    // The SIGINT handler shuts down cleanly and calls process.exit(0).
    // NSSM treats this as a proper service stop (not a crash) — it does NOT
    // restart. The helper (AppNoJob=1 means no job, so detached:true works)
    // survives and copies the binary while the file is unlocked.
    this._log('Agent will restart now for update...');
  }

  /**
   * Download a file from URL to local path.
   * @param {string} fileUrl
   * @param {string} destPath
   * @returns {Promise<boolean>}
   * @private
   */
  _downloadToFile(fileUrl, destPath) {
    return new Promise(function (resolve) {
      try {
        var parsed = require('url').parse(fileUrl);
        var mod = parsed.protocol === 'https:' ? require('https') : require('http');
        var fs = require('fs');
        var file = fs.createWriteStream(destPath);

        mod.get(fileUrl, function (response) {
          // Handle redirects
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            file.close();
            try { require('fs').unlinkSync(destPath); } catch (_) {}
            resolve(this._downloadToFile(response.headers.location, destPath));
            return;
          }

          if (response.statusCode !== 200) {
            file.close();
            try { require('fs').unlinkSync(destPath); } catch (_) {}
            return resolve(false);
          }

          response.pipe(file);
          file.on('finish', function () {
            file.close();
            resolve(true);
          });
        }.bind(this)).on('error', function (err) {
          this._log('Download error: ' + err.message);
          file.close();
          try { require('fs').unlinkSync(destPath); } catch (_) {}
          resolve(false);
        }.bind(this));
      } catch (err) {
        this._log('Download setup error: ' + err.message);
        resolve(false);
      }
    }.bind(this));
  }

  // ── Internal: Status callback ──────────────────────────────────────

  /**
   * Fire the onStatusChange callback if one was provided.
   * @private
   */
  _triggerStatusChange() {
    try {
      this._onStatusChange({
        isOnline: this._isOnline,
        lastCheckin: this._lastCheckin,
        assetId: this._assetId,
        hasToken: !!this._agentToken,
      });
    } catch (_) { /* callback must not crash the lifecycle */ }
  }

  /**
   * Clean up stale .old files from the agent directory and stale temp files
   * from previous incomplete updates.
   * Runs on lifecycle start for defense-in-depth.
   * @private
   */
  _cleanupStaleFiles() {
    try {
      var fs = require('fs');
      var path = require('path');
      var os = require('os');

      // Clean .old files in the agent directory (same dir as the exe)
      var agentDir = path.dirname(process.execPath);
      if (agentDir && fs.existsSync(agentDir)) {
        var entries = fs.readdirSync(agentDir);
        entries.forEach(function (f) {
          if (f.endsWith('.old')) {
            try { fs.unlinkSync(path.join(agentDir, f)); } catch (_) {}
          }
        });
      }

      // Clean stale temp files from previous update attempts
      var tempDir = os.tmpdir();
      if (tempDir && fs.existsSync(tempDir)) {
        var tempEntries = fs.readdirSync(tempDir);
        tempEntries.forEach(function (f) {
          if (f.startsWith('resolv-agent-update-')) {
            try { fs.unlinkSync(path.join(tempDir, f)); } catch (_) {}
          }
        });
      }
    } catch (_) { /* best-effort cleanup */ }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  AgentLifecycle: AgentLifecycle,
};
