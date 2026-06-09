-- Visual workflow definitions
CREATE TABLE IF NOT EXISTS visual_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(300) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('ticket_created', 'ticket_updated', 'status_changed', 'ticket_assigned', 'comment_added', 'ticket_resolved', 'ticket_closed', 'scheduled', 'manual')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  conditions JSONB NOT NULL DEFAULT '[]',
  steps JSONB NOT NULL DEFAULT '[]',
  execution_order INTEGER NOT NULL DEFAULT 0,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  last_error TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workflow execution log
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES visual_workflows(id) ON DELETE CASCADE,
  trigger_type VARCHAR(50) NOT NULL,
  trigger_data JSONB,
  status VARCHAR(50) NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'skipped')),
  steps_executed JSONB DEFAULT '[]',
  error_message TEXT,
  duration_ms INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_visual_workflows_trigger ON visual_workflows(trigger_type);
CREATE INDEX IF NOT EXISTS idx_visual_workflows_active ON visual_workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_visual_workflows_order ON visual_workflows(execution_order);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started ON workflow_executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);

-- Trigger
DO $$ BEGIN
  CREATE TRIGGER update_visual_workflows_updated_at BEFORE UPDATE ON visual_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
