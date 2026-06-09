// email-commands.ts — API routes for email command confirmations and admin management
// Handles token-based confirmation of destructive actions (e.g., delete via email)
// and admin endpoints for viewing email command history and stats.

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';

export default async function emailCommandRoutes(fastify: FastifyInstance) {

  // POST /email-commands/confirm — Confirm a pending email delete
  // No auth required; uses token-based confirmation from the email link
  fastify.post('/email-commands/confirm', async (request, reply) => {
    const body = z.object({
      token: z.string().min(1),
    }).parse(request.body);

    // Look up the confirmation
    const result = await pool.query(
      `SELECT * FROM email_delete_confirmations WHERE confirmation_token = $1 AND confirmed = false`,
      [body.token]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Invalid or already used confirmation token' });
    }

    const confirmation = result.rows[0];

    // Check expiry
    if (new Date(confirmation.expires_at) < new Date()) {
      return reply.status(410).send({ error: 'Confirmation token has expired' });
    }

    // Execute the delete
    await pool.query('DELETE FROM tickets WHERE id = $1', [confirmation.ticket_id]);

    // Mark confirmation as used
    await pool.query('UPDATE email_delete_confirmations SET confirmed = true WHERE id = $1', [confirmation.id]);

    // Log the command
    await pool.query(
      `INSERT INTO email_command_log (sender_email, sender_user_id, ticket_id, command, result) VALUES ($1, $2, $3, 'delete', 'success')`,
      [confirmation.sender_email, confirmation.sender_user_id, confirmation.ticket_id]
    );

    return reply.send({ message: 'Ticket deleted successfully' });
  });

  // GET /admin/email/commands — List recent email commands (admin)
  fastify.get('/admin/email/commands', { preHandler: [fastify.requirePermission('view_email_log')] }, async (request, reply) => {
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
      sender_email: z.string().optional(),
      command: z.string().optional(),
      result: z.enum(['success', 'denied', 'error', 'queued_confirmation', 'skipped']).optional(),
    }).parse(request.query);

    const offset = (query.page - 1) * query.pageSize;
    let where = 'WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (query.sender_email) { where += ` AND sender_email ILIKE $${idx++}`; params.push(`%${query.sender_email}%`); }
    if (query.command) { where += ` AND command = $${idx++}`; params.push(query.command); }
    if (query.result) { where += ` AND result = $${idx++}`; params.push(query.result); }

    const count = await pool.query(`SELECT COUNT(*) FROM email_command_log ${where}`, params);
    const result = await pool.query(
      `SELECT ecl.*, t.number as ticket_number, t.title as ticket_title, u.name as sender_name
       FROM email_command_log ecl
       LEFT JOIN tickets t ON ecl.ticket_id = t.id
       LEFT JOIN users u ON ecl.sender_user_id = u.id
       ${where}
       ORDER BY ecl.executed_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, query.pageSize, offset]
    );

    return reply.send({
      data: result.rows,
      total: parseInt(count.rows[0].count),
      page: query.page,
      pageSize: query.pageSize,
    });
  });

  // GET /admin/email/commands/stats — Email command statistics
  fastify.get('/admin/email/commands/stats', { preHandler: [fastify.requirePermission('view_email_log')] }, async (request, reply) => {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE result = 'success') as successful,
        COUNT(*) FILTER (WHERE result = 'denied') as denied,
        COUNT(*) FILTER (WHERE result = 'error') as errors,
        COUNT(*) FILTER (WHERE executed_at > NOW() - INTERVAL '24 hours') as last_24h
      FROM email_command_log
    `);
    return reply.send({ data: result.rows[0] });
  });

  // GET /admin/email/commands/reference — Get email command reference (for help docs)
  fastify.get('/admin/email/commands/reference', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    return reply.send({
      data: {
        subject_commands: [
          { syntax: '[Status:value]', description: 'Change ticket status', values: 'open, in_progress, waiting, resolved, closed', example: '[Status:resolved]' },
          { syntax: '[Priority:value]', description: 'Change ticket priority', values: 'low, medium, high, critical', example: '[Priority:high]' },
          { syntax: '[Type:value]', description: 'Change ticket type', values: 'incident, service_request, problem, change', example: '[Type:change]' },
          { syntax: '[Category:name]', description: 'Change ticket category', values: 'Any category name', example: '[Category:Network]' },
          { syntax: '[Assign:email]', description: 'Reassign ticket', values: 'User email address', example: '[Assign:john@company.com]' },
          { syntax: '[Close:reason]', description: 'Close ticket', values: 'Optional close reason', example: '[Close:Issue resolved by user]' },
          { syntax: '[Resolve:notes]', description: 'Resolve ticket', values: 'Optional resolution notes', example: '[Resolve:Fixed in latest update]' },
          { syntax: '[Reopen]', description: 'Reopen closed ticket', values: 'None', example: '[Reopen]' },
          { syntax: '[Delete]', description: 'Delete ticket (requires confirmation)', values: 'None', example: '[Delete]' },
          { syntax: '[CC:email]', description: 'Add a watcher/CC', values: 'Email address', example: '[CC:manager@company.com]' },
        ],
        body_commands: [
          { syntax: '@resolv status <value>', description: 'Change ticket status' },
          { syntax: '@resolv priority <value>', description: 'Change ticket priority' },
          { syntax: '@resolv assign <email>', description: 'Reassign ticket' },
          { syntax: '@resolv close [reason]', description: 'Close ticket' },
          { syntax: '@resolv resolve [notes]', description: 'Resolve ticket' },
          { syntax: '@resolv reopen', description: 'Reopen closed ticket' },
          { syntax: '@resolv delete', description: 'Delete ticket (requires confirmation)' },
          { syntax: '@resolv cc <email>', description: 'Add a watcher/CC' },
          { syntax: '@resolv type <value>', description: 'Change ticket type' },
          { syntax: '@resolv category <name>', description: 'Change ticket category' },
        ],
        permissions: {
          status: 'All roles (own tickets for users)',
          priority: 'Admin, Manager, Agent',
          assign: 'Admin, Manager',
          close: 'Admin, Manager, Agent',
          resolve: 'Admin, Manager, Agent',
          reopen: 'All roles (own tickets for users)',
          delete: 'Admin only (requires confirmation)',
          cc: 'All roles (own tickets for users)',
          type: 'Admin, Manager, Agent',
          category: 'Admin, Manager, Agent',
        },
      },
    });
  });

}
