import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

const tables = ['configuration_items', 'ci_relationships', 'webhook_configs', 'webhook_deliveries', 
  'major_incidents', 'major_incident_timeline', 'time_entries', 'releases', 'release_changes'];

for (const t of tables) {
  const r = await pool.query(
    "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = $1)", [t]
  );
  const exists = r.rows[0].exists;
  if (exists) {
    const cols = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position", [t]
    );
    console.log(`\n${t} (EXISTS):`);
    cols.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));
  } else {
    console.log(`\n${t}: MISSING`);
  }
}
await pool.end();
