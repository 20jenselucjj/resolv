-- Software licenses
CREATE TABLE IF NOT EXISTS software_licenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(300) NOT NULL,
  publisher VARCHAR(200),
  version VARCHAR(100),
  license_type VARCHAR(50) NOT NULL CHECK (license_type IN ('perpetual', 'subscription', 'concurrent', 'freeware', 'open_source', 'trial')),
  license_key TEXT,
  total_seats INTEGER NOT NULL DEFAULT 0,
  used_seats INTEGER NOT NULL DEFAULT 0,
  available_seats INTEGER GENERATED ALWAYS AS (total_seats - used_seats) STORED,
  purchase_date DATE,
  expiry_date DATE,
  renewal_date DATE,
  cost_per_seat NUMERIC(10,2),
  total_cost NUMERIC(12,2),
  currency VARCHAR(10) DEFAULT 'USD',
  vendor VARCHAR(200),
  purchase_order VARCHAR(100),
  invoice_number VARCHAR(100),
  notes TEXT,
  compliance_status VARCHAR(50) NOT NULL DEFAULT 'compliant' CHECK (compliance_status IN ('compliant', 'warning', 'non_compliant', 'expired')),
  alert_threshold INTEGER DEFAULT 10,
  auto_match BOOLEAN NOT NULL DEFAULT true,
  match_pattern VARCHAR(500),
  category VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- License assignments (which asset has which license)
CREATE TABLE IF NOT EXISTS license_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_id UUID NOT NULL REFERENCES software_licenses(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  software_name VARCHAR(500) NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_auto_matched BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(license_id, asset_id)
);

-- Software contracts
CREATE TABLE IF NOT EXISTS software_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_id UUID REFERENCES software_licenses(id) ON DELETE SET NULL,
  name VARCHAR(300) NOT NULL,
  contract_number VARCHAR(100),
  vendor VARCHAR(200),
  start_date DATE,
  end_date DATE,
  auto_renew BOOLEAN DEFAULT false,
  renewal_notice_days INTEGER DEFAULT 30,
  terms TEXT,
  file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_software_licenses_type ON software_licenses(license_type);
CREATE INDEX IF NOT EXISTS idx_software_licenses_compliance ON software_licenses(compliance_status);
CREATE INDEX IF NOT EXISTS idx_software_licenses_expiry ON software_licenses(expiry_date);
CREATE INDEX IF NOT EXISTS idx_software_licenses_active ON software_licenses(is_active);
CREATE INDEX IF NOT EXISTS idx_license_assignments_license ON license_assignments(license_id);
CREATE INDEX IF NOT EXISTS idx_license_assignments_asset ON license_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_software_contracts_license ON software_contracts(license_id);
CREATE INDEX IF NOT EXISTS idx_software_contracts_end ON software_contracts(end_date);

-- Triggers
DO $$ BEGIN
  CREATE TRIGGER update_software_licenses_updated_at BEFORE UPDATE ON software_licenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_software_contracts_updated_at BEFORE UPDATE ON software_contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
