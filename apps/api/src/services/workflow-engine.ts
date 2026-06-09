// workflow-engine.ts — Visual workflow execution engine
// Handles: condition evaluation, step execution, branching, event dispatch
// Wired into notification-runner.ts for automatic trigger on ticket events

import { pool } from '../db/pool';
import type { NotificationEvent, NotificationEventType } from './notification-runner';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkflowContext {
  ticketId?: string;
  ticketData: Record<string, any>;
  actor: { id: string; name: string; email: string };
  previousData?: Record<string, any>;
}

interface ExecutionResult {
  status: 'completed' | 'failed' | 'skipped';
  steps_executed: StepLog[];
  error_message?: string;
  duration_ms: number;
}

interface StepLog {
  step_id: string;
  type: string;
  config: any;
  status: string;
  output: any;
}

// ─── Trigger type map ───────────────────────────────────────────────────────

const EVENT_TO_TRIGGER: Record<string, string> = {
  ticket_created: 'ticket_created',
  ticket_updated: 'ticket_updated',
  status_changed: 'status_changed',
  ticket_assigned: 'ticket_assigned',
  ticket_reassigned: 'ticket_assigned',
  comment_added: 'comment_added',
  ticket_resolved: 'ticket_resolved',
  ticket_closed: 'ticket_closed',
};

// ─── Circular execution guard ──────────────────────────────────────────────

const activeWorkflowRuns = new Map<string, number>();
const MAX_DEPTH = 3;

function getGuardKey(workflowId: string, ticketId?: string): string {
  return `${workflowId}:${ticketId || 'none'}`;
}

// ─── Condition evaluation ───────────────────────────────────────────────────

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function evaluateCondition(actual: any, operator: string, expected: any): boolean {
  const a = String(actual ?? '').toLowerCase();
  const e = String(expected ?? '').toLowerCase();

  switch (operator) {
    case 'is': return a === e;
    case 'is_not': return a !== e;
    case 'contains': return a.includes(e);
    case 'not_contains': return !a.includes(e);
    case 'is_empty': return !actual || actual === '';
    case 'is_not_empty': return actual !== null && actual !== undefined && actual !== '';
    default: return true;
  }
}

function evaluateConditions(conditions: any[], triggerData: any): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((cond: any) => {
    const value = getNestedValue(triggerData, cond.field);
    return evaluateCondition(value, cond.operator, cond.value);
  });
}

// ─── Variable interpolation ─────────────────────────────────────────────────

function interpolate(template: string, data: any): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, key) => {
    const value = getNestedValue(data, key);
    return value !== undefined ? String(value) : `{{${key}}}`;
  });
}

// ─── Step executor ──────────────────────────────────────────────────────────

