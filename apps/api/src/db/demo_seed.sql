-- ============================================================================
-- Resolv ITSM — Demo Seed Data
-- ============================================================================
-- Run AFTER seed.sql has been applied. This script adds rich demo data across
-- ALL tables to showcase every feature of the platform in a demo.
-- All passwords remain "Password123!" (from seed.sql).
-- ============================================================================

-- ============================================================================
-- 1. UPDATE EXISTING USERS — Add manager, title, employee_id, location, etc.
-- ============================================================================
UPDATE users SET
  title = 'IT Director', employee_id = 'EMP-001', location = 'Denver, CO', manager_id = NULL
WHERE email = 'marcus.johnson@company.com';

UPDATE users SET
  title = 'IT Operations Manager', employee_id = 'EMP-002', location = 'Denver, CO', manager_id = (SELECT id FROM users WHERE email = 'marcus.johnson@company.com')
WHERE email = 'sarah.chen@company.com';

UPDATE users SET
  title = 'Senior Help Desk Technician', employee_id = 'EMP-003', location = 'Denver, CO', manager_id = (SELECT id FROM users WHERE email = 'sarah.chen@company.com')
WHERE email = 'david.smith@company.com';

UPDATE users SET
  title = 'IT Support Specialist', employee_id = 'EMP-004', location = 'Denver, CO', manager_id = (SELECT id FROM users WHERE email = 'sarah.chen@company.com')
WHERE email = 'elena.rodriguez@company.com';

UPDATE users SET
  title = 'Network Engineer', employee_id = 'EMP-005', location = 'Denver, CO', manager_id = (SELECT id FROM users WHERE email = 'sarah.chen@company.com')
WHERE email = 'alex.wilson@company.com';

UPDATE users SET
  title = 'Security Analyst', employee_id = 'EMP-006', location = 'Denver, CO', manager_id = (SELECT id FROM users WHERE email = 'sarah.chen@company.com')
WHERE email = 'maya.patel@company.com';

UPDATE users SET
  title = 'HR Manager', employee_id = 'EMP-101', location = 'Denver, CO', manager_id = (SELECT id FROM users WHERE email = 'marcus.johnson@company.com')
WHERE email = 'jennifer.brown@company.com';

UPDATE users SET
  title = 'Finance Director', employee_id = 'EMP-102', location = 'Denver, CO'
WHERE email = 'robert.taylor@company.com';

UPDATE users SET
  title = 'Marketing Director', employee_id = 'EMP-103', location = 'Denver, CO'
WHERE email = 'lisa.garcia@company.com';

UPDATE users SET
  title = 'VP of Sales', employee_id = 'EMP-104', location = 'Denver, CO'
WHERE email = 'james.miller@company.com';

UPDATE users SET
  title = 'Operations Director', employee_id = 'EMP-105', location = 'Denver, CO'
WHERE email = 'patricia.davis@company.com';

UPDATE users SET
  title = 'Senior Software Engineer', employee_id = 'EMP-106', location = 'Denver, CO'
WHERE email = 'michael.wilson@company.com';

UPDATE users SET
  title = 'General Counsel', employee_id = 'EMP-107', location = 'Denver, CO'
WHERE email = 'linda.martinez@company.com';

UPDATE users SET
  title = 'Customer Success Manager', employee_id = 'EMP-108', location = 'Denver, CO'
WHERE email = 'thomas.anderson@company.com';

UPDATE users SET
  title = 'Product Manager', employee_id = 'EMP-109', location = 'Denver, CO'
WHERE email = 'susan.white@company.com';

-- ============================================================================
-- 2. ASSET GROUPS
-- ============================================================================
INSERT INTO asset_groups (name, description, color, created_by)
SELECT * FROM (VALUES
  ('IT Department Devices', 'All IT-managed workstations and laptops', '#6366f1', (SELECT id FROM users WHERE email = 'sarah.chen@company.com')),
  ('Engineering Team', 'Devices assigned to engineering staff', '#10b981', (SELECT id FROM users WHERE email = 'michael.wilson@company.com')),
  ('Production Servers', 'Critical production infrastructure', '#ef4444', (SELECT id FROM users WHERE email = 'alex.wilson@company.com')),
  ('Sales Team', 'Devices for the sales department', '#f59e0b', (SELECT id FROM users WHERE email = 'james.miller@company.com'))
) AS v(name, description, color, created_by)
WHERE NOT EXISTS (SELECT 1 FROM asset_groups ag WHERE ag.name = v.name);

-- ============================================================================
-- 3. ASSETS — Devices with realistic specs
-- ============================================================================
-- Asset 1: David Smith's workstation
WITH a1 AS (
  INSERT INTO assets (name, display_name, asset_type, status, agent_status, agent_version, agent_token, serial_number, manufacturer, model, ip_address, mac_address, hostname, domain, os_name, os_version, os_build, os_arch, asset_group_id, assigned_to_id, department, location, company, purchase_date, warranty_expiry, purchase_cost, vendor, notes, tags)
  VALUES
    ('DESKTOP-WS001', 'David Smith - Dell Precision 3660', 'workstation', 'active', 'online', '1.2.3', gen_random_uuid()::text, 'SN-DELL-9901234', 'Dell', 'Precision 3660', '192.168.1.101', 'AA:BB:CC:DD:EE:01', 'DESKTOP-WS001', 'corp.company.com', 'Windows 11 Pro', '23H2', '22631.2861', 'x64',
     (SELECT id FROM asset_groups WHERE name = 'IT Department Devices'),
     (SELECT id FROM users WHERE email = 'david.smith@company.com'), 'IT', 'Denver, CO - HQ', 'Resolv Corp',
     '2024-01-15', '2027-01-15', 2499.00, 'Dell', 'Primary help desk workstation with dual monitor setup', ARRAY['desktop', 'dell', 'it-department'])
  RETURNING id
)
INSERT INTO asset_hardware (asset_id, cpu_model, cpu_manufacturer, cpu_cores, cpu_threads, cpu_speed_mhz, ram_total_gb, ram_used_gb, ram_free_gb, gpu_model, gpu_vram_gb, disk_total_gb, disk_used_gb, disk_free_gb, disks)
SELECT id, 'Intel Core i9-13900K', 'Intel', 24, 32, 5800, 64, 28.5, 35.5, 'NVIDIA RTX A4000', 16, 2048, 842, 1206,
  JSONB_BUILD_ARRAY(
    JSONB_BUILD_OBJECT('model', 'Samsung 990 Pro', 'type', 'NVMe SSD', 'capacity_gb', 1024, 'used_gb', 520, 'free_gb', 504, 'mount_point', 'C:'),
    JSONB_BUILD_OBJECT('model', 'Samsung 870 EVO', 'type', 'SATA SSD', 'capacity_gb', 2048, 'used_gb', 322, 'free_gb', 1726, 'mount_point', 'D:')
  )
FROM a1;

WITH a1 AS (
  INSERT INTO assets (name, display_name, asset_type, status, agent_status, agent_version, agent_token, serial_number, manufacturer, model, ip_address, mac_address, hostname, domain, os_name, os_version, os_build, os_arch, asset_group_id, assigned_to_id, department, location, company, purchase_date, warranty_expiry, purchase_cost, vendor, tags)
  VALUES
    ('LAPTOP-MW001', 'Michael Wilson - MacBook Pro 16"', 'laptop', 'active', 'online', '1.2.3', gen_random_uuid()::text, 'SN-APPLE-M2-7788', 'Apple', 'MacBook Pro 16" M3 Max', '192.168.1.201', 'AA:BB:CC:DD:EE:02', 'LAPTOP-MW001', 'corp.company.com', 'macOS', '14.3', '23D56', 'arm64',
     (SELECT id FROM asset_groups WHERE name = 'Engineering Team'),
     (SELECT id FROM users WHERE email = 'michael.wilson@company.com'), 'Engineering', 'Denver, CO - HQ', 'Resolv Corp',
     '2024-03-01', '2027-03-01', 3499.00, 'Apple', ARRAY['laptop', 'apple', 'engineering'])
  RETURNING id
)
INSERT INTO asset_hardware (asset_id, cpu_model, cpu_manufacturer, cpu_cores, cpu_threads, cpu_speed_mhz, ram_total_gb, ram_used_gb, ram_free_gb, gpu_model, gpu_vram_gb, disk_total_gb, disk_used_gb, disk_free_gb, disks)
SELECT id, 'Apple M3 Max', 'Apple', 16, 16, 4050, 48, 22.3, 25.7, 'Apple M3 Max (Integrated)', NULL, 1024, 420, 604,
  JSONB_BUILD_ARRAY(
    JSONB_BUILD_OBJECT('model', 'Apple SSD AP1024R', 'type', 'NVMe SSD', 'capacity_gb', 1024, 'used_gb', 420, 'free_gb', 604, 'mount_point', '/')
  )
FROM a1;

-- Asset 3: Production Server
WITH a1 AS (
  INSERT INTO assets (name, display_name, asset_type, status, agent_status, agent_version, agent_token, serial_number, manufacturer, model, ip_address, mac_address, hostname, domain, os_name, os_version, os_build, os_arch, asset_group_id, assigned_to_id, department, location, company, purchase_date, warranty_expiry, purchase_cost, vendor, tags)
  VALUES
    ('SRV-PROD-DB01', 'Primary Database Server', 'server', 'active', 'online', '1.2.3', gen_random_uuid()::text, 'SN-HPE-DB-4433', 'HPE', 'ProLiant DL380 Gen11', '10.0.1.10', 'AA:BB:CC:DD:EE:10', 'srv-prod-db01', 'corp.company.com', 'Windows Server 2022 Standard', '21H2', '20348.2655', 'x64',
     (SELECT id FROM asset_groups WHERE name = 'Production Servers'),
     (SELECT id FROM users WHERE email = 'alex.wilson@company.com'), 'IT Infrastructure', 'Denver, CO - Data Center', 'Resolv Corp',
     '2023-06-01', '2028-06-01', 18500.00, 'HPE', ARRAY['server', 'hpe', 'database', 'production'])
  RETURNING id
)
INSERT INTO asset_hardware (asset_id, cpu_model, cpu_manufacturer, cpu_cores, cpu_threads, cpu_speed_mhz, ram_total_gb, ram_used_gb, ram_free_gb, disk_total_gb, disk_used_gb, disk_free_gb, disks)
SELECT id, 'Intel Xeon Gold 6438M', 'Intel', 64, 128, 4200, 512, 412, 100, 8192, 5120, 3072,
  JSONB_BUILD_ARRAY(
    JSONB_BUILD_OBJECT('model', 'HPE 1.92TB SAS SSD', 'type', 'SAS SSD', 'capacity_gb', 1920, 'used_gb', 1536, 'free_gb', 384, 'mount_point', 'C:'),
    JSONB_BUILD_OBJECT('model', 'HPE 3.84TB SAS SSD', 'type', 'SAS SSD', 'capacity_gb', 3840, 'used_gb', 2048, 'free_gb', 1792, 'mount_point', 'D:'),
    JSONB_BUILD_OBJECT('model', 'HPE 3.84TB SAS SSD', 'type', 'SAS SSD', 'capacity_gb', 3840, 'used_gb', 1536, 'free_gb', 2304, 'mount_point', 'E:')
  )
FROM a1;

-- Asset 4: Elena's laptop
WITH a1 AS (
  INSERT INTO assets (name, display_name, asset_type, status, agent_status, agent_version, agent_token, serial_number, manufacturer, model, ip_address, mac_address, hostname, domain, os_name, os_version, os_build, os_arch, asset_group_id, assigned_to_id, department, location, company, purchase_date, warranty_expiry, purchase_cost, vendor, tags)
  VALUES
    ('LAPTOP-ER001', 'Elena Rodriguez - ThinkPad X1', 'laptop', 'active', 'online', '1.2.3', gen_random_uuid()::text, 'SN-LENOVO-X1-5566', 'Lenovo', 'ThinkPad X1 Carbon Gen 12', '192.168.1.102', 'AA:BB:CC:DD:EE:03', 'LAPTOP-ER001', 'corp.company.com', 'Windows 11 Pro', '23H2', '22631.2861', 'x64',
     (SELECT id FROM asset_groups WHERE name = 'IT Department Devices'),
     (SELECT id FROM users WHERE email = 'elena.rodriguez@company.com'), 'IT Support', 'Denver, CO - HQ', 'Resolv Corp',
     '2024-02-15', '2027-02-15', 1899.00, 'Lenovo', ARRAY['laptop', 'lenovo', 'it-department'])
  RETURNING id
)
INSERT INTO asset_hardware (asset_id, cpu_model, cpu_manufacturer, cpu_cores, cpu_threads, cpu_speed_mhz, ram_total_gb, ram_used_gb, ram_free_gb, disk_total_gb, disk_used_gb, disk_free_gb, disks)
SELECT id, 'Intel Core Ultra 7 165U', 'Intel', 14, 18, 4700, 32, 14.2, 17.8, 512, 280, 232,
  JSONB_BUILD_ARRAY(
    JSONB_BUILD_OBJECT('model', 'Samsung PM9C1', 'type', 'NVMe SSD', 'capacity_gb', 512, 'used_gb', 280, 'free_gb', 232, 'mount_point', 'C:')
  )
FROM a1;

-- Asset 5: Printer on floor 3
INSERT INTO assets (name, display_name, asset_type, status, agent_status, asset_group_id, serial_number, manufacturer, model, ip_address, mac_address, hostname, location, company, purchase_date, warranty_expiry, purchase_cost, vendor, tags)
VALUES
  ('PRN-FL3-01', 'Floor 3 - HP LaserJet MFP', 'printer', 'active', 'offline', (SELECT id FROM asset_groups WHERE name = 'IT Department Devices'),
   'SN-HP-MFP-2233', 'HP', 'LaserJet Enterprise MFP M636', '192.168.5.50', 'AA:BB:CC:DD:EE:50', 'PRN-FL3-01', 'Denver, CO - HQ - Floor 3', 'Resolv Corp',
   '2023-09-01', '2026-09-01', 3299.00, 'HP', ARRAY['printer', 'hp', 'floor-3']);

