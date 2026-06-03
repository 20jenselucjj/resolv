-- Knowledge Source Scope for Persona-Specific AI Knowledge
-- Adds scope column to ai_knowledge_sources and ai_knowledge_qa
-- so ingested knowledge can be targeted to Agent AI, Portal AI, or Both

DO $$ BEGIN
  ALTER TABLE ai_knowledge_sources ADD COLUMN scope VARCHAR(20) NOT NULL DEFAULT 'both';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ai_knowledge_qa ADD COLUMN scope VARCHAR(20) NOT NULL DEFAULT 'both';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
