-- Changes table
CREATE TABLE IF NOT EXISTS changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number SERIAL UNIQUE,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  change_type VARCHAR(50) NOT NULL DEFAULT 'standard' CHECK (change_type IN ('standard', 'normal', 'emergency')),
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'scheduled', 'in_progress', 'completed', 'rejected', 'rolled_back', 'cancelled')),
  priority VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  risk_level VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  impact TEXT,
  risk_assessment TEXT,
  implementation_plan TEXT,
  rollback_plan TEXT,
  test_results TEXT,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approval_id UUID REFERENCES approval_requests(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  assets_affected UUID[] DEFAULT '{}',
  services_affected TEXT[] DEFAULT '{}',
  outage_required BOOLEAN DEFAULT false,
  outage_description TEXT,
  cab_notes TEXT,
  post_implementation_review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Change activity log
CREATE TABLE IF NOT EXISTS change_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  change_id UUID NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_changes_status ON changes(status);
CREATE INDEX IF NOT EXISTS idx_changes_type ON changes(change_type);
CREATE INDEX IF NOT EXISTS idx_changes_priority ON changes(priority);
CREATE INDEX IF NOT EXISTS idx_changes_risk ON changes(risk_level);
CREATE INDEX IF NOT EXISTS idx_changes_assigned ON changes(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_changes_scheduled ON changes(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_changes_created ON changes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_activity_change ON change_activity(change_id);

-- Triggers
DO $$ BEGIN
  CREATE TRIGGER update_changes_updated_at BEFORE UPDATE ON changes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


