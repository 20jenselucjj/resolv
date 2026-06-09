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

console.log('🚀 Loading demo seed data...\n');

const sql = fs.readFileSync(path.join(__dirname, 'demo_seed.sql'), 'utf8');

pool.query(sql)
  .then(() => {
    console.log('✅ Demo seed data applied successfully');
    console.log('   You can now log in with any existing user (Password123!)');
    console.log('   and see all demo tickets, assets, knowledge, AI data, etc.');
    process.exit(0);
  })
  .catch(e => {
    console.error('❌ Error:', e.message);
    if (e.position) {
      const lines = sql.substring(0, e.position).split('\n');
      console.error(`   Near line ${lines.length}: ${lines[lines.length - 1]?.substring(0, 100)}`);
    }
    process.exit(1);
  });
