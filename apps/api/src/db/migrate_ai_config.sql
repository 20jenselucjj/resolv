-- Migration: Add tools, behavior, and rules columns to ai_config
-- The frontend sends these but the table had no columns for them.
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS tools JSONB NOT NULL DEFAULT '{"searchTickets":true,"createTickets":true,"getTicketDetails":true,"getMyTickets":true,"searchKnowledge":true,"getStats":true}';
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS behavior JSONB NOT NULL DEFAULT '{"responseLength":"medium","includeCitations":true,"includeSources":true,"fallbackToWeb":false,"maxCitations":3}';
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS rules TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
