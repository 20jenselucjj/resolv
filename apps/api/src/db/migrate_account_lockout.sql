-- Migration: Add account-based auto-lockout support
-- Adds tracking columns for failed login attempts and auto-lock expiry

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN locked_until TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Ensure locked column defaults to false if not already set
ALTER TABLE users ALTER COLUMN locked SET DEFAULT false;
