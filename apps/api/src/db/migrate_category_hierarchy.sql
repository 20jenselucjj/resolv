-- Category Hierarchy Migration
-- Adds parent_id for self-referencing tree structure
-- Changes unique constraint from (name) to (parent_id, name)
-- Adds sort_order for display ordering
-- Adds indices for tree query performance

-- Add parent_id for hierarchy
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Change unique constraint from name to (parent_id, name) for hierarchical uniqueness
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_parent_name_key'
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_parent_name_key UNIQUE (parent_id, name);
  END IF;
END $$;

-- Add sort_order for display ordering
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Index for tree queries
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);
