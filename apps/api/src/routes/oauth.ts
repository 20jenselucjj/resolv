import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import https from 'https';
import { URL } from 'url';
import { pool } from '../db/pool';

// In-memory store for OAuth states (state → { codeVerifier, createdAt, mode })
const oauthStates = new Map<string, { codeVerifier: string; createdAt: number; mode: 'sync' | 'login' | 'email_send'; provider: 'google' | 'microsoft' }>();

// Clean up expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, record] of oauthStates) {
    if (now - record.createdAt > 10 * 60 * 1000) {
      oauthStates.delete(state);
    }
  }
}, 5 * 60 * 1000);

/** Generate a code verifier (43‑char random string) */
function generateCodeVerifier(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const bytes = crypto.randomBytes(43);
  for (let i = 0; i < 43; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/** Base64url-encoded SHA-256 digest */
function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64url');
}

/** Helper: perform an HTTPS POST and return parsed JSON */
async function httpsPost(url: string, body: Record<string, string>): Promise<any> {
  const parsed = new URL(url);
  const params = new URLSearchParams(body).toString();

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(params),
        },
      },
      (res: any) => {
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk.toString()));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(params);
    req.end();
  });
}

/** Helper: perform an HTTPS GET and return parsed JSON */
async function httpsGet(url: string, token: string): Promise<any> {
  const parsed = new URL(url);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
      (res: any) => {
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk.toString()));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

/** Helper: perform an HTTPS POST with JSON body and return parsed JSON */
async function httpsPostJson(url: string, token: string, body: any): Promise<any> {
  const parsed = new URL(url);
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res: any) => {
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk.toString()));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({});
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ─── Store & retrieve OAuth tokens ───────────────────────────────────────────

