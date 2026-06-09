-- Migration: Register agent v1.12.0 for auto-update
-- Includes gateway fixes, commands fixes, HTTP redirect support

DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM agent_versions WHERE version = '1.12.0') INTO v_exists;

  IF NOT v_exists THEN
    -- Unset old latest
    UPDATE agent_versions SET is_latest = false WHERE is_latest = true;

    -- Insert new version
    INSERT INTO agent_versions (version, changelog, file_size_bytes, checksum_sha256, rollout_percentage, is_latest, is_active)
    VALUES (
      '1.12.0',
      'Added default gateway detection; fixed event log level filtering; fixed HTTP redirect handling in software installs; fixed MSI installer support; improved uninstall command parsing; fixed auto-update checksum comparison',
      46925671,
      'ae88fbf8e4455d4bc60899fd981fb59605bfd813e03bccf9eb072533e72e7e50',
      100,
      true,
      true
    );
  END IF;
END $$;
