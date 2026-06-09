// Register v1.2.0 agent version in the database for auto-update
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/resolv'
});

async function main() {
  // Check if already registered
  const existing = await pool.query(
    `SELECT version, is_latest, is_active FROM agent_versions ORDER BY created_at DESC`
  );
  console.log('Existing versions:', JSON.stringify(existing.rows, null, 2));

  const alreadyHas120 = existing.rows.some(r => r.version === '1.2.0');
  if (alreadyHas120) {
    console.log('v1.2.0 already registered. Setting as latest...');
    await pool.query(`UPDATE agent_versions SET is_latest = false WHERE is_latest = true`);
    await pool.query(`UPDATE agent_versions SET is_latest = true, is_active = true WHERE version = '1.2.0'`);
    console.log('v1.2.0 set as latest.');
  } else {
    console.log('Registering v1.2.0...');
    // Unset any existing latest
    await pool.query(`UPDATE agent_versions SET is_latest = false WHERE is_latest = true`);
    
    const result = await pool.query(`
      INSERT INTO agent_versions (version, changelog, file_size_bytes, checksum_sha256, rollout_percentage, is_latest, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      '1.2.0',
      'Fixed: cycle count WMI query (ROOT/WMI BatteryCycleCount), collect_logs pipeline (no semicolons before pipes), encryption Protection Off substring bug, network adapter subnet/gateway storage',
      46918005,
      '1B96283293AFEA9581EC5748DD4C75D8A92730D3365E0CAD51EBA33077752AEF',
      100,
      true,
      true
    ]);
    console.log('Registered:', result.rows[0].version, '- latest:', result.rows[0].is_latest);
  }

  await pool.end();
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
