// email-template-engine.ts — Simple string interpolation for email templates
// Templates use [VARIABLE_NAME] syntax: [TICKET_ID], [USER_NAME], [AGENT_NAME], [TICKET_TITLE]

import { pool } from '../db/pool';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface TemplateVariables {
  ticket_id?: number;
  ticket_title?: string;
  user_name?: string;
  agent_name?: string;
  ticket_url?: string;
  close_notes?: string;
  priority?: string;
  status?: string;
  requestor_name?: string;
  requestor_email?: string;
  assigned_to_name?: string;
  created_at?: string;
  due_date?: string;
  category?: string;
  ticket_type?: string;
  description?: string;
  priority_color?: string;
  status_color?: string;
  comment_body?: string;
  [key: string]: string | number | undefined;
}

/**
 * Format priority value for display in emails.
 */
export function formatPriority(priority: string | undefined): string {
  if (!priority) return 'None';
  const map: Record<string, string> = {
    low: 'P4 - Low',
    medium: 'P3 - Medium',
    high: 'P2 - High',
    critical: 'P1 - Critical'
  };
  return map[priority.toLowerCase()] || priority;
}

/**
 * Format status value for display in emails.
 */
export function formatStatus(status: string | undefined): string {
  if (!status) return 'None';
  const map: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    waiting: 'Waiting on User',
    resolved: 'Resolved',
    closed: 'Closed'
  };
  return map[status.toLowerCase()] || status;
}

/**
 * Format ticket type for display in emails.
 */
export function formatTicketType(type: string | undefined): string {
  if (!type) return 'Incident';
  const map: Record<string, string> = {
    incident: 'Incident',
    service_request: 'Service Request',
    problem: 'Problem',
    change: 'Change Request'
  };
  return map[type.toLowerCase()] || type;
}

/**
 * Get color hex for priority level.
 */
export function getPriorityColor(priority: string | undefined): string {
  if (!priority) return '#6b7280';
  const map: Record<string, string> = {
    low: '#6b7280',
    medium: '#2563eb',
    high: '#f59e0b',
    critical: '#dc2626'
  };
  return map[priority.toLowerCase()] || '#6b7280';
}

/**
 * Get color hex for status.
 */
export function getStatusColor(status: string | undefined): string {
  if (!status) return '#6b7280';
  const map: Record<string, string> = {
    open: '#2563eb',
    in_progress: '#7c3aed',
    waiting: '#f59e0b',
    resolved: '#059669',
    closed: '#6b7280'
  };
  return map[status.toLowerCase()] || '#6b7280';
}

/**
 * Format a date string for display in emails.
 */
export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'None';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch {
    return dateStr;
  }
}

