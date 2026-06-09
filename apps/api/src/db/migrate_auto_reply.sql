-- migrate_auto_reply.sql — Auto-reply rules system
-- Run: psql -d resolv -f migrate_auto_reply.sql

CREATE TABLE IF NOT EXISTS auto_reply_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  description TEXT DEFAULT '',
  conditions JSONB NOT NULL DEFAULT '{}',
  reply_subject VARCHAR(500) DEFAULT 'Re: Ticket #[TICKET_ID]',
  reply_body TEXT NOT NULL DEFAULT 'Thank you for contacting us. We have received your request and will get back to you shortly.',
  reply_from_email VARCHAR(255) DEFAULT '',
  send_to_requester BOOLEAN DEFAULT true,
  send_to_assignee BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_reply_rules_enabled ON auto_reply_rules(enabled);

-- Insert system settings for auto-reply defaults
INSERT INTO system_settings (key, value, updated_at)
VALUES ('auto_reply_enabled', 'false', NOW())
ON CONFLICT (key) DO NOTHING;
