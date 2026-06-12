import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import { eventBus, BusPayload } from '../services/event-bus';

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const createWebhookSchema = z.object({
  name: z.string().min(3).max(255),
  url: z.string().url().max(2000),
  secret: z.string().max(2000).optional(),
  events: z.array(z.string()).min(1),
  is_active: z.boolean().default(true),
  retry_count: z.number().int().min(0).max(10).default(3),
  timeout_seconds: z.number().int().min(5).max(120).default(30),
});

const updateWebhookSchema = z.object({
  name: z.string().min(3).max(255).optional(),
  url: z.string().url().max(2000).optional(),
  secret: z.string().max(2000).optional().nullable(),
  events: z.array(z.string()).min(1).optional(),
  is_active: z.boolean().optional(),
  retry_count: z.number().int().min(0).max(10).optional(),
  timeout_seconds: z.number().int().min(5).max(120).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
});

const deliveryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
  status: z.enum(['pending', 'success', 'failed', 'retrying']).optional(),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

interface DeliveryResult {
  status: 'success' | 'failed';
  statusCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  durationMs: number;
}

async function deliverWebhook(
  webhook: { url: string; secret: string | null; timeout_seconds: number },
  payload: BusPayload
): Promise<DeliveryResult> {
  const start = Date.now();
  const body = JSON.stringify({
    event: payload.event,
    entityType: payload.entityType,
    entityId: payload.entityId,
    timestamp: payload.timestamp,
    data: payload.data,
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      (webhook.timeout_seconds || 30) * 1000
    );

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Resolv-Webhook/1.0',
    };
    if (webhook.secret) {
      headers['X-Webhook-Secret'] = webhook.secret;
    }

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseBody = await response.text();
    return {
      status: response.ok ? 'success' : 'failed',
      statusCode: response.status,
      responseBody,
      errorMessage: response.ok ? null : `HTTP ${response.status}`,
      durationMs: Date.now() - start,
    };
  } catch (error: any) {
    return {
      status: 'failed',
      statusCode: null,
      responseBody: null,
      errorMessage: error.name === 'AbortError' ? 'Request timed out' : (error.message || 'Unknown error'),
      durationMs: Date.now() - start,
    };
  }
}

async function attemptRetry(
  webhook: any,
  deliveryId: string,
  payload: BusPayload,
  retriesLeft: number
): Promise<void> {
  const maxRetries = webhook.retry_count || 3;
  const attemptNumber = maxRetries - retriesLeft + 1;

  // Exponential backoff: 10s * 2^(attemptNumber - 1)
  const delay = 10000 * Math.pow(2, attemptNumber - 1);
  await new Promise(resolve => setTimeout(resolve, delay));

  const result = await deliverWebhook(webhook, payload);

  if (result.status === 'success' || retriesLeft <= 0) {
    const finalStatus = result.status === 'success' ? 'success' : 'failed';
    await pool.query(
      `UPDATE webhook_deliveries
         SET status = $1, status_code = $2, response_body = $3,
             error_message = $4, attempt_count = $5, duration_ms = $6
       WHERE id = $7`,
      [
        finalStatus,
        result.statusCode,
        result.responseBody,
        result.errorMessage,
        attemptNumber,
        result.durationMs,
        deliveryId,
      ]
    );
  } else {
    await pool.query(
      `UPDATE webhook_deliveries
         SET status = 'retrying', status_code = $1, response_body = $2,
             error_message = $3, attempt_count = $4, duration_ms = $5
       WHERE id = $6`,
      [
        result.statusCode,
        result.responseBody,
        result.errorMessage,
        attemptNumber,
        result.durationMs,
        deliveryId,
      ]
    );
    await attemptRetry(webhook, deliveryId, payload, retriesLeft - 1);
  }
}

