-- Add parent_id to ticket_comments for threaded/reply support
ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES ticket_comments(id) ON DELETE CASCADE;

-- Index for efficient thread lookups
CREATE INDEX IF NOT EXISTS idx_ticket_comments_parent ON ticket_comments(parent_id);
