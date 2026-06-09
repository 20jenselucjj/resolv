import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/resolv' });
await pool.query('UPDATE agent_versions SET is_latest = false WHERE is_latest = true');
await pool.query(
  'INSERT INTO agent_versions (version, changelog, file_size_bytes, checksum_sha256, rollout_percentage, is_latest, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7)',
  ['1.5.0', 'Test auto-update with spawn detached + log file', 46918085, '8026ba688266ad21edf5cc835ab0bad361a8e3f1ad532dc693fa6a251aa8daa6', 100, true, true]
);
const r = await pool.query('SELECT version, is_latest FROM agent_versions ORDER BY created_at DESC LIMIT 2');
console.log(JSON.stringify(r.rows, null, 2));
await pool.end();