async function executeStep(
  step: any,
  context: WorkflowContext,
  dryRun: boolean
): Promise<StepLog> {
  const config = step.config || {};
  const ticketId = context.ticketId;
  const actor = context.actor;
  const data = {
    ticket: context.ticketData,
    actor: { id: actor.id, name: actor.name, email: actor.email },
  };

  try {
    switch (step.type) {
      // ── Set Field ─────────────────────────────────────────────────────
      case 'set_field': {
        const field = config.field as string;
        const value = interpolate(String(config.value ?? ''), data);

        if (dryRun) {
          return { step_id: step.id, type: step.type, config, status: 'completed', output: { field, value } };
        }

        if (!ticketId) {
          return { step_id: step.id, type: step.type, config, status: 'error', output: { error: 'No ticket ID in context' } };
        }

        // Map readable field names to DB column names
        const fieldMap: Record<string, string> = {
          title: 'title',
          description: 'description',
          priority: 'priority',
          ticket_type: 'ticket_type',
          category_id: 'category_id',
          status: 'status',
        };

        const dbField = fieldMap[field];
        if (!dbField) {
          return { step_id: step.id, type: step.type, config, status: 'error', output: { error: `Unknown field: ${field}` } };
        }

        await pool.query(
          `UPDATE tickets SET ${dbField} = $1 WHERE id = $2`,
          [value, ticketId]
        );

        return { step_id: step.id, type: step.type, config, status: 'completed', output: { field, value } };
      }

      // ── Set Status ────────────────────────────────────────────────────
      case 'set_status': {
        const status = config.status as string;

        if (dryRun) {
          return { step_id: step.id, type: step.type, config, status: 'completed', output: { status } };
        }

        if (!ticketId) {
          return { step_id: step.id, type: step.type, config, status: 'error', output: { error: 'No ticket ID in context' } };
        }

        await pool.query(
          `UPDATE tickets SET status = $1 WHERE id = $2`,
          [status, ticketId]
        );

        // Log activity
        await pool.query(
          `INSERT INTO ticket_activity (ticket_id, actor_id, action, new_value)
           VALUES ($1, $2, 'status_changed', $3)`,
          [ticketId, actor.id, status]
        );

        return { step_id: step.id, type: step.type, config, status: 'completed', output: { status } };
      }

      // ── Assign To ─────────────────────────────────────────────────────
      case 'assign_to': {
        const userId = config.user_id as string;
        const groupId = config.group_id as string;

        if (dryRun) {
          return { step_id: step.id, type: step.type, config, status: 'completed', output: { user_id: userId, group_id: groupId } };
        }

        if (!ticketId) {
          return { step_id: step.id, type: step.type, config, status: 'error', output: { error: 'No ticket ID in context' } };
        }

        if (userId) {
          // Update legacy assignee field
          await pool.query(
            'UPDATE tickets SET assigned_to_id = $1 WHERE id = $2',
            [userId, ticketId]
          );

        }
        if (groupId) {
          await pool.query(
            'UPDATE tickets SET group_id = $1 WHERE id = $2',
            [groupId, ticketId]
          );
        }

        return { step_id: step.id, type: step.type, config, status: 'completed', output: { user_id: userId, group_id: groupId } };
      }

      // ── Add Comment ───────────────────────────────────────────────────
      case 'add_comment': {
        const body = interpolate(String(config.body ?? ''), data);
        const isInternal = !!config.is_internal;

        if (dryRun) {
          return { step_id: step.id, type: step.type, config, status: 'completed', output: { body, is_internal: isInternal } };
        }

        if (!ticketId) {
          return { step_id: step.id, type: step.type, config, status: 'error', output: { error: 'No ticket ID in context' } };
        }

        await pool.query(
          `INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal)
           VALUES ($1, $2, $3, $4)`,
          [ticketId, actor.id, body, isInternal]
        );

        return { step_id: step.id, type: step.type, config, status: 'completed', output: { body, is_internal: isInternal } };
      }

      // ── Send Notification ────────────────────────────────────────────
      case 'send_notification': {
        const recipients = (config.recipients || []) as string[];
        const notificationTemplate = String(config.template || 'ticket_updated');

        if (dryRun) {
          return { step_id: step.id, type: step.type, config, status: 'completed', output: { recipients, template: notificationTemplate } };
        }

        // Insert in-app notifications for the specified recipient groups
        if (ticketId) {
          for (const group of recipients) {
            let whereClause = '';
            switch (group) {
              case 'assignee':
                if (context.ticketData.assigned_to_id) {
                  await pool.query(
                    `INSERT INTO notifications (user_id, type, title, body, ticket_id)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [context.ticketData.assigned_to_id, 'workflow_notification',
                     `Workflow: ${notificationTemplate}`,
                     interpolate(String(config.message || 'You have a notification'), data),
                     ticketId]
                  );
                }
                break;
              case 'requestor':
                if (context.ticketData.created_by_id) {
                  await pool.query(
                    `INSERT INTO notifications (user_id, type, title, body, ticket_id)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [context.ticketData.created_by_id, 'workflow_notification',
                     `Workflow: ${notificationTemplate}`,
                     interpolate(String(config.message || 'You have a notification'), data),
                     ticketId]
                  );
                }
                break;
              case 'all_agents':
                await pool.query(
                  `INSERT INTO notifications (user_id, type, title, body, ticket_id)
                   SELECT id, 'workflow_notification', $1, $2, $3 FROM users
                   WHERE role IN ('admin', 'agent') AND is_active = true`,
                  [`Workflow: ${notificationTemplate}`,
                   interpolate(String(config.message || 'You have a notification'), data),
                   ticketId]
                );
                break;
            }
          }
        }

        return { step_id: step.id, type: step.type, config, status: 'completed', output: { recipients, template: notificationTemplate } };
      }

      // ── Send Email ────────────────────────────────────────────────────
      case 'send_email': {
        const to = String(config.to || '');
        const subject = interpolate(String(config.subject ?? ''), data);
        const emailBody = interpolate(String(config.body ?? ''), data);

        if (dryRun) {
          return { step_id: step.id, type: step.type, config, status: 'completed', output: { to, subject } };
        }

        if (!to) {
          return { step_id: step.id, type: step.type, config, status: 'error', output: { error: 'No recipient specified' } };
        }

        // Import dynamically to avoid circular dependency at module level
        const { sendCustomEmail } = await import('./outbound-email');
        sendCustomEmail(to, '', subject, emailBody, ticketId).catch((err: Error) =>
          console.error(`[workflow-engine] send_email failed to ${to}:`, err.message)
        );

        return { step_id: step.id, type: step.type, config, status: 'completed', output: { to, subject } };
      }

      // ── Create Ticket ─────────────────────────────────────────────────
      case 'create_ticket': {
        const title = interpolate(String(config.title ?? ''), data);
        const ticketType = String(config.ticket_type || 'incident');
        const description = interpolate(String(config.description ?? ''), data);
        const priority = String(config.priority || 'medium');

        if (dryRun) {
          return { step_id: step.id, type: step.type, config, status: 'completed', output: { title, ticket_type: ticketType } };
        }

        const result = await pool.query(
          `INSERT INTO tickets (title, description, priority, ticket_type, created_by_id)
           VALUES ($1, $2, $3, $4, $5) RETURNING id, number`,
          [title, description, priority, ticketType, actor.id]
        );

        return {
          step_id: step.id, type: step.type, config,
          status: 'completed',
          output: { title, ticket_id: result.rows[0].id, number: result.rows[0].number },
        };
      }

      // ── Delay ─────────────────────────────────────────────────────────
      case 'delay': {
        const minutes = Math.min(config.minutes || 0, 1440); // Max 24h
        return {
          step_id: step.id, type: step.type, config,
          status: 'completed',
          output: { minutes, note: 'Delay step is acknowledged. Scheduled execution is a future enhancement — the next steps run immediately.' },
        };
      }

      // ── Condition Branch ──────────────────────────────────────────────
      case 'condition': {
        const subConditions = config.conditions || [];
        const conditionsPass = evaluateConditions(subConditions, context.ticketData);

        // Execute the appropriate branch recursively
        const branch = conditionsPass ? (config.if_true || []) : (config.if_false || []);
        const branchResults: StepLog[] = [];

        for (const branchStep of branch) {
          const result = await executeStep(branchStep, context, dryRun);
          branchResults.push(result);
          if (result.status === 'error') break;
        }

        return {
          step_id: step.id, type: step.type, config,
          status: 'completed',
          output: {
            decision: conditionsPass ? 'if_true' : 'if_false',
            conditions_pass: conditionsPass,
            branch_executed: branchResults,
          },
        };
      }

      default:
        return { step_id: step.id, type: step.type, config, status: 'error', output: { error: `Unknown step type: ${step.type}` } };
    }
  } catch (err: any) {
    return { step_id: step.id, type: step.type, config, status: 'error', output: { error: err.message } };
  }
}

