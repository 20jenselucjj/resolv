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

// Auto-discover all migration files sorted by name for deterministic ordering
const migrationFiles = fs.readdirSync(__dirname)
  .filter(f => f.startsWith('migrate_') && f.endsWith('.sql'))
  .sort();

async function run() {
  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    await pool.query(sql);
    console.log(`✅ Applied: ${file}`);
  }
}

run()
  .then(() => { console.log('✅ All migrations applied successfully'); process.exit(0); })
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
