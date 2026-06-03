-- migrate_notifications_v2.sql
-- Comprehensive notification system overhaul:
--   1. Expand auto_reply_rules with event-based triggers
--   2. Ticket watchers (CC support)
--   3. Business hours + holidays
--   4. Satisfaction surveys (CSAT)
--   5. Notification log for throttling/dedup
--   6. SLA notification tracking

-- ─── 1. Expand auto_reply_rules ─────────────────────────────────────────────
-- Add event column: which ticket events trigger this rule
-- Default 'any' means all events; specific values: ticket_created, ticket_updated,
-- status_changed, ticket_assigned, comment_added, ticket_resolved, ticket_closed
ALTER TABLE auto_reply_rules ADD COLUMN IF NOT EXISTS event VARCHAR(50) DEFAULT 'any';

-- Delay in minutes before sending (0 = immediate)
ALTER TABLE auto_reply_rules ADD COLUMN IF NOT EXISTS delay_minutes INTEGER DEFAULT 0;

-- Whether to notify watchers/CCs on the ticket
ALTER TABLE auto_reply_rules ADD COLUMN IF NOT EXISTS notify_watchers BOOLEAN DEFAULT false;

-- Suppress duplicate notifications for same ticket+user+event within cooldown
ALTER TABLE auto_reply_rules ADD COLUMN IF NOT EXISTS suppress_duplicates BOOLEAN DEFAULT true;

-- Cooldown period in minutes for duplicate suppression
ALTER TABLE auto_reply_rules ADD COLUMN IF NOT EXISTS cooldown_minutes INTEGER DEFAULT 60;

-- ─── 2. Ticket watchers (CC/follower support) ──────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_watchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  added_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticket_id, user_id),
  UNIQUE(ticket_id, email)
);
CREATE INDEX IF NOT EXISTS idx_ticket_watchers_ticket ON ticket_watchers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_watchers_user ON ticket_watchers(user_id);

-- ─── 3. Business hours ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL DEFAULT '08:00:00',
  end_time TIME NOT NULL DEFAULT '17:00:00',
  is_business_day BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(day_of_week)
);

-- Seed default business hours (Mon-Fri 8am-5pm)
INSERT INTO business_hours (day_of_week, start_time, end_time, is_business_day)
VALUES
  (0, '00:00:00', '00:00:00', false),  -- Sunday
  (1, '08:00:00', '17:00:00', true),   -- Monday
  (2, '08:00:00', '17:00:00', true),   -- Tuesday
  (3, '08:00:00', '17:00:00', true),   -- Wednesday
  (4, '08:00:00', '17:00:00', true),   -- Thursday
  (5, '08:00:00', '17:00:00', true),   -- Friday
  (6, '00:00:00', '00:00:00', false)   -- Saturday
ON CONFLICT (day_of_week) DO NOTHING;

-- Business holidays
CREATE TABLE IF NOT EXISTS business_holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  holiday_date DATE NOT NULL,
  is_annual BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_holidays_date ON business_holidays(holiday_date);

-- ─── 4. Satisfaction surveys (CSAT) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS satisfaction_surveys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(ticket_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_ticket ON satisfaction_surveys(ticket_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_user ON satisfaction_surveys(user_id);

-- ─── 5. Notification log (throttling/dedup) ────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  template_name VARCHAR(100),
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notification_log_lookup
  ON notification_log(ticket_id, user_email, event_type, sent_at);

-- ─── 6. SLA notification tracking ──────────────────────────────────────────
-- Tracks which SLA thresholds have already fired for a ticket to avoid duplicates
CREATE TABLE IF NOT EXISTS sla_notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  threshold_percent INTEGER NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticket_id, threshold_percent, notification_type)
);
CREATE INDEX IF NOT EXISTS idx_sla_notification_log_ticket ON sla_notification_log(ticket_id);

-- ─── 7. System settings for notification config ────────────────────────────
-- These are stored as JSON in system_settings table:
--   notification_schedule_config  — intervals and thresholds for scheduled runner
--   satisfaction_survey_config    — CSAT survey settings
--   escalation_config            — escalation rules
--   business_hours_config        — feature toggle + timezone

INSERT INTO system_settings (key, value, updated_at)
VALUES ('notification_schedule_config', '{"enabled":true,"check_interval_seconds":60,"due_date_reminder_hours":[24,4],"sla_warning_thresholds":[50,75,90],"unassigned_escalation_minutes":30,"survey_delay_hours":24}', NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_settings (key, value, updated_at)
VALUES ('satisfaction_survey_config', '{"enabled":true,"delay_hours":24,"template_name":"Satisfaction Survey","include_comment_field":true}', NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_settings (key, value, updated_at)
VALUES ('escalation_config', '{"enabled":true,"unassigned":{"enabled":true,"after_minutes":30,"notify_role":"admin"},"sla_breach":{"enabled":true,"notify_assignee":true,"notify_manager":true}}', NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_settings (key, value, updated_at)
VALUES ('business_hours_config', '{"enabled":false,"timezone":"America/Denver","respect_for_notifications":false,"respect_for_sla":true}', NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_settings (key, value, updated_at)
VALUES ('throttling_config', '{"enabled":true,"default_cooldown_minutes":15,"max_notifications_per_hour":10,"suppress_after_resolve":false}', NOW())
ON CONFLICT (key) DO NOTHING;
