-- Dashboard Pinboard Migration
-- Create user_dashboard_pins table for saving favorite metrics

CREATE TABLE IF NOT EXISTS user_dashboard_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_key VARCHAR(100) NOT NULL,
  metric_label VARCHAR(200) NOT NULL,
  metric_type VARCHAR(50) NOT NULL,  -- 'kpi', 'chart', 'table'
  config JSONB,  -- stores chart type, filters, time range, etc.
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, metric_key)
);

CREATE INDEX IF NOT EXISTS idx_user_dashboard_pins_user_id ON user_dashboard_pins(user_id);
CREATE INDEX IF NOT EXISTS idx_user_dashboard_pins_position ON user_dashboard_pins(user_id, position);
