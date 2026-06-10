-- Migration: Add owner_name to assets table
-- Adds a free-text owner field for asset ownership tracking

DO $$ BEGIN
  ALTER TABLE assets ADD COLUMN owner_name VARCHAR(255);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
