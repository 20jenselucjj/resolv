'use strict';

const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Executes commands received from the Resolv server.
 * 
 * Supports command types:
 *   - run_script: Execute a PowerShell or batch script
 *   - install_software: Download and install software
 *   - uninstall_software: Uninstall software by name
 *   - restart_service: Restart a Windows service
 *   - stop_service: Stop a Windows service
 *   - start_service: Start a Windows service
 *   - collect_logs: Collect and return Windows event logs
 *   - reboot: Reboot the machine
 *   - shutdown: Shutdown the machine
 *   - custom: Execute an arbitrary command
 */
class CommandExecutor {
  /**
   * @param {Object} options
   * @param {string} options.serverUrl     Server base URL
   * @param {Function} options.getAgentToken  Returns current agent token
   * @param {Function} options.getAssetId     Returns current asset ID
   * @param {Function} [options.log]          Logging function
   */
  constructor(options) {
    this._serverUrl = options.serverUrl;
    this._getAgentToken = options.getAgentToken;
    this._getAssetId = options.getAssetId;
    this._log = options.log || function(msg) { console.log('[Resolv Agent]', msg); };
    this._protocol = require('./protocol');
    this._executing = false;
  }

  /**
   * Poll for and execute pending commands.
   * Call this after each heartbeat or when woken by WebSocket.
   * @returns {Promise<void>}
   */
  async pollAndExecute() {
    if (this._executing) return; // Don't overlap executions
    
    var token = this._getAgentToken();
    if (!token) return;

    try {
      var res = await this._protocol.request(
        'POST', this._serverUrl,
        '/api/assets/agent/commands/poll',
        {}, token
      );

      if (res.status === 401) return; // Will be handled by lifecycle
      if (res.status !== 200) {
        this._log('Command poll returned status ' + res.status);
        return;
      }

      var data = res.body && (res.body.data || res.body);
      if (!data || !data.command) {
        this._log('Command poll: no pending commands');
        return;
      }

      var command = data.command;
      this._log('Executing command: ' + command.command_type + ' (id: ' + command.id + ')');
      
      this._executing = true;
      try {
        await this._executeCommand(command);
      } finally {
        this._executing = false;
      }
    } catch (err) {
      this._log('Command poll error: ' + err.message);
    }
  }

  /**
   * Execute a single command and report the result.
   * @param {Object} command  Command object from poll response
   * @returns {Promise<void>}
   * @private
   */
  async _executeCommand(command) {
    var token = this._getAgentToken();
    var commandId = command.id;
    var timeoutMs = (command.timeout_seconds || 60) * 1000;

    // Report in_progress
    await this._reportResult(commandId, token, {
      status: 'in_progress',
    });

    try {
      var result;
      switch (command.command_type) {
        case 'run_script':
          result = await this._runScript(command.payload, timeoutMs);
          break;
        case 'install_software':
          result = await this._installSoftware(command.payload, timeoutMs);
          break;
        case 'uninstall_software':
          result = await this._uninstallSoftware(command.payload, timeoutMs);
          break;
        case 'restart_service':
          result = await this._serviceAction(command.payload, 'restart', timeoutMs);
          break;
        case 'stop_service':
          result = await this._serviceAction(command.payload, 'stop', timeoutMs);
          break;
        case 'start_service':
          result = await this._serviceAction(command.payload, 'start', timeoutMs);
          break;
        case 'collect_logs':
          result = await this._collectLogs(command.payload, timeoutMs);
          break;
        case 'reboot':
          result = await this._reboot(command.payload, timeoutMs);
          break;
        case 'shutdown':
          result = await this._shutdown(command.payload, timeoutMs);
          break;
        case 'custom':
          result = await this._runCustom(command.payload, timeoutMs);
          break;
        default:
          result = { success: false, exit_code: 1, stderr: 'Unknown command type: ' + command.command_type };
      }

      // Report result
      await this._reportResult(commandId, token, {
        status: result.success ? 'completed' : 'failed',
        exit_code: result.exit_code || 0,
        stdout: result.stdout || null,
        stderr: result.stderr || null,
        result: result.result || null,
        error_message: result.success ? null : (result.stderr || 'Command failed'),
      });

      this._log('Command ' + commandId + ' ' + (result.success ? 'completed' : 'failed'));
    } catch (err) {
      this._log('Command ' + commandId + ' error: ' + err.message);
      await this._reportResult(commandId, token, {
        status: 'failed',
        error_message: err.message,
        exit_code: 1,
      });
    }
  }

