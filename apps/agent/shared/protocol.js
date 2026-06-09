'use strict';

/**
 * Resolv Agent — HTTP / API Protocol Layer
 *
 * Provides low-level HTTP request helpers (using Node.js native http/https
 * modules) and high-level API functions for agent registration, checkin,
 * heartbeat, and disconnect.
 *
 * Uses native http/https rather than fetch() because the agent is bundled
 * with pkg which does not support the fetch API in older Node.js targets.
 * DNS resolution prefers IPv4 addresses to avoid localhost → ::1 issues.
 */

const http = require('http');
const https = require('https');
const dns = require('dns');
const url = require('url');

// ---------------------------------------------------------------------------
// Internal: HTTP request with IPv4-preferring DNS resolution
// ---------------------------------------------------------------------------

/**
 * Make an HTTP(S) request with IPv4-preferring DNS resolution.
 *
 * Resolves the hostname to all addresses, sorts IPv4 before IPv6, and
 * attempts each address in order. This avoids the common problem where
 * Node.js resolves `localhost` to `::1` (IPv6) but the server only listens
 * on IPv4 (127.0.0.1).
 *
 * @param {string} method      HTTP method (GET, POST, etc.)
 * @param {string} serverUrl   Base server URL (e.g. http://localhost:3001)
 * @param {string} urlPath     URL path (e.g. /api/assets/agent/register)
 * @param {*}      [body]      Request body (object, serialised to JSON)
 * @param {string} [token]     Bearer token for Authorization header
 * @returns {Promise<{status: number, body: *}>}
 */