-- Asset 6: Network switch
INSERT INTO assets (name, display_name, asset_type, status, agent_status, asset_group_id, serial_number, manufacturer, model, ip_address, mac_address, hostname, location, company, purchase_date, warranty_expiry, purchase_cost, vendor, tags)
VALUES
  ('SW-CORE-01', 'Core Network Switch - Floor 1', 'network_device', 'active', 'offline', (SELECT id FROM asset_groups WHERE name = 'Production Servers'),
   'SN-CISCO-CORE-9900', 'Cisco', 'Catalyst 9500-48Y4C', '10.0.0.1', 'AA:BB:CC:DD:EE:99', 'SW-CORE-01', 'Denver, CO - Data Center', 'Resolv Corp',
   '2023-03-15', '2028-03-15', 24999.00, 'Cisco', ARRAY['network', 'cisco', 'core']);

-- Asset 7: James Miller's laptop (Sales VP)
WITH a1 AS (
  INSERT INTO assets (name, display_name, asset_type, status, agent_status, agent_version, agent_token, serial_number, manufacturer, model, ip_address, mac_address, hostname, domain, os_name, os_version, os_build, os_arch, asset_group_id, assigned_to_id, department, location, company, purchase_date, warranty_expiry, purchase_cost, vendor, tags)
  VALUES
    ('LAPTOP-JM001', 'James Miller - Surface Laptop 6', 'laptop', 'active', 'online', '1.2.3', gen_random_uuid()::text, 'SN-MS-SL6-3344', 'Microsoft', 'Surface Laptop 6 for Business', '192.168.1.150', 'AA:BB:CC:DD:EE:04', 'LAPTOP-JM001', 'corp.company.com', 'Windows 11 Pro', '23H2', '22631.2861', 'x64',
     (SELECT id FROM asset_groups WHERE name = 'Sales Team'),
     (SELECT id FROM users WHERE email = 'james.miller@company.com'), 'Sales', 'Denver, CO - HQ', 'Resolv Corp',
     '2024-04-01', '2027-04-01', 2399.00, 'Microsoft', ARRAY['laptop', 'surface', 'sales'])
  RETURNING id
)
INSERT INTO asset_hardware (asset_id, cpu_model, cpu_manufacturer, cpu_cores, cpu_threads, cpu_speed_mhz, ram_total_gb, ram_used_gb, ram_free_gb, disk_total_gb, disk_used_gb, disk_free_gb, disks)
SELECT id, 'Intel Core i7-13800H', 'Intel', 14, 20, 5200, 32, 18.5, 13.5, 512, 310, 202,
  JSONB_BUILD_ARRAY(
    JSONB_BUILD_OBJECT('model', 'Samsung PM9A1', 'type', 'NVMe SSD', 'capacity_gb', 512, 'used_gb', 310, 'free_gb', 202, 'mount_point', 'C:')
  )
FROM a1;

-- Asset 8: Alex Wilson's workstation
WITH a1 AS (
  INSERT INTO assets (name, display_name, asset_type, status, agent_status, agent_version, agent_token, serial_number, manufacturer, model, ip_address, mac_address, hostname, domain, os_name, os_version, os_build, os_arch, asset_group_id, assigned_to_id, department, location, company, purchase_date, warranty_expiry, purchase_cost, vendor, tags)
  VALUES
    ('DESKTOP-AW001', 'Alex Wilson - Precision 5860', 'workstation', 'active', 'online', '1.2.3', gen_random_uuid()::text, 'SN-DELL-5860-1122', 'Dell', 'Precision 5860', '192.168.1.103', 'AA:BB:CC:DD:EE:05', 'DESKTOP-AW001', 'corp.company.com', 'Windows 11 Pro', '23H2', '22631.2861', 'x64',
     (SELECT id FROM asset_groups WHERE name = 'IT Department Devices'),
     (SELECT id FROM users WHERE email = 'alex.wilson@company.com'), 'Network Engineering', 'Denver, CO - HQ', 'Resolv Corp',
     '2024-01-20', '2027-01-20', 3299.00, 'Dell', ARRAY['desktop', 'dell', 'networking'])
  RETURNING id
)
INSERT INTO asset_hardware (asset_id, cpu_model, cpu_manufacturer, cpu_cores, cpu_threads, cpu_speed_mhz, ram_total_gb, ram_used_gb, ram_free_gb, disk_total_gb, disk_used_gb, disk_free_gb, disks)
SELECT id, 'AMD Ryzen Threadripper PRO 5975WX', 'AMD', 32, 64, 4500, 128, 52.3, 75.7, 2048, 920, 1128,
  JSONB_BUILD_ARRAY(
    JSONB_BUILD_OBJECT('model', 'Samsung 980 PRO', 'type', 'NVMe SSD', 'capacity_gb', 1024, 'used_gb', 512, 'free_gb', 512, 'mount_point', 'C:'),
    JSONB_BUILD_OBJECT('model', 'WD Black SN850X', 'type', 'NVMe SSD', 'capacity_gb', 1024, 'used_gb', 408, 'free_gb', 616, 'mount_point', 'D:')
  )
FROM a1;

-- ============================================================================
-- 4. ASSET SOFTWARE INVENTORY
-- ============================================================================
-- Software on David Smith's workstation
INSERT INTO asset_software (asset_id, name, version, publisher, install_date, size_mb)
SELECT a.id, s.name, s.version, s.publisher, s.install_date, s.size_mb
FROM assets a
CROSS JOIN (VALUES
  ('Microsoft 365 Apps for Enterprise', '2402', 'Microsoft Corporation', '2024-01-15'::date, 3200),
  ('Google Chrome', '122.0.6261.129', 'Google LLC', '2024-01-15'::date, 280),
  ('Slack', '4.35.131', 'Slack Technologies', '2024-01-16'::date, 350),
  ('Visual Studio Code', '1.87.0', 'Microsoft Corporation', '2024-01-15'::date, 420),
  ('7-Zip', '23.01', 'Igor Pavlov', '2024-01-15'::date, 8),
  ('Adobe Acrobat Reader', '24.001.20604', 'Adobe', '2024-01-15'::date, 680),
  ('Putty', '0.80', 'Simon Tatham', '2024-01-20'::date, 15),
  ('Wireshark', '4.2.3', 'Wireshark Foundation', '2024-02-01'::date, 120),
  ('Zoom', '6.0.0', 'Zoom Video Communications', '2024-01-16'::date, 210),
  ('Microsoft Teams', '1.7.00', 'Microsoft Corporation', '2024-01-15'::date, 580),
  ('Notepad++', '8.6.5', 'Notepad++ Team', '2024-01-15'::date, 12),
  ('Git', '2.43.0', 'Git for Windows', '2024-01-15'::date, 280)
) AS s(name, version, publisher, install_date, size_mb)
WHERE a.name = 'DESKTOP-WS001'
  AND NOT EXISTS (SELECT 1 FROM asset_software WHERE asset_id = a.id AND name = s.name);

-- Software on Michael Wilson's MacBook
INSERT INTO asset_software (asset_id, name, version, publisher, install_date, size_mb)
SELECT a.id, s.name, s.version, s.publisher, s.install_date, s.size_mb
FROM assets a
CROSS JOIN (VALUES
  ('Microsoft 365 Apps for Enterprise', '16.82', 'Microsoft Corporation', '2024-03-01'::date, 2800),
  ('Google Chrome', '122.0.6261.129', 'Google LLC', '2024-03-01'::date, 350),
  ('Slack', '4.35.131', 'Slack Technologies', '2024-03-01'::date, 300),
  ('Visual Studio Code', '1.87.0', 'Microsoft Corporation', '2024-03-02'::date, 380),
  ('Xcode', '15.3', 'Apple Inc.', '2024-03-05'::date, 8500),
  ('Docker Desktop', '4.28.0', 'Docker Inc.', '2024-03-02'::date, 650),
  ('iTerm2', '3.5.0', 'iTerm2 Project', '2024-03-01'::date, 45),
  ('Homebrew', '4.2.0', 'Homebrew Project', '2024-03-01'::date, 1),
  ('Node.js', '20.11.0', 'Node.js Foundation', '2024-03-01'::date, 85),
  ('Figma', '124.3', 'Figma Inc.', '2024-03-10'::date, 320),
  ('Zoom', '6.0.0', 'Zoom Video Communications', '2024-03-01'::date, 180),
  ('Postman', '10.23.0', 'Postman Inc.', '2024-03-02'::date, 290)
) AS s(name, version, publisher, install_date, size_mb)
WHERE a.name = 'LAPTOP-MW001'
  AND NOT EXISTS (SELECT 1 FROM asset_software WHERE asset_id = a.id AND name = s.name);

-- ============================================================================
-- 5. ASSET NETWORK ADAPTERS
-- ============================================================================
INSERT INTO asset_network_adapters (asset_id, adapter_name, ip_address, mac_address, subnet_mask, gateway, dns_servers, adapter_type, speed_mbps, is_virtual, is_active)
SELECT a.id, 'Realtek PCIe 2.5GbE Family Controller', '192.168.1.101', 'AA:BB:CC:DD:EE:01', '255.255.255.0', '192.168.1.1', ARRAY['10.0.0.10', '10.0.0.11'], 'ethernet', 2500, false, true
FROM assets a WHERE a.name = 'DESKTOP-WS001'
AND NOT EXISTS (SELECT 1 FROM asset_network_adapters WHERE asset_id = a.id);

INSERT INTO asset_network_adapters (asset_id, adapter_name, ip_address, mac_address, subnet_mask, gateway, dns_servers, adapter_type, speed_mbps, is_virtual, is_active)
SELECT a.id, 'Intel Wi-Fi 6E AX211', '192.168.1.102', 'AA:BB:CC:DD:EE:03', '255.255.255.0', '192.168.1.1', ARRAY['10.0.0.10', '10.0.0.11'], 'wifi', 1200, false, true
FROM assets a WHERE a.name = 'LAPTOP-ER001'
AND NOT EXISTS (SELECT 1 FROM asset_network_adapters WHERE asset_id = a.id);

INSERT INTO asset_network_adapters (asset_id, adapter_name, ip_address, mac_address, subnet_mask, gateway, dns_servers, adapter_type, speed_mbps, is_virtual, is_active)
SELECT a.id, 'HPE Ethernet 10Gb 2-port SFP+ BCM57414', '10.0.1.10', 'AA:BB:CC:DD:EE:10', '255.255.255.0', '10.0.1.1', ARRAY['10.0.0.10', '10.0.0.11'], 'ethernet', 10000, false, true
FROM assets a WHERE a.name = 'SRV-PROD-DB01'
AND NOT EXISTS (SELECT 1 FROM asset_network_adapters WHERE asset_id = a.id);

-- ============================================================================
-- 6. ASSET ACTIVITY LOG
-- ============================================================================
INSERT INTO asset_activity (asset_id, actor_id, action, description, created_at)
SELECT a.id, u.id, 'agent:registered', 'Agent v1.2.3 registered successfully', NOW() - INTERVAL '30 days'
FROM assets a, users u
WHERE a.name = 'DESKTOP-WS001' AND u.email = 'david.smith@company.com'
AND NOT EXISTS (SELECT 1 FROM asset_activity WHERE asset_id = a.id AND action = 'agent:registered');

INSERT INTO asset_activity (asset_id, actor_id, action, description, created_at)
SELECT a.id, u.id, 'agent:checkin', 'Hardware inventory collected. CPU: 28%, RAM: 44% used, Disk: 41% used', NOW() - INTERVAL '2 hours'
FROM assets a, users u
WHERE a.name = 'DESKTOP-WS001' AND u.email = 'david.smith@company.com';

INSERT INTO asset_activity (asset_id, actor_id, action, description, created_at)
SELECT a.id, u.id, 'agent:heartbeat', 'Agent heartbeat received. Status: Online', NOW() - INTERVAL '5 minutes'
FROM assets a, users u
WHERE a.name = 'DESKTOP-WS001' AND u.email = 'david.smith@company.com';

INSERT INTO asset_activity (asset_id, actor_id, action, description, created_at)
SELECT a.id, u.id, 'agent:checkin', 'Software inventory updated: 48 applications found', NOW() - INTERVAL '1 day'
FROM assets a, users u
WHERE a.name = 'LAPTOP-MW001' AND u.email = 'michael.wilson@company.com';

INSERT INTO asset_activity (asset_id, actor_id, action, description, created_at)
SELECT a.id, u.id, 'asset:updated', 'Asset assigned to Michael Wilson (Engineering)', NOW() - INTERVAL '30 days'
FROM assets a, users u
WHERE a.name = 'LAPTOP-MW001' AND u.email = 'sarah.chen@company.com';

INSERT INTO asset_activity (asset_id, actor_id, action, description, created_at)
SELECT a.id, u.id, 'agent:heartbeat', 'Agent heartbeat received. Status: Online', NOW() - INTERVAL '3 minutes'
FROM assets a, users u
WHERE a.name = 'LAPTOP-ER001' AND u.email = 'elena.rodriguez@company.com';

-- ============================================================================
-- 7. TICKETS — 25 realistic support tickets
-- ============================================================================

-- Ticket 1: Critical - VPN outage
WITH t1 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, first_response_at, created_at, updated_at)
  SELECT
    'VPN service down for remote employees',
    'All remote employees are unable to connect to the corporate VPN. Users are reporting "Connection refused" errors when attempting to connect via the AnyConnect client. This is affecting approximately 40 remote workers. Need immediate assistance.',
    'in_progress', 'critical', 'incident',
    (SELECT id FROM users WHERE email = 'jennifer.brown@company.com'),
    (SELECT id FROM users WHERE email = 'alex.wilson@company.com'),
    (SELECT id FROM categories WHERE name = 'VPN & Remote Access'),
    (SELECT id FROM sla_policies WHERE name = 'P1 Critical'),
    ARRAY['vpn', 'anyconnect', 'outage', 'remote-work'],
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '2 hours'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'jennifer.brown@company.com'), 'created', NULL, 'Ticket created', created_at FROM t1
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), 'assigned', 'unassigned', 'Alex Wilson', created_at + INTERVAL '10 minutes' FROM t1
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'alex.wilson@company.com'), 'status_changed', 'open', 'in_progress', created_at + INTERVAL '30 minutes' FROM t1;

