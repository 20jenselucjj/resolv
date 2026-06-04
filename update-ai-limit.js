const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/resolv' });

(async () => {
  await pool.query("UPDATE ai_config SET max_messages_per_day = 500");
  console.log('Updated max_messages_per_day to 500');
  process.exit(0);
})();
