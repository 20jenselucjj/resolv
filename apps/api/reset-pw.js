const bcrypt = require('bcrypt');
const pg = require('pg');

async function main() {
  const pw = 'TempPass2026!';
  const hash = await bcrypt.hash(pw, 12);
  console.log('Password:', pw);
  
  const pool = new pg.Pool({ connectionString: 'postgresql://postgres:password@localhost:5432/resolv' });
  const result = await pool.query(
    "UPDATE users SET password_hash = $1, password_reset_required = true WHERE LOWER(email) = LOWER('20jenselucjj@gmail.com')",
    [hash]
  );
  console.log('Updated rows:', result.rowCount);
  await pool.end();
}

main().catch(console.error);