// ─── Workflow executor ────────────────────────────────────────────────────

async function executeWorkflow(
  workflow: any,
  context: WorkflowContext,
  dryRun: boolean = false
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const executionLog: StepLog[] = [];
  const guardKey = getGuardKey(workflow.id, context.ticketId);

  // Guard against circular execution
  const currentDepth = activeWorkflowRuns.get(guardKey) || 0;
  if (currentDepth >= MAX_DEPTH) {
    console.warn(`[workflow-engine] Max depth reached for workflow ${workflow.id} on ticket ${context.ticketId}`);
    return { status: 'skipped', steps_executed: [], duration_ms: 0 };
  }
  activeWorkflowRuns.set(guardKey, currentDepth + 1);

  try {
    // Evaluate workflow-level conditions
    if (!evaluateConditions(workflow.conditions, context.ticketData)) {
      const duration = Date.now() - startTime;
      activeWorkflowRuns.delete(guardKey);
      // Log as skipped
      await pool.query(
        `INSERT INTO workflow_executions (workflow_id, trigger_type, trigger_data, status, steps_executed, duration_ms)
         VALUES ($1, $2, $3, 'skipped', '[]', $4)`,
        [workflow.id, workflow.trigger_type, JSON.stringify(context.ticketData), duration]
      );
      return { status: 'skipped', steps_executed: [], duration_ms: duration };
    }

    // Execute steps in order
    for (const step of (workflow.steps || [])) {
      const result = await executeStep(step, context, dryRun);
      executionLog.push(result);
      if (result.status === 'error') break;
    }

    const duration = Date.now() - startTime;

    if (!dryRun) {
      // Update workflow run count
      await pool.query(
        'UPDATE visual_workflows SET run_count = run_count + 1, last_run_at = NOW(), last_error = NULL WHERE id = $1',
        [workflow.id]
      );

      // Log execution
      await pool.query(
        `INSERT INTO workflow_executions (workflow_id, trigger_type, trigger_data, status, steps_executed, duration_ms)
         VALUES ($1, $2, $3, 'completed', $4, $5)`,
        [workflow.id, workflow.trigger_type, JSON.stringify(context.ticketData), JSON.stringify(executionLog), duration]
      );
    }

    return { status: 'completed', steps_executed: executionLog, duration_ms: duration };
  } catch (err: any) {
    const duration = Date.now() - startTime;

    if (!dryRun) {
      await pool.query(
        'UPDATE visual_workflows SET last_error = $1 WHERE id = $2',
        [err.message, workflow.id]
      );
      await pool.query(
        `INSERT INTO workflow_executions (workflow_id, trigger_type, trigger_data, status, steps_executed, error_message, duration_ms)
         VALUES ($1, $2, $3, 'failed', $4, $5, $6)`,
        [workflow.id, workflow.trigger_type, JSON.stringify(context.ticketData), JSON.stringify(executionLog), err.message, duration]
      );
    }

    return { status: 'failed', steps_executed: executionLog, error_message: err.message, duration_ms: duration };
  } finally {
    activeWorkflowRuns.delete(guardKey);
  }
}

