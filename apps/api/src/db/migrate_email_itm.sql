-- migrate_email_itm.sql — Email Incident Ticket Management
-- Adds support for multiple reporters, multiple assignees, email command logging,
-- email delete confirmations, and email-specific permissions.
-- Run: psql -d resolv -f migrate_email_itm.sql


-- ─── 3. Email command log (audit trail for email commands) ──────────────────
CREATE TABLE IF NOT EXISTS email_command_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR(500),
  sender_email VARCHAR(255),
  sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  command VARCHAR(50),
  arguments TEXT,
  result VARCHAR(50) CHECK (result IN ('success', 'denied', 'error', 'queued_confirmation', 'skipped')),
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_command_log_ticket ON email_command_log(ticket_id);
CREATE INDEX IF NOT EXISTS idx_email_command_log_sender ON email_command_log(sender_email);
CREATE INDEX IF NOT EXISTS idx_email_command_log_executed ON email_command_log(executed_at);

-- ─── 4. Email delete confirmations (pending confirmations via email) ────────
CREATE TABLE IF NOT EXISTS email_delete_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender_email VARCHAR(255) NOT NULL,
  sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  confirmation_token VARCHAR(100) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_delete_confirmations_token ON email_delete_confirmations(confirmation_token);
CREATE INDEX IF NOT EXISTS idx_email_delete_confirmations_ticket ON email_delete_confirmations(ticket_id);


-- ─── 6. System settings for email ITM config ────────────────────────────────
INSERT INTO system_settings (key, value, description)
VALUES
  ('email_commands_enabled', 'true', 'Allow email-based ticket commands (status, priority, assign, close, delete)'),
  ('email_delete_confirmation_required', 'true', 'Require CONFIRM reply before executing email delete commands'),
  ('email_command_rate_limit', '20', 'Max email commands per sender per hour')
ON CONFLICT (key) DO NOTHING;
