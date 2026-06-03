// Standalone template renderer — no DB connection needed
// Renders all 9 default email templates with sample data to rendered-templates/
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

function interpolate(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `[${key.toUpperCase()}]`;
    result = result.replaceAll(placeholder, value != null ? String(value) : '');
  }
  return result;
}

const footer = '<hr><p style="font-family:sans-serif;font-size:12px;color:#999;">---<br>This email was sent by <strong>Resolv</strong> IT Service Management</p>';

// ─── Templates extracted from email-template-engine.ts ───
// Each template: { name, subject, body }
// [Template bodies are referenced from the source file]
// We load them via require of the database-less default function

const pathToEngine = path.join(__dirname, '..', 'apps', 'api', 'src', 'services', 'email-template-engine.ts');

async function main() {
  // Use a dynamic require that ts-node-dev handles
  const engine = require(pathToEngine);
  
  const outDir = path.join(__dirname, '..', 'rendered-templates');
  
  // The getDefaultTemplates isn't exported, but loadTemplates falls back to it
  // If no DB, we need another approach
  
  // Instead, let's manually extract by reading the file
  console.log('Reading template source file...');
  const source = fs.readFileSync(pathToEngine, 'utf-8');
  
  // Find all template definitions using regex
  const templateRegex = /name:\s*'([^']+)',\s*\n\s*subject:\s*'([^']+)',\s*\n\s*body:\s*`([\s\S]*?)`\s*,/g;
  let match;
  let count = 0;
  
  while ((match = templateRegex.exec(source)) !== null) {
    const name = match[1];
    const subject = match[2];
    let body = match[3];
    
    // Fix escaped characters in the template body
    body = body.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    body = body.replace(/\\n/g, '\n');
    body = body.replace(/\\t/g, '\t');
    
    const renderedSubject = interpolate(subject, sampleVars);
    const renderedBody = interpolate(body, sampleVars);
    
    const safeName = name.replace(/[^a-z0-9]/gi, '_');
    
    // Rendered output (with sample values)
    const fullHtml = renderedBody + '\n' + footer;
    fs.writeFileSync(path.join(outDir, safeName + '.html'), fullHtml, 'utf-8');
    console.log('Rendered: rendered-templates/' + safeName + '.html');
    
    // Source output (with [PLACEHOLDER] variables)
    const sourceContent = 'Subject: ' + subject + '\n\n' + body;
    fs.writeFileSync(path.join(outDir, safeName + '_source.html'), sourceContent, 'utf-8');
    console.log('Source:   rendered-templates/' + safeName + '_source.html  ← copy this into admin editor');
    
    count++;
  }
  
  console.log('\n' + count + ' templates written to rendered-templates/');
  console.log('Open the .html files in a browser to see the rendered emails.');
  console.log('Use the _source.html files to copy template source into the admin portal editor.');
}

main().catch(console.error);