// ─── Public API: fire workflows on event ─────────────────────────────────────

export async function fireWorkflows(event: NotificationEvent): Promise<void> {
  const triggerType = EVENT_TO_TRIGGER[event.type];
  if (!triggerType) return; // Not a ticket event we handle

  try {
    // Query active workflows matching this trigger
    const result = await pool.query(
      `SELECT * FROM visual_workflows WHERE trigger_type = $1 AND is_active = true ORDER BY execution_order ASC`,
      [triggerType]
    );

    const workflows = result.rows;
    if (workflows.length === 0) return;

    const context: WorkflowContext = {
      ticketId: event.ticket.id,
      ticketData: {
        id: event.ticket.id,
        number: event.ticket.number,
        title: event.ticket.title,
        description: event.ticket.description || '',
        priority: event.ticket.priority,
        status: event.ticket.status,
        ticket_type: event.ticket.ticket_type,
        category_id: event.ticket.category_id,
        due_date: event.ticket.due_date,
        created_at: event.ticket.created_at,
        created_by_id: event.ticket.created_by_id,
        assigned_to_id: event.ticket.assigned_to_id,
        ...(event.previousTicket ? { previous: event.previousTicket } : {}),
      },
      actor: event.actor,
      previousData: event.previousTicket,
    };

    for (const workflow of workflows) {
      executeWorkflow(workflow, context, false).catch((err: Error) => {
        console.error(`[workflow-engine] Workflow ${workflow.id} (${workflow.name}) failed:`, err.message);
      });
    }
  } catch (err: any) {
    console.error('[workflow-engine] fireWorkflows failed:', err.message);
  }
}

