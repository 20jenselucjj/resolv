import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import { forceSchedulerCycle } from '../services/scheduled-notifications';
import { saveBusinessHoursConfig, updateDaySchedule, addHoliday, removeHoliday, getHolidays } from '../services/business-hours';

export default async function notificationConfigRoutes(fastify: FastifyInstance) {
  // ─── Notification Schedule Config ──────────────────────────────────────────

  // GET /admin/notification-schedule/config
  fastify.get('/admin/notification-schedule/config', { preHandler: [fastify.requireRole(['admin'])] }, async (_request, reply) => {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'notification_schedule_config'");
    const config = result.rows.length > 0 ? JSON.parse(result.rows[0].value) : {};
    return reply.send({ data: config });
  });

  // POST /admin/notification-schedule/config
  fastify.post('/admin/notification-schedule/config', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = z.object({
      enabled: z.boolean().optional(),
      check_interval_seconds: z.number().int().min(10).max(3600).optional(),
      due_date_reminder_hours: z.array(z.number().int().min(1).max(168)).optional(),
      sla_warning_thresholds: z.array(z.number().int().min(10).max(100)).optional(),
      unassigned_escalation_minutes: z.number().int().min(5).max(1440).optional(),
      survey_delay_hours: z.number().int().min(1).max(168).optional(),
    }).parse(request.body);

    // Merge with existing
    const existing = await pool.query("SELECT value FROM system_settings WHERE key = 'notification_schedule_config'");
    const current = existing.rows.length > 0 ? JSON.parse(existing.rows[0].value) : {};
    const merged = { ...current, ...body };

    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at) VALUES ('notification_schedule_config', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(merged)]
    );
    return reply.send({ data: merged });
  });

  // ─── Satisfaction Survey Config ────────────────────────────────────────────

  // GET /admin/satisfaction/config
  fastify.get('/admin/satisfaction/config', { preHandler: [fastify.requireRole(['admin'])] }, async (_request, reply) => {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'satisfaction_survey_config'");
    const config = result.rows.length > 0 ? JSON.parse(result.rows[0].value) : {};
    return reply.send({ data: config });
  });

  // POST /admin/satisfaction/config
  fastify.post('/admin/satisfaction/config', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = z.object({
      enabled: z.boolean().optional(),
      delay_hours: z.number().int().min(1).max(168).optional(),
      template_name: z.string().optional(),
      include_comment_field: z.boolean().optional(),
    }).parse(request.body);

    const existing = await pool.query("SELECT value FROM system_settings WHERE key = 'satisfaction_survey_config'");
    const current = existing.rows.length > 0 ? JSON.parse(existing.rows[0].value) : {};
    const merged = { ...current, ...body };

    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at) VALUES ('satisfaction_survey_config', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(merged)]
    );
    return reply.send({ data: merged });
  });

  // ─── Escalation Config ─────────────────────────────────────────────────────

  // GET /admin/escalation/config
  fastify.get('/admin/escalation/config', { preHandler: [fastify.requireRole(['admin'])] }, async (_request, reply) => {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'escalation_config'");
    const config = result.rows.length > 0 ? JSON.parse(result.rows[0].value) : {};
    return reply.send({ data: config });
  });

  // POST /admin/escalation/config
  fastify.post('/admin/escalation/config', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = z.object({
      enabled: z.boolean().optional(),
      unassigned: z.object({
        enabled: z.boolean().optional(),
        after_minutes: z.number().int().min(5).max(1440).optional(),
        notify_role: z.string().optional(),
      }).optional(),
      sla_breach: z.object({
        enabled: z.boolean().optional(),
        notify_assignee: z.boolean().optional(),
        notify_manager: z.boolean().optional(),
      }).optional(),
    }).parse(request.body);

    const existing = await pool.query("SELECT value FROM system_settings WHERE key = 'escalation_config'");
    const current = existing.rows.length > 0 ? JSON.parse(existing.rows[0].value) : {};
    const merged = { ...current, ...body };

    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at) VALUES ('escalation_config', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(merged)]
    );
    return reply.send({ data: merged });
  });

  // ─── Throttling Config ─────────────────────────────────────────────────────

  // GET /admin/throttling/config
  fastify.get('/admin/throttling/config', { preHandler: [fastify.requireRole(['admin'])] }, async (_request, reply) => {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'throttling_config'");
    const config = result.rows.length > 0 ? JSON.parse(result.rows[0].value) : {};
    return reply.send({ data: config });
  });

  // POST /admin/throttling/config
  fastify.post('/admin/throttling/config', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = z.object({
      enabled: z.boolean().optional(),
      default_cooldown_minutes: z.number().int().min(1).max(1440).optional(),
      max_notifications_per_hour: z.number().int().min(1).max(100).optional(),
      suppress_after_resolve: z.boolean().optional(),
    }).parse(request.body);

    const existing = await pool.query("SELECT value FROM system_settings WHERE key = 'throttling_config'");
    const current = existing.rows.length > 0 ? JSON.parse(existing.rows[0].value) : {};
    const merged = { ...current, ...body };

    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at) VALUES ('throttling_config', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(merged)]
    );
    return reply.send({ data: merged });
  });

  // ─── Business Hours Config ─────────────────────────────────────────────────

  // GET /admin/business-hours/config
  fastify.get('/admin/business-hours/config', { preHandler: [fastify.requireRole(['admin'])] }, async (_request, reply) => {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'business_hours_config'");
    const config = result.rows.length > 0 ? JSON.parse(result.rows[0].value) : {};

    // Also get the week schedule
    const schedule = await pool.query('SELECT * FROM business_hours ORDER BY day_of_week');
    const holidays = await getHolidays();

    return reply.send({ data: { config, schedule: schedule.rows, holidays } });
  });

  // POST /admin/business-hours/config
  fastify.post('/admin/business-hours/config', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = z.object({
      enabled: z.boolean().optional(),
      timezone: z.string().optional(),
      respect_for_notifications: z.boolean().optional(),
      respect_for_sla: z.boolean().optional(),
    }).parse(request.body);

    await saveBusinessHoursConfig({
      enabled: body.enabled ?? false,
      timezone: body.timezone || 'America/Denver',
      respect_for_notifications: body.respect_for_notifications ?? false,
      respect_for_sla: body.respect_for_sla ?? true,
    });

    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'business_hours_config'");
    return reply.send({ data: JSON.parse(result.rows[0].value) });
  });

  // PUT /admin/business-hours/schedule/:dayOfWeek
  fastify.put('/admin/business-hours/schedule/:dayOfWeek', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { dayOfWeek } = request.params as { dayOfWeek: string };
    const body = z.object({
      start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      is_business_day: z.boolean(),
    }).parse(request.body);

    const dow = parseInt(dayOfWeek);
    if (isNaN(dow) || dow < 0 || dow > 6) {
      return reply.status(400).send({ error: 'dayOfWeek must be 0-6' });
    }

    await updateDaySchedule(dow, body.start_time, body.end_time, body.is_business_day);
    return reply.send({ data: { day_of_week: dow, ...body } });
  });

  // POST /admin/business-hours/holidays
  fastify.post('/admin/business-hours/holidays', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const body = z.object({
      name: z.string().min(1),
      holiday_date: z.string(),
      is_annual: z.boolean().default(false),
    }).parse(request.body);

    await addHoliday(body.name, new Date(body.holiday_date), body.is_annual);
    const holidays = await getHolidays();
    return reply.status(201).send({ data: holidays });
  });

  // DELETE /admin/business-hours/holidays/:id
  fastify.delete('/admin/business-hours/holidays/:id', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await removeHoliday(id);
    return reply.status(204).send();
  });

  // ─── Force scheduler cycle (testing) ───────────────────────────────────────

  // POST /admin/notification-schedule/force-run
  fastify.post('/admin/notification-schedule/force-run', { preHandler: [fastify.requireRole(['admin'])] }, async (_request, reply) => {
    const result = await forceSchedulerCycle();
    return reply.send(result);
  });

  // ─── Notification log (recent) ─────────────────────────────────────────────

  // GET /admin/notification-log
  fastify.get('/admin/notification-log', { preHandler: [fastify.requireRole(['admin'])] }, async (request, reply) => {
    const limit = parseInt((request.query as any)?.limit || '100');
    const result = await pool.query(
      `SELECT nl.*, t.number as ticket_number, t.title as ticket_title
       FROM notification_log nl
       LEFT JOIN tickets t ON nl.ticket_id = t.id
       ORDER BY nl.sent_at DESC
       LIMIT $1`,
      [Math.min(limit, 500)]
    );
    return reply.send({ data: result.rows });
  });
}
