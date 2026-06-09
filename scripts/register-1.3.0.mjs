import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/resolv' });
// Update v1.3.0 checksum
await pool.query('UPDATE agent_versions SET checksum_sha256 = $1, file_size_bytes = $2, is_latest = true WHERE version = $3',
  ['d78de5b87a5cbdc11c3f8eaed43027fc0dfb7f07224aa4f5783fb072beb6469c', '46917749', '1.3.0']);
// Make sure v1.2.0 is not latest
await pool.query('UPDATE agent_versions SET is_latest = false WHERE version = $1', ['1.2.0']);
const r = await pool.query('SELECT version, is_latest, checksum_sha256 FROM agent_versions ORDER BY created_at DESC LIMIT 2');
console.log(JSON.stringify(r.rows, null, 2));
await pool.end();
