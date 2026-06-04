const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/resolv' });

(async () => {
  // Get Lisa's user ID
  const { rows: users } = await pool.query("SELECT id FROM users WHERE email = 'lisa.garcia@company.com'");
  if (users.length === 0) { console.log('User not found'); process.exit(1); }
  const userId = users[0].id;
  
  // Get her sessions
  const { rows: sessions } = await pool.query('SELECT id, title FROM ai_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 3', [userId]);
  
  for (const session of sessions) {
    console.log(`\n=== Session: ${session.id} ===`);
    console.log(`Title: ${session.title}`);
    
    // Get messages for this session
    const { rows: messages } = await pool.query(
      'SELECT role, content, tool_calls, created_at FROM ai_messages WHERE session_id = $1 ORDER BY created_at',
      [session.id]
    );
    
    console.log(`Messages: ${messages.length}`);
    messages.forEach((m, i) => {
      const contentPreview = m.content ? m.content.substring(0, 100) : '(empty)';
      const hasToolCalls = m.tool_calls ? 'yes' : 'no';
      console.log(`  [${i}] ${m.role} | content: ${contentPreview} | tool_calls: ${hasToolCalls}`);
    });
  }
  
  process.exit(0);
})();
