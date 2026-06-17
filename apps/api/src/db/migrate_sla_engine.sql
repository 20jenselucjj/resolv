-- migrate_sla_engine.sql
-- SLA calculation engine support:
--   1. Add sla_breached_at column to tickets (for breach timing)
--   2. Add sla_policy_id index hint for the breach detection query
--   3. Add sla_breached + sla_breached_at composite index

-- 1. sla_breached_at: when the ticket was first marked as breached
DO $$ BEGIN
  ALTER TABLE tickets ADD COLUMN sla_breached_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Composite index for breach detection queries (status + sla_breached + sla_policy_id)
CREATE INDEX IF NOT EXISTS idx_tickets_sla_breach_scan
  ON tickets(status, sla_breached, sla_policy_id)
  WHERE sla_policy_id IS NOT NULL;

-- 3. Index for breached tickets listing
CREATE INDEX IF NOT EXISTS idx_tickets_sla_breached_at
  ON tickets(sla_breached_at DESC NULLS LAST)
  WHERE sla_breached = true;
