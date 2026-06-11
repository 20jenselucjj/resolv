-- migrate_remove_legacy_tables.sql
-- Drops tables superseded by newer implementations:

-- 1. automation_rules — legacy, never executed at runtime (visual workflows replace it)
DROP TABLE IF EXISTS automation_rules CASCADE;

-- 2. ticket_workflows — legacy status transitions (Workflow Designer replaces it)
DROP TABLE IF EXISTS ticket_workflows CASCADE;
