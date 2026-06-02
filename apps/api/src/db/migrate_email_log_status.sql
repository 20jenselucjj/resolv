-- migrate_email_log_status.sql
-- Widen status column and add 'skipped' to allowed values
ALTER TABLE email_log
  ALTER COLUMN status TYPE VARCHAR(50),
  DROP CONSTRAINT IF EXISTS email_log_status_check,
  ADD CONSTRAINT email_log_status_check
    CHECK (status IN ('sent', 'failed', 'received', 'processed', 'bounced', 'skipped'));
