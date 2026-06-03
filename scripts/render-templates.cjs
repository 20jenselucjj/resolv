// Render all email templates with sample data to rendered-templates/
const { loadTemplates, findTemplate, interpolateSubject, interpolateBody } = require('../apps/api/src/services/email-template-engine');
const fs = require('fs');
const path = require('path');

const sampleVars = {
  ticket_id: 52,
  ticket_title: 'Computer is in a bootloop',
  user_name: 'Lucas Jensen',
  agent_name: 'Lucas Jensen',
  ticket_url: 'http://localhost:3000/dashboard/tickets/abc-123',
  priority: 'P2 - High',
  priority_color: '#f59e0b',
  status: 'In Progress',
  status_color: '#7c3aed',
  requestor_name: 'Lucas',
  assigned_to_name: 'Lucas Jensen',
  created_at: '06/03/2026, 01:26 PM',
  due_date: '06/04/2026, 01:26 PM',
  category: 'Hardware',
  ticket_type: 'Incident',
  description: 'Computer keeps restarting in a continuous loop after Windows update.',
  close_notes: 'Issue resolved. Reverted problematic Windows update.',
  comment_body: 'I have checked the system logs and found the issue. Working on a fix now.',
  sla_threshold: 90,
  time_remaining: '2 hours',
  escalation_reason: 'Ticket has exceeded initial response SLA.',
  time_overdue: '1 hour 15 minutes',
  resolved_at: '06/03/2026, 02:00 PM',
  previous_assignee: 'None',
  survey_url_1: '#', survey_url_2: '#', survey_url_3: '#', survey_url_4: '#', survey_url_5: '#',
};

const footer = '<hr><p style="font-family:sans-serif;font-size:12px;color:#999;">---<br>This email was sent by <strong>Resolv</strong> IT Service Management</p>';

async function main() {
  const templates = await loadTemplates();
  const names = templates.map(function(t) { return t.name; });
  const outDir = path.join(__dirname, '..', 'rendered-templates');

  for (const name of names) {
    const tmpl = findTemplate(templates, name);
    if (!tmpl) continue;
    const subject = interpolateSubject(tmpl.subject, sampleVars);
    const body = interpolateBody(tmpl.body, sampleVars);
    const fullHtml = body + '\n' + footer;
    const safeName = name.replace(/[^a-z0-9]/gi, '_');
    fs.writeFileSync(path.join(outDir, safeName + '.html'), fullHtml, 'utf-8');
    console.log('Rendered: rendered-templates/' + safeName + '.html');
  }

  console.log('\n--- Source files (with [VARIABLE] placeholders, copy into admin editor) ---\n');

  for (const name of names) {
    const tmpl = findTemplate(templates, name);
    if (!tmpl) continue;
    const safeName = name.replace(/[^a-z0-9]/gi, '_');
    const sourceContent = 'Subject: ' + tmpl.subject + '\n\n' + tmpl.body;
    fs.writeFileSync(path.join(outDir, safeName + '_source.html'), sourceContent, 'utf-8');
    console.log('rendered-templates/' + safeName + '_source.html');
  }
}

main().catch(console.error);
