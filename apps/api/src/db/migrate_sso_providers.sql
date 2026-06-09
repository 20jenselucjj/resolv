-- SSO Provider configurations
CREATE TABLE IF NOT EXISTS sso_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('saml', 'ldap')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- SAML config
  saml_entry_point TEXT,
  saml_issuer VARCHAR(500),
  saml_callback_url TEXT,
  saml_cert TEXT,
  saml_want_assertions_signed BOOLEAN DEFAULT true,
  saml_want_authn_response_signed BOOLEAN DEFAULT true,
  saml_signature_algorithm VARCHAR(50) DEFAULT 'sha256',
  saml_attribute_mapping JSONB DEFAULT '{"email":"email","name":"displayName","firstName":"firstName","lastName":"lastName"}',
  
  -- LDAP config
  ldap_url TEXT,
  ldap_bind_dn TEXT,
  ldap_bind_password TEXT,
  ldap_search_base TEXT,
  ldap_search_filter VARCHAR(500) DEFAULT '(uid={{username}})',
  ldap_attribute_mapping JSONB DEFAULT '{"email":"mail","name":"cn","firstName":"givenName","lastName":"sn","department":"department"}',
  ldap_group_search_base TEXT,
  ldap_group_filter VARCHAR(500) DEFAULT '(member={{dn}})',
  ldap_group_role_mapping JSONB DEFAULT '{}',
  
  -- Common
  auto_create_users BOOLEAN DEFAULT true,
  default_role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sso_providers_type ON sso_providers(provider_type);
CREATE INDEX IF NOT EXISTS idx_sso_providers_active ON sso_providers(is_active);

-- Updated_at trigger
DO $$ BEGIN
  CREATE TRIGGER update_sso_providers_updated_at BEFORE UPDATE ON sso_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add 'sso' and 'ldap' to user source check if not already there
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_source_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_source_check CHECK (source IN ('manual', 'google_workspace', 'azure_ad', 'ldap', 'sso'));
  END IF;
END $$;
