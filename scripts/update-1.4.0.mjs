import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/resolv' });
await pool.query('UPDATE agent_versions SET checksum_sha256 = $1, file_size_bytes = $2 WHERE version = $3',
  ['b9626d5b65a8c4210b53a676819ee7787ac2763e5b7fa07f37bd3d8a1b1bd10a', '46918101', '1.4.0']);
await pool.query('UPDATE agent_versions SET is_latest = true WHERE version = $1', ['1.4.0']);
const r = await pool.query('SELECT version, is_latest, checksum_sha256 FROM agent_versions ORDER BY created_at DESC LIMIT 2');
console.log(JSON.stringify(r.rows, null, 2));
await pool.end();