-- Ticket 2: High - VPN connection failing after update
WITH t2 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, created_at, updated_at)
  SELECT
    'VPN connection failing after Windows 11 update',
    'After installing the latest Windows 11 cumulative update (KB5035853), my VPN client fails to connect. It gets to "Authenticating" and then times out. Other team members on the same update are also affected.',
    'open', 'high', 'incident',
    (SELECT id FROM users WHERE email = 'james.miller@company.com'),
    (SELECT id FROM users WHERE email = 'alex.wilson@company.com'),
    (SELECT id FROM categories WHERE name = 'VPN & Remote Access'),
    (SELECT id FROM sla_policies WHERE name = 'P2 High'),
    ARRAY['vpn', 'windows-update', 'anyconnect', 'connectivity'],
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '1 day'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'james.miller@company.com'), 'created', NULL, 'Ticket created', created_at FROM t2
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), 'assigned', 'unassigned', 'Alex Wilson', created_at + INTERVAL '5 minutes' FROM t2;

-- Ticket 3: Medium - Printer issue
WITH t3 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, created_at, updated_at)
  SELECT
    'Printer not responding on Floor 3 - Marketing',
    'The HP LaserJet on floor 3 near the Marketing department is showing "Offline" status. I have tried restarting it and checking the network cable. The printer has paper and toner. Can someone take a look?',
    'waiting', 'medium', 'incident',
    (SELECT id FROM users WHERE email = 'lisa.garcia@company.com'),
    (SELECT id FROM users WHERE email = 'david.smith@company.com'),
    (SELECT id FROM categories WHERE name = 'Printer & Peripherals'),
    (SELECT id FROM sla_policies WHERE name = 'P3 Medium'),
    ARRAY['printer', 'hp', 'offline', 'floor-3'],
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '4 days'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'lisa.garcia@company.com'), 'created', NULL, 'Ticket created', created_at FROM t3
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), 'assigned', 'unassigned', 'David Smith', created_at + INTERVAL '15 minutes' FROM t3
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'david.smith@company.com'), 'status_changed', 'open', 'in_progress', created_at + INTERVAL '1 hour' FROM t3
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'david.smith@company.com'), 'status_changed', 'in_progress', 'waiting', created_at + INTERVAL '2 days' FROM t3;

-- Ticket 4: Medium - Email syncing on mobile
WITH t4 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, created_at, updated_at)
  SELECT
    'Email not syncing on iOS Outlook app',
    'Outlook mobile app on my iPhone stopped syncing emails since yesterday. I can send emails but new incoming messages do not show up. I have tried force-closing the app and restarting my phone. All other apps work fine on WiFi and cellular.',
    'open', 'medium', 'incident',
    (SELECT id FROM users WHERE email = 'patricia.davis@company.com'),
    (SELECT id FROM users WHERE email = 'elena.rodriguez@company.com'),
    (SELECT id FROM categories WHERE name = 'Email & Communication'),
    (SELECT id FROM sla_policies WHERE name = 'P3 Medium'),
    ARRAY['email', 'outlook', 'ios', 'mobile'],
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '12 hours'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'patricia.davis@company.com'), 'created', NULL, 'Ticket created', created_at FROM t4;

-- Ticket 5: Low - New hire onboarding
WITH t5 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, due_date, created_at, updated_at)
  SELECT
    'New hire onboarding - Software setup',
    'We have a new Finance analyst starting next Monday. She needs: Excel (advanced), SAP client, Salesforce access, Slack, Zoom, and a company laptop with dual monitors. Can we get this set up before her start date?',
    'open', 'low', 'service_request',
    (SELECT id FROM users WHERE email = 'robert.taylor@company.com'),
    (SELECT id FROM users WHERE email = 'david.smith@company.com'),
    (SELECT id FROM categories WHERE name = 'Software Installation'),
    (SELECT id FROM sla_policies WHERE name = 'P4 Low'),
    ARRAY['onboarding', 'new-hire', 'finance', 'software'],
    NOW() + INTERVAL '5 days',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '6 days'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'robert.taylor@company.com'), 'created', NULL, 'Ticket created', created_at FROM t5
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), 'assigned', 'unassigned', 'David Smith', created_at + INTERVAL '2 hours' FROM t5;

-- Ticket 6: Server CPU critical alert
WITH t6 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, first_response_at, created_at, updated_at)
  SELECT
    'Database server CPU at 95% - Performance degradation',
    'Alert from monitoring system: SRV-PROD-DB01 CPU sustained at 95-98% for the past 30 minutes. Database queries are timing out and the CRM application is responding slowly. Approximately 200 users are affected.',
    'resolved', 'critical', 'incident',
    (SELECT id FROM users WHERE email = 'michael.wilson@company.com'),
    (SELECT id FROM users WHERE email = 'alex.wilson@company.com'),
    (SELECT id FROM categories WHERE name = 'Server & Infrastructure'),
    (SELECT id FROM sla_policies WHERE name = 'P1 Critical'),
    ARRAY['server', 'database', 'cpu', 'performance', 'alert'],
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '8 days'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'michael.wilson@company.com'), 'created', NULL, 'Ticket created', created_at FROM t6
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), 'assigned', 'unassigned', 'Alex Wilson', created_at + INTERVAL '5 minutes' FROM t6
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'alex.wilson@company.com'), 'status_changed', 'open', 'in_progress', created_at + INTERVAL '10 minutes' FROM t6
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'alex.wilson@company.com'), 'status_changed', 'in_progress', 'resolved', created_at + INTERVAL '2 days' FROM t6
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), 'sla_breached', 'false', 'true', created_at + INTERVAL '4 hours' FROM t6;

-- Update ticket 6 with resolved time and SLA breach
UPDATE tickets SET resolved_at = NOW() - INTERVAL '8 days', sla_breached = true, close_notes = 'Found runaway query from reporting module. Killed the process and optimized the query. CPU returned to normal (25-35%).' WHERE title = 'Database server CPU at 95% - Performance degradation';

-- Ticket 7: Password reset
WITH t7 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, resolved_at, created_at, updated_at)
  SELECT
    'Password reset request - Account locked',
    'I have been locked out of my account after 3 failed login attempts. I need my password reset. This is urgent as I have a client meeting in 30 minutes.',
    'closed', 'low', 'service_request',
    (SELECT id FROM users WHERE email = 'thomas.anderson@company.com'),
    (SELECT id FROM users WHERE email = 'elena.rodriguez@company.com'),
    (SELECT id FROM categories WHERE name = 'Account & Access'),
    (SELECT id FROM sla_policies WHERE name = 'P4 Low'),
    ARRAY['password', 'account', 'locked', 'access'],
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '14 days',
    NOW() - INTERVAL '13 days'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'thomas.anderson@company.com'), 'created', NULL, 'Ticket created', created_at FROM t7
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), 'assigned', 'unassigned', 'Elena Rodriguez', created_at + INTERVAL '10 minutes' FROM t7
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'elena.rodriguez@company.com'), 'status_changed', 'open', 'in_progress', created_at + INTERVAL '15 minutes' FROM t7
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'elena.rodriguez@company.com'), 'status_changed', 'in_progress', 'resolved', created_at + INTERVAL '20 minutes' FROM t7
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'elena.rodriguez@company.com'), 'status_changed', 'resolved', 'closed', created_at + INTERVAL '1 day' FROM t7;

UPDATE tickets SET close_notes = 'Password reset completed. User informed of new temporary password and required to change on next login.', closed_at = NOW() - INTERVAL '13 days' WHERE title = 'Password reset request - Account locked';

-- Ticket 8: Suspicious login - Security
WITH t8 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, created_at, updated_at)
  SELECT
    'Suspicious login attempt detected - VP of Sales account',
    'Security alert: Multiple failed login attempts from IP 185.220.101.x (Germany) on James Miller''s account over the past 2 hours. This is outside the normal login pattern. Account has been temporarily locked. Please investigate.',
    'in_progress', 'critical', 'incident',
    (SELECT id FROM users WHERE email = 'sarah.chen@company.com'),
    (SELECT id FROM users WHERE email = 'maya.patel@company.com'),
    (SELECT id FROM categories WHERE name = 'Security Incident'),
    (SELECT id FROM sla_policies WHERE name = 'P1 Critical'),
    ARRAY['security', 'suspicious-login', 'brute-force', 'investigation'],
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '2 days'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), 'created', NULL, 'Ticket created', created_at FROM t8
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), 'assigned', 'unassigned', 'Maya Patel', created_at + INTERVAL '5 minutes' FROM t8
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'maya.patel@company.com'), 'status_changed', 'open', 'in_progress', created_at + INTERVAL '15 minutes' FROM t8;

-- Ticket 9: File server backup failure
WITH t9 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, created_at, updated_at)
  SELECT
    'File server backup failed - nightly job error',
    'The scheduled nightly backup for the Finance file server (FS-FINANCE-01) failed at 2:00 AM. Error code: VSS_E_UNEXPECTED. Volume Shadow Copy service may not be running. Last successful backup was 3 days ago.',
    'open', 'high', 'incident',
    (SELECT id FROM users WHERE email = 'robert.taylor@company.com'),
    (SELECT id FROM users WHERE email = 'alex.wilson@company.com'),
    (SELECT id FROM categories WHERE name = 'Data & Backup'),
    (SELECT id FROM sla_policies WHERE name = 'P2 High'),
    ARRAY['backup', 'file-server', 'finance', 'vss-error'],
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '8 hours'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'robert.taylor@company.com'), 'created', NULL, 'Ticket created', created_at FROM t9;

-- Ticket 10: Monitor replacement (closed)
WITH t10 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, resolved_at, closed_at, created_at, updated_at)
  SELECT
    'Replace broken monitor - Engineering',
    'My Dell 27" monitor (U2723QE) started flickering this morning and now the screen is completely black. The power light is on but no display. This is my primary development monitor.',
    'closed', 'low', 'service_request',
    (SELECT id FROM users WHERE email = 'michael.wilson@company.com'),
    (SELECT id FROM users WHERE email = 'david.smith@company.com'),
    (SELECT id FROM categories WHERE name = 'Hardware Issues'),
    (SELECT id FROM sla_policies WHERE name = 'P4 Low'),
    ARRAY['monitor', 'dell', 'replacement', 'hardware'],
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '19 days',
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '18 days'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'michael.wilson@company.com'), 'created', NULL, 'Ticket created', created_at FROM t10
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), 'assigned', 'unassigned', 'David Smith', created_at + INTERVAL '1 hour' FROM t10
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'david.smith@company.com'), 'status_changed', 'open', 'in_progress', created_at + INTERVAL '2 hours' FROM t10
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'david.smith@company.com'), 'status_changed', 'in_progress', 'resolved', created_at + INTERVAL '5 days' FROM t10
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'david.smith@company.com'), 'status_changed', 'resolved', 'closed', created_at + INTERVAL '6 days' FROM t10;

UPDATE tickets SET close_notes = 'Replaced Dell U2723QE with identical model. Old monitor sent for warranty repair. User confirmed working.' WHERE title = 'Replace broken monitor - Engineering';

-- Ticket 11: WiFi issues
WITH t11 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, created_at, updated_at)
  SELECT
    'WiFi connectivity issues in Conference Room B',
    'Users are experiencing intermittent WiFi drops in Conference Room B on the 2nd floor. The connection drops every 10-15 minutes and requires reconnecting. This is happening on multiple devices (both Windows and Mac).',
    'waiting', 'medium', 'incident',
    (SELECT id FROM users WHERE email = 'lisa.garcia@company.com'),
    (SELECT id FROM users WHERE email = 'alex.wilson@company.com'),
    (SELECT id FROM categories WHERE name = 'Network & Connectivity'),
    (SELECT id FROM sla_policies WHERE name = 'P3 Medium'),
    ARRAY['wifi', 'conference-room', 'connectivity', 'intermittent'],
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '2 days'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'lisa.garcia@company.com'), 'created', NULL, 'Ticket created', created_at FROM t11
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), 'assigned', 'unassigned', 'Alex Wilson', created_at + INTERVAL '30 minutes' FROM t11
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'alex.wilson@company.com'), 'status_changed', 'open', 'in_progress', created_at + INTERVAL '2 hours' FROM t11
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'alex.wilson@company.com'), 'status_changed', 'in_progress', 'waiting', created_at + INTERVAL '1 day' FROM t11;

-- Ticket 12: New employee laptop (resolved)
WITH t12 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, resolved_at, created_at, updated_at)
  SELECT
    'New employee laptop setup - HR Coordinator',
    'Need a laptop prepared for the new HR Coordinator starting next Monday. Requirements: Windows 11, Office 365, HRMS client, company standard security tools. Laptop is a Lenovo ThinkPad X1 Carbon.',
    'resolved', 'medium', 'service_request',
    (SELECT id FROM users WHERE email = 'jennifer.brown@company.com'),
    (SELECT id FROM users WHERE email = 'elena.rodriguez@company.com'),
    (SELECT id FROM categories WHERE name = 'Hardware Issues'),
    (SELECT id FROM sla_policies WHERE name = 'P3 Medium'),
    ARRAY['onboarding', 'laptop', 'setup', 'new-hire'],
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '6 days'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'jennifer.brown@company.com'), 'created', NULL, 'Ticket created', created_at FROM t12
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), 'assigned', 'unassigned', 'Elena Rodriguez', created_at + INTERVAL '2 hours' FROM t12
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'elena.rodriguez@company.com'), 'status_changed', 'open', 'in_progress', created_at + INTERVAL '1 day' FROM t12
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'elena.rodriguez@company.com'), 'status_changed', 'in_progress', 'resolved', created_at + INTERVAL '3 days' FROM t12;

-- Ticket 13: Software upgrade request
WITH t13 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, created_at, updated_at)
  SELECT
    'Accounting software upgrade - QuickBooks 2025',
    'Our Finance team needs to upgrade from QuickBooks 2024 to QuickBooks 2025. The upgrade needs to be deployed to 5 machines in the Finance department. The license has been purchased. Needs to be done before month-end close.',
    'open', 'medium', 'change',
    (SELECT id FROM users WHERE email = 'robert.taylor@company.com'),
    (SELECT id FROM users WHERE email = 'elena.rodriguez@company.com'),
    (SELECT id FROM categories WHERE name = 'Software / Applications'),
    (SELECT id FROM sla_policies WHERE name = 'P3 Medium'),
    ARRAY['quickbooks', 'upgrade', 'finance', 'software'],
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '2 days'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'robert.taylor@company.com'), 'created', NULL, 'Ticket created', created_at FROM t13
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), 'assigned', 'unassigned', 'Elena Rodriguez', created_at + INTERVAL '3 hours' FROM t13;

