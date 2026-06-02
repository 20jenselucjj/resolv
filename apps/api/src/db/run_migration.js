const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_xy59wXzbRisn@ep-noisy-cloud-aq1mqml2.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

const sql = fs.readFileSync(path.join(__dirname, 'migrate_users_sessions.sql'), 'utf8');
const emailSql = fs.readFileSync(path.join(__dirname, 'migrate_email.sql'), 'utf8');
const ticketDefaultsSql = fs.readFileSync(path.join(__dirname, 'migrate_ticket_defaults.sql'), 'utf8');
const autoReplySql = fs.readFileSync(path.join(__dirname, 'migrate_auto_reply.sql'), 'utf8');
const aiConfigSql = fs.readFileSync(path.join(__dirname, 'migrate_ai_config.sql'), 'utf8');

async function run() {
  await pool.query(sql);
  console.log('Users/sessions migration applied');
  await pool.query(emailSql);
  console.log('Email migration applied');
  await pool.query(ticketDefaultsSql);
  console.log('Ticket defaults migration applied');
  await pool.query(autoReplySql);
  console.log('Auto-reply migration applied');
  await pool.query(aiConfigSql);
  console.log('AI config migration applied');
}

run()
  .then(() => { console.log('✅ All migrations applied successfully'); process.exit(0); })
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
