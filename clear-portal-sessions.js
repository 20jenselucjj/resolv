const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/resolv' });

(async () => {
  // Get Lisa's user ID
  const { rows: users } = await pool.query("SELECT id FROM users WHERE email = 'lisa.garcia@company.com'");
  if (users.length === 0) { console.log('User not found'); process.exit(1); }
  const userId = users[0].id;
  
  // Delete all AI messages and sessions for this user
  const { rows: sessions } = await pool.query('SELECT id FROM ai_sessions WHERE user_id = $1', [userId]);
  const sessionIds = sessions.map(s => s.id);
  
  if (sessionIds.length > 0) {
    await pool.query('DELETE FROM ai_messages WHERE session_id = ANY($1)', [sessionIds]);
    await pool.query('DELETE FROM ai_sessions WHERE user_id = $1', [userId]);
    console.log(`Cleared ${sessionIds.length} sessions and their messages for Lisa Garcia`);
  } else {
    console.log('No sessions to clear');
  }
  
  process.exit(0);
})();