  // ── Command Implementations ────────────────────────────────────────

  /**
   * Execute a PowerShell or batch script.
   * payload: { script: string, type: 'powershell'|'cmd'|'batch' }
   */
  _runScript(payload, timeoutMs) {
    var script = payload.script || '';
    var type = payload.type || 'powershell';
    
    var cmd;
    if (type === 'powershell') {
      cmd = 'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "' + script.replace(/"/g, '\\"') + '"';
    } else {
      cmd = script;
    }

    return this._execCommand(cmd, timeoutMs);
  }

  /**
   * Install software via PowerShell.
   * payload: { name: string, installer_url?: string, install_command?: string }
   */
  async _installSoftware(payload, timeoutMs) {
    if (payload.install_command) {
      return this._execCommand(payload.install_command, timeoutMs);
    }
    
    if (payload.installer_url) {
      // Detect extension from URL for correct file type
      var urlExt = (payload.installer_url.match(/\.(\w+)(?:\?|$)/) || [])[1] || 'exe';
      // .msi installers need msiexec, not direct execution
      var tempPath = path.join(os.tmpdir(), 'resolv-install-' + Date.now() + '.' + urlExt);
      var downloadResult = await this._downloadFile(payload.installer_url, tempPath);
      if (!downloadResult.success) return downloadResult;

      var installCmd;
      if (payload.install_command) {
        installCmd = payload.install_command;
      } else if (urlExt.toLowerCase() === 'msi') {
        installCmd = 'msiexec /i "' + tempPath + '" /quiet /norestart';
      } else {
        installCmd = '"' + tempPath + '" /S /quiet /norestart';
      }
      var result = await this._execCommand(installCmd, timeoutMs);
      
      // Cleanup
      try { fs.unlinkSync(tempPath); } catch (_) {}
      return result;
    }

    // Try winget as fallback
    if (payload.name) {
      return this._execCommand('winget install "' + payload.name + '" --accept-source-agreements --accept-package-agreements --silent', timeoutMs);
    }

    return { success: false, exit_code: 1, stderr: 'No install method specified' };
  }

  /**
   * Uninstall software by name.
   * payload: { name: string, uninstall_command?: string }
   */
  async _uninstallSoftware(payload, timeoutMs) {
    if (payload.uninstall_command) {
      return this._execCommand(payload.uninstall_command, timeoutMs);
    }

    if (payload.name) {
      // Find uninstall string + quiet flags from registry
      var ps = 'Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*, HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* ' +
        '| Where-Object { $_.DisplayName -like "*' + payload.name.replace(/"/g, '`"') + '*" } ' +
        '| Select-Object -First 1 UninstallString,QuietUninstallString';
      var findResult = await this._execCommand('powershell -NoProfile -Command "(' + ps + ' | ConvertTo-Json -Compress)"', 15000);

      if (findResult.success && findResult.stdout && findResult.stdout.trim()) {
        try {
          var regEntry = JSON.parse(findResult.stdout.trim());
          // Prefer QuietUninstallString if available (already has silent flags)
          var uninstallCmd = (regEntry.QuietUninstallString || regEntry.UninstallString || '').trim();
          if (!uninstallCmd) {
            return { success: false, exit_code: 1, stderr: 'No uninstall command found for: ' + payload.name };
          }
          // Only append quiet flags if there's no QuietUninstallString
          if (!regEntry.QuietUninstallString) {
            if (uninstallCmd.toLowerCase().indexOf('msiexec') === 0 || uninstallCmd.toLowerCase().indexOf('msiexec ') === 0) {
              // msiexec already uses its own format — append quiet if not present
              if (uninstallCmd.indexOf('/quiet') === -1 && uninstallCmd.indexOf('/qb') === -1) {
                uninstallCmd += ' /quiet /norestart';
              }
            } else if (uninstallCmd.indexOf('/S') === -1 && uninstallCmd.indexOf('/silent') === -1 && uninstallCmd.indexOf('/VERYSILENT') === -1) {
              uninstallCmd += ' /S /silent';
            }
          }
          return this._execCommand(uninstallCmd, timeoutMs);
        } catch (_) {
          return { success: false, exit_code: 1, stderr: 'Failed to parse uninstall data for: ' + payload.name };
        }
      }
      
      return { success: false, exit_code: 1, stderr: 'Software not found: ' + payload.name };
    }

    return { success: false, exit_code: 1, stderr: 'No uninstall method specified' };
  }

  /**
   * Start/stop/restart a Windows service.
   * payload: { service_name: string }
   */
  _serviceAction(payload, action, timeoutMs) {
    var serviceName = payload.service_name;
    if (!serviceName) {
      return Promise.resolve({ success: false, exit_code: 1, stderr: 'No service_name specified' });
    }
    return this._execCommand('net ' + action + ' "' + serviceName + '"', timeoutMs);
  }

  /**
   * Collect Windows event logs.
   * payload: { log_name?: string, level?: string, max_events?: number, hours_back?: number }
   */
  _collectLogs(payload, timeoutMs) {
    var logName = payload.log_name || 'System';
    var levelRaw = payload.level || 'Error,Warning';
    var maxEvents = payload.max_events || 50;
    var hoursBack = payload.hours_back || 24;

    // Convert level names to numeric values (Get-WinEvent FilterHashtable expects integers)
    var levelMap = { 'Critical': 1, 'Error': 2, 'Warning': 3, 'Information': 4, 'Verbose': 5 };
    var levelNums = levelRaw.split(',').map(function (s) {
      var trimmed = s.trim();
      return levelMap[trimmed] != null ? levelMap[trimmed] : parseInt(trimmed, 10);
    }).filter(function (n) { return !isNaN(n); });
    var levelArray = levelNums.length > 0 ? '@(' + levelNums.join(',') + ')' : '@(1,2,3,4,5)';

    // Build a single pipeline — no semicolons before pipes which causes "empty pipe element" errors
    var ps = '$startDate = (Get-Date).AddHours(-' + hoursBack + '); ' +
      'Get-WinEvent -FilterHashtable @{LogName="' + logName + '";Level=' + levelArray + ';StartTime=$startDate} -MaxEvents ' + maxEvents + ' -ErrorAction SilentlyContinue ' +
      '| Select-Object TimeCreated,Id,LevelDisplayName,ProviderName,Message ' +
      '| ConvertTo-Json -Compress';

    return this._execCommand('powershell -NoProfile -Command "' + ps.replace(/"/g, '\\"') + '"', timeoutMs);
  }

  /**
   * Reboot the machine.
   * payload: { delay_seconds?: number, message?: string }
   */
  _reboot(payload, timeoutMs) {
    var delay = payload.delay_seconds || 30;
    var msg = (payload.message || 'System reboot initiated by Resolv ITSM').replace(/"/g, '\\"');
    return this._execCommand('shutdown /r /t ' + delay + ' /c "' + msg + '"', 10000);
  }

  /**
   * Shutdown the machine.
   * payload: { delay_seconds?: number, message?: string }
   */
  _shutdown(payload, timeoutMs) {
    var delay = payload.delay_seconds || 30;
    var msg = (payload.message || 'System shutdown initiated by Resolv ITSM').replace(/"/g, '\\"');
    return this._execCommand('shutdown /s /t ' + delay + ' /c "' + msg + '"', 10000);
  }

  /**
   * Execute a custom command.
   * payload: { command: string, shell?: 'powershell'|'cmd' }
   */
  _runCustom(payload, timeoutMs) {
    var command = payload.command || '';
    var shell = payload.shell || 'cmd';
    
    if (shell === 'powershell') {
      return this._execCommand('powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "' + command.replace(/"/g, '\\"') + '"', timeoutMs);
    }
    return this._execCommand(command, timeoutMs);
  }

  // ── Helpers ────────────────────────────────────────────────────────

  /**
   * Execute a shell command with timeout.
   * @returns {Promise<{success: boolean, exit_code: number, stdout: string, stderr: string}>}
   * @private
   */
  _execCommand(cmd, timeoutMs) {
    return new Promise(function (resolve) {
      exec(cmd, {
        timeout: timeoutMs || 60000,
        maxBuffer: 10 * 1024 * 1024, // 10MB
        windowsHide: true,
        shell: 'cmd.exe',
      }, function (err, stdout, stderr) {
        resolve({
          success: !err,
          exit_code: err ? (err.code || 1) : 0,
          stdout: (stdout || '').toString().substring(0, 1024 * 100), // Cap at 100KB
          stderr: (stderr || '').toString().substring(0, 1024 * 100),
        });
      });
    });
  }

  /**
   * Download a file from a URL to a local path.
   * @private
   */
  _downloadFile(fileUrl, destPath) {
    var MAX_REDIRECTS = 5;
    var redirects = 0;

    function doDownload(url) {
      return new Promise(function (resolve) {
        try {
          var parsed = require('url').parse(url);
          var mod = parsed.protocol === 'https:' ? require('https') : require('http');
          var file = fs.createWriteStream(destPath);
          
          var opts = {
            hostname: parsed.hostname,
            port: parsed.port,
            path: parsed.path,
            method: 'GET',
            headers: { 'User-Agent': 'ResolvAgent/1.0' },
            rejectUnauthorized: false,
          };
          
          var req = mod.request(opts, function (response) {
            // Follow redirects
            if (response.statusCode >= 300 && response.statusCode < 400) {
              var location = response.headers.location;
              if (!location) {
                file.close();
                try { fs.unlinkSync(destPath); } catch (_) {}
                return resolve({ success: false, exit_code: 1, stderr: 'Redirect with no Location header' });
              }
              if (++redirects > MAX_REDIRECTS) {
                file.close();
                try { fs.unlinkSync(destPath); } catch (_) {}
                return resolve({ success: false, exit_code: 1, stderr: 'Too many redirects' });
              }
              // Resolve relative redirect URLs
              var resolved = location.indexOf('://') >= 0 ? location : require('url').resolve(url, location);
              file.close();
              return resolve(doDownload(resolved));
            }
            
            if (response.statusCode !== 200) {
              file.close();
              try { fs.unlinkSync(destPath); } catch (_) {}
              return resolve({ success: false, exit_code: 1, stderr: 'Download failed: HTTP ' + response.statusCode });
            }
            response.pipe(file);
            file.on('finish', function () {
              file.close();
              resolve({ success: true, exit_code: 0, stdout: 'Downloaded to ' + destPath, stderr: '' });
            });
          });
          req.on('error', function (err) {
            file.close();
            try { fs.unlinkSync(destPath); } catch (_) {}
            resolve({ success: false, exit_code: 1, stderr: 'Download error: ' + err.message });
          });
          req.end();
        } catch (err) {
          resolve({ success: false, exit_code: 1, stderr: 'Download error: ' + err.message });
        }
      });
    }
    return doDownload(fileUrl);
  }

  /**
   * Report command result to the server.
   * @private
   */
  async _reportResult(commandId, token, result) {
    try {
      var res = await this._protocol.request(
        'POST', this._serverUrl,
        '/api/assets/agent/commands/' + commandId + '/result',
        result, token
      );
      if (res.status !== 200 && res.status !== 201) {
        this._log('Report result returned status ' + res.status + ' — command may remain in dispatched state');
      }
    } catch (err) {
      this._log('Failed to report command result: ' + err.message);
    }
  }
}

module.exports = {
  CommandExecutor: CommandExecutor,
};
