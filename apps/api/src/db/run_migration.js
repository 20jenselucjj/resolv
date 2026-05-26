const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_xy59wXzbRisn@ep-noisy-cloud-aq1mqml2.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

const sql = fs.readFileSync(path.join(__dirname, 'migrate_users_sessions.sql'), 'utf8');

pool.query(sql)
  .then(() => { console.log('✅ Migration applied successfully'); process.exit(0); })
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
