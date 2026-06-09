/**
 * Creates an admin user for the demo deployment.
 * Reads DATABASE_URL from .env, EMAIL and PASSWORD from env vars.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error('❌ ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required');
  console.error('   Usage: $env:ADMIN_EMAIL="user@example.com"; $env:ADMIN_PASSWORD="pass"; node setup-admin.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
});

async function main() {
  try {
    // Check if user already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log(`⚠️  Admin user ${email} already exists (id: ${existing.rows[0].id})`);
      await pool.end();
      process.exit(0);
    }

    // Generate bcrypt hash
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert admin user
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, department)
       VALUES ($1, $2, $3, 'admin', 'IT')
       RETURNING id, email, role`,
      [email.split('@')[0], email, passwordHash]
    );

    const user = result.rows[0];
    console.log(`✅ Admin user created: ${user.email} (id: ${user.id}, role: ${user.role})`);

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to create admin user:', err.message);
    await pool.end();
    process.exit(1);
  }
}

main();
