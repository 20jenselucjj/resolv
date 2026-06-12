-- Critical ITSM Gaps: CMDB, Webhooks, Major Incidents, Time Tracking, Releases
-- Applies after all other migrations

-- ═══════════════════════════════════════════════════════════════════════════════
--  1. CMDB — Configuration Items & Relationships
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS configuration_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(500) NOT NULL,
  description TEXT DEFAULT '',
  ci_type VARCHAR(100) NOT NULL CHECK (ci_type IN (
    'server', 'workstation', 'laptop', 'network_device', 'storage',
    'database', 'application', 'service', 'virtual_machine', 'container',
    'middleware', 'load_balancer', 'firewall', 'certificate', 'dns_record',
    'cloud_resource', 'kubernetes_cluster', 'other'
  )),
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  department VARCHAR(255),
  location VARCHAR(255),
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'retired')),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ci_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES configuration_items(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES configuration_items(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL CHECK (relationship_type IN (
    'depends_on', 'runs_on', 'connects_to', 'contains',
    'member_of', 'provides', 'uses', 'backed_by'
  )),
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, target_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_ci_type ON configuration_items(ci_type);
CREATE INDEX IF NOT EXISTS idx_ci_status ON configuration_items(status);
CREATE INDEX IF NOT EXISTS idx_ci_owner ON configuration_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_ci_asset ON configuration_items(asset_id);
CREATE INDEX IF NOT EXISTS idx_ci_search ON configuration_items USING gin(to_tsvector('english', name || ' ' || coalesce(description, '')));
CREATE INDEX IF NOT EXISTS idx_ci_rel_source ON ci_relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_ci_rel_target ON ci_relationships(target_id);
CREATE INDEX IF NOT EXISTS idx_ci_rel_type ON ci_relationships(relationship_type);

DO $$ BEGIN
  CREATE TRIGGER update_ci_updated_at BEFORE UPDATE ON configuration_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
--  2. Webhooks — Outbound Integration Layer
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS webhook_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  url VARCHAR(2000) NOT NULL,
  secret TEXT DEFAULT '',
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  retry_count INTEGER NOT NULL DEFAULT 3,
  timeout_seconds INTEGER NOT NULL DEFAULT 30,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhook_configs(id) ON DELETE CASCADE,
  event VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  status_code INTEGER,
  response_body TEXT,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_active ON webhook_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_webhook_events ON webhook_configs USING gin(events);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_event ON webhook_deliveries(event);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_created ON webhook_deliveries(created_at DESC);

DO $$ BEGIN
  CREATE TRIGGER update_webhook_configs_updated_at BEFORE UPDATE ON webhook_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
--  3. Major Incidents — Extension of ticket system for P1/Critical incidents
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS major_incidents (
  ticket_id UUID PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'stabilized', 'resolved', 'post_review')),
  incident_commander_id UUID REFERENCES users(id) ON DELETE SET NULL,
  bridge_url TEXT DEFAULT '',
  bridge_conference TEXT DEFAULT '',
  bridge_slack_channel TEXT DEFAULT '',
  declaration_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_time TIMESTAMPTZ,
  services_affected TEXT[] DEFAULT '{}',
  comms_template TEXT DEFAULT '',
  pir_completed BOOLEAN DEFAULT false,
  pir_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS major_incident_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  major_incident_ticket_id UUID NOT NULL REFERENCES major_incidents(ticket_id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entry_type VARCHAR(50) NOT NULL CHECK (entry_type IN ('declaration', 'update', 'milestone', 'communication', 'resolution', 'pir')),
  content TEXT NOT NULL,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_major_incident_status ON major_incidents(status);
CREATE INDEX IF NOT EXISTS idx_major_incident_commander ON major_incidents(incident_commander_id);
CREATE INDEX IF NOT EXISTS idx_major_incident_timeline_incident ON major_incident_timeline(major_incident_ticket_id);
CREATE INDEX IF NOT EXISTS idx_major_incident_timeline_created ON major_incident_timeline(created_at DESC);

DO $$ BEGIN
  CREATE TRIGGER update_major_incidents_updated_at BEFORE UPDATE ON major_incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
--  4. Time Tracking — Per-ticket agent effort logging
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  time_spent_minutes INTEGER NOT NULL CHECK (time_spent_minutes > 0 AND time_spent_minutes < 1440),
  description TEXT DEFAULT '',
  billable BOOLEAN DEFAULT true,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_ticket ON time_entries(ticket_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_billable ON time_entries(billable);

DO $$ BEGIN
  CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
--  5. Release Management — Grouped change deployments
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS releases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number SERIAL UNIQUE,
  name VARCHAR(500) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  version VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned', 'in_development', 'in_testing', 'staged', 'deployed', 'completed', 'rolled_back', 'cancelled'
  )),
  priority VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  release_owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  release_notes TEXT DEFAULT '',
  risk_level VARCHAR(50) DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS release_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  release_id UUID NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  change_id UUID NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(release_id, change_id)
);

CREATE INDEX IF NOT EXISTS idx_releases_status ON releases(status);
CREATE INDEX IF NOT EXISTS idx_releases_owner ON releases(release_owner_id);
CREATE INDEX IF NOT EXISTS idx_releases_priority ON releases(priority);
CREATE INDEX IF NOT EXISTS idx_releases_scheduled ON releases(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_releases_created ON releases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_changes_release ON release_changes(release_id);
CREATE INDEX IF NOT EXISTS idx_release_changes_change ON release_changes(change_id);

DO $$ BEGIN
  CREATE TRIGGER update_releases_updated_at BEFORE UPDATE ON releases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