async function storeTokens(accessToken: string, refreshToken: string, expiryDate: string) {
  const payload = JSON.stringify({ access_token: accessToken, refresh_token: refreshToken, expiry_date: expiryDate });
  await pool.query(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES ('directory_sync_tokens', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
    [payload]
  );
}

async function getStoredTokens(): Promise<{ accessToken: string; refreshToken: string; expiryDate: string } | null> {
  const result = await pool.query(
    "SELECT value FROM system_settings WHERE key = 'directory_sync_tokens'"
  );
  if (result.rows.length === 0) return null;
  try {
    const parsed = JSON.parse(result.rows[0].value);
    return {
      accessToken: parsed.access_token,
      refreshToken: parsed.refresh_token,
      expiryDate: parsed.expiry_date,
    };
  } catch {
    return null;
  }
}

async function clearTokens() {
  await pool.query(
    "DELETE FROM system_settings WHERE key = 'directory_sync_tokens'"
  );
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export default async function oauthRoutes(fastify: FastifyInstance) {
  // GET /oauth/google/authorize
  fastify.get('/oauth/google/authorize', async (request, reply) => {
    try {
      // 1. Fetch OAuth config from DB
      const configResult = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'directory_sync_config'"
      );

      if (configResult.rows.length === 0) {
        return reply.status(400).send({ error: 'Directory sync not configured. Please configure it first.' });
      }

      let config: any;
      try {
        config = JSON.parse(configResult.rows[0].value);
      } catch {
        return reply.status(400).send({ error: 'Invalid directory sync configuration.' });
      }

      const clientId = config.clientId;
      const redirectUri = `${request.protocol}://${request.hostname}/api/oauth/google/callback`;
      // In development, respect the host header
      const host = request.headers.host || request.hostname;
      const protocol = request.protocol;
      const finalRedirectUri = `${protocol}://${host}/api/oauth/google/callback`;

      if (!clientId) {
        return reply.status(400).send({ error: 'Google OAuth client_id is not configured.' });
      }

      // 2. Generate PKCE values
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);
      const state = crypto.randomBytes(32).toString('hex');

      // 3. Store state + verifier
      oauthStates.set(state, { codeVerifier, createdAt: Date.now(), mode: 'sync', provider: 'google' });

      // 4. Build Google OAuth URL
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: finalRedirectUri,
        response_type: 'code',
        scope: [
          'openid',
          'email',
          'profile',
          'https://www.googleapis.com/auth/admin.directory.user.readonly',
          'https://www.googleapis.com/auth/admin.directory.group.readonly',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.modify',
        ].join(' '),
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        access_type: 'offline',
        prompt: 'consent',
      });

      const authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      return reply.redirect(302, authorizeUrl);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to initiate OAuth flow.' });
    }
  });

  // GET /oauth/google/callback
  fastify.get('/oauth/google/callback', async (request, reply) => {
    try {
      const query = request.query as { code?: string; state?: string; error?: string };
      const frontendOrigin = process.env.WEB_URL || 'http://localhost:3000';

      // Handle OAuth error response
      if (query.error) {
        // If login mode, redirect to frontend with error
        const loginState = query.state ? oauthStates.get(query.state) : undefined;
        if (loginState?.mode === 'login') {
          oauthStates.delete(query.state!);
          return reply.redirect(302, `${frontendOrigin}/login?error=sso_denied`);
        }
        return reply.status(400).send({ error: `OAuth error: ${query.error}` });
      }

      if (!query.code || !query.state) {
        return reply.status(400).send({ error: 'Missing code or state parameter.' });
      }

      // Verify state
      const storedState = oauthStates.get(query.state);
      if (!storedState) {
        return reply.status(400).send({ error: 'Invalid or expired state parameter.' });
      }
      oauthStates.delete(query.state); // Consume state (single-use)

      // Fetch OAuth config for client_id and client_secret
      const configResult = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'directory_sync_config'"
      );
      if (configResult.rows.length === 0) {
        if (storedState.mode === 'login') {
          return reply.redirect(302, `${frontendOrigin}/login?error=sso_not_configured`);
        }
        return reply.status(400).send({ error: 'Directory sync not configured.' });
      }

      let config: any;
      try {
        config = JSON.parse(configResult.rows[0].value);
      } catch {
        if (storedState.mode === 'login') {
          return reply.redirect(302, `${frontendOrigin}/login?error=sso_config_error`);
        }
        return reply.status(400).send({ error: 'Invalid directory sync configuration.' });
      }

      const clientId = config.clientId;
      const clientSecret = config.clientSecret;
      if (!clientId || !clientSecret) {
        if (storedState.mode === 'login') {
          return reply.redirect(302, `${frontendOrigin}/login?error=sso_not_configured`);
        }
        return reply.status(400).send({ error: 'OAuth client credentials not configured.' });
      }

      const host = request.headers.host || request.hostname;
      const protocol = request.protocol;
      const redirectUri = `${protocol}://${host}/api/oauth/google/callback`;

      // Exchange code for tokens
      const tokenResponse = await httpsPost('https://oauth2.googleapis.com/token', {
        code: query.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: storedState.codeVerifier,
      });

      if (tokenResponse.error) {
        if (storedState.mode === 'login') {
          const googleError = tokenResponse.error;
          const googleDesc = tokenResponse.error_description || '';
          // Pass the actual Google error to the frontend for better diagnostics
          return reply.redirect(302, `${frontendOrigin}/login?error=sso_token_failed&error_detail=${encodeURIComponent(googleError + (googleDesc ? ': ' + googleDesc : ''))}`);
        }
        return reply.status(400).send({ error: `Token exchange failed: ${tokenResponse.error_description || tokenResponse.error}` });
      }

      // ─── Login mode: find/create user and issue JWT ─────────────────────
      if (storedState.mode === 'login') {
        const idToken = tokenResponse.id_token;
        if (!idToken) {
          return reply.redirect(302, `${frontendOrigin}/login?error=sso_no_id_token`);
        }

        // Decode JWT payload
        const payloadBase64 = idToken.split('.')[1];
        const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
        const profile = JSON.parse(payloadJson);

        const email = profile.email;
        const name = profile.name || profile.given_name || email?.split('@')[0] || 'User';

        if (!email) {
          return reply.redirect(302, `${frontendOrigin}/login?error=sso_no_email`);
        }

        // Find or create user
        const { rows: existing } = await pool.query(
          'SELECT id, email, name, role, avatar_url, is_active FROM users WHERE LOWER(email) = LOWER($1)',
          [email]
        );

        let user: any;
        if (existing.length > 0) {
          user = existing[0];
          if (!user.is_active) {
            return reply.redirect(302, `${frontendOrigin}/login?error=sso_account_disabled`);
          }
          await pool.query(
            'UPDATE users SET last_login_at = NOW(), name = $1 WHERE id = $2',
            [name, user.id]
          );
        } else {
          // Auto-register new user with SSO
          const { rows: newUser } = await pool.query(
            `INSERT INTO users (email, name, role, password_hash)
             VALUES ($1, $2, 'user', 'sso_only')
             RETURNING id, email, name, role, avatar_url`,
            [email, name]
          );
          user = newUser[0];
        }

        // Issue JWT
        const token = fastify.jwt.sign({
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
        });

        return reply.redirect(302, `${frontendOrigin}/login?token=${token}`);
      }

      // ─── Sync mode: store tokens and mark config as connected ───────────
      if (!tokenResponse.refresh_token) {
        return reply.status(400).send({ error: 'No refresh_token returned. Ensure access_type=offline and prompt=consent were used.' });
      }

      // Calculate expiry date
      const expiryDate = new Date(Date.now() + (tokenResponse.expires_in || 3600) * 1000).toISOString();

      // Store tokens
      await storeTokens(tokenResponse.access_token, tokenResponse.refresh_token, expiryDate);

      // Decode the ID token to get user info and domain
      let oauthEmail = '';
      let oauthDomain = '';
      if (tokenResponse.id_token) {
        try {
          const payloadBase64 = tokenResponse.id_token.split('.')[1];
          const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
          const profile = JSON.parse(payloadJson);
          oauthEmail = profile.email || '';
          oauthDomain = profile.hd || config.domain || '';
        } catch { /* ignore parse errors */ }
      }

      // Update directory_sync_config to mark as connected
      config.provider = 'google_workspace';
      config.oauthConnected = true;
      config.oauthProvider = 'Google Workspace';
      if (oauthEmail) config.oauthEmail = oauthEmail;
      if (oauthDomain) config.oauthDomain = oauthDomain;
      config.tokenExpiresAt = expiryDate;

      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ('directory_sync_config', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify(config)]
      );

      // Return success page — notify the opener tab so it auto-refreshes
      return reply.type('text/html').send(`<!DOCTYPE html>
<html><head><title>Connected</title></head>
<body style="font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#f5f5f5">
<div style="text-align:center;background:#fff;padding:40px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
<h1 style="color:#34a853">✅ Connected</h1>
<p>Your Google Workspace directory has been connected successfully.</p>
<p>You can close this window and return to the admin panel.</p>
</div>
<script>
if (window.opener) {
  window.opener.postMessage({ type: 'oauth-connected', provider: 'google_workspace' }, '*');
}
</script>
</body></html>`);
    } catch (err: any) {
      fastify.log.error(err);
      // In login mode, redirect to frontend with error
      const frontendOrigin = process.env.WEB_URL || 'http://localhost:3000';
      try {
        const query = request.query as { state?: string };
        if (query.state) {
          const stored = oauthStates.get(query.state);
          if (stored?.mode === 'login') {
            return reply.redirect(302, `${frontendOrigin}/login?error=sso_error`);
          }
        }
      } catch { /* ignore */ }
      return reply.status(500).send({ error: 'OAuth callback failed.' });
    }
  });

  // ─── Outbound Email OAuth ───────────────────────────────────────────────

  // GET /oauth/outbound/authorize?provider=google|microsoft
  fastify.get('/oauth/outbound/authorize', async (request, reply) => {
    try {
      const query = request.query as { provider?: string };
      const provider = (query.provider === 'microsoft' ? 'microsoft' : 'google');

      // Load the outbound OAuth config (client credentials)
      const configResult = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'smtp_oauth_config'"
      );

      if (configResult.rows.length === 0) {
        return reply.status(400).send({ error: 'Outbound email OAuth not configured. Set client credentials first.' });
      }

      let config: any;
      try {
        config = JSON.parse(configResult.rows[0].value);
      } catch {
        return reply.status(400).send({ error: 'Invalid OAuth configuration.' });
      }

      if (!config.clientId || !config.clientSecret) {
        return reply.status(400).send({ error: 'Client ID and Client Secret are required.' });
      }

      const host = request.headers.host || request.hostname;
      const protocol = request.protocol;
      const redirectUri = `${protocol}://${host}/api/oauth/outbound/callback`;

      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);
      const state = crypto.randomBytes(32).toString('hex');

      oauthStates.set(state, { codeVerifier, createdAt: Date.now(), mode: 'email_send', provider });

      if (provider === 'microsoft') {
        const tenant = config.tenant || 'common';
        const params = new URLSearchParams({
          client_id: config.clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'https://outlook.office365.com/SMTP.Send offline_access',
          state,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          access_type: 'offline',
          prompt: 'consent',
        });
        const authorizeUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
        return reply.redirect(302, authorizeUrl);
      } else {
        // Google
        const params = new URLSearchParams({
          client_id: config.clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'https://www.googleapis.com/auth/gmail.send',
          state,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          access_type: 'offline',
          prompt: 'consent',
        });
        const authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
        return reply.redirect(302, authorizeUrl);
      }
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to initiate email OAuth flow.' });
    }
  });

  // GET /oauth/outbound/callback
  fastify.get('/oauth/outbound/callback', async (request, reply) => {
    try {
      const query = request.query as { code?: string; state?: string; error?: string };
      const frontendOrigin = process.env.WEB_URL || 'http://localhost:3000';

      if (query.error) {
        return reply.redirect(302, `${frontendOrigin}/dashboard/admin?tab=settings&oauth_error=${encodeURIComponent(query.error)}`);
      }

      if (!query.code || !query.state) {
        return reply.status(400).send({ error: 'Missing code or state parameter.' });
      }

      const storedState = oauthStates.get(query.state);
      if (!storedState || storedState.mode !== 'email_send') {
        return reply.status(400).send({ error: 'Invalid or expired state parameter.' });
      }
      oauthStates.delete(query.state);

      const provider = storedState.provider;

      // Load OAuth config
      const configResult = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'smtp_oauth_config'"
      );
      if (configResult.rows.length === 0) {
        return reply.status(400).send({ error: 'OAuth config not found.' });
      }

      let config: any;
      try {
        config = JSON.parse(configResult.rows[0].value);
      } catch {
        return reply.status(400).send({ error: 'Invalid OAuth configuration.' });
      }

      const host = request.headers.host || request.hostname;
      const protocol = request.protocol;
      const redirectUri = `${protocol}://${host}/api/oauth/outbound/callback`;

      // Exchange code for tokens
      let tokenEndpoint: string;
      let tokenBody: Record<string, string>;

      if (provider === 'microsoft') {
        tokenEndpoint = `https://login.microsoftonline.com/${config.tenant || 'common'}/oauth2/v2.0/token`;
        tokenBody = {
          code: query.code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: storedState.codeVerifier,
        };
      } else {
        tokenEndpoint = 'https://oauth2.googleapis.com/token';
        tokenBody = {
          code: query.code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: storedState.codeVerifier,
        };
      }

      const tokenResponse = await httpsPost(tokenEndpoint, tokenBody);

      if (tokenResponse.error) {
        return reply.redirect(302, `${frontendOrigin}/dashboard/admin?tab=settings&oauth_error=${encodeURIComponent(tokenResponse.error_description || tokenResponse.error)}`);
      }

      if (!tokenResponse.refresh_token) {
        return reply.redirect(302, `${frontendOrigin}/dashboard/admin?tab=settings&oauth_error=no_refresh_token`);
      }

      const expiryDate = new Date(Date.now() + (tokenResponse.expires_in || 3600) * 1000).toISOString();

      // Store tokens
      const tokens = {
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        expiry_date: expiryDate,
      };
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ('smtp_oauth_tokens', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify(tokens)]
      );

      // Decode ID token or userinfo for email
      let oauthEmail = '';
      if (tokenResponse.id_token) {
        try {
          const payloadBase64 = tokenResponse.id_token.split('.')[1];
          const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
          const profile = JSON.parse(payloadJson);
          oauthEmail = profile.email || profile.upn || '';
        } catch { /* ignore */ }
      }

      // Update config
      config.connected = true;
      config.provider = provider;
      config.tokenExpiresAt = expiryDate;
      if (oauthEmail) config.email = oauthEmail;

      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ('smtp_oauth_config', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify(config)]
      );

      // Email address is already stored in smtp_oauth_config above.

      return reply.type('text/html').send(`<!DOCTYPE html>
<html><head><title>Email Connected</title></head>
<body style="font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#f5f5f5">
<div style="text-align:center;background:#fff;padding:40px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
<h1 style="color:#34a853">&#x2705; Email Connected</h1>
<p>${provider === 'microsoft' ? 'Microsoft 365' : 'Google Workspace'} email sending has been connected.</p>
${oauthEmail ? `<p style="color:#666">Connected as: <strong>${oauthEmail}</strong></p>` : ''}
<p>You can close this window and return to the admin panel.</p>
</div>
<script>
if (window.opener) {
  window.opener.postMessage({ type: 'email-oauth-connected', provider: '${provider}' }, '*');
}
</script>
</body></html>`);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Email OAuth callback failed.' });
    }
  });

  // POST /oauth/outbound/disconnect
  fastify.post('/oauth/outbound/disconnect', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    try {
      await pool.query("DELETE FROM system_settings WHERE key = 'smtp_oauth_tokens'");

      const configResult = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'smtp_oauth_config'"
      );
      if (configResult.rows.length > 0) {
        try {
          const config = JSON.parse(configResult.rows[0].value);
          config.connected = false;
          config.email = null;
          config.tokenExpiresAt = null;
          await pool.query(
            `INSERT INTO system_settings (key, value, updated_at)
             VALUES ('smtp_oauth_config', $1, NOW())
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
            [JSON.stringify(config)]
          );
        } catch { /* ignore */ }
      }

      const { invalidateTransporter } = await import('../services/outbound-email');
      invalidateTransporter();

      return reply.send({ message: 'Email OAuth disconnected successfully.' });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to disconnect email OAuth.' });
    }
  });

  // GET /admin/email/oauth-status — Check OAuth connection status for outbound email
  fastify.get('/admin/email/oauth-status', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    try {
      // Check smtp_oauth path (dedicated outbound email OAuth)
      const smtpConfigResult = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'smtp_oauth_config'"
      );
      const smtpTokenResult = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'smtp_oauth_tokens'"
      );

      // Check directory_sync path (fallback — same Google credentials, gmail.modify scope)
      const dsConfigResult = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'directory_sync_config'"
      );
      const dsTokenResult = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'directory_sync_tokens'"
      );

      let smtpConfig: any = null;
      if (smtpConfigResult.rows.length > 0) {
        try { smtpConfig = JSON.parse(smtpConfigResult.rows[0].value); } catch { /* ignore */ }
      }

      let dsConfig: any = null;
      if (dsConfigResult.rows.length > 0) {
        try { dsConfig = JSON.parse(dsConfigResult.rows[0].value); } catch { /* ignore */ }
      }

      const smtpHasTokens = smtpTokenResult.rows.length > 0;
      const dsHasTokens = dsTokenResult.rows.length > 0;
      const dsHasCredentials = !!(dsConfig?.clientId && dsConfig?.clientSecret);
      const smtpConfigured = !!(smtpConfig?.clientId && smtpConfig?.clientSecret);

      // Determine connection source: prefer dedicated smtp_oauth, fallback to directory_sync
      const hasDedicatedConnection = smtpConfig?.connected === true && smtpHasTokens;
      const hasDsFallback = dsHasCredentials && dsHasTokens;

      const isConnected = hasDedicatedConnection || hasDsFallback;
      const connectedVia = hasDedicatedConnection ? 'smtp_oauth' : hasDsFallback ? 'directory_sync' : null;
      const email = smtpConfig?.email || dsConfig?.email || null;
      const expiresAt = smtpConfig?.tokenExpiresAt || dsConfig?.tokenExpiresAt || null;
      const isExpired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : true;

      return reply.send({
        data: {
          connected: isConnected && !isExpired,
          connectedVia,
          provider: smtpConfig?.provider || dsConfig?.provider || null,
          email,
          expiresAt,
          configured: smtpConfigured || dsHasCredentials,
          dsCredentialsAvailable: dsHasCredentials,
        },
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to get OAuth status.' });
    }
  });
  fastify.post('/oauth/google/disconnect', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    try {
      await clearTokens();

      // Update config to mark as disconnected
      const configResult = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'directory_sync_config'"
      );
      if (configResult.rows.length > 0) {
        try {
          const config = JSON.parse(configResult.rows[0].value);
          config.oauthConnected = false;
          config.oauthProvider = null;
          await pool.query(
            `INSERT INTO system_settings (key, value, updated_at)
             VALUES ('directory_sync_config', $1, NOW())
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
            [JSON.stringify(config)]
          );
        } catch { /* ignore parse errors */ }
      }

      return reply.send({ message: 'OAuth disconnected successfully.' });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to disconnect OAuth.' });
    }
  });
}

// Export helpers for use by other routes
export { getStoredTokens, storeTokens, clearTokens, httpsPost, httpsGet, httpsPostJson, oauthStates };
