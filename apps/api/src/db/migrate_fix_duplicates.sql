-- ============================================================================
-- Resolv Database Fix Migration
-- Fixes: duplicate seed data in catalog_categories and ticket_classification_rules
-- caused by missing unique constraints + ON CONFLICT DO NOTHING
-- ============================================================================

-- ─── 1. Fix catalog_categories ──────────────────────────────────────────────

-- Remove duplicates (keep only the first entry for each name)
DELETE FROM catalog_categories
WHERE id NOT IN (
  SELECT (array_agg(id ORDER BY id))[1]
  FROM catalog_categories
  GROUP BY name
);

-- Add unique constraint to prevent future duplicates (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'catalog_categories_name_key'
  ) THEN
    ALTER TABLE catalog_categories ADD CONSTRAINT catalog_categories_name_key UNIQUE (name);
  END IF;
END $$;

-- ─── 2. Fix ticket_classification_rules ─────────────────────────────────────

-- Remove duplicates (keep only the first entry for each name)
DELETE FROM ticket_classification_rules
WHERE id NOT IN (
  SELECT (array_agg(id ORDER BY id))[1]
  FROM ticket_classification_rules
  GROUP BY name
);

-- Add unique constraint to prevent future duplicates (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ticket_classification_rules_name_key'
  ) THEN
    ALTER TABLE ticket_classification_rules ADD CONSTRAINT ticket_classification_rules_name_key UNIQUE (name);
  END IF;
END $$;