function request(method, serverUrl, urlPath, body, token) {
  return new Promise(function (resolve, reject) {
    var parsed = url.parse(serverUrl);
    var basePath = parsed.path || '';
    // Remove trailing slash from basePath to avoid double slashes
    if (basePath.endsWith('/') && basePath.length > 1) {
      basePath = basePath.slice(0, -1);
    }
    // If basePath is just '/', treat it as empty
    if (basePath === '/') {
      basePath = '';
    }
    var fullPath = basePath + urlPath;

    var isHttps = parsed.protocol === 'https:';
    var mod = isHttps ? https : http;
    var port = parsed.port || (isHttps ? 443 : 80);
    var hostname = parsed.hostname;

    var data = body ? JSON.stringify(body) : null;
    var headers = { 'Content-Type': 'application/json' };

    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    if (data) {
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    headers['Host'] = hostname;

    // Resolve DNS with IPv4 preference
    dns.lookup(hostname, { all: true }, function (err, addresses) {
      if (err) return reject(err);

      // Sort: IPv4 first, then IPv6
      var sorted = (addresses || []).slice().sort(function (a, b) {
        return a.family === 4 ? -1 : 1;
      });

      if (sorted.length === 0) {
        return reject(new Error('No DNS addresses found for ' + hostname));
      }

      function attempt(idx) {
        if (idx >= sorted.length) {
          return reject(
            new Error('All addresses failed for ' + hostname)
          );
        }

        var addr = sorted[idx];

        var opts = {
          hostname: addr.address,
          port: port,
          path: fullPath,
          method: method,
          headers: headers,
          timeout: 30000, // 30-second request timeout
        };

        var req = mod.request(opts, function (res) {
          var chunks = [];
          res.on('data', function (chunk) {
            chunks.push(chunk);
          });
          res.on('end', function () {
            var raw = Buffer.concat(chunks).toString('utf8');
            var result = { status: res.statusCode, body: raw };

            try {
              result.body = JSON.parse(raw);
            } catch (_) {
              // Leave as raw string if not JSON
            }

            resolve(result);
          });
        });

        req.on('error', function (err) {
          attempt(idx + 1); // Try next address (IPv6 fallback)
        });

        req.on('timeout', function () {
          req.destroy();
          attempt(idx + 1);
        });

        if (data) req.write(data);
        req.end();
      }

      attempt(0);
    });
  });
}

// ---------------------------------------------------------------------------
// API: Agent Registration
// ---------------------------------------------------------------------------

/**
 * Register this agent with the Resolv server.
 *
 * The registration body includes a `machine_fingerprint` for server-side
 * deduplication of physical machines.
 *
 * @param {string} serverUrl          Base server URL
 * @param {string} hostname           Local hostname
 * @param {string} agentVersion       Agent version string
 * @param {string} agentSecret        Shared secret for authentication
 * @param {string} machineFingerprint SHA-256 machine fingerprint
 * @returns {Promise<{asset_id: string, agent_token: string} | null>}
 */
async function register(serverUrl, hostname, agentVersion, agentSecret, machineFingerprint) {
  try {
    var res = await request(
      'POST',
      serverUrl,
      '/api/assets/agent/register',
      {
        hostname: hostname,
        agent_version: agentVersion,
        agent_secret: agentSecret,
        machine_fingerprint: machineFingerprint,
      }
    );

    if (res.status === 200 || res.status === 201) {
      var d = res.body && (res.body.data || res.body);
      if (d && d.asset_id && d.agent_token) {
        return { asset_id: d.asset_id, agent_token: d.agent_token };
      }
      console.error(
        '[Resolv Agent] Registration response missing asset_id or agent_token:',
        JSON.stringify(d)
      );
      return null;
    }

    console.error(
      '[Resolv Agent] Registration failed:',
      res.status,
      JSON.stringify(res.body)
    );
    return null;
  } catch (err) {
    console.error('[Resolv Agent] Registration error:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// API: Check-in (full system info report)
// ---------------------------------------------------------------------------

/**
 * Send a full system information check-in to the server.
 *
 * @param {string} serverUrl    Base server URL
 * @param {string} agentToken   Authentication token
 * @param {Object} systemInfo   SystemInfo object from collectSystemInfo()
 * @returns {Promise<boolean>}  True if check-in was accepted
 */
async function checkin(serverUrl, agentToken, systemInfo) {
  try {
    var body = {
      hostname: systemInfo.hostname,
      agent_version: systemInfo.agent_version,
      machine_fingerprint: systemInfo.machine_fingerprint,
      ip_address: systemInfo.ip_address,
      mac_address: systemInfo.mac_address,
      domain: systemInfo.domain,
      os: systemInfo.os,
      hardware: systemInfo.hardware,
      network_adapters: systemInfo.network_adapters,
      software: systemInfo.software,
      current_user: systemInfo.current_user,
      users: systemInfo.users,
      encryption: systemInfo.encryption,
      battery: systemInfo.battery,
      usb_devices: systemInfo.usb_devices,
      usb_changes: systemInfo.usb_changes,
    };

    var res = await request('POST', serverUrl, '/api/assets/agent/checkin', body, agentToken);

    if (res.status === 200 || res.status === 201) {
      return { ok: true, status: res.status };
    }

    console.warn(
      '[Resolv Agent] Check-in failed:',
      res.status,
      JSON.stringify(res.body)
    );
    return { ok: false, status: res.status };
  } catch (err) {
    console.error('[Resolv Agent] Check-in error:', err.message);
    return { ok: false, status: 0 };
  }
}

// ---------------------------------------------------------------------------
// API: Heartbeat
// ---------------------------------------------------------------------------

/**
 * Send a lightweight heartbeat to signal the agent is alive.
 *
 * @param {string} serverUrl   Base server URL
 * @param {string} agentToken  Authentication token
 * @returns {Promise<{ok: boolean, status?: number}>}
 */
async function heartbeat(serverUrl, agentToken) {
  try {
    var res = await request('POST', serverUrl, '/api/assets/agent/heartbeat', {}, agentToken);

    if (res.status === 200 || res.status === 201) {
      return { ok: true, status: res.status, body: res.body };
    }

    return { ok: false, status: res.status, body: res.body };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// API: Disconnect
// ---------------------------------------------------------------------------

/**
 * Notify the server that this agent is going offline.
 *
 * @param {string} serverUrl   Base server URL
 * @param {string} agentToken  Authentication token
 * @returns {Promise<boolean>}
 */
async function disconnect(serverUrl, agentToken) {
  try {
    var res = await request('POST', serverUrl, '/api/assets/agent/disconnect', {}, agentToken);
    return res.status === 200 || res.status === 201;
  } catch (err) {
    console.error('[Resolv Agent] Disconnect error:', err.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// API: Download binary update, wrote to disk
// ---------------------------------------------------------------------------

/**
 * Download the latest agent binary from the server to a local file.
 * Uses Bearer token auth. Streams to disk without buffering the full binary.
 *
 * @param {string} serverUrl    Base server URL
 * @param {string} agentToken   Agent authentication token
 * @param {string} destPath     Local file path to write the binary to
 * @returns {Promise<boolean>}  True if download succeeded
 */
function downloadBinary(serverUrl, agentToken, destPath) {
  return new Promise(function (resolve) {
    var parsed = url.parse(serverUrl);
    var fullPath = '/api/assets/agent/download/update';
    var isHttps = parsed.protocol === 'https:';
    var mod = isHttps ? https : http;
    var port = parsed.port || (isHttps ? 443 : 80);
    var hostname = parsed.hostname;

    var headers = {
      'Authorization': 'Bearer ' + agentToken,
      'Host': hostname,
    };

    dns.lookup(hostname, { all: true }, function (err, addresses) {
      if (err) return resolve(false);

      var sorted = (addresses || []).slice().sort(function (a, b) {
        return a.family === 4 ? -1 : 1;
      });

      if (sorted.length === 0) return resolve(false);

      function attempt(idx) {
        if (idx >= sorted.length) return resolve(false);

        var addr = sorted[idx];
        var opts = {
          hostname: addr.address,
          port: port,
          path: fullPath,
          method: 'GET',
          headers: headers,
          timeout: 120000, // 2 min for binary download
        };

        var req = mod.request(opts, function (res) {
          if (res.statusCode !== 200) {
            resolve(false);
            return;
          }

          var fs = require('fs');
          var file = fs.createWriteStream(destPath);

          res.pipe(file);

          file.on('finish', function () {
            file.close();
            resolve(true);
          });

          file.on('error', function () {
            file.close();
            try { fs.unlinkSync(destPath); } catch (_) {}
            resolve(false);
          });
        });

        req.on('error', function () {
          attempt(idx + 1);
        });

        req.on('timeout', function () {
          req.destroy();
          attempt(idx + 1);
        });

        req.end();
      }

      attempt(0);
    });
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  request: request,
  register: register,
  checkin: checkin,
  heartbeat: heartbeat,
  disconnect: disconnect,
  downloadBinary: downloadBinary,
};
