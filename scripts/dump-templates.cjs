// Extract and render all 9 default email templates
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'rendered-templates');
const enginePath = path.join(__dirname, '..', 'apps', 'api', 'src', 'services', 'email-template-engine.ts');
const source = fs.readFileSync(enginePath, 'utf-8');

// ─── Parse templates from source ───
const lines = source.split('\n');
let currentName = null;
let currentSubject = null;
let inBody = false;
let bodyLines = [];
let templates = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  const nameMatch = line.match(/^\s*name:\s*'([^']+)',?\s*$/);
  if (nameMatch) { currentName = nameMatch[1]; continue; }
  
  const subjectMatch = line.match(/^\s*subject:\s*'([^']+)',?\s*$/);
  if (subjectMatch && currentName) { currentSubject = subjectMatch[1]; continue; }
  
  const bodyStartMatch = line.match(/^\s*body:\s*`(.*)/);
  if (bodyStartMatch && currentName) {
    inBody = true;
    bodyLines = [bodyStartMatch[1]];
    continue;
  }
  
  if (inBody) {
    if (line.trimEnd().endsWith('`,')) {
      bodyLines.push(line.replace(/`,\s*$/, ''));
      inBody = false;
      // Decode unicode escapes
      const body = bodyLines.join('\n').replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
      const subject = currentSubject.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
      templates.push({ name: currentName, subject, body });
      currentName = null;
      currentSubject = null;
      bodyLines = [];
    } else {
      bodyLines.push(line);
    }
  }
}

// ─── Sample data for rendering ───
const sample = {
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

function interpolate(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`[${key.toUpperCase()}]`, value != null ? String(value) : '');
  }
  return result;
}

const footer = '\n\n---\n<hr><p style="font-family:sans-serif;font-size:12px;color:#999;">This email was sent by <strong>Resolv</strong> IT Service Management</p>';

// ─── Write files ───
for (const tpl of templates) {
  const safeName = tpl.name.replace(/[^a-z0-9]/gi, '_');

  // 1. Source file (with [PLACEHOLDER] variables — copy this into admin editor)
  const sourceContent = 'Subject: ' + tpl.subject + '\n\n' + tpl.body;
  fs.writeFileSync(path.join(outDir, safeName + '_source.html'), sourceContent, 'utf-8');
  console.log('Source:    rendered-templates/' + safeName + '_source.html  (copy into admin editor)');

  // 2. Rendered file (with real sample values — open in browser to preview)
  const renderedSubject = interpolate(tpl.subject, sample);
  const renderedBody = interpolate(tpl.body, sample);
  const fullHtml = '<h2 style="font-family:sans-serif;">Rendered: ' + tpl.name + '</h2>'
    + '<p style="font-family:sans-serif;font-size:13px;color:#666;">Subject: <strong>' + renderedSubject + '</strong></p><hr>'
    + renderedBody + footer;
  fs.writeFileSync(path.join(outDir, safeName + '_rendered.html'), fullHtml, 'utf-8');
  console.log('Rendered:  rendered-templates/' + safeName + '_rendered.html  (open in browser)');
}

console.log('\n--- All ' + templates.length + ' templates written to rendered-templates/ ---');
console.log('Use _source.html files to copy template source into the admin portal editor.');
console.log('Open _rendered.html files in a browser to see the actual email layout.');

// Also note about auto-reply
console.log('\n--- Auto Replies ---');
console.log('Auto-reply rules are managed via Dashboard > Admin > Email > Auto Replies tab.');
console.log('They are user-created rules stored in the database — not static HTML templates.');
console.log('Each rule has its own subject/body with [VARIABLE] placeholders.');
