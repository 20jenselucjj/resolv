-- Migration: Add separate tool toggles and behavior settings for Portal AI
-- Previously portal AI shared the same tools/behavior config as Agent AI.
-- Now each has independent control via portal_tools and portal_behavior columns.

ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS portal_tools JSONB NOT NULL DEFAULT '{"getTicketDetails":true,"createTickets":true,"getMyTickets":true,"searchKnowledge":true}';
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS portal_behavior JSONB NOT NULL DEFAULT '{"responseLength":"medium","includeCitations":true,"includeSources":true,"fallbackToWeb":false,"maxCitations":3}';
