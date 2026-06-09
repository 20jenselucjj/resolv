-- Performance indexes for the Resolv ITSM application.
-- This file should be run after schema.sql to optimize common query patterns.

-- 1. tickets table hot paths
CREATE INDEX IF NOT EXISTS idx_tickets_created_at_desc ON tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets (priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_id ON tickets (assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by_id ON tickets (created_by_id);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_type ON tickets (ticket_type);
CREATE INDEX IF NOT EXISTS idx_tickets_tags_gin ON tickets USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_tickets_status_priority ON tickets (status, priority);

-- 2. notifications table
CREATE INDEX IF NOT EXISTS idx_notifications_user_is_read ON notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at_desc ON notifications (created_at DESC);

-- 3. ticket_comments table
CREATE INDEX IF NOT EXISTS idx_ticket_comments_thread ON ticket_comments (ticket_id, created_at ASC);

-- 4. ticket_activity table
CREATE INDEX IF NOT EXISTS idx_ticket_activity_feed ON ticket_activity (ticket_id, created_at ASC);

-- 5. audit_log table
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at_desc ON audit_log (created_at DESC);
