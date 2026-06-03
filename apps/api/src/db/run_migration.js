const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
});

const sql = fs.readFileSync(path.join(__dirname, 'migrate_users_sessions.sql'), 'utf8');
const emailSql = fs.readFileSync(path.join(__dirname, 'migrate_email.sql'), 'utf8');
const ticketDefaultsSql = fs.readFileSync(path.join(__dirname, 'migrate_ticket_defaults.sql'), 'utf8');
const autoReplySql = fs.readFileSync(path.join(__dirname, 'migrate_auto_reply.sql'), 'utf8');
const aiConfigSql = fs.readFileSync(path.join(__dirname, 'migrate_ai_config.sql'), 'utf8');
const aiGuidelinesSql = fs.readFileSync(path.join(__dirname, 'migrate_ai_guidelines.sql'), 'utf8');
const portalToolsSql = fs.readFileSync(path.join(__dirname, 'migrate_portal_tools.sql'), 'utf8');
const passwordResetSql = fs.readFileSync(path.join(__dirname, 'migrate_password_reset.sql'), 'utf8');
const notificationsV2Sql = fs.readFileSync(path.join(__dirname, 'migrate_notifications_v2.sql'), 'utf8');
const knowledgeScopeSql = fs.readFileSync(path.join(__dirname, 'migrate_knowledge_scope.sql'), 'utf8');
const assetGroupDefaultsSql = fs.readFileSync(path.join(__dirname, 'migrate_asset_group_defaults.sql'), 'utf8');

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
  await pool.query(aiGuidelinesSql);
  console.log('AI guidelines migration applied');
  await pool.query(portalToolsSql);
  console.log('Portal tools migration applied');
  await pool.query(passwordResetSql);
  console.log('Password reset migration applied');
  await pool.query(notificationsV2Sql);
  console.log('Notifications v2 migration applied');
  await pool.query(knowledgeScopeSql);
  console.log('Knowledge scope migration applied');
  await pool.query(assetGroupDefaultsSql);
  console.log('Asset group defaults migration applied');
}

run()
  .then(() => { console.log('✅ All migrations applied successfully'); process.exit(0); })
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
