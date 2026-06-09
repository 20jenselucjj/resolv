-- migrate_ticket_defaults.sql — Ticket type defaults for email-created tickets
-- Run: psql -d resolv -f migrate_ticket_defaults.sql

-- Allow attachments from non-user sources (email imports)
DO $$ BEGIN
  ALTER TABLE ticket_attachments ALTER COLUMN uploaded_by DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Default ticket type configuration (per-type due date hours, used for auto-setting due_date)
INSERT INTO system_settings (key, value, updated_at)
VALUES (
  'ticket_type_defaults',
  '{"incident":{"due_hours":24},"service_request":{"due_hours":72},"problem":{"due_hours":168},"change":{"due_hours":336}}',
  NOW()
) ON CONFLICT (key) DO NOTHING;
