-- Asset Group Defaults & Auto-Join Rules
-- Adds default fields that propagate to assets when assigned to a group,
-- plus auto-join rules for automatic asset routing based on asset properties.

DO $$ BEGIN
  ALTER TABLE asset_groups ADD COLUMN default_department VARCHAR(100);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE asset_groups ADD COLUMN default_company VARCHAR(255);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE asset_groups ADD COLUMN default_assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE asset_groups ADD COLUMN auto_join_rules JSONB NOT NULL DEFAULT '[]';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE asset_groups ADD COLUMN auto_join_enabled BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