function getDefaultTemplates(): EmailTemplate[] {
  return [
    {
      id: '1',
      name: 'Ticket Created',
      subject: 'New Ticket #[TICKET_ID] — [TICKET_TITLE]',
      body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Ticket Received</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;border-collapse:collapse;">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#1a73e8;padding:28px 20px;border-radius:6px 6px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#ffffff;">
                    &#128196; New Ticket Received
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#d4e1ff;padding-top:6px;">
                    #[TICKET_ID] — [TICKET_TITLE]
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:28px 25px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
              <!-- Greeting -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#333333;padding-bottom:8px;">
                    Hello <strong>[USER_NAME]</strong>,
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;padding-bottom:22px;line-height:1.5;">
                    Your support request has been received and is being reviewed. Please reference the details below.
                  </td>
                </tr>
              </table>
              <!-- Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:4px;margin-bottom:22px;">
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Ticket Number</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_ID]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Title</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_TITLE]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Requestor</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[REQUESTOR_NAME]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Assigned To</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[ASSIGNED_TO_NAME]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Request Date/Time</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[CREATED_AT]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Priority</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">
                    <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:bold;color:#ffffff;background-color:[PRIORITY_COLOR];">[PRIORITY]</span>
                  </td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Status</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">
                    <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:bold;color:#ffffff;background-color:[STATUS_COLOR];">[STATUS]</span>
                  </td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Due Date</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[DUE_DATE]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Type</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_TYPE]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;width:40%;border-bottom:0;">Category</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:0;">[CATEGORY]</td>
                </tr>
              </table>
              <!-- Description Section -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;padding-bottom:6px;">
                    Description:
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#444444;line-height:1.5;padding:12px 15px;background-color:#f9f9f9;border:1px solid #e0e0e0;border-radius:4px;">
                    [DESCRIPTION]
                  </td>
                </tr>
              </table>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:18px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color:#1a73e8;border-radius:4px;">
                          <a href="[TICKET_URL]" target="_blank" style="display:inline-block;padding:11px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;background-color:#1a73e8;border-radius:4px;">View Ticket</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <!-- Note -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#888888;line-height:1.5;font-style:italic;">
                    Our team will review your request shortly. You&#39;ll receive updates as we work on it.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f7f7f7;border-top:1px solid #e0e0e0;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;border-radius:0 0 6px 6px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;">
                    <p style="margin:0 0 6px 0;">Sent by <strong style="color:#666666;">Resolv</strong> IT Service Management</p>
                    <p style="margin:0;">Reply directly to this email to respond on this ticket.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    },
    {
      id: '2',
      name: 'Ticket Assigned',
      subject: 'Ticket #[TICKET_ID] Assigned to [AGENT_NAME]',
      body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Assigned</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;border-collapse:collapse;">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#1a73e8;padding:28px 20px;border-radius:6px 6px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#ffffff;">
                    &#128203; Ticket Assigned
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#d4e1ff;padding-top:6px;">
                    #[TICKET_ID] — [TICKET_TITLE]
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:28px 25px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
              <!-- Greeting -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#333333;padding-bottom:8px;">
                    Hello <strong>[USER_NAME]</strong>,
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;padding-bottom:22px;line-height:1.5;">
                    This ticket has been assigned to a specialist and is actively being worked on.
                  </td>
                </tr>
              </table>
              <!-- Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:4px;margin-bottom:22px;">
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Ticket Number</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_ID]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Title</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_TITLE]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Requestor</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[REQUESTOR_NAME]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Assigned To</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[AGENT_NAME]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Request Date/Time</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[CREATED_AT]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Priority</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">
                    <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:bold;color:#ffffff;background-color:[PRIORITY_COLOR];">[PRIORITY]</span>
                  </td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Status</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">
                    <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:bold;color:#ffffff;background-color:[STATUS_COLOR];">[STATUS]</span>
                  </td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Due Date</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[DUE_DATE]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Type</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_TYPE]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;width:40%;border-bottom:0;">Category</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:0;">[CATEGORY]</td>
                </tr>
              </table>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color:#1a73e8;border-radius:4px;">
                          <a href="[TICKET_URL]" target="_blank" style="display:inline-block;padding:11px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;background-color:#1a73e8;border-radius:4px;">View Ticket</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f7f7f7;border-top:1px solid #e0e0e0;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;border-radius:0 0 6px 6px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;">
                    <p style="margin:0 0 6px 0;">Sent by <strong style="color:#666666;">Resolv</strong> IT Service Management</p>
                    <p style="margin:0;">Reply directly to this email to respond on this ticket.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    },
    {
      id: '4',
      name: 'Ticket Resolved',
      subject: 'Ticket #[TICKET_ID] Resolved — [TICKET_TITLE]',
      body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Resolved</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;border-collapse:collapse;">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#0d904f;padding:28px 20px;border-radius:6px 6px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#ffffff;">
                    &#9989; Ticket Resolved
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#c8f0d4;padding-top:6px;">
                    #[TICKET_ID] — [TICKET_TITLE]
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:28px 25px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
              <!-- Greeting -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#333333;padding-bottom:8px;">
                    Hello <strong>[USER_NAME]</strong>,
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;padding-bottom:22px;line-height:1.5;">
                    Your ticket has been resolved. Please review the resolution details below.
                  </td>
                </tr>
              </table>
              <!-- Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:4px;margin-bottom:22px;">
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Ticket Number</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_ID]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Title</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_TITLE]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Requestor</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[REQUESTOR_NAME]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Assigned To</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[ASSIGNED_TO_NAME]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Request Date/Time</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[CREATED_AT]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Priority</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">
                    <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:bold;color:#ffffff;background-color:[PRIORITY_COLOR];">[PRIORITY]</span>
                  </td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Status</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">
                    <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:bold;color:#ffffff;background-color:[STATUS_COLOR];">[STATUS]</span>
                  </td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Due Date</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[DUE_DATE]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;width:40%;border-bottom:0;">Type</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:0;">[TICKET_TYPE]</td>
                </tr>
              </table>
              <!-- Resolution Notes Section -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;padding-bottom:6px;">
                    Resolution Notes:
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#444444;line-height:1.5;padding:12px 15px;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;">
                    [CLOSE_NOTES]
                  </td>
                </tr>
              </table>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:18px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color:#0d904f;border-radius:4px;">
                          <a href="[TICKET_URL]" target="_blank" style="display:inline-block;padding:11px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;background-color:#0d904f;border-radius:4px;">View Ticket</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <!-- Note -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#888888;line-height:1.5;font-style:italic;">
                    If this issue persists or you have further questions, simply reply to this email to reopen the ticket.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f7f7f7;border-top:1px solid #e0e0e0;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;border-radius:0 0 6px 6px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;">
                    <p style="margin:0 0 6px 0;">Sent by <strong style="color:#666666;">Resolv</strong> IT Service Management</p>
                    <p style="margin:0;">Reply directly to this email to respond on this ticket.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    },
    {
      id: '5',
      name: 'Comment Added',
      subject: 'Re: Ticket #[TICKET_ID] — New Reply',
      body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Reply on Ticket</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;border-collapse:collapse;">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#1a73e8;padding:28px 20px;border-radius:6px 6px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#ffffff;">
                    &#128172; New Reply on Ticket #[TICKET_ID]
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#d4e1ff;padding-top:6px;">
                    [TICKET_TITLE]
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:28px 25px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
              <!-- Greeting -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#333333;padding-bottom:8px;">
                    Hello <strong>[USER_NAME]</strong>,
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;padding-bottom:22px;line-height:1.5;">
                    A new reply has been added to your ticket. See the details below.
                  </td>
                </tr>
              </table>
              <!-- Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:4px;margin-bottom:22px;">
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Ticket Number</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_ID]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Title</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_TITLE]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Requestor</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[REQUESTOR_NAME]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Assigned To</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[ASSIGNED_TO_NAME]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Request Date/Time</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[CREATED_AT]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Priority</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">
                    <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:bold;color:#ffffff;background-color:[PRIORITY_COLOR];">[PRIORITY]</span>
                  </td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;width:40%;border-bottom:0;">Status</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:0;">
                    <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:bold;color:#ffffff;background-color:[STATUS_COLOR];">[STATUS]</span>
                  </td>
                </tr>
              </table>
              <!-- Comment Section -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;padding-bottom:6px;">
                    Latest Reply:
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#444444;line-height:1.5;padding:12px 15px;background-color:#f9f9f9;border:1px solid #e0e0e0;border-radius:4px;">
                    [COMMENT_BODY]
                  </td>
                </tr>
              </table>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color:#1a73e8;border-radius:4px;">
                          <a href="[TICKET_URL]" target="_blank" style="display:inline-block;padding:11px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;background-color:#1a73e8;border-radius:4px;">View Conversation</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f7f7f7;border-top:1px solid #e0e0e0;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;border-radius:0 0 6px 6px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;">
                    <p style="margin:0 0 6px 0;">Sent by <strong style="color:#666666;">Resolv</strong> IT Service Management</p>
                    <p style="margin:0;">Reply directly to this email to respond on this ticket.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>\`,
    },
    // --- Template 5: SLA Breach Warning ---
    {
      id: '6',
      name: 'SLA Breach Warning',
      subject: '⚠️ SLA Warning — Ticket #[TICKET_ID] at [SLA_THRESHOLD]% of SLA Time',
      body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SLA Breach Warning</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;border-collapse:collapse;">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#dc2626;padding:28px 20px;border-radius:6px 6px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#ffffff;">
                    &#9888; SLA Breach Warning
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#fecaca;padding-top:6px;">
                    #[TICKET_ID] \u2014 [TICKET_TITLE]
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:28px 25px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
              <!-- Greeting -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#333333;padding-bottom:8px;">
                    Hello <strong>[USER_NAME]</strong>,
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;padding-bottom:22px;line-height:1.5;">
                    This ticket is approaching its SLA deadline. Immediate attention is required.
                  </td>
                </tr>
              </table>
              <!-- Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:4px;margin-bottom:22px;">
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Ticket Number</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_ID]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Title</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_TITLE]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Priority</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">
                    <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:bold;color:#ffffff;background-color:[PRIORITY_COLOR];">[PRIORITY]</span>
                  </td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Status</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">
                    <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:bold;color:#ffffff;background-color:[STATUS_COLOR];">[STATUS]</span>
                  </td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Assigned To</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[ASSIGNED_TO_NAME]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Requestor</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[REQUESTOR_NAME]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">SLA Threshold</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#dc2626;border-bottom:1px solid #e0e0e0;">[SLA_THRESHOLD]%</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Time Remaining</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TIME_REMAINING]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;width:40%;border-bottom:0;">Due Date</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:0;">[DUE_DATE]</td>
                </tr>
              </table>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:18px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color:#dc2626;border-radius:4px;">
                          <a href="[TICKET_URL]" target="_blank" style="display:inline-block;padding:12px 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;background-color:#dc2626;border-radius:4px;">Take Action</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <!-- Note -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#888888;line-height:1.5;font-style:italic;">
                    This ticket requires immediate attention to avoid an SLA breach.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f7f7f7;border-top:1px solid #e0e0e0;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;border-radius:0 0 6px 6px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;">
                    <p style="margin:0 0 6px 0;">Sent by <strong style="color:#666666;">Resolv</strong> IT Service Management</p>
                    <p style="margin:0;">Reply directly to this email to respond on this ticket.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>\`,
    },
    // --- Template 6: Due Date Reminder ---
    {
      id: '7',
      name: 'Due Date Reminder',
      subject: 'Reminder: Ticket #[TICKET_ID] is due in [TIME_REMAINING]',
      body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Due Date Reminder</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;border-collapse:collapse;">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#f59e0b;padding:28px 20px;border-radius:6px 6px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#ffffff;">
                    &#9200; Due Date Approaching
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#fef3c7;padding-top:6px;">
                    #[TICKET_ID] \u2014 [TICKET_TITLE]
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:28px 25px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
              <!-- Greeting -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#333333;padding-bottom:8px;">
                    Hello <strong>[USER_NAME]</strong>,
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;padding-bottom:22px;line-height:1.5;">
                    This ticket is approaching its due date. Please ensure it is resolved or updated in a timely manner.
                  </td>
                </tr>
              </table>
              <!-- Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:4px;margin-bottom:22px;">
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Ticket Number</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_ID]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Title</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_TITLE]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Priority</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">
                    <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:bold;color:#ffffff;background-color:[PRIORITY_COLOR];">[PRIORITY]</span>
                  </td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Status</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">
                    <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:bold;color:#ffffff;background-color:[STATUS_COLOR];">[STATUS]</span>
                  </td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Assigned To</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[ASSIGNED_TO_NAME]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Requestor</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[REQUESTOR_NAME]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Due Date</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;">[DUE_DATE]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Time Remaining</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TIME_REMAINING]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;width:40%;border-bottom:0;">Type</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:0;">[TICKET_TYPE]</td>
                </tr>
              </table>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color:#f59e0b;border-radius:4px;">
                          <a href="[TICKET_URL]" target="_blank" style="display:inline-block;padding:12px 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;background-color:#f59e0b;border-radius:4px;">View Ticket</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f7f7f7;border-top:1px solid #e0e0e0;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;border-radius:0 0 6px 6px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;">
                    <p style="margin:0 0 6px 0;">Sent by <strong style="color:#666666;">Resolv</strong> IT Service Management</p>
                    <p style="margin:0;">Reply directly to this email to respond on this ticket.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>\`,
    },
    // --- Template 7: Escalation Notice ---
    {
      id: '8',
      name: 'Escalation Notice',
      subject: '\uD83D\uDD3A Escalation: Ticket #[TICKET_ID] requires attention',
      body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Escalation Notice</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;border-collapse:collapse;">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#dc2626;padding:28px 20px;border-radius:6px 6px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#ffffff;">
                    &#128314; Ticket Escalated
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#fecaca;padding-top:6px;">
                    #[TICKET_ID] \u2014 [TICKET_TITLE]
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:28px 25px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
              <!-- Greeting -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#333333;padding-bottom:8px;">
                    Hello <strong>[USER_NAME]</strong>,
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;padding-bottom:22px;line-height:1.5;">
                    A ticket has been escalated and requires your immediate attention.
                  </td>
                </tr>
              </table>
              <!-- Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:4px;margin-bottom:22px;">
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Ticket Number</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_ID]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Title</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_TITLE]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Priority</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">
                    <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:bold;color:#ffffff;background-color:[PRIORITY_COLOR];">[PRIORITY]</span>
                  </td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Status</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">
                    <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:bold;color:#ffffff;background-color:[STATUS_COLOR];">[STATUS]</span>
                  </td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Assigned To</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[ASSIGNED_TO_NAME]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Requestor</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[REQUESTOR_NAME]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Reason</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[ESCALATION_REASON]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Due Date</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[DUE_DATE]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;width:40%;border-bottom:0;">Time Overdue</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:0;">[TIME_OVERDUE]</td>
                </tr>
              </table>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:18px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color:#dc2626;border-radius:4px;">
                          <a href="[TICKET_URL]" target="_blank" style="display:inline-block;padding:12px 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;background-color:#dc2626;border-radius:4px;">View Ticket</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <!-- Note -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#888888;line-height:1.5;">
                    This ticket has been escalated due to [ESCALATION_REASON]. Please address it as soon as possible.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f7f7f7;border-top:1px solid #e0e0e0;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;border-radius:0 0 6px 6px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;">
                    <p style="margin:0 0 6px 0;">Sent by <strong style="color:#666666;">Resolv</strong> IT Service Management</p>
                    <p style="margin:0;">Reply directly to this email to respond on this ticket.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>\`,
    },
    // --- Template 8: Satisfaction Survey ---
    {
      id: '9',
      name: 'Satisfaction Survey',
      subject: 'How did we do? Rate your experience for Ticket #[TICKET_ID]',
      body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Satisfaction Survey</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;border-collapse:collapse;">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#7c3aed;padding:28px 20px;border-radius:6px 6px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#ffffff;">
                    &#11088; We Value Your Feedback
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#ddd6fe;padding-top:6px;">
                    Ticket #[TICKET_ID]
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:28px 25px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
              <!-- Greeting -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#333333;padding-bottom:8px;">
                    Hello <strong>[USER_NAME]</strong>,
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;padding-bottom:22px;line-height:1.5;">
                    Your ticket has been resolved. We&#39;d love to hear about your experience. Please take a moment to rate the support you received.
                  </td>
                </tr>
              </table>
              <!-- Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:4px;margin-bottom:22px;">
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Ticket Number</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_ID]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Title</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_TITLE]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Assigned To</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[ASSIGNED_TO_NAME]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;width:40%;border-bottom:0;">Resolved Date</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:0;">[RESOLVED_AT]</td>
                </tr>
              </table>
              <!-- Rating Section -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center" style="padding-bottom:8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#333333;">
                    How would you rate your experience?
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:0 4px;"><a href="[SURVEY_URL_1]" target="_blank" style="display:inline-block;width:44px;height:44px;line-height:44px;text-align:center;font-size:24px;text-decoration:none;background-color:#f3f4f6;border-radius:8px;color:#f59e0b;">&#9733;</a></td>
                        <td style="padding:0 4px;"><a href="[SURVEY_URL_2]" target="_blank" style="display:inline-block;width:44px;height:44px;line-height:44px;text-align:center;font-size:24px;text-decoration:none;background-color:#f3f4f6;border-radius:8px;color:#f59e0b;">&#9733;</a></td>
                        <td style="padding:0 4px;"><a href="[SURVEY_URL_3]" target="_blank" style="display:inline-block;width:44px;height:44px;line-height:44px;text-align:center;font-size:24px;text-decoration:none;background-color:#f3f4f6;border-radius:8px;color:#f59e0b;">&#9733;</a></td>
                        <td style="padding:0 4px;"><a href="[SURVEY_URL_4]" target="_blank" style="display:inline-block;width:44px;height:44px;line-height:44px;text-align:center;font-size:24px;text-decoration:none;background-color:#f3f4f6;border-radius:8px;color:#f59e0b;">&#9733;</a></td>
                        <td style="padding:0 4px;"><a href="[SURVEY_URL_5]" target="_blank" style="display:inline-block;width:44px;height:44px;line-height:44px;text-align:center;font-size:24px;text-decoration:none;background-color:#f3f4f6;border-radius:8px;color:#f59e0b;">&#9733;</a></td>
                      </tr>
                      <tr>
                        <td align="center" style="padding:4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#999;">Poor</td>
                        <td align="center" style="padding:4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#999;">Fair</td>
                        <td align="center" style="padding:4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#999;">Good</td>
                        <td align="center" style="padding:4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#999;">Great</td>
                        <td align="center" style="padding:4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#999;">Excellent</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <!-- Note -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#888888;line-height:1.5;font-style:italic;">
                    Your feedback helps us improve our service. Thank you!
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f7f7f7;border-top:1px solid #e0e0e0;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;border-radius:0 0 6px 6px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;">
                    <p style="margin:0 0 6px 0;">Sent by <strong style="color:#666666;">Resolv</strong> IT Service Management</p>
                    <p style="margin:0;">Reply directly to this email to respond on this ticket.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>\`,
    },
    // --- Template 9: Ticket Reassigned ---
    {
      id: '10',
      name: 'Ticket Reassigned',
      subject: 'Ticket #[TICKET_ID] has been reassigned to [AGENT_NAME]',
      body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Reassigned</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;border-collapse:collapse;">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#7c3aed;padding:28px 20px;border-radius:6px 6px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#ffffff;">
                    &#128260; Ticket Reassigned
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#ddd6fe;padding-top:6px;">
                    #[TICKET_ID] \u2014 [TICKET_TITLE]
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:28px 25px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
              <!-- Greeting -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#333333;padding-bottom:8px;">
                    Hello <strong>[USER_NAME]</strong>,
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;padding-bottom:22px;line-height:1.5;">
                    This ticket has been reassigned to a new team member. Here are the updated details.
                  </td>
                </tr>
              </table>
              <!-- Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:4px;margin-bottom:22px;">
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Ticket Number</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_ID]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Title</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_TITLE]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Priority</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">
                    <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:bold;color:#ffffff;background-color:[PRIORITY_COLOR];">[PRIORITY]</span>
                  </td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Status</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">
                    <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:bold;color:#ffffff;background-color:[STATUS_COLOR];">[STATUS]</span>
                  </td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Previously Assigned To</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[PREVIOUS_ASSIGNEE]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Now Assigned To</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;">[AGENT_NAME]</td>
                </tr>
                <tr style="background-color:#f6f8fc;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Requestor</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[REQUESTOR_NAME]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;width:40%;border-bottom:0;">Due Date</td>
                  <td style="padding:9px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:0;">[DUE_DATE]</td>
                </tr>
              </table>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color:#7c3aed;border-radius:4px;">
                          <a href="[TICKET_URL]" target="_blank" style="display:inline-block;padding:12px 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;background-color:#7c3aed;border-radius:4px;">View Ticket</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f7f7f7;border-top:1px solid #e0e0e0;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;border-radius:0 0 6px 6px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;">
                    <p style="margin:0 0 6px 0;">Sent by <strong style="color:#666666;">Resolv</strong> IT Service Management</p>
                    <p style="margin:0;">Reply directly to this email to respond on this ticket.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>\`,
    },
  ];
}

export async function loadTemplates(): Promise<EmailTemplate[]> {
  const result = await pool.query("SELECT value FROM system_settings WHERE key = 'email_templates'");
  if (result.rows.length === 0) return getDefaultTemplates();
  try {
    const parsed = JSON.parse(result.rows[0].value);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return getDefaultTemplates();
  } catch {
    return getDefaultTemplates();
  }
}

export function findTemplate(templates: EmailTemplate[], name: string): EmailTemplate | undefined {
  const normalized = name.toLowerCase();
  return templates.find(t => t.name.toLowerCase() === normalized);
}

export function interpolate(template: string, variables: TemplateVariables): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `[${key.toUpperCase()}]`;
    result = result.replaceAll(placeholder, value != null ? String(value) : '');
  }
  return result;
}

export function interpolateSubject(template: string, variables: TemplateVariables): string {
  return interpolate(template, variables);
}

export function interpolateBody(template: string, variables: TemplateVariables): string {
  return interpolate(template, variables);
}

export { EmailTemplate, TemplateVariables };
