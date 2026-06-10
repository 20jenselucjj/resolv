-- Rules Engine: Role assignment rules + Approval routing rules
-- Replaces hardcoded group->role mapping with admin-configurable rules

-- ─── Role Assignment Rules ───────────────────────────────────────────────────
-- Evaluated during directory sync in priority order. First match wins.
-- If no rule matches, the defaultRole from directory sync config is used.

CREATE TABLE IF NOT EXISTS role_assignment_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 100,
  match_type VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (match_type IN ('all', 'any')),
  conditions JSONB NOT NULL DEFAULT '[]',
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'agent', 'user', 'readonly')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_rules_priority ON role_assignment_rules(priority);
CREATE INDEX IF NOT EXISTS idx_role_rules_enabled ON role_assignment_rules(enabled);

-- ─── Approval Routing Rules ─────────────────────────────────────────────────
-- Evaluated when a service catalog request needs approval (or any entity needing
-- approval routing). Conditions are matched against the entity + requester attributes.
-- The catch-all rule (empty criteria) acts as the default.

CREATE TABLE IF NOT EXISTS approval_routing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 100,
  match_type VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (match_type IN ('all', 'any')),
  match_criteria JSONB NOT NULL DEFAULT '[]',
  steps JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_routing_rules_priority ON approval_routing_rules(priority);
CREATE INDEX IF NOT EXISTS idx_approval_routing_rules_enabled ON approval_routing_rules(enabled);

-- ─── Approval steps: add approver_type for manager_of_requester support ────
-- Existing steps get approver_type='role' (backward compatible).
-- New types: 'role' (match by approver_role), 'manager_of_requester' (match by requester's manager),
--            'user' (match by approver_id), 'any_role' (any user with any of listed roles)

DO $$ BEGIN
  ALTER TABLE approval_steps ADD COLUMN IF NOT EXISTS approver_type VARCHAR(50) NOT NULL DEFAULT 'role';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Seed a sensible default approval routing rule if none exist
INSERT INTO approval_routing_rules (name, description, priority, match_type, match_criteria, steps, enabled)
SELECT 'Default: Manager Approval', 'Fallback rule: route all approvals to any user with the manager role', 9999, 'all', '[]', '[{"type": "role", "role": "manager"}]'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM approval_routing_rules);

-- Seed a sensible default role assignment rule if none exist
INSERT INTO role_assignment_rules (name, description, priority, match_type, conditions, role, enabled)
SELECT 'Default: User', 'Fallback: all synced users get the user role', 9999, 'all', '[]', 'user', true
WHERE NOT EXISTS (SELECT 1 FROM role_assignment_rules);

-- ─── Add cost_center to users table ──────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN cost_center VARCHAR(100);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Triggers
DO $$ BEGIN
  CREATE TRIGGER update_role_assignment_rules_updated_at BEFORE UPDATE ON role_assignment_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_approval_routing_rules_updated_at BEFORE UPDATE ON approval_routing_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
