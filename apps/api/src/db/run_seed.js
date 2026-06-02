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

const sql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');

pool.query(sql)
  .then(() => { console.log('✅ Seed data applied successfully'); process.exit(0); })
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
