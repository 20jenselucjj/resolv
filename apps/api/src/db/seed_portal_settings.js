const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/resolv' });

const settings = [
  ['portal_section_header', 'Report an Issue or Request Service'],
  ['portal_section_description', "Can't find what you need? Submit a support request and our team will help you."],
  ['portal_button_text', 'Get Help'],
  ['portal_success_title', 'Ticket submitted!'],
  ['portal_success_subtitle', "We'll follow up based on your urgency."],
  ['portal_tickets_header', 'My Tickets'],
  ['portal_no_tickets_text', 'No open requests.'],
  ['portal_chat_header', 'Resolv AI'],
  ['portal_chat_subtitle', 'Always here to help'],
  ['portal_chat_empty_title', 'Ask me anything'],
  ['portal_chat_empty_description', 'I can help you troubleshoot issues, find answers, or submit a ticket on your behalf.'],
  ['portal_chip_1_label', 'My computer is slow'],
  ['portal_chip_1_prompt', 'My computer is running slowly, can you help me troubleshoot?'],
  ['portal_chip_2_label', 'I need VPN access'],
  ['portal_chip_2_prompt', 'I need help getting VPN access or troubleshooting my VPN connection.'],
  ['portal_chip_3_label', 'Reset my password'],
  ['portal_chip_3_prompt', 'I need to reset my password for a system or account.'],
  ['portal_chip_4_label', 'Track my ticket'],
  ['portal_chip_4_prompt', 'I want to check the status of my existing ticket.'],
  ['portal_input_placeholder', 'Drop files here or message Resolv AI...'],
  ['portal_input_hint', 'Enter to send \u00b7 Shift+Enter for new line'],
  ['portal_kb_header', 'Knowledge Base'],
  ['portal_all_clear_text', 'All clear!'],
  ['portal_no_articles_text', 'No articles found.'],
];

async function seed() {
  for (const [key, value] of settings) {
    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value]
    );
  }
  const { rows } = await pool.query("SELECT COUNT(*) as cnt FROM system_settings WHERE key LIKE 'portal_%'");
  console.log('Portal settings in DB:', rows[0].cnt);
  await pool.end();
}

seed().catch(e => { console.error(e); process.exit(1); });
