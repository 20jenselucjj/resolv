-- ============================================================
-- ITSM TRACKING — tracking columns for changes, approval_requests
-- ============================================================

-- Add PIR outcome to changes table
-- Values: 'success', 'partial_success', 'failure', 'rolled_back', 'pending'
ALTER TABLE changes ADD COLUMN IF NOT EXISTS pir_outcome VARCHAR(50);

-- Add escalation tracking to approval_requests
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS escalated_to_id UUID REFERENCES users(id) ON DELETE SET NULL;


