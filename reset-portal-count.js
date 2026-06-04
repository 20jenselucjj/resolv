const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/resolv' });

(async () => {
  await pool.query("UPDATE users SET messages_sent_today = 0, last_message_date = NULL WHERE email = 'lisa.garcia@company.com'");
  console.log('Reset message count for lisa.garcia@company.com');
  process.exit(0);
})();
