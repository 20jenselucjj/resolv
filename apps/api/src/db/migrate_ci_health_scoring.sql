-- CI Health Scoring & Baselines
-- Adds health scoring columns to configuration_items,
-- adds version/last_seen fields for scoring criteria,
-- and creates the ci_baselines table.

-- Add columns needed for health scoring
DO $$ BEGIN
  ALTER TABLE configuration_items ADD COLUMN IF NOT EXISTS version VARCHAR(100) DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE configuration_items ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE configuration_items ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE configuration_items ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'unknown';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE configuration_items ADD COLUMN IF NOT EXISTS last_assessed_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE configuration_items ADD COLUMN IF NOT EXISTS baseline_snapshot JSONB DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE configuration_items ADD COLUMN IF NOT EXISTS last_baseline_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Create ci_baselines table
CREATE TABLE IF NOT EXISTS ci_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ci_id UUID NOT NULL REFERENCES configuration_items(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_ci_baselines_ci ON ci_baselines(ci_id, created_at DESC);
