import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
try {
  const r = await pool.query("SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column')");
  console.log('Trigger function exists:', r.rows[0].exists);
} catch (e) {
  console.error('Error:', e.message);
}
await pool.end();
