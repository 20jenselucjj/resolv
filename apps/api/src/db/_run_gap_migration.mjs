import { readFileSync } from 'fs';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const sql = readFileSync(new URL('migrate_critical_gaps.sql', import.meta.url), 'utf8');

try {
  await pool.query(sql);
  console.log('✅ Migration applied successfully');
} catch (e) {
  console.error('❌ Error:', e.message);
  process.exit(1);
}
await pool.end();
