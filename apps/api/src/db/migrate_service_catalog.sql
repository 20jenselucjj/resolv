-- Service Catalog
-- Catalog categories (separate from ticket categories)
CREATE TABLE IF NOT EXISTS catalog_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Catalog items (requestable services)
CREATE TABLE IF NOT EXISTS catalog_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(300) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  short_description VARCHAR(500),
  category_id UUID REFERENCES catalog_categories(id) ON DELETE SET NULL,
  icon VARCHAR(50),
  image_url TEXT,
  fulfillment_type VARCHAR(50) NOT NULL DEFAULT 'ticket' CHECK (fulfillment_type IN ('ticket', 'approval', 'automated')),
  approval_required BOOLEAN NOT NULL DEFAULT false,
  approval_role VARCHAR(50) DEFAULT 'manager',
  priority VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  ticket_type VARCHAR(50) NOT NULL DEFAULT 'service_request' CHECK (ticket_type IN ('incident', 'service_request', 'problem', 'change')),
  custom_fields JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service requests (user submissions)
CREATE TABLE IF NOT EXISTS service_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number SERIAL UNIQUE,
  catalog_item_id UUID NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'pending_approval', 'approved', 'rejected', 'in_progress', 'fulfilled', 'cancelled')),
  priority VARCHAR(50) NOT NULL DEFAULT 'medium',
  answers JSONB NOT NULL DEFAULT '{}',
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  approval_id UUID REFERENCES approval_requests(id) ON DELETE SET NULL,
  fulfillment_notes TEXT,
  fulfilled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_catalog_categories_active ON catalog_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_catalog_categories_sort ON catalog_categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_catalog_items_category ON catalog_items(category_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_active ON catalog_items(is_active);
CREATE INDEX IF NOT EXISTS idx_catalog_items_sort ON catalog_items(sort_order);
CREATE INDEX IF NOT EXISTS idx_service_requests_requested_by ON service_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_catalog_item ON service_requests(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_ticket ON service_requests(ticket_id);

-- Triggers
DO $$ BEGIN
  CREATE TRIGGER update_catalog_categories_updated_at BEFORE UPDATE ON catalog_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_catalog_items_updated_at BEFORE UPDATE ON catalog_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_service_requests_updated_at BEFORE UPDATE ON service_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed default catalog categories
INSERT INTO catalog_categories (name, description, icon, sort_order) VALUES
  ('Hardware', 'Physical equipment and devices', 'monitor', 1),
  ('Software', 'Application installs and licenses', 'code', 2),
  ('Access', 'System and application access requests', 'key', 3),
  ('Accounts', 'User account management', 'user', 4),
  ('Network', 'Network and connectivity', 'wifi', 5),
  ('Other', 'Miscellaneous service requests', 'help-circle', 6)
ON CONFLICT (name) DO NOTHING;
