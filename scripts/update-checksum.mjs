import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/resolv'
});
await pool.query(
  'UPDATE agent_versions SET checksum_sha256 = $1, file_size_bytes = $2 WHERE version = $3',
  ['f961b8f541bb9f7d70e99c22378f97a0e3b59d44995c72a91025e388d2a394f9', '46917733', '1.2.0']
);
const r = await pool.query('SELECT version, checksum_sha256, file_size_bytes FROM agent_versions WHERE version = $1', ['1.2.0']);
console.log('Updated:', r.rows[0]);
await pool.end();
