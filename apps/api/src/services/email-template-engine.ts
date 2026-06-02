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
      body: 'Hello [USER_NAME],\n\nWe have received your request (#[TICKET_ID]: [TICKET_TITLE]). Our team will review it shortly.\n\nYou can view your ticket at: [TICKET_URL]\n\nBest,\nSupport Team',
    },
    {
      id: '2',
      name: 'Ticket Assigned',
      subject: 'Ticket #[TICKET_ID] has been assigned to [AGENT_NAME]',
      body: 'Hello [USER_NAME],\n\nYour ticket #[TICKET_ID]: [TICKET_TITLE] has been assigned to [AGENT_NAME] and is being reviewed.\n\nView your ticket: [TICKET_URL]\n\nBest,\nSupport Team',
    },
    {
      id: '4',
      name: 'Ticket Resolved',
      subject: 'Your ticket #[TICKET_ID] has been resolved',
      body: 'Hello [USER_NAME],\n\nWe consider ticket #[TICKET_ID]: [TICKET_TITLE] resolved.\n\nClose notes: [CLOSE_NOTES]\n\nIf you have any further questions, please reply to this email or visit: [TICKET_URL]\n\nBest,\nSupport Team',
    },
    {
      id: '5',
      name: 'Comment Added',
      subject: 'New reply on ticket #[TICKET_ID]',
      body: 'Hello [USER_NAME],\n\nA new reply has been added to your ticket #[TICKET_ID]: [TICKET_TITLE].\n\nView updates: [TICKET_URL]\n\nBest,\nSupport Team',
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
