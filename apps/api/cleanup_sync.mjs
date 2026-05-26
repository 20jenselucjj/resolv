import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const ADMIN_EMAIL = '20jenselucjj@gmail.com';

try {
  // 1. Find admin user
  const adminRes = await pool.query("SELECT id FROM users WHERE email = $1", [ADMIN_EMAIL]);
  if (adminRes.rows.length === 0) {
    console.error('Admin user not found!');
    process.exit(1);
  }
  const adminId = adminRes.rows[0].id;
  console.log(`✓ Found admin: ${ADMIN_EMAIL} (${adminId})`);

  // 2. Fix corrupted user names (stored as JSON objects instead of strings)
  // Extract fullName or displayName from the JSON string using regex
  const fixNames = await pool.query(
    `UPDATE users SET name = 
      COALESCE(
        NULLIF(SUBSTRING(name FROM '"fullName":"([^"]+)"'), ''),
        NULLIF(SUBSTRING(name FROM '"displayName":"([^"]+)"'), ''),
        SUBSTRING(name FROM '"givenName":"([^"]+)"') || ' ' || SUBSTRING(name FROM '"familyName":"([^"]+)"')
      )
     WHERE name LIKE '{%'`
  );
  if (fixNames.rowCount > 0) {
    console.log(`✓ Fixed ${fixNames.rowCount} corrupted user names`);
  } else {
    console.log(`! No corrupted names found`);
  }

  // 3. Update stored directory_sync_config to fix field mapping
  const configRes = await pool.query("SELECT value FROM system_settings WHERE key = 'directory_sync_config'");
  if (configRes.rows.length > 0) {
    let config = JSON.parse(configRes.rows[0].value);
    if (config.fieldMapping && config.fieldMapping.name === 'name') {
      config.fieldMapping.name = 'name.fullName';
      config.enabled = false; // Also disable sync
      await pool.query(
        "INSERT INTO system_settings (key, value, updated_at) VALUES ('directory_sync_config', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()",
        [JSON.stringify(config)]
      );
      console.log('✓ Updated field mapping and disabled sync in stored config');
    } else {
      console.log('! Config field mapping already correct or not found');
      // Still ensure it's disabled
      config.enabled = false;
      await pool.query(
        "INSERT INTO system_settings (key, value, updated_at) VALUES ('directory_sync_config', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()",
        [JSON.stringify(config)]
      );
      console.log('✓ Sync disabled in config');
    }
  }

  // 4. Delete all users except admin (reassign their references first)
  const otherUsers = await pool.query("SELECT id, email FROM users WHERE email != $1", [ADMIN_EMAIL]);
  console.log(`\nFound ${otherUsers.rows.length} users to delete:`);
  otherUsers.rows.forEach(u => console.log(`  ${u.email} (${u.id})`));

  if (otherUsers.rows.length > 0) {
    const otherIds = otherUsers.rows.map(r => r.id);

    // Reassign tickets from deleted users to admin
    const reassignTickets = await pool.query(
      "UPDATE tickets SET created_by_id = $1 WHERE created_by_id = ANY($2::uuid[])",
      [adminId, otherIds]
    );
    console.log(`✓ Reassigned ${reassignTickets.rowCount} tickets to admin`);

    const reassignAssigned = await pool.query(
      "UPDATE tickets SET assigned_to_id = NULL WHERE assigned_to_id = ANY($1::uuid[])",
      [otherIds]
    );
    console.log(`✓ Unassigned ${reassignAssigned.rowCount} tickets`);

    // Delete notifications for other users
    const delNotifs = await pool.query(
      "DELETE FROM notifications WHERE user_id = ANY($1::uuid[])",
      [otherIds]
    );
    console.log(`✓ Deleted ${delNotifs.rowCount} notifications`);

    // Delete AI sessions
    const delSessions = await pool.query(
      "DELETE FROM ai_sessions WHERE user_id = ANY($1::uuid[])",
      [otherIds]
    );
    console.log(`✓ Deleted ${delSessions.rowCount} AI sessions`);

    // Now delete the users
    const delUsers = await pool.query(
      "DELETE FROM users WHERE email != $1",
      [ADMIN_EMAIL]
    );
    console.log(`✓ Deleted ${delUsers.rowCount} users`);
  } else {
    console.log('! No other users to delete');
  }

  console.log('\n✅ All done. Sync is disabled (enabled: false), users cleaned up.');
  await pool.end();
} catch (e) {
  console.error('Error:', e);
  await pool.end();
  process.exit(1);
}
