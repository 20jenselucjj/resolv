import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/resolv' });

// Insert v1.6.0
await pool.query(
  `INSERT INTO agent_versions (version, checksum_sha256, file_size_bytes, is_latest) VALUES ($1, $2, $3, $4)`,
  ['1.6.0', 'ad3d93492936e948091487425aaffa318325c7bab2e19e097bec22706ac0768e', '46918053', true]
);

// Demote v1.5.0
await pool.query(`UPDATE agent_versions SET is_latest = false WHERE version = $1`, ['1.5.0']);

// Verify
const r = await pool.query('SELECT version, is_latest, checksum_sha256 FROM agent_versions WHERE version LIKE $1 ORDER BY created_at DESC LIMIT 3', ['1.%']);
r.rows.forEach(row => console.log(JSON.stringify(row)));

await pool.end();
