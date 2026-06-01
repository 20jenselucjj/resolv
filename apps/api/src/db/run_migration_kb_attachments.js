const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/resolv',
});

const sql = fs.readFileSync(path.join(__dirname, 'migrate_knowledge_attachments.sql'), 'utf8');

pool.query(sql)
  .then(() => { console.log('✅ Knowledge attachments migration applied successfully'); process.exit(0); })
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