async function processWebhookDelivery(webhook: any, payload: BusPayload): Promise<void> {
  // Create delivery record
  const deliveryResult = await pool.query(
    `INSERT INTO webhook_deliveries (webhook_id, event, payload, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING *`,
    [webhook.id, payload.event, JSON.stringify(payload)]
  );

  const deliveryId = deliveryResult.rows[0].id;

  const result = await deliverWebhook(webhook, payload);

  if (result.status === 'success') {
    await pool.query(
      `UPDATE webhook_deliveries
         SET status = 'success', status_code = $1, response_body = $2,
             attempt_count = 1, duration_ms = $3
       WHERE id = $4`,
      [result.statusCode, result.responseBody, result.durationMs, deliveryId]
    );
  } else {
    await pool.query(
      `UPDATE webhook_deliveries
         SET status = 'retrying', status_code = $1, error_message = $2,
             attempt_count = 1, duration_ms = $3
       WHERE id = $4`,
      [result.statusCode, result.errorMessage, result.durationMs, deliveryId]
    );

    if ((webhook.retry_count || 3) > 0) {
      await attemptRetry(webhook, deliveryId, payload, (webhook.retry_count || 3) - 1);
    } else {
      await pool.query(
        `UPDATE webhook_deliveries
           SET status = 'failed', error_message = $1
         WHERE id = $2`,
        [result.errorMessage, deliveryId]
      );
    }
  }
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export default async function webhookRoutes(fastify: FastifyInstance) {

  // ───────────────────────────────────────────────────────────────────────────
  //  GET /webhooks — list webhook configs with pagination
  // ───────────────────────────────────────────────────────────────────────────
  fastify.get('/webhooks', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const offset = (query.page - 1) * query.pageSize;

    const countResult = await pool.query('SELECT COUNT(*) FROM webhook_configs');
    const result = await pool.query(
      `SELECT * FROM webhook_configs
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [query.pageSize, offset]
    );

    return reply.send({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: query.page,
      pageSize: query.pageSize,
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  //  POST /webhooks — create webhook config
  // ───────────────────────────────────────────────────────────────────────────
  fastify.post('/webhooks', {
    preHandler: [fastify.authenticate, fastify.requirePermission('manage_webhooks')],
  }, async (request, reply) => {
    const body = createWebhookSchema.parse(request.body);

    const result = await pool.query(
      `INSERT INTO webhook_configs (name, url, secret, events, is_active, retry_count, timeout_seconds, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        body.name,
        body.url,
        body.secret || null,
        body.events,
        body.is_active,
        body.retry_count,
        body.timeout_seconds,
        request.user.id,
      ]
    );

    return reply.status(201).send({ data: result.rows[0] });
  });

  // ───────────────────────────────────────────────────────────────────────────
  //  GET /webhooks/deliveries/:deliveryId — single delivery detail
  // ───────────────────────────────────────────────────────────────────────────
  fastify.get('/webhooks/deliveries/:deliveryId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { deliveryId } = request.params as { deliveryId: string };

    const result = await pool.query(
      `SELECT wd.*, wc.name as webhook_name, wc.url as webhook_url
       FROM webhook_deliveries wd
       JOIN webhook_configs wc ON wd.webhook_id = wc.id
       WHERE wd.id = $1`,
      [deliveryId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Delivery not found' });
    }

    return reply.send({ data: result.rows[0] });
  });

  // ───────────────────────────────────────────────────────────────────────────
  //  POST /webhooks/deliveries/:deliveryId/retry — retry a failed delivery
  // ───────────────────────────────────────────────────────────────────────────
  fastify.post('/webhooks/deliveries/:deliveryId/retry', {
    preHandler: [fastify.authenticate, fastify.requirePermission('manage_webhooks')],
  }, async (request, reply) => {
    const { deliveryId } = request.params as { deliveryId: string };

    // Fetch the original delivery with its webhook config
    const deliveryResult = await pool.query(
      `SELECT wd.*, wc.url, wc.secret, wc.timeout_seconds, wc.retry_count
       FROM webhook_deliveries wd
       JOIN webhook_configs wc ON wd.webhook_id = wc.id
       WHERE wd.id = $1`,
      [deliveryId]
    );

    if (deliveryResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Delivery not found' });
    }

    const row = deliveryResult.rows[0];
    const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;

    // Create a new delivery record for the retry
    const newDelivery = await pool.query(
      `INSERT INTO webhook_deliveries (webhook_id, event, payload, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [row.webhook_id, row.event, JSON.stringify(payload)]
    );

    const newDeliveryId = newDelivery.rows[0].id;

    // Fire and forget the actual HTTP call
    (async () => {
      try {
        const result = await deliverWebhook(row, payload);

        if (result.status === 'success') {
          await pool.query(
            `UPDATE webhook_deliveries
               SET status = 'success', status_code = $1, response_body = $2,
                   attempt_count = 1, duration_ms = $3
             WHERE id = $4`,
            [result.statusCode, result.responseBody, result.durationMs, newDeliveryId]
          );
        } else {
          await pool.query(
            `UPDATE webhook_deliveries
               SET status = 'retrying', status_code = $1, error_message = $2,
                   attempt_count = 1, duration_ms = $3
             WHERE id = $4`,
            [result.statusCode, result.errorMessage, result.durationMs, newDeliveryId]
          );

          if ((row.retry_count || 3) > 0) {
            await attemptRetry(row, newDeliveryId, payload, (row.retry_count || 3) - 1);
          } else {
            await pool.query(
              `UPDATE webhook_deliveries SET status = 'failed', error_message = $1 WHERE id = $2`,
              [result.errorMessage, newDeliveryId]
            );
          }
        }
      } catch (err: any) {
        await pool.query(
          `UPDATE webhook_deliveries SET status = 'failed', error_message = $1 WHERE id = $2`,
          [err.message, newDeliveryId]
        );
      }
    })().catch(err => {
      fastify.log.error('[webhooks] Retry handler error:', err.message);
    });

    return reply.send({ data: newDelivery.rows[0] });
  });

  // ───────────────────────────────────────────────────────────────────────────
  //  GET /webhooks/:id — single webhook config
  // ───────────────────────────────────────────────────────────────────────────
  fastify.get('/webhooks/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await pool.query('SELECT * FROM webhook_configs WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Webhook not found' });
    }

    return reply.send({ data: result.rows[0] });
  });

  // ───────────────────────────────────────────────────────────────────────────
  //  PATCH /webhooks/:id — update webhook config
  // ───────────────────────────────────────────────────────────────────────────
  fastify.patch('/webhooks/:id', {
    preHandler: [fastify.authenticate, fastify.requirePermission('manage_webhooks')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateWebhookSchema.parse(request.body);

    // Check existence
    const existing = await pool.query('SELECT * FROM webhook_configs WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Webhook not found' });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (body.name !== undefined) { updates.push(`name = $${paramIdx++}`); params.push(body.name); }
    if (body.url !== undefined) { updates.push(`url = $${paramIdx++}`); params.push(body.url); }
    if (body.secret !== undefined) { updates.push(`secret = $${paramIdx++}`); params.push(body.secret); }
    if (body.events !== undefined) { updates.push(`events = $${paramIdx++}`); params.push(body.events); }
    if (body.is_active !== undefined) { updates.push(`is_active = $${paramIdx++}`); params.push(body.is_active); }
    if (body.retry_count !== undefined) { updates.push(`retry_count = $${paramIdx++}`); params.push(body.retry_count); }
    if (body.timeout_seconds !== undefined) { updates.push(`timeout_seconds = $${paramIdx++}`); params.push(body.timeout_seconds); }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      params.push(id);
      await pool.query(
        `UPDATE webhook_configs SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
        params
      );
    }

    const result = await pool.query('SELECT * FROM webhook_configs WHERE id = $1', [id]);
    return reply.send({ data: result.rows[0] });
  });

  // ───────────────────────────────────────────────────────────────────────────
  //  DELETE /webhooks/:id — delete webhook config (cascades to deliveries)
  // ───────────────────────────────────────────────────────────────────────────
  fastify.delete('/webhooks/:id', {
    preHandler: [fastify.authenticate, fastify.requirePermission('manage_webhooks')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await pool.query('DELETE FROM webhook_configs WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return reply.status(404).send({ error: 'Webhook not found' });
    }

    return reply.status(204).send();
  });

  // ───────────────────────────────────────────────────────────────────────────
  //  POST /webhooks/:id/test — send a test event to the webhook URL
  // ───────────────────────────────────────────────────────────────────────────
  fastify.post('/webhooks/:id/test', {
    preHandler: [fastify.authenticate, fastify.requirePermission('manage_webhooks')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const webhookResult = await pool.query('SELECT * FROM webhook_configs WHERE id = $1', [id]);
    if (webhookResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Webhook not found' });
    }

    const webhook = webhookResult.rows[0];

    const testPayload: BusPayload = {
      event: 'test' as any,
      entityType: 'webhook',
      entityId: id,
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from Resolv ITSM',
        timestamp: new Date().toISOString(),
      },
    };

    // Create a delivery record
    const deliveryResult = await pool.query(
      `INSERT INTO webhook_deliveries (webhook_id, event, payload, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [id, 'test', JSON.stringify(testPayload)]
    );

    const delivery = deliveryResult.rows[0];

    // Execute synchronously so we can return the result
    const result = await deliverWebhook(webhook, testPayload);

    if (result.status === 'success') {
      await pool.query(
        `UPDATE webhook_deliveries
           SET status = 'success', status_code = $1, response_body = $2,
               attempt_count = 1, duration_ms = $3
         WHERE id = $4`,
        [result.statusCode, result.responseBody, result.durationMs, delivery.id]
      );
    } else {
      await pool.query(
        `UPDATE webhook_deliveries
           SET status = 'failed', status_code = $1, response_body = $2,
               error_message = $3, attempt_count = 1, duration_ms = $4
         WHERE id = $5`,
        [result.statusCode, result.responseBody, result.errorMessage, result.durationMs, delivery.id]
      );
    }

    return reply.send({
      data: {
        id: delivery.id,
        status: result.status === 'success' ? 'success' : 'failed',
        status_code: result.statusCode,
        response_body: result.responseBody,
        error_message: result.errorMessage,
        duration_ms: result.durationMs,
      },
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  //  GET /webhooks/:id/deliveries — list deliveries for a webhook
  // ───────────────────────────────────────────────────────────────────────────
  fastify.get('/webhooks/:id/deliveries', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = deliveryQuerySchema.parse(request.query);
    const offset = (query.page - 1) * query.pageSize;

    // Build dynamic WHERE
    let whereClause = 'WHERE wd.webhook_id = $1';
    const params: any[] = [id];
    let paramIdx = 2;

    if (query.status) {
      whereClause += ` AND wd.status = $${paramIdx++}`;
      params.push(query.status);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM webhook_deliveries wd ${whereClause}`,
      params
    );

    params.push(query.pageSize, offset);
    const result = await pool.query(
      `SELECT wd.*
       FROM webhook_deliveries wd
       ${whereClause}
       ORDER BY wd.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    return reply.send({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: query.page,
      pageSize: query.pageSize,
    });
  });
}

// ─── Event Bus Listener ────────────────────────────────────────────────────

/**
 * Start the webhook dispatch engine.
 *
 * Subscribes to all event bus events, finds matching active webhook configs,
 * and delivers HTTP POST requests with retry logic.
 *
 * Call this during server startup from index.ts after the pool is ready.
 */
export function startWebhookListener(): void {
  eventBus.on('*', async (payload: BusPayload) => {
    try {
      const result = await pool.query(
        `SELECT * FROM webhook_configs
         WHERE is_active = true AND $1 = ANY(events)`,
        [payload.event]
      );

      for (const webhook of result.rows) {
        // Fire and forget each delivery so one failure doesn't block others
        processWebhookDelivery(webhook, payload).catch((err: any) => {
          console.error('[webhooks] Delivery error:', err.message);
        });
      }
    } catch (err: any) {
      console.error('[webhooks] Error querying webhook configs:', err.message);
    }
  });

  console.log('[webhooks] Event bus listener started');
}
