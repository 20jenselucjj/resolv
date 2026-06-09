import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/resolv' });
// Unset current latest
await pool.query('UPDATE agent_versions SET is_latest = false WHERE is_latest = true');
// Insert v1.4.0
await pool.query(
  'INSERT INTO agent_versions (version, changelog, file_size_bytes, checksum_sha256, rollout_percentage, is_latest, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7)',
  ['1.4.0', 'Test auto-update with timeout fix', 46917733, 'a398087dc6f8bf24ab8107c9a12f093fa44280b6fc3f1cc682511e0a51f2461b', 100, true, true]
);
const r = await pool.query('SELECT version, is_latest FROM agent_versions ORDER BY created_at DESC LIMIT 2');
console.log(JSON.stringify(r.rows, null, 2));
await pool.end();
