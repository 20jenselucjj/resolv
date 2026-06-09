-- Advanced Reporting: saved reports, scheduled delivery, and execution logging
-- Depends on: users table, uuid-ossp extension, update_updated_at_column() function

CREATE TABLE IF NOT EXISTS saved_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(300) NOT NULL,
  description TEXT,
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('ticket_summary', 'agent_performance', 'sla_compliance', 'category_breakdown', 'custom')),
  config JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES saved_reports(id) ON DELETE CASCADE,
  frequency VARCHAR(50) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  day_of_week INTEGER,
  day_of_month INTEGER,
  hour INTEGER NOT NULL DEFAULT 8,
  recipients TEXT[] NOT NULL DEFAULT '{}',
  format VARCHAR(20) NOT NULL DEFAULT 'email' CHECK (format IN ('email', 'csv', 'pdf')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_execution_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES saved_reports(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES report_schedules(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  format VARCHAR(20),
  file_path TEXT,
  row_count INTEGER,
  error_message TEXT,
  executed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Allow NULL for ad-hoc report executions (no saved report reference)
ALTER TABLE report_execution_log ALTER COLUMN report_id DROP NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_reports_type ON saved_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_saved_reports_created_by ON saved_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_saved_reports_public ON saved_reports(is_public);
CREATE INDEX IF NOT EXISTS idx_report_schedules_report ON report_schedules(report_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_active ON report_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_report_schedules_next ON report_schedules(next_run_at);
CREATE INDEX IF NOT EXISTS idx_report_exec_log_report ON report_execution_log(report_id);
CREATE INDEX IF NOT EXISTS idx_report_exec_log_started ON report_execution_log(started_at DESC);

-- Triggers
DO $$ BEGIN
  CREATE TRIGGER update_saved_reports_updated_at BEFORE UPDATE ON saved_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_report_schedules_updated_at BEFORE UPDATE ON report_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
