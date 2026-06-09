-- Seed IT-specific categories
INSERT INTO categories (name, color, icon)
VALUES 
  ('Hardware Issues', '#ef4444', 'monitor'),
  ('Software / Applications', '#f59e0b', 'code'),
  ('Network & Connectivity', '#3b82f6', 'wifi'),
  ('Email & Communication', '#8b5cf6', 'mail'),
  ('Account & Access', '#10b981', 'lock'),
  ('Printer & Peripherals', '#ec4899', 'printer'),
  ('VPN & Remote Access', '#6366f1', 'shield'),
  ('Server & Infrastructure', '#f97316', 'server'),
  ('Security Incident', '#dc2626', 'alert-triangle'),
  ('Software Installation', '#0ea5e9', 'package'),
  ('Data & Backup', '#14b8a6', 'database'),
  ('Phone & Mobile', '#a855f7', 'smartphone')
ON CONFLICT (name) DO NOTHING;

-- Seed SLA Policies
INSERT INTO sla_policies (name, priority, response_time_hours, resolution_time_hours)
VALUES 
  ('P1 Critical', 'critical', 1, 4),
  ('P2 High', 'high', 4, 24),
  ('P3 Medium', 'medium', 8, 72),
  ('P4 Low', 'low', 24, 168)
ON CONFLICT (name) DO NOTHING;