// ─── Public API: classification ─────────────────────────────────────────────

export async function autoClassifyTicket(
  title: string,
  description: string,
  currentType?: string
): Promise<{ ticket_type?: string; priority?: string } | null> {
  try {
    const result = await pool.query(
      `SELECT * FROM ticket_classification_rules WHERE is_active = true ORDER BY priority DESC`
    );
    const rules = result.rows;
    if (rules.length === 0) return null;

    const searchText = `${title} ${description || ''}`.toLowerCase();

    for (const rule of rules) {
      if (!rule.keywords || rule.keywords.length === 0) continue;

      const matches = rule.keywords.filter((kw: string) =>
        searchText.includes(kw.toLowerCase())
      );

      let matched = false;
      if (rule.match_type === 'all') {
        matched = matches.length === rule.keywords.length;
      } else {
        matched = matches.length > 0;
      }

      if (matched) {
        return {
          ticket_type: rule.ticket_type,
          priority: rule.priority ? String(rule.priority) : undefined,
        };
      }
    }

    return null;
  } catch (err: any) {
    console.error('[workflow-engine] autoClassifyTicket failed:', err.message);
    return null;
  }
}

// ─── Public API: scheduled workflows ────────────────────────────────────────

// Simple cron expression parser — supports "every X minutes" and "hourly" patterns
function parseSchedule(executionOrder: number, _triggerType: string): { intervalMinutes: number } {
  // execution_order field doubles as interval hint (default 60 min if 0)
  const minutes = executionOrder > 0 ? executionOrder : 60;
  return { intervalMinutes: Math.max(5, Math.min(minutes, 43200)) }; // 5min - 30days
}

/**
 * Check and execute any due scheduled workflows.
 * Called from the scheduler service on each tick.
 */
export async function fireScheduledWorkflows(): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT * FROM visual_workflows WHERE trigger_type = 'scheduled' AND is_active = true ORDER BY execution_order ASC`
    );

    const workflows = result.rows;
    if (workflows.length === 0) return;

    for (const workflow of workflows) {
      // Check if enough time has passed since last run
      if (workflow.last_run_at) {
        const schedule = parseSchedule(workflow.execution_order, workflow.trigger_type);
        const lastRun = new Date(workflow.last_run_at).getTime();
        const elapsed = Date.now() - lastRun;
        if (elapsed < schedule.intervalMinutes * 60 * 1000) continue;
      }

      const context: WorkflowContext = {
        ticketData: {
          trigger: 'scheduled',
          workflow_name: workflow.name,
          executed_at: new Date().toISOString(),
        },
        actor: { id: 'system', name: 'Scheduler', email: '' },
      };

      executeWorkflow(workflow, context, false).catch((err: Error) => {
        console.error(`[workflow-engine] Scheduled workflow ${workflow.id} (${workflow.name}) failed:`, err.message);
      });
    }
  } catch (err: any) {
    console.error('[workflow-engine] fireScheduledWorkflows failed:', err.message);
  }
}

// ─── Exports for the test endpoint ──────────────────────────────────────────

export { executeWorkflow, evaluateConditions, executeStep, interpolate };
