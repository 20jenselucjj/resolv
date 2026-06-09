-- Email account configurations
CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('smtp', 'imap', 'gmail_api')),
  direction VARCHAR(50) NOT NULL CHECK (direction IN ('outbound', 'inbound', 'both')),

  -- SMTP/IMAP common
  host VARCHAR(500),
  port INTEGER,
  encryption VARCHAR(20) CHECK (encryption IN ('none', 'ssl', 'tls', 'starttls')),
  username VARCHAR(500),
  password TEXT,

  -- Email address
  email_address VARCHAR(500),
  from_name VARCHAR(200),

  -- IMAP specific
  imap_folder VARCHAR(200) DEFAULT 'INBOX',
  imap_poll_interval INTEGER DEFAULT 60,

  -- Settings
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  last_test_at TIMESTAMPTZ,
  last_test_success BOOLEAN,
  last_test_error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_accounts_type ON email_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_email_accounts_direction ON email_accounts(direction);
CREATE INDEX IF NOT EXISTS idx_email_accounts_active ON email_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_email_accounts_default ON email_accounts(is_default);

DO $$ BEGIN
  CREATE TRIGGER update_email_accounts_updated_at BEFORE UPDATE ON email_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
