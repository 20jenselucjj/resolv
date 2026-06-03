// email-template-engine.ts ΓÇö Simple string interpolation for email templates
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
  [key: string]: string | number | undefined;
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

function getDefaultTemplates(): EmailTemplate[] {
  return [
    {
      id: '1',
      name: 'Ticket Created',
      subject: 'Your ticket #[TICKET_ID] has been created',
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
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-collapse:collapse;">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#1a73e8;padding:30px 20px;border-radius:8px 8px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:bold;color:#ffffff;">
                    &#128196; New Ticket Received
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background-color:#ffffff;padding:30px 25px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#333333;padding-bottom:15px;">
                    Hello <strong>[USER_NAME]</strong>,
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;padding-bottom:20px;line-height:1.5;">
                    We've received your support request. Here are the details:
                  </td>
                </tr>
              </table>
              <!-- Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:4px;margin-bottom:25px;">
                <tr style="background-color:#f0f4f9;">
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Ticket #</td>
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_ID]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Title</td>
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_TITLE]</td>
                </tr>
                <tr style="background-color:#f9f9f9;">
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Priority</td>
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[PRIORITY]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;width:40%;">Status</td>
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;">[STATUS]</td>
                </tr>
              </table>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:20px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color:#1a73e8;border-radius:4px;">
                          <a href="[TICKET_URL]" target="_blank" style="display:inline-block;padding:12px 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;background-color:#1a73e8;border-radius:4px;">View Your Ticket</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <!-- Note -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#777777;line-height:1.5;font-style:italic;">
                    Our team will review your request shortly. You'll receive updates as we work on it.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f5f5f5;border-top:1px solid #e0e0e0;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;border-radius:0 0 8px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;">
                    <p style="margin:0 0 8px 0;">Sent by <strong style="color:#666666;">Resolv</strong> IT Service Management</p>
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
      subject: 'Ticket #[TICKET_ID] has been assigned to [AGENT_NAME]',
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
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-collapse:collapse;">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#1a73e8;padding:30px 20px;border-radius:8px 8px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:bold;color:#ffffff;">
                    &#128203; Ticket Assigned
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background-color:#ffffff;padding:30px 25px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#333333;padding-bottom:15px;">
                    Hello <strong>[USER_NAME]</strong>,
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;padding-bottom:20px;line-height:1.5;">
                    Your ticket has been assigned to a specialist and is being reviewed.
                  </td>
                </tr>
              </table>
              <!-- Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:4px;margin-bottom:25px;">
                <tr style="background-color:#f0f4f9;">
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Ticket #</td>
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_ID]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Title</td>
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_TITLE]</td>
                </tr>
                <tr style="background-color:#f9f9f9;">
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Assigned To</td>
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[AGENT_NAME]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;width:40%;">Priority</td>
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;">[PRIORITY]</td>
                </tr>
              </table>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color:#1a73e8;border-radius:4px;">
                          <a href="[TICKET_URL]" target="_blank" style="display:inline-block;padding:12px 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;background-color:#1a73e8;border-radius:4px;">View Your Ticket</a>
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
            <td style="background-color:#f5f5f5;border-top:1px solid #e0e0e0;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;border-radius:0 0 8px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;">
                    <p style="margin:0 0 8px 0;">Sent by <strong style="color:#666666;">Resolv</strong> IT Service Management</p>
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
      subject: 'Your ticket #[TICKET_ID] has been resolved',
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
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-collapse:collapse;">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#0d904f;padding:30px 20px;border-radius:8px 8px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:bold;color:#ffffff;">
                    &#9989; Ticket Resolved
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background-color:#ffffff;padding:30px 25px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#333333;padding-bottom:15px;">
                    Hello <strong>[USER_NAME]</strong>,
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;padding-bottom:20px;line-height:1.5;">
                    Your ticket has been resolved.
                  </td>
                </tr>
              </table>
              <!-- Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:4px;margin-bottom:25px;">
                <tr style="background-color:#f0f4f9;">
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Ticket #</td>
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_ID]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Title</td>
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_TITLE]</td>
                </tr>
                <tr style="background-color:#f9f9f9;">
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Status</td>
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[STATUS]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;width:40%;">Resolution Notes</td>
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;">[CLOSE_NOTES]</td>
                </tr>
              </table>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:15px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color:#0d904f;border-radius:4px;">
                          <a href="[TICKET_URL]" target="_blank" style="display:inline-block;padding:12px 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;background-color:#0d904f;border-radius:4px;">View Your Ticket</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <!-- Note -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#777777;line-height:1.5;font-style:italic;">
                    If you have further questions, simply reply to this email or visit your ticket.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f5f5f5;border-top:1px solid #e0e0e0;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;border-radius:0 0 8px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;">
                    <p style="margin:0 0 8px 0;">Sent by <strong style="color:#666666;">Resolv</strong> IT Service Management</p>
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
      subject: 'New reply on ticket #[TICKET_ID]',
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
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-collapse:collapse;">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#1a73e8;padding:30px 20px;border-radius:8px 8px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:bold;color:#ffffff;">
                    &#128172; New Reply on Ticket #[TICKET_ID]
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background-color:#ffffff;padding:30px 25px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#333333;padding-bottom:15px;">
                    Hello <strong>[USER_NAME]</strong>,
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;padding-bottom:20px;line-height:1.5;">
                    A new reply has been added to your ticket.
                  </td>
                </tr>
              </table>
              <!-- Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e0e0e0;border-radius:4px;margin-bottom:25px;">
                <tr style="background-color:#f0f4f9;">
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;border-bottom:1px solid #e0e0e0;width:40%;">Ticket #</td>
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;border-bottom:1px solid #e0e0e0;">[TICKET_ID]</td>
                </tr>
                <tr style="background-color:#ffffff;">
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#333333;width:40%;">Title</td>
                  <td style="padding:10px 15px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;">[TICKET_TITLE]</td>
                </tr>
              </table>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color:#1a73e8;border-radius:4px;">
                          <a href="[TICKET_URL]" target="_blank" style="display:inline-block;padding:12px 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;background-color:#1a73e8;border-radius:4px;">View Conversation</a>
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
            <td style="background-color:#f5f5f5;border-top:1px solid #e0e0e0;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;border-radius:0 0 8px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;">
                    <p style="margin:0 0 8px 0;">Sent by <strong style="color:#666666;">Resolv</strong> IT Service Management</p>
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
  ];
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
