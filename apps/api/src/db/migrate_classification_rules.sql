-- Migration: Add ticket classification rules table
-- Admins define keyword-based rules to determine if a ticket should be incident, request, etc.

CREATE TABLE IF NOT EXISTS ticket_classification_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  match_type VARCHAR(20) NOT NULL DEFAULT 'any' CHECK (match_type IN ('any', 'all')),
  keywords TEXT[] NOT NULL DEFAULT '{}',
  ticket_type VARCHAR(50) NOT NULL CHECK (ticket_type IN ('incident', 'service_request', 'problem', 'change')),
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique constraint on name (safe to re-run)
ALTER TABLE ticket_classification_rules ADD CONSTRAINT IF NOT EXISTS ticket_classification_rules_name_key UNIQUE (name);

-- Add default classification rules (safe to re-run)
INSERT INTO ticket_classification_rules (name, match_type, keywords, ticket_type, priority, is_active) VALUES
  ('Broken / Not Working', 'any', ARRAY['broken', 'not working', 'wont turn on', 'crash', 'crashed', 'error', 'down', 'outage', 'cant connect', 'dead', 'failed', 'failure', 'not loading', 'blank screen', 'frozen', 'freezing'], 'incident', 100, true),
  ('Cannot Access / Login', 'any', ARRAY['cant log in', 'cant sign in', 'forgot password', 'locked out', 'cant access', 'access denied', 'mfa', '2fa', 'authenticator', 'reset password'], 'incident', 90, true),
  ('New Access / Permission Request', 'any', ARRAY['need access', 'request access', 'grant access', 'new account', 'permission to', 'access to', 'new user', 'add me to'], 'service_request', 80, true),
  ('New Equipment / Hardware', 'any', ARRAY['new laptop', 'new computer', 'new monitor', 'need a', 'need new', 'request a', 'order', 'purchase', 'replace my', 'upgrade'], 'service_request', 70, true),
  ('Software Installation', 'any', ARRAY['install', 'installation', 'need software', 'new software', 'software for', 'application for', 'setup'], 'service_request', 60, true),
  ('Password Reset', 'any', ARRAY['password reset', 'reset my password', 'forgot my password', 'need a new password'], 'service_request', 50, true),
  ('Network / Connectivity', 'any', ARRAY['no internet', 'wifi not working', 'cant connect to wifi', 'network down', 'vpn not working', 'vpn issue', 'cant connect to network', 'ethernet not working'], 'incident', 40, true),
  ('Security Issue', 'any', ARRAY['phishing', 'virus', 'malware', 'ransomware', 'suspicious', 'hacked', 'breach', 'unauthorized', 'security'], 'incident', 30, true)
ON CONFLICT (name) DO NOTHING;