-- Ticket 14: Security audit - vulnerability scan
WITH t14 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, created_at, updated_at)
  SELECT
    'Security audit - Critical vulnerabilities found in quarterly scan',
    'Quarterly vulnerability scan results are in. Found 3 critical vulnerabilities and 12 high-severity issues across our server infrastructure. Top priority: MS-2024-001 (Remote Code Execution in Windows Print Spooler) on 8 servers.',
    'in_progress', 'high', 'problem',
    (SELECT id FROM users WHERE email = 'marcus.johnson@company.com'),
    (SELECT id FROM users WHERE email = 'maya.patel@company.com'),
    (SELECT id FROM categories WHERE name = 'Security Incident'),
    (SELECT id FROM sla_policies WHERE name = 'P2 High'),
    ARRAY['security', 'vulnerability', 'audit', 'patching'],
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '5 days'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'marcus.johnson@company.com'), 'created', NULL, 'Ticket created', created_at FROM t14
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'marcus.johnson@company.com'), 'assigned', 'unassigned', 'Maya Patel', created_at + INTERVAL '5 minutes' FROM t14
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'maya.patel@company.com'), 'status_changed', 'open', 'in_progress', created_at + INTERVAL '1 hour' FROM t14;

-- Ticket 15: VoIP phone not working
WITH t15 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, created_at, updated_at)
  SELECT
    'VoIP desk phone not working - Sales floor',
    'My Cisco IP Phone 8845 is showing "No Service" on the display. It has been like this since 9 AM. I tried unplugging and reconnecting. Other phones on the floor are working fine.',
    'open', 'low', 'incident',
    (SELECT id FROM users WHERE email = 'james.miller@company.com'),
    (SELECT id FROM users WHERE email = 'david.smith@company.com'),
    (SELECT id FROM categories WHERE name = 'Phone & Mobile'),
    (SELECT id FROM sla_policies WHERE name = 'P4 Low'),
    ARRAY['voip', 'phone', 'cisco', 'sales'],
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '6 hours'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'james.miller@company.com'), 'created', NULL, 'Ticket created', created_at FROM t15;

-- Ticket 16: SLA breach - critical resolved
WITH t16 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, resolved_at, created_at, updated_at)
  SELECT
    'SLA breach - Critical production issue (CRM down)',
    'CRM application is completely down. Users getting HTTP 500 errors on login. All sales operations are halted. This is a P1 critical issue requiring immediate escalation.',
    'resolved', 'critical', 'incident',
    (SELECT id FROM users WHERE email = 'james.miller@company.com'),
    (SELECT id FROM users WHERE email = 'alex.wilson@company.com'),
    (SELECT id FROM categories WHERE name = 'Server & Infrastructure'),
    (SELECT id FROM sla_policies WHERE name = 'P1 Critical'),
    ARRAY['crm', 'production', 'outage', 'critical', 'sla'],
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '17 days'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'james.miller@company.com'), 'created', NULL, 'Ticket created', created_at FROM t16
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), 'assigned', 'unassigned', 'Alex Wilson', created_at + INTERVAL '5 minutes' FROM t16
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'alex.wilson@company.com'), 'status_changed', 'open', 'in_progress', created_at + INTERVAL '10 minutes' FROM t16
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'alex.wilson@company.com'), 'status_changed', 'in_progress', 'resolved', created_at + INTERVAL '3 days' FROM t16;

UPDATE tickets SET sla_breached = true, close_notes = 'Root cause: Database connection pool exhaustion due to a connection leak in the CRM API service. Restarted the service and increased connection pool limits. Patched the connection leak. Service restored after 4 hours.' WHERE title = 'SLA breach - Critical production issue (CRM down)';

-- Ticket 17: Remote desktop issue
WITH t17 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, created_at, updated_at)
  SELECT
    'Remote Desktop not connecting to office workstation',
    'I am trying to RDP into my office workstation from home but getting "This computer can''t connect to the remote computer" error. I have verified the computer is on (colleague checked) and I am using the correct IP address.',
    'in_progress', 'medium', 'incident',
    (SELECT id FROM users WHERE email = 'susan.white@company.com'),
    (SELECT id FROM users WHERE email = 'elena.rodriguez@company.com'),
    (SELECT id FROM categories WHERE name = 'VPN & Remote Access'),
    (SELECT id FROM sla_policies WHERE name = 'P3 Medium'),
    ARRAY['rdp', 'remote-desktop', 'vpn', 'access'],
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '1 day'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'susan.white@company.com'), 'created', NULL, 'Ticket created', created_at FROM t17
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), 'assigned', 'unassigned', 'Elena Rodriguez', created_at + INTERVAL '1 hour' FROM t17
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'elena.rodriguez@company.com'), 'status_changed', 'open', 'in_progress', created_at + INTERVAL '2 hours' FROM t17;

-- Ticket 18: Drive permission issue
WITH t18 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, created_at, updated_at)
  SELECT
    'Shared drive access denied - Legal department',
    'Several members of the Legal team are getting "Access Denied" when trying to open the "Corporate Contracts" shared drive (S:\ drive). The issue started this morning. No changes were made to permissions that we know of.',
    'waiting', 'high', 'incident',
    (SELECT id FROM users WHERE email = 'linda.martinez@company.com'),
    (SELECT id FROM users WHERE email = 'maya.patel@company.com'),
    (SELECT id FROM categories WHERE name = 'Account & Access'),
    (SELECT id FROM sla_policies WHERE name = 'P2 High'),
    ARRAY['permissions', 'shared-drive', 'access', 'legal'],
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '4 days'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'linda.martinez@company.com'), 'created', NULL, 'Ticket created', created_at FROM t18
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), 'assigned', 'unassigned', 'Maya Patel', created_at + INTERVAL '20 minutes' FROM t18
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'maya.patel@company.com'), 'status_changed', 'open', 'in_progress', created_at + INTERVAL '1 hour' FROM t18
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'maya.patel@company.com'), 'status_changed', 'in_progress', 'waiting', created_at + INTERVAL '2 days' FROM t18;

-- Ticket 19: Software license audit
WITH t19 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, created_at, updated_at)
  SELECT
    'Quarterly software license audit preparation',
    'We need to prepare for the quarterly software license audit. Please generate a report of all installed software across the company, highlight any unlicensed software, and prepare the compliance documentation. Due by end of quarter.',
    'open', 'low', 'change',
    (SELECT id FROM users WHERE email = 'robert.taylor@company.com'),
    (SELECT id FROM users WHERE email = 'david.smith@company.com'),
    (SELECT id FROM categories WHERE name = 'Software / Applications'),
    (SELECT id FROM sla_policies WHERE name = 'P4 Low'),
    ARRAY['license', 'audit', 'compliance', 'software'],
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '5 days'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'robert.taylor@company.com'), 'created', NULL, 'Ticket created', created_at FROM t19
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), 'assigned', 'unassigned', 'David Smith', created_at + INTERVAL '1 day' FROM t19;

-- Ticket 20: CRM slow performance
WITH t20 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, first_response_at, created_at, updated_at)
  SELECT
    'CRM system slow performance - All users affected',
    'The CRM system has been extremely slow for the past 2 days. Page load times are 10-15 seconds (normally 1-2 seconds). Some reports are timing out entirely. This is affecting the entire Sales team.',
    'in_progress', 'high', 'problem',
    (SELECT id FROM users WHERE email = 'james.miller@company.com'),
    (SELECT id FROM users WHERE email = 'elena.rodriguez@company.com'),
    (SELECT id FROM categories WHERE name = 'Software / Applications'),
    (SELECT id FROM sla_policies WHERE name = 'P2 High'),
    ARRAY['crm', 'slow', 'performance', 'sales'],
    NOW() - INTERVAL '12 hours',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '6 hours'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'james.miller@company.com'), 'created', NULL, 'Ticket created', created_at FROM t20
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), 'assigned', 'unassigned', 'Elena Rodriguez', created_at + INTERVAL '1 hour' FROM t20
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'elena.rodriguez@company.com'), 'status_changed', 'open', 'in_progress', created_at + INTERVAL '2 hours' FROM t20;

-- Ticket 21: New security policy deployment
WITH t21 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, created_at, updated_at)
  SELECT
    'New security policy deployment - MFA for all users',
    'As part of the security initiative, we need to roll out MFA to all 200+ users. This includes: sending communication, scheduling enrollment sessions, updating documentation, and providing support during the transition. Target completion: 2 weeks.',
    'open', 'medium', 'change',
    (SELECT id FROM users WHERE email = 'marcus.johnson@company.com'),
    (SELECT id FROM users WHERE email = 'maya.patel@company.com'),
    (SELECT id FROM categories WHERE name = 'Security Incident'),
    (SELECT id FROM sla_policies WHERE name = 'P3 Medium'),
    ARRAY['mfa', 'security', 'rollout', 'policy'],
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '3 days'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'marcus.johnson@company.com'), 'created', NULL, 'Ticket created', created_at FROM t21
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'marcus.johnson@company.com'), 'assigned', 'unassigned', 'Maya Patel', created_at + INTERVAL '10 minutes' FROM t21;

-- Ticket 22: broken laptop screen
WITH t22 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, created_at, updated_at)
  SELECT
    'Dropped laptop - Screen cracked (Marketing)',
    'I accidentally dropped my company laptop (Surface Laptop 6) and the screen is cracked. The display has black spots and lines across it. The laptop still boots and I can connect to an external monitor. Need a replacement ASAP for a presentation next week.',
    'open', 'medium', 'incident',
    (SELECT id FROM users WHERE email = 'lisa.garcia@company.com'),
    (SELECT id FROM users WHERE email = 'david.smith@company.com'),
    (SELECT id FROM categories WHERE name = 'Hardware Issues'),
    (SELECT id FROM sla_policies WHERE name = 'P3 Medium'),
    ARRAY['laptop', 'damage', 'screen', 'replacement'],
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '4 hours'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'lisa.garcia@company.com'), 'created', NULL, 'Ticket created', created_at FROM t22;

-- Ticket 23: Access request for contractor
WITH t23 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, created_at, updated_at)
  SELECT
    'Contractor access request - External consultant',
    'We have a security consultant starting next week who needs temporary access to our SIEM system and vulnerability management platform. Access needed for 4 weeks. Consultant name: John Smith. Company: SecureShield Consulting.',
    'open', 'low', 'service_request',
    (SELECT id FROM users WHERE email = 'marcus.johnson@company.com'),
    (SELECT id FROM users WHERE email = 'maya.patel@company.com'),
    (SELECT id FROM categories WHERE name = 'Account & Access'),
    (SELECT id FROM sla_policies WHERE name = 'P4 Low'),
    ARRAY['contractor', 'access', 'temporary', 'consultant'],
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '2 days'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'marcus.johnson@company.com'), 'created', NULL, 'Ticket created', created_at FROM t23;

-- Ticket 24: Windows update issue
WITH t24 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, resolved_at, created_at, updated_at)
  SELECT
    'Windows Update stuck at 95% - Multiple machines',
    'Several employees in Operations are reporting that their Windows Update installation is stuck at 95% for the KB5035853 update. The update has been trying to install for 2 days. Restarting does not help.',
    'resolved', 'medium', 'problem',
    (SELECT id FROM users WHERE email = 'patricia.davis@company.com'),
    (SELECT id FROM users WHERE email = 'elena.rodriguez@company.com'),
    (SELECT id FROM categories WHERE name = 'Software / Applications'),
    (SELECT id FROM sla_policies WHERE name = 'P3 Medium'),
    ARRAY['windows-update', 'stuck', 'kb5035853', 'patching'],
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '9 days'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'patricia.davis@company.com'), 'created', NULL, 'Ticket created', created_at FROM t24
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), 'assigned', 'unassigned', 'Elena Rodriguez', created_at + INTERVAL '1 hour' FROM t24
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'elena.rodriguez@company.com'), 'status_changed', 'open', 'in_progress', created_at + INTERVAL '3 hours' FROM t24
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'elena.rodriguez@company.com'), 'status_changed', 'in_progress', 'resolved', created_at + INTERVAL '5 days' FROM t24;

UPDATE tickets SET close_notes = 'Fixed by clearing Windows Update cache (SoftwareDistribution folder) and running Windows Update Troubleshooter. Applied the update manually via Microsoft Catalog for affected machines.' WHERE title = 'Windows Update stuck at 95% - Multiple machines';

-- Ticket 25: Data restore request
WITH t25 AS (
  INSERT INTO tickets (title, description, status, priority, ticket_type, created_by_id, assigned_to_id, category_id, sla_policy_id, tags, first_response_at, resolved_at, created_at, updated_at)
  SELECT
    'Accidental file deletion - Restore from backup',
    'I accidentally deleted an important client contract file from the Legal shared drive. The file was called "Client-Agreement-AcmeCorp-FINAL.docx". I need it restored from the most recent backup. It was deleted approximately 2 hours ago.',
    'resolved', 'high', 'service_request',
    (SELECT id FROM users WHERE email = 'linda.martinez@company.com'),
    (SELECT id FROM users WHERE email = 'alex.wilson@company.com'),
    (SELECT id FROM categories WHERE name = 'Data & Backup'),
    (SELECT id FROM sla_policies WHERE name = 'P2 High'),
    ARRAY['restore', 'backup', 'file-recovery', 'legal'],
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '18 days',
    NOW() - INTERVAL '16 days'
  RETURNING id, created_at
)
INSERT INTO ticket_activity (ticket_id, actor_id, action, old_value, new_value, created_at)
SELECT id, (SELECT id FROM users WHERE email = 'linda.martinez@company.com'), 'created', NULL, 'Ticket created', created_at FROM t25
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), 'assigned', 'unassigned', 'Alex Wilson', created_at + INTERVAL '2 minutes' FROM t25
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'alex.wilson@company.com'), 'status_changed', 'open', 'in_progress', created_at + INTERVAL '5 minutes' FROM t25
UNION ALL
SELECT id, (SELECT id FROM users WHERE email = 'alex.wilson@company.com'), 'status_changed', 'in_progress', 'resolved', created_at + INTERVAL '2 days' FROM t25;

