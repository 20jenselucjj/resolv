-- Remove built-in script library concept
-- Users can now add their own scripts instead

-- 1. Drop the is_builtin column and its index (safe: IF EXISTS)
DROP INDEX IF EXISTS idx_scripts_builtin;
ALTER TABLE scripts DROP COLUMN IF EXISTS is_builtin;

-- 2. Delete any remaining built-in scripts (seeded data)
-- Note: column is already dropped above, so we delete by known script names instead
DELETE FROM scripts WHERE name IN (
  'Clear Print Spooler', 'Flush DNS Cache', 'Reset Network Adapter', 'Disk Cleanup',
  'System Information', 'Check Disk Health', 'List Running Services', 'Windows Update Check',
  'Repair Windows Image', 'System File Checker', 'Get Installed Updates',
  'Test Internet Connectivity', 'Export System Event Errors', 'Disable Cortana',
  'Enable Remote Desktop', 'Get Active Network Connections', 'Clear Windows Update Cache',
  'Check RAM Details', 'Power Plan Settings', 'Restart Windows Explorer'
);
