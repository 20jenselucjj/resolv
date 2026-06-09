-- Remove built-in script library concept
-- Users can now add their own scripts instead

-- 1. Delete all built-in scripts (seeded data)
DELETE FROM scripts WHERE is_builtin = true;

-- 2. Drop the is_builtin column and its index
DROP INDEX IF EXISTS idx_scripts_builtin;
ALTER TABLE scripts DROP COLUMN IF EXISTS is_builtin;
