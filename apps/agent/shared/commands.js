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
      // Download installer to temp, then execute
      var tempPath = path.join(os.tmpdir(), 'resolv-install-' + Date.now() + '.exe');
      var downloadResult = await this._downloadFile(payload.installer_url, tempPath);
      if (!downloadResult.success) return downloadResult;
      
      var installCmd = payload.install_command || ('"' + tempPath + '" /S /quiet /norestart');
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
      // Find uninstall string from registry
      var ps = 'Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*, HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Where-Object { $_.DisplayName -like "*' + payload.name.replace(/"/g, '`"') + '*" } | Select-Object -First 1 -ExpandProperty UninstallString';
      var findResult = await this._execCommand('powershell -NoProfile -Command "' + ps.replace(/"/g, '\\"') + '"', 15000);
      
      if (findResult.success && findResult.stdout && findResult.stdout.trim()) {
        var uninstallCmd = findResult.stdout.trim();
        if (uninstallCmd.toLowerCase().indexOf('msiexec') === 0) {
          uninstallCmd += ' /quiet /norestart';
        } else {
          uninstallCmd += ' /S /silent';
        }
        return this._execCommand(uninstallCmd, timeoutMs);
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
    var level = payload.level || 'Error,Warning';
    var maxEvents = payload.max_events || 50;
    var hoursBack = payload.hours_back || 24;

    var ps = [
      '$startDate = (Get-Date).AddHours(-' + hoursBack + ')',
      'Get-WinEvent -FilterHashtable @{LogName="' + logName + '";Level=' + level + ';StartTime=$startDate} -MaxEvents ' + maxEvents + ' -ErrorAction SilentlyContinue',
      '| Select-Object TimeCreated,Id,LevelDisplayName,ProviderName,Message',
      '| ConvertTo-Json -Compress'
    ].join('; ');

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
          success: !err || (err && err.killed === false && stdout),
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
    return new Promise(function (resolve) {
      try {
        var parsed = require('url').parse(fileUrl);
        var mod = parsed.protocol === 'https:' ? require('https') : require('http');
        var file = fs.createWriteStream(destPath);
        
        mod.get(fileUrl, function (response) {
          if (response.statusCode !== 200) {
            file.close();
            return resolve({ success: false, exit_code: 1, stderr: 'Download failed: HTTP ' + response.statusCode });
          }
          response.pipe(file);
          file.on('finish', function () {
            file.close();
            resolve({ success: true, exit_code: 0, stdout: 'Downloaded to ' + destPath, stderr: '' });
          });
        }).on('error', function (err) {
          file.close();
          try { fs.unlinkSync(destPath); } catch (_) {}
          resolve({ success: false, exit_code: 1, stderr: 'Download error: ' + err.message });
        });
      } catch (err) {
        resolve({ success: false, exit_code: 1, stderr: 'Download error: ' + err.message });
      }
    });
  }

  /**
   * Report command result to the server.
   * @private
   */
  async _reportResult(commandId, token, result) {
    try {
      await this._protocol.request(
        'POST', this._serverUrl,
        '/api/assets/agent/commands/' + commandId + '/result',
        result, token
      );
    } catch (err) {
      this._log('Failed to report command result: ' + err.message);
    }
  }
}

module.exports = {
  CommandExecutor: CommandExecutor,
};
