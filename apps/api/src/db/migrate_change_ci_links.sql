-- Adds change_ci_links table for CMDB → Change integration
CREATE TABLE IF NOT EXISTS change_ci_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id UUID NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
  ci_id UUID NOT NULL REFERENCES configuration_items(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL DEFAULT 'affects',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(change_id, ci_id)
);

CREATE INDEX IF NOT EXISTS idx_change_ci_links_change ON change_ci_links(change_id);
CREATE INDEX IF NOT EXISTS idx_change_ci_links_ci ON change_ci_links(ci_id);
