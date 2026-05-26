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

-- Seed Users
-- Password is "Password123!" for all users
INSERT INTO users (name, email, password_hash, role, department, phone)
VALUES 
  -- Admins
  ('Marcus Johnson', 'marcus.johnson@company.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'IT', '555-0101'),
  ('Sarah Chen', 'sarah.chen@company.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'IT', '555-0102'),
  
  -- Agents
  ('David Smith', 'david.smith@company.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'agent', 'IT Help Desk', '555-0103'),
  ('Elena Rodriguez', 'elena.rodriguez@company.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'agent', 'IT Support', '555-0104'),
  ('Alex Wilson', 'alex.wilson@company.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'agent', 'Network Engineering', '555-0105'),
  ('Maya Patel', 'maya.patel@company.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'agent', 'Security', '555-0106'),
  
  -- Regular Users
  ('Jennifer Brown', 'jennifer.brown@company.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Human Resources', '555-0201'),
  ('Robert Taylor', 'robert.taylor@company.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Finance', '555-0202'),
  ('Lisa Garcia', 'lisa.garcia@company.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Marketing', '555-0203'),
  ('James Miller', 'james.miller@company.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Sales', '555-0204'),
  ('Patricia Davis', 'patricia.davis@company.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Operations', '555-0205'),
  ('Michael Wilson', 'michael.wilson@company.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Engineering', '555-0206'),
  ('Linda Martinez', 'linda.martinez@company.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Legal', '555-0207'),
  ('Thomas Anderson', 'thomas.anderson@company.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Customer Success', '555-0208'),
  ('Susan White', 'susan.white@company.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Product', '555-0209')
ON CONFLICT (email) DO NOTHING;
