import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

try {
  const res = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position"
  );
  console.log('Users table columns:');
  res.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));
  await pool.end();
} catch (e) {
  console.error(e);
  await pool.end();
}
