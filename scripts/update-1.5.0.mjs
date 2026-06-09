import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/resolv' });
await pool.query('UPDATE agent_versions SET checksum_sha256 = $1, file_size_bytes = $2 WHERE version = $3',
  ['f9fda76597dcd093f3d59d8bae69fa5761cb51c551aaa3400cdd214e3b8aa454', '46918069', '1.5.0']);
await pool.query('UPDATE agent_versions SET is_latest = true WHERE version = $1', ['1.5.0']);
await pool.query('UPDATE agent_versions SET is_latest = false WHERE version = $1', ['1.4.0']);
const r = await pool.query('SELECT version, is_latest FROM agent_versions ORDER BY created_at DESC LIMIT 2');
console.log(JSON.stringify(r.rows, null, 2));
await pool.end();
