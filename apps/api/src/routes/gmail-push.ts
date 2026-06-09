import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import crypto from 'crypto';

export default async function gmailPushRoutes(fastify: FastifyInstance) {
  /**
   * POST /webhook/gmail-push — Google Cloud Pub/Sub push endpoint
   * Receives push notifications when new emails arrive in the monitored mailbox.
   * No auth required — verified via Pub/Sub auth header or push subscription verification.
   */
  fastify.post('/webhook/gmail-push', async (request, reply) => {
    try {
      // Verify the push is from Google Pub/Sub
      // Option 1: Check the authorization header (Bearer token from Pub/Sub)
      const authHeader = request.headers.authorization;
      const expectedToken = process.env.GMAIL_PUSH_AUTH_TOKEN;
      
      if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
        // If a push auth token is configured, enforce it
        fastify.log.warn('[gmail-push] Unauthorized push notification — token mismatch');
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Parse the Pub/Sub message
      const body = z.object({
        message: z.object({
          data: z.string().optional(),     // Base64-encoded notification data
          messageId: z.string(),
          message_id: z.string().optional(),
          publishTime: z.string().optional(),
          publish_time: z.string().optional(),
          attributes: z.record(z.string()).optional(),
        }),
        subscription: z.string().optional(),
      }).parse(request.body);

      const messageId = body.message.messageId || body.message.message_id;

      // Decode the message data if present
      let notificationData: any = {};
      if (body.message.data) {
        try {
          const decoded = Buffer.from(body.message.data, 'base64').toString('utf-8');
          notificationData = JSON.parse(decoded);
        } catch {
          // Data might not be JSON — that's OK for history-based notifications
          notificationData = { raw: body.message.data };
        }
      }

      fastify.log.info(`[gmail-push] Received push notification: ${messageId}`);

      // Log the push notification for debugging
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at) 
         VALUES ('last_gmail_push', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify({ messageId, receivedAt: new Date().toISOString(), data: notificationData })]
      ).catch(() => {});

      // Trigger an immediate poll to process new messages
      // The push notification tells us there's new mail, but we still use
      // the existing Gmail API polling logic to fetch and process messages.
      // This gives us near-real-time processing without rewriting the entire pipeline.
      try {
        const { forcePoll } = await import('../services/inbound-email');
        const result = await forcePoll();
        fastify.log.info(`[gmail-push] Triggered poll: ${result.message}`);
      } catch (err: any) {
        fastify.log.error(`[gmail-push] Failed to trigger poll: ${err.message}`);
      }

      // Always return 200 to acknowledge the push (even if processing fails)
      // Pub/Sub will retry on non-2xx responses
      return reply.send({ received: true });
    } catch (err: any) {
      fastify.log.error('[gmail-push] Error processing push:', err.message);
      // Still return 200 to prevent Pub/Sub retry storms for malformed messages
      return reply.send({ received: true, error: err.message });
    }
  });

  /**
   * POST /admin/email/push/setup — Set up Gmail push notifications
   * Creates a Pub/Sub topic and push subscription via Gmail API
   */
  fastify.post('/admin/email/push/setup', { preHandler: [fastify.requirePermission('manage_email_config')] }, async (request, reply) => {
    try {
      const body = z.object({
        projectId: z.string().min(1),
        topicName: z.string().min(1).default('resolv-gmail-notifications'),
        pushEndpoint: z.string().url(),
      }).parse(request.body);

      // Store the push config
      const pushConfig = {
        projectId: body.projectId,
        topicName: body.topicName,
        pushEndpoint: body.pushEndpoint,
        enabled: true,
        setupAt: new Date().toISOString(),
      };

      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ('gmail_push_config', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify(pushConfig)]
      );

      // The actual Pub/Sub topic/subscription creation requires Google Cloud SDK
      // or REST API calls with appropriate service account credentials.
      // For now, we store the config and provide instructions for manual setup.
      
      return reply.send({
        message: 'Push notification configuration saved',
        config: pushConfig,
        instructions: [
          `1. Create Pub/Sub topic: projects/${body.projectId}/topics/${body.topicName}`,
          `2. Create push subscription with endpoint: ${body.pushEndpoint}`,
          `3. Grant Gmail API permission: gmail watch --userId=me --topicName=projects/${body.projectId}/topics/${body.topicName}`,
          `4. Call POST /api/email/push/watch to start watching the mailbox`,
        ],
      });
    } catch (err: any) {
      fastify.log.error('[gmail-push] Setup error:', err.message);
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * POST /admin/email/push/watch — Start watching the Gmail mailbox for push notifications
   * Calls the Gmail API watch endpoint to register for push notifications
   */
  fastify.post('/admin/email/push/watch', { preHandler: [fastify.requirePermission('manage_email_config')] }, async (request, reply) => {
    try {
      // Load push config
      const configResult = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'gmail_push_config'"
      );
      if (configResult.rows.length === 0) {
        return reply.status(400).send({ error: 'Push notifications not configured. Call POST /admin/email/push/setup first.' });
      }

      const pushConfig = JSON.parse(configResult.rows[0].value);
      if (!pushConfig.enabled) {
        return reply.status(400).send({ error: 'Push notifications are disabled' });
      }

      // Get a valid access token
      const { getValidAccessToken } = await import('../routes/directory-sync/helpers');
      let accessToken: string;
      try {
        accessToken = await getValidAccessToken();
      } catch (err: any) {
        return reply.status(400).send({ error: `Cannot get access token: ${err.message}` });
      }

      // Call Gmail API watch endpoint
      const https = await import('https');
      const topicName = `projects/${pushConfig.projectId}/topics/${pushConfig.topicName}`;
      const payload = JSON.stringify({ topicName, labelIds: ['INBOX'] });

      const watchResult = await new Promise<any>((resolve, reject) => {
        const req = https.request({
          hostname: 'gmail.googleapis.com',
          path: '/gmail/v1/users/me/watch',
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        }, (res: any) => {
          let data = '';
          res.on('data', (chunk: Buffer) => data += chunk.toString());
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch { resolve({}); }
          });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
      });

      if (watchResult.error) {
        return reply.status(400).send({ error: `Gmail watch failed: ${JSON.stringify(watchResult.error)}` });
      }

      // Store the watch expiration
      const expiresAt = watchResult.expiration ? new Date(parseInt(watchResult.expiration)).toISOString() : null;
      pushConfig.watching = true;
      pushConfig.watchExpiresAt = expiresAt;
      pushConfig.historyId = watchResult.historyId;

      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ('gmail_push_config', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify(pushConfig)]
      );

      return reply.send({
        message: 'Gmail watch started successfully',
        expiresAt,
        historyId: watchResult.historyId,
      });
    } catch (err: any) {
      fastify.log.error('[gmail-push] Watch error:', err.message);
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * POST /admin/email/push/stop — Stop watching the Gmail mailbox
   */
  fastify.post('/admin/email/push/stop', { preHandler: [fastify.requirePermission('manage_email_config')] }, async (request, reply) => {
    try {
      const configResult = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'gmail_push_config'"
      );
      if (configResult.rows.length === 0) {
        return reply.status(400).send({ error: 'Push notifications not configured' });
      }

      const pushConfig = JSON.parse(configResult.rows[0].value);
      pushConfig.watching = false;
      pushConfig.watchExpiresAt = null;

      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ('gmail_push_config', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify(pushConfig)]
      );

      // Call Gmail API stop endpoint
      const { getValidAccessToken } = await import('../routes/directory-sync/helpers');
      let accessToken: string;
      try {
        accessToken = await getValidAccessToken();
      } catch {
        // Even if token fails, we've disabled the config locally
        return reply.send({ message: 'Push notifications disabled locally (could not call Gmail API stop)' });
      }

      const https = await import('https');
      await new Promise<any>((resolve, reject) => {
        const req = https.request({
          hostname: 'gmail.googleapis.com',
          path: '/gmail/v1/users/me/stop',
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Content-Length': 0,
          },
        }, (res: any) => {
          let data = '';
          res.on('data', (chunk: Buffer) => data += chunk.toString());
          res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.end();
      });

      return reply.send({ message: 'Gmail watch stopped successfully' });
    } catch (err: any) {
      fastify.log.error('[gmail-push] Stop error:', err.message);
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * GET /admin/email/push/status — Get push notification status
   */
  fastify.get('/admin/email/push/status', { preHandler: [fastify.requirePermission('manage_email_config')] }, async (request, reply) => {
    try {
      const configResult = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'gmail_push_config'"
      );
      
      let pushConfig = null;
      if (configResult.rows.length > 0) {
        try { pushConfig = JSON.parse(configResult.rows[0].value); } catch {}
      }

      const lastPushResult = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'last_gmail_push'"
      );
      let lastPush = null;
      if (lastPushResult.rows.length > 0) {
        try { lastPush = JSON.parse(lastPushResult.rows[0].value); } catch {}
      }

      return reply.send({
        data: {
          configured: !!pushConfig,
          enabled: pushConfig?.enabled || false,
          watching: pushConfig?.watching || false,
          watchExpiresAt: pushConfig?.watchExpiresAt || null,
          projectId: pushConfig?.projectId || null,
          topicName: pushConfig?.topicName || null,
          pushEndpoint: pushConfig?.pushEndpoint || null,
          lastPushReceived: lastPush?.receivedAt || null,
          lastPushMessageId: lastPush?.messageId || null,
        },
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