UPDATE tickets SET close_notes = 'Restored "Client-Agreement-AcmeCorp-FINAL.docx" from last night''s backup. File was recovered to its original location. User confirmed all content is intact.' WHERE title = 'Accidental file deletion - Restore from backup';

-- ============================================================================
-- 8. TICKET COMMENTS
-- ============================================================================

-- Comments on Ticket 1 (VPN down - critical)
INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal, created_at)
SELECT t.id, u.id, 'I''ve checked the VPN server logs. It looks like the license server expired. Checking on renewing now.', false, t.updated_at - INTERVAL '2 days'
FROM tickets t, users u WHERE t.title LIKE 'VPN service down%' AND u.email = 'alex.wilson@company.com';

INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal, created_at)
SELECT t.id, u.id, 'License renewed. VPN service is back online. Users can reconnect. I will monitor for the next hour to ensure stability.', false, t.updated_at - INTERVAL '1 day'
FROM tickets t, users u WHERE t.title LIKE 'VPN service down%' AND u.email = 'alex.wilson@company.com';

INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal, created_at)
SELECT t.id, u.id, 'We need to set an alert for license expiry. This almost became a major outage. Adding a monitoring check.', true, t.updated_at - INTERVAL '1 day'
FROM tickets t, users u WHERE t.title LIKE 'VPN service down%' AND u.email = 'marcus.johnson@company.com';

-- Comments on Ticket 3 (Printer)
INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal, created_at)
SELECT t.id, u.id, 'I checked the printer. It appears to have lost its IP configuration. Waiting on facilities to get me access to the network closet to trace the cable.', false, t.updated_at - INTERVAL '3 days'
FROM tickets t, users u WHERE t.title LIKE 'Printer not responding%' AND u.email = 'david.smith@company.com';

INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal, created_at)
SELECT t.id, u.id, 'Facilities will have someone available tomorrow at 10 AM to open the closet. I''ll follow up then.', true, t.updated_at - INTERVAL '2 days'
FROM tickets t, users u WHERE t.title LIKE 'Printer not responding%' AND u.email = 'david.smith@company.com';

-- Comments on Ticket 6 (Database server)
INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal, created_at)
SELECT t.id, u.id, 'Found the issue - a reporting query from the Analytics team was not properly indexed and was consuming all CPU. I have killed the process and the DBA team is optimizing the query.', false, t.updated_at - INTERVAL '10 days'
FROM tickets t, users u WHERE t.title LIKE 'Database server CPU%' AND u.email = 'alex.wilson@company.com';

INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal, created_at)
SELECT t.id, u.id, 'Thanks Alex! Let''s schedule a review of all reporting queries to prevent this from happening again.', false, t.updated_at - INTERVAL '10 days'
FROM tickets t, users u WHERE t.title LIKE 'Database server CPU%' AND u.email = 'michael.wilson@company.com';

-- Comments on Ticket 8 (Suspicious login)
INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal, created_at)
SELECT t.id, u.id, 'Initial investigation: The IP 185.220.101.x is associated with a known threat actor group (Viking Spider). I have blocked the IP range at the firewall level. User''s MFA tokens are being reset as a precaution.', false, t.updated_at - INTERVAL '3 days'
FROM tickets t, users u WHERE t.title LIKE 'Suspicious login%' AND u.email = 'maya.patel@company.com';

INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal, created_at)
SELECT t.id, u.id, 'Good catch Maya. Please also initiate a password reset for James and enable login notifications on his account.', true, t.updated_at - INTERVAL '3 days'
FROM tickets t, users u WHERE t.title LIKE 'Suspicious login%' AND u.email = 'marcus.johnson@company.com';

INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal, created_at)
SELECT t.id, u.id, 'Password reset completed, MFA tokens refreshed, and login alerts enabled. Monitoring for any further suspicious activity. No evidence of data compromise found.', false, t.updated_at - INTERVAL '2 days'
FROM tickets t, users u WHERE t.title LIKE 'Suspicious login%' AND u.email = 'maya.patel@company.com';

-- Comments on Ticket 11 (WiFi)
INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal, created_at)
SELECT t.id, u.id, 'I checked the access point in Conference Room B. Firmware is outdated (v3.2.1, latest is v4.0.5). Scheduling a firmware update during maintenance window this weekend.', false, t.updated_at - INTERVAL '1 day'
FROM tickets t, users u WHERE t.title LIKE 'WiFi connectivity%' AND u.email = 'alex.wilson@company.com';

-- Comments on Ticket 14 (Security audit)
INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal, created_at)
SELECT t.id, u.id, 'I have deployed the MS-2024-001 patch to all 8 affected servers. The 12 high-severity issues are being triaged. Estimated time to full remediation: 2 weeks.', false, t.updated_at - INTERVAL '4 days'
FROM tickets t, users u WHERE t.title LIKE 'Security audit%' AND u.email = 'maya.patel@company.com';

INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal, created_at)
SELECT t.id, u.id, 'Excellent progress. Keep me posted on the high-severity items. I want a status report for next week''s leadership meeting.', true, t.updated_at - INTERVAL '4 days'
FROM tickets t, users u WHERE t.title LIKE 'Security audit%' AND u.email = 'marcus.johnson@company.com';

-- Comments on Ticket 20 (CRM slow)
INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal, created_at)
SELECT t.id, u.id, 'I checked the CRM application logs. The database query for the dashboard is taking 8+ seconds. The main table has grown to 2M rows without proper indexing. Working with the CRM vendor on a fix.', false, t.updated_at - INTERVAL '1 day'
FROM tickets t, users u WHERE t.title LIKE 'CRM system slow%' AND u.email = 'elena.rodriguez@company.com';

-- Comments on Ticket 24 (Windows Update)
INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal, created_at)
SELECT t.id, u.id, 'This is a known issue with KB5035853. Microsoft has acknowledged it. The workaround is to clear the SoftwareDistribution folder. I will apply this to all affected machines remotely.', false, t.updated_at - INTERVAL '12 days'
FROM tickets t, users u WHERE t.title LIKE 'Windows Update stuck%' AND u.email = 'elena.rodriguez@company.com';

-- ============================================================================
-- 9. TICKET WATCHERS
-- ============================================================================
INSERT INTO ticket_watchers (ticket_id, user_id, added_by)
SELECT t.id, u.id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com')
FROM tickets t, users u
WHERE t.title LIKE 'VPN service down%' AND u.email = 'marcus.johnson@company.com'
AND NOT EXISTS (SELECT 1 FROM ticket_watchers WHERE ticket_id = t.id AND user_id = u.id);

INSERT INTO ticket_watchers (ticket_id, user_id, added_by)
SELECT t.id, u.id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com')
FROM tickets t, users u
WHERE t.title LIKE 'Suspicious login%' AND u.email = 'marcus.johnson@company.com'
AND NOT EXISTS (SELECT 1 FROM ticket_watchers WHERE ticket_id = t.id AND user_id = u.id);

INSERT INTO ticket_watchers (ticket_id, user_id, added_by)
SELECT t.id, u.id, (SELECT id FROM users WHERE email = 'sarah.chen@company.com')
FROM tickets t, users u
WHERE t.title LIKE 'CRM system slow%' AND u.email = 'james.miller@company.com'
AND NOT EXISTS (SELECT 1 FROM ticket_watchers WHERE ticket_id = t.id AND user_id = u.id);

-- ============================================================================
-- 10. SATISFACTION SURVEYS
-- ============================================================================
INSERT INTO satisfaction_surveys (ticket_id, user_id, rating, comment, sent_at, responded_at)
SELECT t.id, t.created_by_id, 4, 'The issue was resolved quickly once it was picked up. Would appreciate faster initial response next time.', t.resolved_at + INTERVAL '1 day', t.resolved_at + INTERVAL '2 days'
FROM tickets t WHERE t.title LIKE 'Database server CPU%'
  AND NOT EXISTS (SELECT 1 FROM satisfaction_surveys WHERE ticket_id = t.id);

INSERT INTO satisfaction_surveys (ticket_id, user_id, rating, comment, sent_at, responded_at)
SELECT t.id, t.created_by_id, 5, 'Elena was super helpful! Password reset done in minutes. Saved my client meeting!', t.resolved_at + INTERVAL '1 day', t.resolved_at + INTERVAL '3 hours'
FROM tickets t WHERE t.title LIKE 'Password reset%'
  AND NOT EXISTS (SELECT 1 FROM satisfaction_surveys WHERE ticket_id = t.id);

INSERT INTO satisfaction_surveys (ticket_id, user_id, rating, comment, sent_at, responded_at)
SELECT t.id, t.created_by_id, 3, 'The replacement monitor was good but it took almost a week to get it resolved. Need faster turnaround for hardware issues.', t.closed_at + INTERVAL '1 day', t.closed_at + INTERVAL '5 days'
FROM tickets t WHERE t.title LIKE 'Replace broken monitor%'
  AND NOT EXISTS (SELECT 1 FROM satisfaction_surveys WHERE ticket_id = t.id);

INSERT INTO satisfaction_surveys (ticket_id, user_id, rating, comment, sent_at, responded_at)
SELECT t.id, t.created_by_id, 5, 'File was restored quickly and Alex kept me updated throughout the process. Excellent service!', t.resolved_at + INTERVAL '1 day', t.resolved_at + INTERVAL '1 day'
FROM tickets t WHERE t.title LIKE 'Accidental file deletion%'
  AND NOT EXISTS (SELECT 1 FROM satisfaction_surveys WHERE ticket_id = t.id);

INSERT INTO satisfaction_surveys (ticket_id, user_id, rating, comment, sent_at, responded_at)
SELECT t.id, t.created_by_id, 4, 'The laptop was set up on time for the new hire. Everything was ready. Great job!', t.resolved_at + INTERVAL '1 day', t.resolved_at + INTERVAL '2 days'
FROM tickets t WHERE t.title LIKE 'New employee laptop%'
  AND NOT EXISTS (SELECT 1 FROM satisfaction_surveys WHERE ticket_id = t.id);

-- ============================================================================
-- 11. NOTIFICATIONS
-- ============================================================================
INSERT INTO notifications (user_id, type, title, body, ticket_id, is_read, created_at)
SELECT u.id, 'ticket:assigned', 'Ticket assigned to you', 'Ticket "VPN service down for remote employees" has been assigned to you.', t.id, true, t.created_at + INTERVAL '10 minutes'
FROM users u, tickets t WHERE u.email = 'alex.wilson@company.com' AND t.title LIKE 'VPN service down%';

INSERT INTO notifications (user_id, type, title, body, ticket_id, is_read, created_at)
SELECT u.id, 'ticket:comment', 'New comment on VPN service ticket', 'Alex Wilson added a comment on "VPN service down for remote employees".', t.id, true, t.updated_at - INTERVAL '2 days'
FROM users u, tickets t WHERE u.email = 'marcus.johnson@company.com' AND t.title LIKE 'VPN service down%';

INSERT INTO notifications (user_id, type, title, body, ticket_id, is_read, created_at)
SELECT u.id, 'ticket:assigned', 'Security incident assigned', 'Ticket "Suspicious login attempt detected" has been assigned to you.', t.id, true, t.created_at + INTERVAL '5 minutes'
FROM users u, tickets t WHERE u.email = 'maya.patel@company.com' AND t.title LIKE 'Suspicious login%';

INSERT INTO notifications (user_id, type, title, body, ticket_id, is_read, created_at)
SELECT u.id, 'ticket:sla_breach_warning', 'SLA breach warning (75%)', 'Ticket "SLA breach - Critical production issue (CRM down)" is at 75% of SLA response time.', t.id, false, t.created_at + INTERVAL '45 minutes'
FROM users u, tickets t WHERE u.email = 'alex.wilson@company.com' AND t.title LIKE 'SLA breach - Critical%';

INSERT INTO notifications (user_id, type, title, body, ticket_id, is_read, created_at)
SELECT u.id, 'ticket:sla_breach', 'SLA breach - Critical ticket', 'Ticket "Database server CPU at 95%" has breached its SLA. Immediate attention required.', t.id, true, t.created_at + INTERVAL '4 hours'
FROM users u, tickets t WHERE u.email = 'sarah.chen@company.com' AND t.title LIKE 'Database server CPU%';

INSERT INTO notifications (user_id, type, title, body, ticket_id, is_read, created_at)
SELECT u.id, 'ticket:comment', 'New comment on security incident', 'Maya Patel added an update on "Suspicious login attempt detected".', t.id, false, t.updated_at - INTERVAL '3 days'
FROM users u, tickets t WHERE u.email = 'marcus.johnson@company.com' AND t.title LIKE 'Suspicious login%';

INSERT INTO notifications (user_id, type, title, body, ticket_id, is_read, created_at)
SELECT u.id, 'system:weekly_report', 'Weekly IT Summary Available', 'Your weekly IT support summary is now available. Tickets created: 22, Resolved: 18, Satisfaction: 4.2/5', NULL, false, NOW() - INTERVAL '2 days'
FROM users u WHERE u.email = 'sarah.chen@company.com';

INSERT INTO notifications (user_id, type, title, body, ticket_id, is_read, created_at)
SELECT u.id, 'ticket:new', 'New ticket created - CRM slow performance', 'James Miller reported "CRM system slow performance - All users affected" (High priority).', t.id, false, t.created_at
FROM users u, tickets t WHERE u.email = 'sarah.chen@company.com' AND t.title LIKE 'CRM system slow%';

INSERT INTO notifications (user_id, type, title, body, ticket_id, is_read, created_at)
SELECT u.id, 'ticket:assigned', 'New ticket assigned to you', 'Ticket "Windows Update stuck at 95%" has been assigned to you.', t.id, true, t.created_at + INTERVAL '1 hour'
FROM users u, tickets t WHERE u.email = 'elena.rodriguez@company.com' AND t.title LIKE 'Windows Update stuck%';

-- ============================================================================
-- 12. KNOWLEDGE ARTICLES
-- ============================================================================
INSERT INTO knowledge_articles (title, slug, body, category_id, author_id, status, views, helpful_count, not_helpful_count, tags, published_at, created_at, updated_at)
SELECT
  'How to Reset Your Password',
  'how-to-reset-your-password',
  'If you have forgotten your password or need to reset it for security reasons, follow these steps:

