// report-scheduler.ts — Background daemon for scheduled report delivery
// Runs periodic checks against report_schedules table.
// Uses SELECT FOR UPDATE SKIP LOCKED for multi-instance safety.
// Exports start/stop functions for lifecycle management.

import fs from 'fs';
import path from 'path';
import { pool } from '../db/pool';
import { sendCustomEmail } from './outbound-email';
import type { EmailAttachment } from './outbound-email';
import {
  executeReport,
  reportToCsv,
  reportToHtml,
  calculateNextRun,
} from '../routes/advanced-reports';

// ─── Configuration ───────────────────────────────────────────────────────────

const INTERVAL_MS = parseInt(process.env.REPORT_SCHEDULER_INTERVAL_MS || '60000', 10);
const EXPORT_DIR = process.env.REPORT_EXPORT_DIR || './exports';

function isEnabled(): boolean {
  if (process.env.REPORT_SCHEDULER_ENABLED !== undefined) {
    return process.env.REPORT_SCHEDULER_ENABLED === 'true';
  }
  return process.env.NODE_ENV === 'production';
}

// ─── Scheduler State ─────────────────────────────────────────────────────────

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let schedulerRunning = false;

export const schedulerStatus = {
  isRunning: false,
  lastCheckAt: null as Date | null,
  startedAt: null as Date | null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureExportDir(): void {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
    console.log(`[report-scheduler] Created export directory: ${EXPORT_DIR}`);
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

// ─── Process a single schedule ────────────────────────────────────────────────

interface ScheduleRow {
  id: string;
  report_id: string;
  report_name: string;
  report_type: string;
  config: any;
  frequency: string;
  day_of_week: number | null;
  day_of_month: number | null;
  hour: number;
  recipients: string[];
  format: string;
}

async function processSchedule(schedule: ScheduleRow): Promise<void> {
  const config = typeof schedule.config === 'string'
    ? JSON.parse(schedule.config)
    : schedule.config;

  // Insert execution log (running state)
  const logResult = await pool.query(
    `INSERT INTO report_execution_log (report_id, schedule_id, status, format)
     VALUES ($1, $2, 'running', $3) RETURNING *`,
    [schedule.report_id, schedule.id, schedule.format]
  );
  const logId = logResult.rows[0].id;

  try {
    // Execute the report
    const result = await executeReport(schedule.report_type, config);
    const rowCount = Array.isArray(result.data) ? result.data.length : 1;

    // Handle output based on format
    let filePath: string | null = null;

    if (schedule.format === 'email') {
      // Send email with CSV attachment and HTML body
      const csvContent = reportToCsv(schedule.report_type, result);
      const htmlBody = reportToHtml(schedule.report_type, result);

      const attachment: EmailAttachment = {
        filename: `${sanitizeFilename(schedule.report_name)}.csv`,
        content: Buffer.from(csvContent, 'utf-8'),
        mimeType: 'text/csv',
      };

      const recipients = schedule.recipients || [];
      if (recipients.length > 0) {
        await Promise.allSettled(
          recipients.map((recipient: string) =>
            sendCustomEmail(
              recipient,
              '',
              `Scheduled Report: ${schedule.report_name}`,
              htmlBody,
              undefined,
              [attachment]
            ).catch((err: Error) => {
              console.error(`[report-scheduler] Email to ${recipient} failed:`, err.message);
            })
          )
        );
      } else {
        console.warn(`[report-scheduler] Schedule ${schedule.id} has no recipients — skipping email`);
      }
    } else if (schedule.format === 'csv') {
      // Save CSV to disk
      ensureExportDir();
      const csvContent = reportToCsv(schedule.report_type, result);
      const filename = `${sanitizeFilename(schedule.report_name)}_${Date.now()}.csv`;
      filePath = path.join(EXPORT_DIR, filename);
      fs.writeFileSync(filePath, csvContent, 'utf-8');
      console.log(`[report-scheduler] Saved CSV: ${filePath}`);
    } else if (schedule.format === 'pdf') {
      // Save HTML to disk (browser can print to PDF)
      ensureExportDir();
      const htmlContent = reportToHtml(schedule.report_type, result);
      const filename = `${sanitizeFilename(schedule.report_name)}_${Date.now()}.html`;
      filePath = path.join(EXPORT_DIR, filename);
      fs.writeFileSync(filePath, htmlContent, 'utf-8');
      console.log(`[report-scheduler] Saved PDF-ready HTML: ${filePath}`);
    }

    // Calculate next run
    const nextRun = calculateNextRun(schedule);

    // Update schedule last_run_at and next_run_at
    await pool.query(
      `UPDATE report_schedules SET last_run_at = NOW(), next_run_at = $1 WHERE id = $2`,
      [nextRun, schedule.id]
    );

    // Mark execution log as completed
    await pool.query(
      `UPDATE report_execution_log SET status = 'completed', completed_at = NOW(), row_count = $1, file_path = $2 WHERE id = $3`,
      [rowCount, filePath, logId]
    );

    console.log(`[report-scheduler] Completed schedule "${schedule.report_name}" (${schedule.id})`);
  } catch (err: any) {
    console.error(`[report-scheduler] Failed schedule "${schedule.report_name}" (${schedule.id}):`, err.message);

    // Mark execution log as failed
    await pool.query(
      `UPDATE report_execution_log SET status = 'failed', completed_at = NOW(), error_message = $1 WHERE id = $2`,
      [err.message, logId]
    ).catch((logErr: any) => {
      console.error('[report-scheduler] Failed to update execution log:', logErr.message);
    });

    // Update next_run_at anyway so it retries on the normal cadence
    // (don't leave it stuck in the past causing continuous retries)
    try {
      const nextRun = calculateNextRun(schedule);
      await pool.query(
        `UPDATE report_schedules SET next_run_at = $1 WHERE id = $2`,
        [nextRun, schedule.id]
      );
    } catch (updateErr: any) {
      console.error('[report-scheduler] Failed to update next_run_at:', updateErr.message);
    }
  }
}

// ─── Main scheduler cycle ────────────────────────────────────────────────────

async function runSchedulerCycle(): Promise<void> {
  if (schedulerRunning) return;
  schedulerRunning = true;

  const checkTime = new Date();
  schedulerStatus.lastCheckAt = checkTime;

  try {
    // Use a transaction with FOR UPDATE SKIP LOCKED for multi-instance safety
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const dueResult = await client.query(
        `SELECT rs.*, sr.name as report_name, sr.report_type, sr.config
         FROM report_schedules rs
         JOIN saved_reports sr ON rs.report_id = sr.id
         WHERE rs.is_active = true AND rs.next_run_at <= NOW()
         ORDER BY rs.next_run_at ASC
         FOR UPDATE SKIP LOCKED`
      );

      await client.query('COMMIT');

      const dueSchedules = dueResult.rows;

      if (dueSchedules.length > 0) {
        console.log(`[report-scheduler] Found ${dueSchedules.length} due schedule(s) to process`);

        // Process each schedule independently — failures don't stop others
        for (const schedule of dueSchedules) {
          await processSchedule(schedule);
        }
      }
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[report-scheduler] Cycle failed:', err.message);
  } finally {
    schedulerRunning = false;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Start the report scheduler daemon.
 * Call once on server startup. Only runs in production by default.
 */
export async function startReportScheduler(): Promise<void> {
  if (schedulerTimer) {
    console.log('[report-scheduler] Already running — skipping duplicate start');
    return;
  }

  if (!isEnabled()) {
    console.log('[report-scheduler] Disabled by configuration' +
      (process.env.NODE_ENV !== 'production' ? ' (NODE_ENV is not production)' : '') +
      ' — set REPORT_SCHEDULER_ENABLED=true to override');
    return;
  }

  ensureExportDir();

  schedulerStatus.startedAt = new Date();
  schedulerStatus.isRunning = true;

  // Initial run after 10 seconds (allows server to fully initialize)
  setTimeout(() => {
    runSchedulerCycle().catch((err: any) =>
      console.error('[report-scheduler] Initial cycle error:', err.message)
    );
  }, 10000);

  // Then run on interval
  schedulerTimer = setInterval(() => {
    runSchedulerCycle().catch((err: any) =>
      console.error('[report-scheduler] Interval error:', err.message)
    );
  }, INTERVAL_MS);

  console.log(`[report-scheduler] Started — checking every ${INTERVAL_MS / 1000}s (export dir: ${EXPORT_DIR})`);
}

/**
 * Stop the report scheduler daemon.
 */
export async function stopReportScheduler(): Promise<void> {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  schedulerStatus.isRunning = false;
  schedulerStatus.startedAt = null;
  console.log('[report-scheduler] Stopped');
}

/**
 * Get current scheduler status (thread-safe snapshot).
 */
export function getSchedulerStatus(): typeof schedulerStatus {
  return { ...schedulerStatus, isRunning: schedulerStatus.isRunning };
}
