-- migrate_email.sql ΓÇö Email infrastructure tables and system settings
-- Run: psql -d resolv -f migrate_email.sql

-- Email log table: records every sent/received email
CREATE TABLE IF NOT EXISTS email_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  recipient_email VARCHAR(255) NOT NULL,
  sender_email VARCHAR(255) DEFAULT '',
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'received', 'processed', 'bounced')),
  error_message TEXT,
  message_id VARCHAR(500),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_ticket_id ON email_log(ticket_id);
CREATE INDEX IF NOT EXISTS idx_email_log_created_at ON email_log(created_at);
CREATE INDEX IF NOT EXISTS idx_email_log_direction ON email_log(direction);

-- Inbound email routing table: maps from-email patterns to auto-assign rules
CREATE TABLE IF NOT EXISTS email_routing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  from_pattern VARCHAR(500) DEFAULT '',
  subject_pattern VARCHAR(500) DEFAULT '',
  assign_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  priority VARCHAR(20) DEFAULT 'medium',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default environment variables for email (if not already set)
INSERT INTO system_settings (key, value, updated_at)
VALUES
  ('email_inbound_enabled', 'false', NOW()),
  ('email_inbound_protocol', 'gmail_api', NOW()),
  ('email_inbound_poll_interval', '60', NOW()),
  ('email_inbound_label', 'INBOX', NOW()),
  ('email_ticket_creation_enabled', 'false', NOW()),
  ('email_reply_enabled', 'false', NOW())
ON CONFLICT (key) DO NOTHING;