1. Go to the login page at https://portal.company.com/login
2. Click the "Forgot Password" link below the login button
3. Enter your company email address
4. Check your inbox for a password reset email (allow up to 5 minutes)
5. Click the reset link in the email (it expires after 1 hour)
6. Enter your new password. Requirements:
   - At least 12 characters long
   - Contains uppercase and lowercase letters
   - Contains at least one number
   - Contains at least one special character (!@#$%)
   - Cannot be one of your last 5 passwords
7. Confirm your new password and submit
8. Log in with your new password

If you do not receive the reset email within 5 minutes:
- Check your Spam/Junk folder
- Check email forwarding rules if you have them enabled
- Contact the IT Help Desk at extension 555-0103

For security reasons, passwords expire every 90 days. You will receive email reminders 7 days and 1 day before expiration.',
  (SELECT id FROM categories WHERE name = 'Account & Access'),
  (SELECT id FROM users WHERE email = 'elena.rodriguez@company.com'),
  'published', 342, 28, 3, ARRAY['password', 'account', 'reset', 'security'],
  NOW() - INTERVAL '60 days',
  NOW() - INTERVAL '60 days',
  NOW() - INTERVAL '5 days'
WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles WHERE slug = 'how-to-reset-your-password');

INSERT INTO knowledge_articles (title, slug, body, category_id, author_id, status, views, helpful_count, not_helpful_count, tags, published_at, created_at, updated_at)
SELECT
  'Connecting to the Corporate VPN (AnyConnect)',
  'connecting-to-corporate-vpn-anyconnect',
  'This guide covers how to connect to the corporate VPN using Cisco AnyConnect.

## Prerequisites
- Cisco AnyConnect client installed on your device
- Active company account (not locked/disabled)
- Internet connection (WiFi or wired)
- Your MFA method configured and available

## Installation (if not already installed)

### Windows
1. Go to https://vpn.company.com and log in with your credentials
2. The AnyConnect client will download automatically
3. Run the installer and follow the prompts
4. Restart your computer if prompted

### macOS
1. Open Self Service app
2. Search for "AnyConnect"
3. Click Install
4. Follow the prompts

## Connecting
1. Open Cisco AnyConnect
2. Enter: vpn.company.com in the connection box
3. Click Connect
4. Enter your username and password
5. Complete the MFA challenge via your authenticator app
6. Wait for "Connected" status

## Troubleshooting
- "Connection refused": Contact IT Help Desk - the VPN service may be down
- "Authentication failed": Verify your password is correct. Reset if needed
- MFA not working: Contact IT to have your MFA device re-registered

## Disconnecting
Right-click the AnyConnect icon in your system tray and select "Disconnect".',
  (SELECT id FROM categories WHERE name = 'VPN & Remote Access'),
  (SELECT id FROM users WHERE email = 'alex.wilson@company.com'),
  'published', 567, 45, 8, ARRAY['vpn', 'anyconnect', 'remote-access', 'connectivity'],
  NOW() - INTERVAL '45 days',
  NOW() - INTERVAL '45 days',
  NOW() - INTERVAL '10 days'
WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles WHERE slug = 'connecting-to-corporate-vpn-anyconnect');

INSERT INTO knowledge_articles (title, slug, body, category_id, author_id, status, views, helpful_count, not_helpful_count, tags, published_at, created_at, updated_at)
SELECT
  'Company Printer Setup Guide',
  'company-printer-setup-guide',
  'How to add and configure company printers on your work computer.

## Windows 11
1. Open Settings → Bluetooth & devices → Printers & scanners
2. Click "Add device"
3. Wait for Windows to discover nearby printers
4. Select your printer from the list
5. If the printer doesn''t appear, click "Add manually"
6. Select "Add a printer using an IP address or hostname"
7. Choose "TCP/IP Device" and enter:
   - Floor 1-2: 192.168.5.50 (HP LaserJet MFP)
   - Floor 3-4: 192.168.5.51 (HP Color LaserJet)
   - Executive Suite: 192.168.5.52 (Xerox AltaLink)
8. Follow the driver installation prompts

## macOS
1. Open System Settings → Printers & Scanners
2. Click the "+" button
3. The printer should appear in the list automatically
4. Select it and click Add

## Common Issues
- Printer shows "Offline": Check the printer screen to ensure it''s awake
- Print job stuck: Open Print Queue → Cancel all documents → Restart print spooler
- Paper jam: Open the printer cover and carefully remove any jammed paper

For persistent issues, submit a ticket to the IT Help Desk.',
  (SELECT id FROM categories WHERE name = 'Printer & Peripherals'),
  (SELECT id FROM users WHERE email = 'david.smith@company.com'),
  'published', 198, 15, 4, ARRAY['printer', 'setup', 'guide', 'printing'],
  NOW() - INTERVAL '30 days',
  NOW() - INTERVAL '30 days',
  NOW() - INTERVAL '10 days'
WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles WHERE slug = 'company-printer-setup-guide');

INSERT INTO knowledge_articles (title, slug, body, category_id, author_id, status, views, helpful_count, not_helpful_count, tags, published_at, created_at, updated_at)
SELECT
  'IT Security Best Practices for Remote Work',
  'it-security-best-practices-remote-work',
  'Important security guidelines for working outside the office.

## 1. Always Use VPN
- The VPN must be active whenever you access company resources
- This includes email, shared drives, CRM, and internal websites
- Do NOT use public WiFi without the VPN active

## 2. Physical Security
- Lock your laptop when away from your desk (Windows+L or Control+Command+Q)
- Never leave devices unattended in public places
- Use privacy screens in public/coworking spaces
- Report lost or stolen devices IMMEDIATELY to IT

## 3. Password Hygiene
- Use unique passwords for company and personal accounts
- Enable MFA on all accounts that support it
- Never share passwords via email, Slack, or text message
- Use the company-approved password manager (Bitwarden)

## 4. Phishing Awareness
- Verify email sender addresses carefully
- Hover over links before clicking to see the actual URL
- Report suspicious emails via the "Report Phishing" button in Outlook
- When in doubt, forward to security@company.com

## 5. Device Security
- Keep your operating system updated (restart when prompted)
- Do not install unauthorized software
- Company devices are for business use only
- Report any unusual behavior to IT immediately

## Reporting a Security Incident
Call the IT Security team immediately at 555-0106 if you suspect:
- Your account has been compromised
- You see unauthorized access
- You lost a company device
- You clicked on a suspicious link',
  (SELECT id FROM categories WHERE name = 'Security Incident'),
  (SELECT id FROM users WHERE email = 'maya.patel@company.com'),
  'published', 432, 38, 2, ARRAY['security', 'remote-work', 'best-practices', 'phishing', 'vpn'],
  NOW() - INTERVAL '20 days',
  NOW() - INTERVAL '20 days',
  NOW() - INTERVAL '5 days'
WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles WHERE slug = 'it-security-best-practices-remote-work');

INSERT INTO knowledge_articles (title, slug, body, category_id, author_id, status, views, helpful_count, not_helpful_count, tags, published_at, created_at, updated_at)
SELECT
  'How to Request Software Installation',
  'how-to-request-software-installation',
  'Process for requesting new software to be installed on your company device.

## Standard Software (Pre-Approved)
The following software is pre-approved and can be installed via Self Service (Mac) or Software Center (Windows):
- Google Chrome, Firefox
- Microsoft 365 Apps
- Slack, Zoom, Teams
- Visual Studio Code
- 7-Zip, WinRAR
- Adobe Acrobat Reader
- Notepad++
- Putty, WinSCP
- Git for Windows

## Non-Standard Software
For software not in the approved list:
1. Submit a ticket via the portal with category "Software Installation"
2. Include the software name, version, and publisher
3. Provide a business justification
4. The IT team will review for:
   - Security compatibility
   - License compliance
   - System requirements
5. You will receive a decision within 2 business days

## Trial/Temporary Software
- Temporary licenses can be requested for up to 30 days
- The request must be approved by your department head
- IT will install and remove the software at the end of the trial period

## Important Notes
- Only IT can install software on company devices
- Do NOT attempt to install software using admin credentials
- Unauthorized software installations may result in disciplinary action
- All software must be properly licensed

For questions, contact the IT Help Desk at extension 555-0103.',
  (SELECT id FROM categories WHERE name = 'Software Installation'),
  (SELECT id FROM users WHERE email = 'david.smith@company.com'),
  'published', 156, 12, 1, ARRAY['software', 'installation', 'request', 'guide'],
  NOW() - INTERVAL '25 days',
  NOW() - INTERVAL '25 days',
  NOW() - INTERVAL '3 days'
WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles WHERE slug = 'how-to-request-software-installation');

INSERT INTO knowledge_articles (title, slug, body, category_id, author_id, status, views, helpful_count, not_helpful_count, tags, published_at, created_at, updated_at)
SELECT
  'Setting Up Email on Your Mobile Device',
  'setting-up-email-on-mobile-device',
  'How to configure your company email on iOS and Android devices.

## Recommended: Microsoft Outlook App

### iOS (iPhone/iPad)
1. Open the App Store and install "Microsoft Outlook"
2. Open the app and tap "Add Account"
3. Enter your company email address
4. You will be redirected to the company login page
5. Enter your credentials and complete MFA
6. Grant calendar and contact permissions when prompted

### Android
1. Open Google Play Store and install "Microsoft Outlook"
2. Open the app and tap "Get Started"
3. Enter your company email address
4. Complete the company portal login
5. Complete MFA verification
6. Grant calendar and contact permissions

## Alternative: Native Mail App (iOS)
1. Open Settings → Mail → Accounts → Add Account
2. Select "Microsoft Exchange"
3. Enter your email and password
4. Complete MFA verification
5. Choose what to sync: Mail, Contacts, Calendars

## Troubleshooting
- "Cannot connect to server": Ensure you have internet connectivity
- "Authentication failed": Reset your password first, then set up the account fresh
- Emails not syncing: Pull down to refresh, or force-close and reopen the app
- Missing emails: Check Focus/Focus mode settings on your device

## Security Notice
- Do not configure personal devices to auto-forward company emails
- Company email on personal devices is subject to Mobile Device Management (MDM) policy
- Lost or stolen devices must be reported within 1 hour to IT for remote wipe

For further help, contact the IT Help Desk at 555-0103 or submit a ticket.',
  (SELECT id FROM categories WHERE name = 'Email & Communication'),
  (SELECT id FROM users WHERE email = 'elena.rodriguez@company.com'),
  'published', 278, 22, 3, ARRAY['email', 'mobile', 'outlook', 'setup', 'ios', 'android'],
  NOW() - INTERVAL '15 days',
  NOW() - INTERVAL '15 days',
  NOW() - INTERVAL '2 days'
WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles WHERE slug = 'setting-up-email-on-mobile-device');

-- ============================================================================
-- 13. AI SESSIONS & MESSAGES
-- ============================================================================
INSERT INTO ai_sessions (user_id, title, created_at, updated_at)
SELECT u.id, 'IT Support - VPN troubleshooting', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'
FROM users u WHERE u.email = 'david.smith@company.com'
AND NOT EXISTS (SELECT 1 FROM ai_sessions WHERE title = 'IT Support - VPN troubleshooting' AND user_id = u.id);

INSERT INTO ai_sessions (user_id, title, created_at, updated_at)
SELECT u.id, 'Asset management help', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'
FROM users u WHERE u.email = 'elena.rodriguez@company.com'
AND NOT EXISTS (SELECT 1 FROM ai_sessions WHERE title = 'Asset management help' AND user_id = u.id);

INSERT INTO ai_sessions (user_id, title, created_at, updated_at)
SELECT u.id, 'Creating a ticket template', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'
FROM users u WHERE u.email = 'sarah.chen@company.com'
AND NOT EXISTS (SELECT 1 FROM ai_sessions WHERE title = 'Creating a ticket template' AND user_id = u.id);

-- Messages for Session 1 (VPN troubleshooting)
INSERT INTO ai_messages (session_id, role, content, created_at)
SELECT s.id, 'user', 'I need help troubleshooting a VPN issue. Users are getting "Connection refused" errors on AnyConnect.', s.created_at
FROM ai_sessions s WHERE s.title = 'IT Support - VPN troubleshooting' AND NOT EXISTS (SELECT 1 FROM ai_messages WHERE session_id = s.id);

INSERT INTO ai_messages (session_id, role, content, created_at)
SELECT s.id, 'assistant', 'Let me help you diagnose this. First, could you check the VPN server status? Common causes for "Connection refused" include:

1. The VPN service isn''t running on the server
2. The licensing server expired
3. Firewall rules blocking connections
4. The AnyConnect service needs restarting

Can you check the VPN server console to see if the service is active?', s.created_at + INTERVAL '1 minute'
FROM ai_sessions s WHERE s.title = 'IT Support - VPN troubleshooting';

INSERT INTO ai_messages (session_id, role, content, created_at)
SELECT s.id, 'user', 'I checked and the VPN service is running. Let me look at the license status.', s.created_at + INTERVAL '2 minutes'
FROM ai_sessions s WHERE s.title = 'IT Support - VPN troubleshooting';

INSERT INTO ai_messages (session_id, role, content, created_at)
SELECT s.id, 'assistant', 'Good idea! License expiry is a common issue with AnyConnect. If the license has expired:

1. Log into the Cisco Smart Account portal
2. Generate a new license key
3. Apply it to the VPN headend
4. Restart the AnyConnect service

Also, while you''re at it, check the current connection count vs your license limit in case you''ve exceeded the concurrent user limit.', s.created_at + INTERVAL '3 minutes'
FROM ai_sessions s WHERE s.title = 'IT Support - VPN troubleshooting';

INSERT INTO ai_messages (session_id, role, content, created_at)
SELECT s.id, 'assistant', 'Here''s a checklist for the VPN license renewal process:

1. Go to https://smartlicense.cisco.com
2. Navigate to Smart Account → Licenses
3. Find the AnyConnect Plus license
4. Click "Renew" or generate a new activation key
5. On the VPN headend: ssh into the device
6. Run: `license install <new-license-key>`
7. Run: `show license status` to verify
8. Restart the AnyConnect service: `service acwebagent restart`

