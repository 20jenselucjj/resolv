-- Migration: Add default_gateway column to assets table
-- The agent now collects default gateway via si.networkGatewayDefault()

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='assets' AND column_name='default_gateway'
  ) THEN
    ALTER TABLE assets ADD COLUMN default_gateway VARCHAR(45);
  END IF;
END $$;
