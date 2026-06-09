-- Add machine_fingerprint column for agent deduplication
-- Fingerprint = SHA-256(serial_number + '|' + primary_mac_address)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS machine_fingerprint VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_machine_fingerprint ON assets (machine_fingerprint) WHERE machine_fingerprint IS NOT NULL;