Would you like me to help draft a ticket for the license renewal?', s.created_at + INTERVAL '4 minutes'
FROM ai_sessions s WHERE s.title = 'IT Support - VPN troubleshooting';

-- Messages for Session 2 (Asset management)
INSERT INTO ai_messages (session_id, role, content, created_at)
SELECT s.id, 'user', 'How can I find all assets assigned to a specific user?', s.created_at
FROM ai_sessions s WHERE s.title = 'Asset management help' AND NOT EXISTS (SELECT 1 FROM ai_messages WHERE session_id = s.id);

INSERT INTO ai_messages (session_id, role, content, created_at)
SELECT s.id, 'assistant', 'You can find assets assigned to a specific user in two ways:

1. **Via the Web UI**: Go to Users → Select the user → Click the Assets tab

2. **Via the Assets page**: Use the filter dropdown to filter by "Assigned To"

Each asset card will show the user''s name, department, and contact info directly on the card.

To see current hardware specs: Click on any asset to open the detail view, then select the Hardware tab for real-time CPU, RAM, disk, and network adapter info.

Is there a specific user you''re looking for?', s.created_at + INTERVAL '1 minute'
FROM ai_sessions s WHERE s.title = 'Asset management help';

INSERT INTO ai_messages (session_id, role, content, created_at)
SELECT s.id, 'user', 'I need to find all laptops that are due for warranty renewal this quarter.', s.created_at + INTERVAL '1 minute'
FROM ai_sessions s WHERE s.title = 'Asset management help';

INSERT INTO ai_messages (session_id, role, content, created_at)
SELECT s.id, 'assistant', 'To find assets expiring this quarter:

1. Go to Assets in the main navigation
2. Click on the "Filters" button
3. Set Type: "Laptop"
4. Set Warranty Expiry: Custom range → [Start of quarter] to [End of quarter]
5. You can also export this list as CSV for planning

Based on the current inventory, I can see you have approximately 5-8 laptops with warranties expiring in the next 90 days. You should start the budget planning for replacements soon - particularly the Dell Latitude 5430 models from 2022.

Tip: You can set up automated reminders for warranty expirations in the System Settings under "Asset Alerts."', s.created_at + INTERVAL '2 minutes'
FROM ai_sessions s WHERE s.title = 'Asset management help';

-- Messages for Session 3 (Ticket template)
INSERT INTO ai_messages (session_id, role, content, created_at)
SELECT s.id, 'user', 'Can you help me create a ticket template for new hire onboarding? It should include all the common setup steps.', s.created_at
FROM ai_sessions s WHERE s.title = 'Creating a ticket template' AND NOT EXISTS (SELECT 1 FROM ai_messages WHERE session_id = s.id);

INSERT INTO ai_messages (session_id, role, content, created_at)
SELECT s.id, 'assistant', 'Sure! Here''s a comprehensive new hire onboarding template:

**Template Name**: New Employee IT Setup
**Type**: Service Request
**Priority**: Medium
**Category**: Software Installation

**Checklist/Description**:
1. Prepare laptop (clean image, apply updates)
2. Install standard software suite:
   - Microsoft 365 (Outlook, Word, Excel, Teams)
   - Company-standard web browser (Chrome)
   - VPN client (AnyConnect)
   - Antivirus/Endpoint protection
   - Corporate password manager
3. Create AD/Entra ID account
4. Assign email address
5. Configure MFA enrollment
6. Assign shared drive permissions based on department
7. Create phone extension if applicable
8. Order and configure peripherals (monitors, keyboard, mouse)
9. Schedule orientation session for day 1

Would you like me to create this as a proper ticket template in the system? What department would this be primarily for?', s.created_at + INTERVAL '1 minute'
FROM ai_sessions s WHERE s.title = 'Creating a ticket template';

INSERT INTO ai_messages (session_id, role, content, created_at)
SELECT s.id, 'user', 'Yes, please create it! This is for all departments - standard company-wide onboarding.', s.created_at + INTERVAL '2 minutes'
FROM ai_sessions s WHERE s.title = 'Creating a ticket template';

INSERT INTO ai_messages (session_id, role, content, created_at)
SELECT s.id, 'assistant', 'Great! I''ll create a company-wide "New Employee IT Setup" template. I''ll set it as public so everyone in the IT team can use it.

I recommend also creating a separate "Contractor IT Setup" template with these differences:
- Limited software access
- Temporary account with expiry date
- VPN-only access (no physical office equipment unless requested)
- 30-day access review reminder

Would you like me to continue creating both templates?', s.created_at + INTERVAL '2 minutes'
FROM ai_sessions s WHERE s.title = 'Creating a ticket template';

-- ============================================================================
-- 14. AI KNOWLEDGE SOURCES (RAG)
-- ============================================================================
INSERT INTO ai_knowledge_sources (name, source_type, content_type, raw_content, status, tags, category, classification, chunk_count, uploaded_by)
SELECT
  'IT Support FAQ - Common Password Issues',
  'manual', 'text',
  'Password Policy: Passwords must be at least 12 characters with uppercase, lowercase, numbers, and special characters. They expire every 90 days. Cannot reuse last 5 passwords.
Password Reset: Users can reset via the "Forgot Password" link on the login page. The reset email arrives within 5 minutes. Check spam if not received.
Account Lockout: After 5 failed login attempts, accounts are locked for 30 minutes. Admins can unlock manually via the User Management page.
MFA Setup: All users must use Microsoft Authenticator or a hardware token. MFA can be reset by IT admins if the user gets a new phone.
Temporary Passwords: Generated during password reset. User must change at first login. Valid for 24 hours only.',
  'ready', ARRAY['password', 'mfa', 'account', 'faq'], 'Account Management', 'unclassified', 1,
  (SELECT id FROM users WHERE email = 'elena.rodriguez@company.com')
WHERE NOT EXISTS (SELECT 1 FROM ai_knowledge_sources WHERE name = 'IT Support FAQ - Common Password Issues');

INSERT INTO ai_knowledge_qa (question, answer, category, tags, created_by)
SELECT
  'How do I connect to the corporate WiFi?',
  'To connect to the corporate WiFi:
1. On your device, select "Company-Guest" for guest access or "Company-Secure" for employee access
2. For guest access: Open a browser and accept the terms of service
3. For employee access: Use your company email and password, then complete MFA
4. If you have issues connecting, ensure your device is registered with IT
Contact the Help Desk if you need your device registered.',
  'Network', ARRAY['wifi', 'guest', 'connectivity'],
  (SELECT id FROM users WHERE email = 'alex.wilson@company.com')
WHERE NOT EXISTS (SELECT 1 FROM ai_knowledge_qa WHERE question = 'How do I connect to the corporate WiFi?');

INSERT INTO ai_knowledge_qa (question, answer, category, tags, created_by)
SELECT
  'What do I do if I suspect a phishing email?',
  'If you suspect a phishing email:
1. DO NOT click any links or download attachments
2. DO NOT reply to the email
3. Click the "Report Phishing" button in Outlook (this automatically reports it to the security team)
4. If the Report Phishing button is not available, forward the email to security@company.com
5. If you already clicked a link, IMMEDIATELY contact the IT Security team at 555-0106
6. Change your password and force MFA re-enrollment if you entered credentials
Remember: IT will NEVER ask for your password via email. Always verify suspicious emails by calling the sender directly.',
  'Security', ARRAY['phishing', 'security', 'email', 'report'],
  (SELECT id FROM users WHERE email = 'maya.patel@company.com')
WHERE NOT EXISTS (SELECT 1 FROM ai_knowledge_qa WHERE question = 'What do I do if I suspect a phishing email?');

INSERT INTO ai_knowledge_qa (question, answer, category, tags, created_by)
SELECT
  'How do I request a new software installation?',
  'To request new software:
1. Submit a ticket through the IT portal with category "Software Installation"
2. Include: Software name, version, publisher, and business justification
3. The IT team will review for security compatibility and license compliance
4. Standard software (Chrome, Slack, VS Code, etc.) is pre-approved
5. Non-standard software requires department head approval
6. You will receive a decision within 2 business days
7. Do NOT install software without IT approval - this is a security policy violation',
  'Software', ARRAY['software', 'installation', 'request'],
  (SELECT id FROM users WHERE email = 'david.smith@company.com')
WHERE NOT EXISTS (SELECT 1 FROM ai_knowledge_qa WHERE question = 'How do I request a new software installation?');

-- ============================================================================
-- 15. RAG QUERY LOG (for analytics demo)
-- ============================================================================
INSERT INTO ai_rag_queries (session_id, user_id, query, retrieval_strategy_used, confidence_score, response_had_context, created_at)
SELECT s.id, u.id, 'How do I reset my password?', 'hybrid', 0.95, true, NOW() - INTERVAL '6 days'
FROM ai_sessions s, users u WHERE s.title = 'IT Support - VPN troubleshooting' AND u.email = 'david.smith@company.com'
AND NOT EXISTS (SELECT 1 FROM ai_rag_queries WHERE query = 'How do I reset my password?');

INSERT INTO ai_rag_queries (session_id, user_id, query, retrieval_strategy_used, confidence_score, response_had_context, created_at)
SELECT s.id, u.id, 'What are the VPN connection steps?', 'semantic', 0.88, true, NOW() - INTERVAL '5 days'
FROM ai_sessions s, users u WHERE s.title = 'IT Support - VPN troubleshooting' AND u.email = 'david.smith@company.com'
AND NOT EXISTS (SELECT 1 FROM ai_rag_queries WHERE query = 'What are the VPN connection steps?');

INSERT INTO ai_rag_queries (user_id, query, retrieval_strategy_used, confidence_score, response_had_context, created_at)
SELECT u.id, 'How do I set up email on my iPhone?', 'hybrid', 0.82, true, NOW() - INTERVAL '4 days'
FROM users u WHERE u.email = 'james.miller@company.com'
AND NOT EXISTS (SELECT 1 FROM ai_rag_queries WHERE query = 'How do I set up email on my iPhone?');

INSERT INTO ai_rag_queries (user_id, query, retrieval_strategy_used, confidence_score, response_had_context, created_at)
SELECT u.id, 'What is the MFA policy?', 'keyword', 0.91, true, NOW() - INTERVAL '3 days'
FROM users u WHERE u.email = 'lisa.garcia@company.com'
AND NOT EXISTS (SELECT 1 FROM ai_rag_queries WHERE query = 'What is the MFA policy?');

INSERT INTO ai_rag_queries (user_id, query, retrieval_strategy_used, confidence_score, response_had_context, created_at)
SELECT u.id, 'How to request a visitor badge for a contractor', 'hybrid', 0.65, false, NOW() - INTERVAL '2 days'
FROM users u WHERE u.email = 'thomas.anderson@company.com'
AND NOT EXISTS (SELECT 1 FROM ai_rag_queries WHERE query = 'How to request a visitor badge for a contractor');

-- ============================================================================
-- 16. AUTOMATION RULES
-- ============================================================================
INSERT INTO automation_rules (name, trigger, condition, action, action_value, enabled)
SELECT
  'Auto-assign Critical tickets to Network Engineering',
  'ticket_created',
  'priority == "critical"',
  'assign_to_team',
  'Network Engineering',
  true
WHERE NOT EXISTS (SELECT 1 FROM automation_rules WHERE name = 'Auto-assign Critical tickets to Network Engineering');

INSERT INTO automation_rules (name, trigger, condition, action, action_value, enabled)
SELECT
  'Notify manager on SLA breach',
  'sla_breached',
  NULL,
  'notify_role',
  'admin',
  true
WHERE NOT EXISTS (SELECT 1 FROM automation_rules WHERE name = 'Notify manager on SLA breach');

INSERT INTO automation_rules (name, trigger, condition, action, action_value, enabled)
SELECT
  'Auto-close resolved tickets after 7 days',
  'ticket_resolved',
  'status == "resolved" AND days_since_resolved >= 7',
  'auto_close_ticket',
  NULL,
  true
WHERE NOT EXISTS (SELECT 1 FROM automation_rules WHERE name = 'Auto-close resolved tickets after 7 days');

INSERT INTO automation_rules (name, trigger, condition, action, action_value, enabled)
SELECT
  'Assign VPN tickets to Network Engineering',
  'ticket_created',
  'category == "VPN & Remote Access"',
  'assign_to_team',
  'Network Engineering',
  true
WHERE NOT EXISTS (SELECT 1 FROM automation_rules WHERE name = 'Assign VPN tickets to Network Engineering');

-- ============================================================================
-- 17. TICKET TEMPLATES
-- ============================================================================
INSERT INTO ticket_templates (name, title, description, ticket_type, priority, category_id, created_by, is_public)
SELECT
  'New Employee IT Setup',
  'New Employee Onboarding - [NAME]',
  'Full IT setup for new employee starting [START_DATE].
Tasks:
1. Prepare laptop (model: [MODEL])
2. Install standard software suite
3. Create AD/Entra ID account
4. Assign email address
5. Configure MFA
6. Set up shared drive access ([DEPARTMENT])
7. Configure phone extension (if applicable)
8. Order peripherals (monitors, keyboard, mouse)',
  'service_request', 'medium', (SELECT id FROM categories WHERE name = 'Hardware Issues'),
  (SELECT id FROM users WHERE email = 'sarah.chen@company.com'), true
WHERE NOT EXISTS (SELECT 1 FROM ticket_templates WHERE name = 'New Employee IT Setup');

INSERT INTO ticket_templates (name, title, description, ticket_type, priority, category_id, created_by, is_public)
SELECT
  'Security Incident Report',
  'Security Incident Report - [BRIEF_DESCRIPTION]',
  'Incident Details:
- Type: [Phishing/Malware/Unauthorized Access/Data Breach/Lost Device/Other]
- Date/Time of discovery: [DATETIME]
- Affected system(s): [SYSTEMS]
- Scope of impact: [SCOPE]
- Immediate actions taken: [ACTIONS]
- Has sensitive data been compromised? [YES/NO]

Required steps:
1. Isolate affected systems
2. Initiate incident response protocol
3. Notify security team',
  'incident', 'high', (SELECT id FROM categories WHERE name = 'Security Incident'),
  (SELECT id FROM users WHERE email = 'maya.patel@company.com'), true
