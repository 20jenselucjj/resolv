-- Azure AD / Entra ID Directory Sync
-- Adds sync log table for audit of Azure AD sync operations
-- Configuration stored in system_settings as 'azure_ad_config'

CREATE TABLE IF NOT EXISTS azure_ad_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN ('full', 'incremental', 'manual')),
  status VARCHAR(50) NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  users_created INTEGER NOT NULL DEFAULT 0,
  users_updated INTEGER NOT NULL DEFAULT 0,
  users_deactivated INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  started_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_azure_ad_sync_log_status ON azure_ad_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_azure_ad_sync_log_started ON azure_ad_sync_log(started_at DESC);
