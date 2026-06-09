-- Agent Command Queue
-- Enables server to push commands (scripts, software installs, etc.) to agents

CREATE TABLE IF NOT EXISTS agent_commands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  command_type VARCHAR(50) NOT NULL CHECK (command_type IN (
    'run_script', 'install_software', 'uninstall_software',
    'restart_service', 'stop_service', 'start_service',
    'collect_logs', 'reboot', 'shutdown', 'custom'
  )),
  payload JSONB NOT NULL DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'dispatched', 'in_progress', 'completed', 'failed', 'cancelled', 'expired'
  )),
  -- Execution tracking
  dispatched_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB,
  error_message TEXT,
  exit_code INTEGER,
  stdout TEXT,
  stderr TEXT,
  -- Retry / TTL
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  expires_at TIMESTAMPTZ,
  -- Metadata
  timeout_seconds INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient polling (agent looks for pending commands for its asset)
CREATE INDEX IF NOT EXISTS idx_agent_commands_poll
  ON agent_commands (asset_id, status, priority DESC, created_at ASC)
  WHERE status IN ('pending', 'dispatched');

-- Index for web UI listing
CREATE INDEX IF NOT EXISTS idx_agent_commands_asset
  ON agent_commands (asset_id, created_at DESC);

-- Auto-expire old pending commands (older than 7 days)
-- This is a soft TTL — the API checks expires_at when polling
