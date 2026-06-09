-- Migration: Custom Fields & Forms
-- Admins can define custom fields, and users can fill them when creating/editing tickets and assets

-- Custom field definitions (admin-configurable)
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  field_key VARCHAR(100) NOT NULL UNIQUE,
  field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'multi_select', 'checkbox', 'url', 'textarea')),
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('ticket', 'asset')),
  required BOOLEAN NOT NULL DEFAULT false,
  options TEXT[] NOT NULL DEFAULT '{}',
  default_value TEXT,
  placeholder TEXT,
  help_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Custom field values (EAV pattern)
CREATE TABLE IF NOT EXISTS custom_field_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  definition_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  value_text TEXT,
  value_number NUMERIC,
  value_date TIMESTAMPTZ,
  value_boolean BOOLEAN,
  value_array TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(definition_id, entity_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cfd_entity_type ON custom_field_definitions(entity_type);
CREATE INDEX IF NOT EXISTS idx_cfd_active ON custom_field_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_cfd_sort ON custom_field_definitions(sort_order);
CREATE INDEX IF NOT EXISTS idx_cfv_entity ON custom_field_values(entity_id);
CREATE INDEX IF NOT EXISTS idx_cfv_definition ON custom_field_values(definition_id);
CREATE INDEX IF NOT EXISTS idx_cfv_lookup ON custom_field_values(definition_id, value_text);
CREATE INDEX IF NOT EXISTS idx_cfv_entity_def ON custom_field_values(entity_id, definition_id);

-- Updated_at triggers
DO $$ BEGIN
  CREATE TRIGGER update_custom_field_definitions_updated_at BEFORE UPDATE ON custom_field_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_custom_field_values_updated_at BEFORE UPDATE ON custom_field_values
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
