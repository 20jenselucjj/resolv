-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'agent', 'user')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  color VARCHAR(20) DEFAULT '#6366f1',
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SLA Policies table
CREATE TABLE IF NOT EXISTS sla_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  priority VARCHAR(50) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  response_time_hours INTEGER NOT NULL,
  resolution_time_hours INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number SERIAL UNIQUE,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  priority VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Ticket comments table
CREATE TABLE IF NOT EXISTS ticket_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ticket activity log
CREATE TABLE IF NOT EXISTS ticket_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Knowledge Articles table
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) UNIQUE NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  views INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  body TEXT,
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System Settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Audit Log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(200) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ALTER tickets table to add new columns
DO $$ BEGIN ALTER TABLE tickets ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tickets ADD COLUMN ticket_type VARCHAR(50) DEFAULT 'incident' CHECK (ticket_type IN ('incident','service_request','problem','change')); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tickets ADD COLUMN due_date TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tickets ADD COLUMN close_notes TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tickets ADD COLUMN sla_policy_id UUID REFERENCES sla_policies(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tickets ADD COLUMN sla_breached BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tickets ADD COLUMN first_response_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tickets ADD COLUMN closed_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tickets ADD COLUMN satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tickets ADD COLUMN satisfaction_comment TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tickets ADD COLUMN asset_id VARCHAR(255); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tickets ADD COLUMN location VARCHAR(255); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tickets ADD COLUMN requested_by_id UUID REFERENCES users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tickets ADD COLUMN merged_into_id UUID REFERENCES tickets(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE tickets ADD COLUMN merge_reason TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ALTER users table to add new columns
DO $$ BEGIN ALTER TABLE users ADD COLUMN department VARCHAR(100); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN phone VARCHAR(50); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN invited_by UUID REFERENCES users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN external_id VARCHAR(255); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN source VARCHAR(50) DEFAULT 'manual' CHECK (source IN ('manual', 'google_workspace', 'azure_ad', 'ldap', 'sso')); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN last_sync_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN manager_id UUID REFERENCES users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN employee_id VARCHAR(100); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN title VARCHAR(200); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN location VARCHAR(200); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE users ADD COLUMN windows_username VARCHAR(255); EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Asset users table additions: resolved user FK and richer session info
DO $$ BEGIN ALTER TABLE asset_users ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE asset_users ADD COLUMN session_type VARCHAR(50); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE asset_users ADD COLUMN session_host VARCHAR(255); EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by_id);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_policy ON tickets(sla_policy_id);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_type ON tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activity_ticket ON ticket_activity(ticket_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_category ON knowledge_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_author ON knowledge_articles(author_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_slug ON knowledge_articles(slug);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_ticket ON notifications(ticket_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ticket_comments_updated_at ON ticket_comments;
CREATE TRIGGER update_ticket_comments_updated_at BEFORE UPDATE ON ticket_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sla_policies_updated_at ON sla_policies;
CREATE TRIGGER update_sla_policies_updated_at BEFORE UPDATE ON sla_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_knowledge_articles_updated_at ON knowledge_articles;
CREATE TRIGGER update_knowledge_articles_updated_at BEFORE UPDATE ON knowledge_articles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Default SLA Policies
INSERT INTO sla_policies (name, priority, response_time_hours, resolution_time_hours)
VALUES 
  ('Standard Low', 'low', 72, 168),
  ('Standard Medium', 'medium', 24, 72),
  ('Standard High', 'high', 4, 24),
  ('Standard Critical', 'critical', 1, 4)
ON CONFLICT (name) DO NOTHING;

-- Default Categories
INSERT INTO categories (name, icon, color)
VALUES 
  ('IT Support', 'life-buoy', '#6366f1'),
  ('Network', 'wifi', '#3b82f6'),
  ('Hardware', 'monitor', '#10b981'),
  ('Software', 'code', '#f59e0b'),
  ('Security', 'shield', '#ef4444'),
  ('HR', 'users', '#ec4899'),
  ('Facilities', 'home', '#8b5cf6')
ON CONFLICT (name) DO NOTHING;

-- Default System Settings
INSERT INTO system_settings (key, value, description)
VALUES 
  ('company_name', 'Resolv ITSM', 'The name of the company using the ITSM platform'),
  ('allow_registration', 'true', 'Whether new users can register themselves'),
  ('default_sla_policy', 'medium', 'The default SLA priority for new tickets'),
  ('max_attachment_size_mb', '10', 'Maximum allowed size for ticket attachments in MB'),
  ('ticket_auto_close_days', '30', 'Number of days after which resolved tickets are automatically closed'),
  ('agent_secret_key', '', 'Shared secret used by Resolv Agent for initial device registration — MUST be set before deployment')
ON CONFLICT (key) DO NOTHING;

-- Automation Rules table
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS automation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    trigger VARCHAR(100) NOT NULL,
    condition TEXT,
    action VARCHAR(100) NOT NULL,
    action_value TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- Working Hours table
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS working_hours (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day VARCHAR(20) NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT true,
    start_time VARCHAR(10) DEFAULT '08:00',
    end_time VARCHAR(10) DEFAULT '17:00',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- Default working hours
INSERT INTO working_hours (day, enabled, start_time, end_time)
VALUES 
  ('Monday', true, '08:00', '17:00'),
  ('Tuesday', true, '08:00', '17:00'),
  ('Wednesday', true, '08:00', '17:00'),
  ('Thursday', true, '08:00', '17:00'),
  ('Friday', true, '08:00', '17:00'),
  ('Saturday', false, '08:00', '17:00'),
  ('Sunday', false, '08:00', '17:00')
ON CONFLICT (day) DO NOTHING;

-- AI configuration (single row, upserted)
CREATE TABLE IF NOT EXISTS ai_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(100) NOT NULL DEFAULT 'openai',
  base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
  api_key TEXT NOT NULL DEFAULT '',
  model VARCHAR(200) NOT NULL DEFAULT 'gpt-4o-mini',
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.7,
  max_tokens INTEGER NOT NULL DEFAULT 1024,
  system_prompt TEXT NOT NULL DEFAULT 'You are a helpful IT support assistant. Help users create tickets, check status, and find knowledge base articles.',
  enabled BOOLEAN NOT NULL DEFAULT false,
  allowed_roles TEXT[] NOT NULL DEFAULT ARRAY['admin','agent','user'],
  max_messages_per_day INTEGER NOT NULL DEFAULT 100,
  -- Self-Service Portal AI settings
  portal_enabled BOOLEAN NOT NULL DEFAULT false,
  portal_model VARCHAR(200) NOT NULL DEFAULT 'gpt-4o-mini',
  portal_temperature NUMERIC(3,2) NOT NULL DEFAULT 0.7,
  portal_max_tokens INTEGER NOT NULL DEFAULT 1024,
  portal_system_prompt TEXT NOT NULL DEFAULT 'You are a helpful customer support assistant. Help customers find answers to their questions and resolve common issues on their own.',
  portal_allowed_roles TEXT[] NOT NULL DEFAULT ARRAY['user'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI chat sessions
CREATE TABLE IF NOT EXISTS ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI chat messages
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user','assistant','tool')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_call_id VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ticket attachments
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES ticket_comments(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  filename VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(200) NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ticket templates (user-created, for agents and admins)
CREATE TABLE IF NOT EXISTS ticket_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  title VARCHAR(500) NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  ticket_type VARCHAR(50) DEFAULT 'incident' CHECK (ticket_type IN ('incident','service_request','problem','change')),
  priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_templates_created_by ON ticket_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_ticket_templates_is_public ON ticket_templates(is_public);

-- ============================================================
-- AI TRAINING / RAG KNOWLEDGE BASE
-- ============================================================

-- RAG configuration (single row)
CREATE TABLE IF NOT EXISTS ai_rag_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT true,
  retrieval_strategy VARCHAR(20) NOT NULL DEFAULT 'hybrid' CHECK (retrieval_strategy IN ('semantic', 'keyword', 'hybrid')),
  top_k INTEGER NOT NULL DEFAULT 5,
  similarity_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.70,
  chunk_size INTEGER NOT NULL DEFAULT 512,
  chunk_overlap INTEGER NOT NULL DEFAULT 64,
  reranking_enabled BOOLEAN NOT NULL DEFAULT false,
  citation_mode VARCHAR(20) NOT NULL DEFAULT 'inline' CHECK (citation_mode IN ('inline', 'footer', 'none')),
  inject_context BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default RAG config
INSERT INTO ai_rag_config (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;

-- Knowledge sources (uploaded documents / URLs / manual entries)
CREATE TABLE IF NOT EXISTS ai_knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(500) NOT NULL,
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('file', 'url', 'manual', 'kb_sync', 'ticket_sync')),
  content_type VARCHAR(100),
  original_filename VARCHAR(500),
  url TEXT,
  raw_content TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_message TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  category VARCHAR(200),
  classification VARCHAR(50) DEFAULT 'unclassified' CHECK (classification IN ('unclassified', 'sensitive', 'confidential', 'secret')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration: add 'ticket_sync' to the source_type check constraint
-- (existing databases created with the old constraint need this)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_knowledge_sources_source_type_check'
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'ai_knowledge_sources_source_type_check'
      AND pg_get_constraintdef(oid) LIKE '%ticket_sync%'
    )
  ) THEN
    ALTER TABLE ai_knowledge_sources DROP CONSTRAINT ai_knowledge_sources_source_type_check;
    ALTER TABLE ai_knowledge_sources ADD CONSTRAINT ai_knowledge_sources_source_type_check
      CHECK (source_type IN ('file', 'url', 'manual', 'kb_sync', 'ticket_sync'));
  END IF;
END $$;

-- Knowledge chunks (chunked text with embeddings)
CREATE TABLE IF NOT EXISTS ai_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES ai_knowledge_sources(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_tokens INTEGER,
  embedding JSONB,
  embedding_model VARCHAR(200),
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Manual Q&A pairs (admin-authored ground truth)
CREATE TABLE IF NOT EXISTS ai_knowledge_qa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(200),
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  embedding JSONB,
  embedding_model VARCHAR(200),
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', question || ' ' || answer)) STORED,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RAG query log (for analytics and audit)
CREATE TABLE IF NOT EXISTS ai_rag_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES ai_sessions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  retrieved_chunk_ids UUID[],
  retrieved_qa_ids UUID[],
  retrieval_strategy_used VARCHAR(20),
  confidence_score NUMERIC(4,3),
  response_had_context BOOLEAN DEFAULT false,
  flagged_for_review BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI chat files (uploaded via AI panel, can be attached to tickets after creation)
CREATE TABLE IF NOT EXISTS ai_chat_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  filename VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(200) NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for RAG
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_source ON ai_knowledge_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_search ON ai_knowledge_chunks USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_qa_search ON ai_knowledge_qa USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sources_status ON ai_knowledge_sources(status);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sources_active ON ai_knowledge_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_rag_queries_user ON ai_rag_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_rag_queries_created ON ai_rag_queries(created_at);

-- ============================================================
-- ASSET MANAGEMENT
-- ============================================================

-- Asset Groups
CREATE TABLE IF NOT EXISTS asset_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL UNIQUE,
  description TEXT,
  color VARCHAR(20) DEFAULT '#6366f1',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assets core table
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  asset_type VARCHAR(50) NOT NULL DEFAULT 'workstation' CHECK (asset_type IN ('workstation', 'laptop', 'server', 'mobile', 'printer', 'network_device', 'other')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'retired', 'maintenance', 'disposed')),
  agent_status VARCHAR(20) DEFAULT 'offline' CHECK (agent_status IN ('online', 'offline', 'unknown')),
  agent_version VARCHAR(50),
  agent_token VARCHAR(255) UNIQUE,
  agent_last_seen TIMESTAMPTZ,
  agent_socket_id VARCHAR(255),
  -- Identity
  serial_number VARCHAR(255),
  manufacturer VARCHAR(255),
  model VARCHAR(255),
  -- Network
  ip_address VARCHAR(45),
  mac_address VARCHAR(17),
  hostname VARCHAR(255),
  domain VARCHAR(255),
  -- OS
  os_name VARCHAR(255),
  os_version VARCHAR(255),
  os_build VARCHAR(100),
  os_arch VARCHAR(50),
  -- Organization
  asset_group_id UUID REFERENCES asset_groups(id) ON DELETE SET NULL,
  assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
  department VARCHAR(100),
  location VARCHAR(255),
  company VARCHAR(255),
  -- Lifecycle
  purchase_date DATE,
  warranty_expiry DATE,
  purchase_cost NUMERIC(10,2),
  vendor VARCHAR(255),
  -- Misc
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asset Hardware (updated by agent on each checkin)
CREATE TABLE IF NOT EXISTS asset_hardware (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL UNIQUE REFERENCES assets(id) ON DELETE CASCADE,
  cpu_model VARCHAR(255),
  cpu_manufacturer VARCHAR(255),
  cpu_cores INTEGER,
  cpu_threads INTEGER,
  cpu_speed_mhz INTEGER,
  cpu_usage_percent NUMERIC(5,2),
  ram_total_gb NUMERIC(10,2),
  ram_used_gb NUMERIC(10,2),
  ram_free_gb NUMERIC(10,2),
  gpu_model VARCHAR(255),
  gpu_vram_gb NUMERIC(10,2),
  motherboard_manufacturer VARCHAR(255),
  motherboard_model VARCHAR(255),
  bios_version VARCHAR(100),
  bios_release_date VARCHAR(50),
  disk_total_gb NUMERIC(10,2),
  disk_used_gb NUMERIC(10,2),
  disk_free_gb NUMERIC(10,2),
  disks JSONB DEFAULT '[]',
  displays JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asset Software Inventory (replaced wholesale on each checkin)
CREATE TABLE IF NOT EXISTS asset_software (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  version VARCHAR(200),
  publisher VARCHAR(255),
  install_date DATE,
  install_location TEXT,
  size_mb NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asset Network Adapters (replaced on each checkin)
CREATE TABLE IF NOT EXISTS asset_network_adapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  adapter_name VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  mac_address VARCHAR(17),
  subnet_mask VARCHAR(45),
  gateway VARCHAR(45),
  dns_servers TEXT[] DEFAULT '{}',
  adapter_type VARCHAR(50),
  speed_mbps INTEGER,
  is_virtual BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asset logged-in users history (updated by agent)
CREATE TABLE IF NOT EXISTS asset_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  username VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_type VARCHAR(50),
  session_host VARCHAR(255),
  is_current BOOLEAN DEFAULT false,
  logged_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asset Activity Log
CREATE TABLE IF NOT EXISTS asset_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asset Remote Sessions
CREATE TABLE IF NOT EXISTS asset_remote_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  initiated_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'ended', 'failed')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Update tickets.asset_id to reference assets table (if not already a FK)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'tickets' AND ccu.column_name = 'id' AND ccu.table_name = 'assets'
  ) THEN
    ALTER TABLE tickets ALTER COLUMN asset_id TYPE UUID USING asset_id::UUID;
    ALTER TABLE tickets ADD CONSTRAINT fk_tickets_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Indexes for asset management
CREATE INDEX IF NOT EXISTS idx_assets_agent_status ON assets(agent_status);
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to ON assets(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_assets_group ON assets(asset_group_id);
CREATE INDEX IF NOT EXISTS idx_assets_agent_token ON assets(agent_token);
CREATE INDEX IF NOT EXISTS idx_asset_software_asset ON asset_software(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_network_asset ON asset_network_adapters(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_activity_asset ON asset_activity(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_remote_asset ON asset_remote_sessions(asset_id);

-- Triggers for asset management
DROP TRIGGER IF EXISTS update_asset_groups_updated_at ON asset_groups;
CREATE TRIGGER update_asset_groups_updated_at BEFORE UPDATE ON asset_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comment editing support (ALTER only if columns don't exist)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticket_comments' AND column_name='edited_at') THEN
    ALTER TABLE ticket_comments ADD COLUMN edited_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticket_comments' AND column_name='edited_by_id') THEN
    ALTER TABLE ticket_comments ADD COLUMN edited_by_id UUID REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticket_comments' AND column_name='is_edited') THEN
    ALTER TABLE ticket_comments ADD COLUMN is_edited BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Ticket Workflows table (admin-configurable status transitions)
CREATE TABLE IF NOT EXISTS ticket_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_status VARCHAR(50) NOT NULL,
  to_status VARCHAR(50) NOT NULL,
  required_fields TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_workflows_status ON ticket_workflows(from_status, to_status);

-- Holidays table (for SLA calculation exclusions)
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  date DATE NOT NULL,
  recurring BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);