WHERE NOT EXISTS (SELECT 1 FROM ticket_templates WHERE name = 'Security Incident Report');

INSERT INTO ticket_templates (name, title, description, ticket_type, priority, category_id, created_by, is_public)
SELECT
  'Hardware Replacement Request',
  'Hardware Replacement - [DEVICE_TYPE] - [USER_NAME]',
  'Hardware replacement request:
- Device type: [Laptop/Desktop/Monitor/Phone/Other]
- Current device: [MAKE/MODEL/SERIAL]
- Reason: [Damaged/Malfunctioning/Upgrade/Other]
- Urgency: [Immediate/This Week/This Month]
- Does user need a loaner device? [YES/NO]
- Current warranty status: [IN WARRANTY/EXPIRED/UNKNOWN]

Note: If the device is under warranty, contact vendor first for repair/replacement.',
  'service_request', 'medium', (SELECT id FROM categories WHERE name = 'Hardware Issues'),
  (SELECT id FROM users WHERE email = 'david.smith@company.com'), true
WHERE NOT EXISTS (SELECT 1 FROM ticket_templates WHERE name = 'Hardware Replacement Request');

-- ============================================================================
-- 18. AUDIT LOG
-- ============================================================================
INSERT INTO audit_log (actor_id, action, entity_type, entity_id, old_data, new_data, created_at)
SELECT u.id, 'user.login', 'session', u.id, NULL,
  JSONB_BUILD_OBJECT('ip', '192.168.1.101', 'method', 'password', 'role', u.role),
  NOW() - INTERVAL '30 days'
FROM users u WHERE u.email = 'sarah.chen@company.com'
AND NOT EXISTS (SELECT 1 FROM audit_log WHERE action = 'user.login' AND actor_id = u.id);

INSERT INTO audit_log (actor_id, action, entity_type, entity_id, old_data, new_data, created_at)
SELECT u.id, 'ticket.created', 'ticket', t.id, NULL,
  JSONB_BUILD_OBJECT('title', t.title, 'priority', t.priority, 'status', t.status),
  t.created_at
FROM tickets t, users u WHERE t.title LIKE 'VPN service down%' AND u.email = 'jennifer.brown@company.com';

INSERT INTO audit_log (actor_id, action, entity_type, entity_id, old_data, new_data, created_at)
SELECT u.id, 'ticket.assigned', 'ticket', t.id,
  JSONB_BUILD_OBJECT('assigned_to', NULL),
  JSONB_BUILD_OBJECT('assigned_to', 'Alex Wilson'),
  t.created_at + INTERVAL '10 minutes'
FROM tickets t, users u WHERE t.title LIKE 'VPN service down%' AND u.email = 'sarah.chen@company.com';

INSERT INTO audit_log (actor_id, action, entity_type, entity_id, old_data, new_data, created_at)
SELECT u.id, 'settings.updated', 'system_settings', NULL,
  JSONB_BUILD_OBJECT('key', 'max_attachment_size_mb', 'old_value', '10'),
  JSONB_BUILD_OBJECT('key', 'max_attachment_size_mb', 'new_value', '25'),
  NOW() - INTERVAL '15 days'
FROM users u WHERE u.email = 'marcus.johnson@company.com'
AND NOT EXISTS (SELECT 1 FROM audit_log WHERE action = 'settings.updated' AND actor_id = u.id);

INSERT INTO audit_log (actor_id, action, entity_type, entity_id, old_data, new_data, created_at)
SELECT u.id, 'ticket.sla_breach', 'ticket', t.id,
  JSONB_BUILD_OBJECT('sla_breached', false),
  JSONB_BUILD_OBJECT('sla_breached', true, 'policy', 'P1 Critical', 'breached_at', t.created_at + INTERVAL '4 hours'),
  t.created_at + INTERVAL '4 hours'
FROM tickets t, users u WHERE t.title LIKE 'Database server CPU%' AND u.email = 'sarah.chen@company.com';

INSERT INTO audit_log (actor_id, action, entity_type, entity_id, old_data, new_data, created_at)
SELECT u.id, 'user.password_reset', 'user', target.id,
  NULL,
  JSONB_BUILD_OBJECT('reset_by', u.email, 'reason', 'security_incident'),
  NOW() - INTERVAL '3 days'
FROM users u, users target WHERE u.email = 'maya.patel@company.com' AND target.email = 'james.miller@company.com'
AND NOT EXISTS (SELECT 1 FROM audit_log WHERE action = 'user.password_reset' AND entity_id = target.id);

INSERT INTO audit_log (actor_id, action, entity_type, entity_id, old_data, new_data, created_at)
SELECT u.id, 'automation_rule.created', 'automation_rules', ar.id, NULL,
  JSONB_BUILD_OBJECT('name', ar.name, 'trigger', ar.trigger, 'action', ar.action),
  ar.created_at
FROM automation_rules ar, users u WHERE ar.name = 'Auto-assign Critical tickets to Network Engineering' AND u.email = 'sarah.chen@company.com';

-- ============================================================================
-- 19. AUTO-REPLY RULES
-- ============================================================================
INSERT INTO auto_reply_rules (name, enabled, description, conditions, event, reply_body, send_to_requester, send_to_assignee)
VALUES
  ('New Ticket Acknowledgment', true, 'Send acknowledgment email when a new ticket is created',
   '{"categories": [], "priorities": []}'::jsonb, 'ticket_created',
   'Thank you for contacting the IT Help Desk. Your ticket has been received and will be reviewed shortly.

Ticket #[TICKET_ID] - [TITLE]
Priority: [PRIORITY]

Our team will respond to your request within the applicable SLA timeframe. If this is a critical issue requiring immediate attention, please contact the IT Help Desk directly at 555-0103.

For updates, please reference your ticket number in future communications.',
   true, false)
ON CONFLICT DO NOTHING;

INSERT INTO auto_reply_rules (name, enabled, description, conditions, event, reply_body, send_to_requester, send_to_assignee)
VALUES
  ('Ticket Resolved Notification', true, 'Notify requester when ticket is marked resolved',
   '{}'::jsonb, 'ticket_resolved',
   'Your ticket #[TICKET_ID] has been marked as resolved.

Ticket: [TITLE]
Resolution: [CLOSE_NOTES]

If you are satisfied with the resolution, no further action is needed. If the issue persists or you have any follow-up questions, please reply to this email and your ticket will be reopened.

We value your feedback! Please take a moment to rate your experience:
[SATISFACTION_SURVEY_LINK]

Thank you for your patience while we worked on this issue.',
   true, false)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 20. EMAIL LOG (for demonstration)
-- ============================================================================
INSERT INTO email_log (ticket_id, direction, recipient_email, sender_email, subject, body, status, created_at)
SELECT t.id, 'outbound', u.email, 'helpdesk@company.com',
  'Ticket Created: VPN service down for remote employees (#TKT-1)',
  'Dear Jennifer,

Your ticket has been created successfully.

Ticket #[TICKET_NUMBER]: VPN service down for remote employees
Priority: Critical
Status: Open

Our team has been notified and will respond within 1 hour.

Best regards,
IT Help Desk',
  'sent', t.created_at
FROM tickets t, users u WHERE t.title LIKE 'VPN service down%' AND u.email = 'sarah.chen@company.com'
AND NOT EXISTS (SELECT 1 FROM email_log WHERE ticket_id = t.id AND direction = 'outbound');

INSERT INTO email_log (ticket_id, direction, recipient_email, sender_email, subject, body, status, created_at)
SELECT t.id, 'outbound', u.email, 'helpdesk@company.com',
  'Re: Password reset request',
  'Hi Thomas,

Your password has been reset successfully. Please check your email for the temporary password. You will be required to change it on next login.

If you have any further issues, please let us know.

Best regards,
Elena Rodriguez
IT Support Specialist',
  'sent', t.created_at + INTERVAL '20 minutes'
FROM tickets t, users u WHERE t.title LIKE 'Password reset%' AND u.email = 'thomas.anderson@company.com'
AND NOT EXISTS (SELECT 1 FROM email_log WHERE ticket_id = t.id AND direction = 'outbound' AND recipient_email = u.email);

-- ============================================================================
-- 21. TICKET WORKFLOWS (status transitions)
-- ============================================================================
INSERT INTO ticket_workflows (from_status, to_status, required_fields)
SELECT * FROM (VALUES
  ('open', 'in_progress', ARRAY[]::text[]),
  ('in_progress', 'waiting', ARRAY[]::text[]),
  ('waiting', 'in_progress', ARRAY[]::text[]),
  ('in_progress', 'resolved', ARRAY['close_notes']),
  ('resolved', 'closed', ARRAY[]::text[]),
  ('resolved', 'in_progress', ARRAY[]::text[]),
  ('open', 'resolved', ARRAY['close_notes']),
  ('waiting', 'resolved', ARRAY['close_notes'])
) AS v(from_status, to_status, required_fields)
WHERE NOT EXISTS (
  SELECT 1 FROM ticket_workflows tw
  WHERE tw.from_status = v.from_status AND tw.to_status = v.to_status
);

-- ============================================================================
-- 22. UPDATE USERS LAST LOGIN (for recent activity demo)
-- ============================================================================
UPDATE users SET last_login_at = NOW() - INTERVAL '2 hours' WHERE email = 'sarah.chen@company.com';
UPDATE users SET last_login_at = NOW() - INTERVAL '30 minutes' WHERE email = 'david.smith@company.com';
UPDATE users SET last_login_at = NOW() - INTERVAL '1 hour' WHERE email = 'alex.wilson@company.com';
UPDATE users SET last_login_at = NOW() - INTERVAL '15 minutes' WHERE email = 'elena.rodriguez@company.com';
UPDATE users SET last_login_at = NOW() - INTERVAL '45 minutes' WHERE email = 'maya.patel@company.com';
UPDATE users SET last_login_at = NOW() - INTERVAL '3 hours' WHERE email = 'marcus.johnson@company.com';
UPDATE users SET last_login_at = NOW() - INTERVAL '4 hours' WHERE email = 'james.miller@company.com';
UPDATE users SET last_login_at = NOW() - INTERVAL '1 day' WHERE email = 'jennifer.brown@company.com';
UPDATE users SET last_login_at = NOW() - INTERVAL '2 days' WHERE email = 'robert.taylor@company.com';

-- ============================================================================
-- 23. NOTIFICATION LOG (for notification history demo)
-- ============================================================================
INSERT INTO notification_log (ticket_id, user_email, event_type, template_name, sent_at)
SELECT t.id, 'jennifer.brown@company.com', 'ticket_created', 'ticket_created_confirmation', t.created_at
FROM tickets t WHERE t.title LIKE 'VPN service down%'
AND NOT EXISTS (SELECT 1 FROM notification_log WHERE ticket_id = t.id AND event_type = 'ticket_created');

INSERT INTO notification_log (ticket_id, user_email, event_type, template_name, sent_at)
SELECT t.id, 'alex.wilson@company.com', 'ticket_assigned', 'ticket_assigned_notification', t.created_at + INTERVAL '10 minutes'
FROM tickets t WHERE t.title LIKE 'VPN service down%'
AND NOT EXISTS (SELECT 1 FROM notification_log WHERE ticket_id = t.id AND event_type = 'ticket_assigned');

INSERT INTO notification_log (ticket_id, user_email, event_type, template_name, sent_at)
SELECT t.id, 'sarah.chen@company.com', 'sla_breach', 'sla_breach_alert', t.created_at + INTERVAL '4 hours'
FROM tickets t WHERE t.title LIKE 'Database server CPU%'
AND NOT EXISTS (SELECT 1 FROM notification_log WHERE ticket_id = t.id AND event_type = 'sla_breach');

-- ============================================================================
-- 24. HOLIDAYS (for SLA calculations)
-- ============================================================================
INSERT INTO holidays (name, date, recurring)
SELECT * FROM (VALUES
  ('New Year''s Day', '2026-01-01'::date, true),
  ('Martin Luther King Jr. Day', '2026-01-19'::date, false),
  ('President''s Day', '2026-02-16'::date, false),
  ('Memorial Day', '2026-05-25'::date, false),
  ('Independence Day', '2026-07-03'::date, false),
  ('Labor Day', '2026-09-07'::date, false),
  ('Thanksgiving Day', '2026-11-26'::date, false),
  ('Thanksgiving Friday', '2026-11-27'::date, false),
  ('Christmas Day', '2026-12-25'::date, true)
) AS v(name, date, recurring)
WHERE NOT EXISTS (SELECT 1 FROM holidays h WHERE h.name = v.name AND h.date = v.date);

-- ============================================================================
-- SUMMARY
-- ============================================================================
DO $$
DECLARE
  ticket_count INTEGER;
  comment_count INTEGER;
  activity_count INTEGER;
  article_count INTEGER;
  asset_count INTEGER;
  notification_count INTEGER;
  ai_session_count INTEGER;
  ai_message_count INTEGER;
  audit_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO ticket_count FROM tickets;
  SELECT COUNT(*) INTO comment_count FROM ticket_comments;
  SELECT COUNT(*) INTO activity_count FROM ticket_activity;
  SELECT COUNT(*) INTO article_count FROM knowledge_articles;
  SELECT COUNT(*) INTO asset_count FROM assets;
  SELECT COUNT(*) INTO notification_count FROM notifications;
  SELECT COUNT(*) INTO ai_session_count FROM ai_sessions;
  SELECT COUNT(*) INTO ai_message_count FROM ai_messages;
  SELECT COUNT(*) INTO audit_count FROM audit_log;
  
  RAISE NOTICE '=============================================';
  RAISE NOTICE '  DEMO SEED DATA LOADED SUCCESSFULLY';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '  Tickets:          %', ticket_count;
  RAISE NOTICE '  Comments:         %', comment_count;
  RAISE NOTICE '  Activity:         %', activity_count;
  RAISE NOTICE '  Knowledge:        %', article_count;
  RAISE NOTICE '  Assets:           %', asset_count;
  RAISE NOTICE '  Notifications:    %', notification_count;
  RAISE NOTICE '  AI Sessions:      %', ai_session_count;
  RAISE NOTICE '  AI Messages:      %', ai_message_count;
  RAISE NOTICE '  Audit Log:        %', audit_count;
  RAISE NOTICE '=============================================';
END $$;
