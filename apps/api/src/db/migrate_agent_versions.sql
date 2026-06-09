-- Agent version management for auto-update

CREATE TABLE IF NOT EXISTS agent_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version VARCHAR(50) NOT NULL UNIQUE,
  changelog TEXT,
  download_url TEXT,
  file_size_bytes BIGINT,
  checksum_sha256 VARCHAR(64),
  -- Rollout control
  rollout_percentage INTEGER NOT NULL DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  min_agent_version VARCHAR(50),
  -- Status
  is_latest BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_versions_latest ON agent_versions (is_latest) WHERE is_latest = true;
CREATE INDEX IF NOT EXISTS idx_agent_versions_active ON agent_versions (is_active) WHERE is_active = true;

-- Seed initial version record (matches current agent version)
INSERT INTO agent_versions (version, changelog, is_latest, is_active, rollout_percentage)
VALUES ('1.0.0', 'Initial release', true, true, 100)
ON CONFLICT (version) DO NOTHING;
