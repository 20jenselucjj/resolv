-- Phase 2: BitLocker encryption, battery health, USB device tracking

-- Add encryption status to asset_hardware (JSONB array of drive statuses)
ALTER TABLE asset_hardware ADD COLUMN IF NOT EXISTS encryption_status JSONB DEFAULT '[]';

-- Add battery health columns to asset_hardware
ALTER TABLE asset_hardware ADD COLUMN IF NOT EXISTS battery_has_battery BOOLEAN DEFAULT false;
ALTER TABLE asset_hardware ADD COLUMN IF NOT EXISTS battery_design_capacity_mwh BIGINT;
ALTER TABLE asset_hardware ADD COLUMN IF NOT EXISTS battery_full_charge_capacity_mwh BIGINT;
ALTER TABLE asset_hardware ADD COLUMN IF NOT EXISTS battery_health_percent NUMERIC(5,2);
ALTER TABLE asset_hardware ADD COLUMN IF NOT EXISTS battery_cycle_count INTEGER;
ALTER TABLE asset_hardware ADD COLUMN IF NOT EXISTS battery_is_charging BOOLEAN DEFAULT false;
ALTER TABLE asset_hardware ADD COLUMN IF NOT EXISTS battery_remaining_percent NUMERIC(5,2);

-- USB devices table (replaced on each checkin like network adapters)
CREATE TABLE IF NOT EXISTS asset_usb_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  device_name VARCHAR(500),
  manufacturer VARCHAR(255),
  serial VARCHAR(255),
  device_type VARCHAR(100),
  device_id VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
