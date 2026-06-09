-- Migration: Add suggestion button configuration columns to ai_config
-- These define contextual action buttons the AI can offer users

ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS portal_suggestions JSONB NOT NULL DEFAULT '{
  "createTicket": {"enabled":true,"label":"Create Ticket","prompt":"I need to create a support ticket","icon":"ticket"},
  "viewTickets": {"enabled":true,"label":"My Tickets","prompt":"Show my open tickets","icon":"list"},
  "searchKB": {"enabled":true,"label":"Search KB","prompt":"Search the knowledge base for answers","icon":"search"},
  "contactSupport": {"enabled":true,"label":"Contact Support","prompt":"I need to speak with a support agent","icon":"user"}
}';

ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS agent_suggestions JSONB NOT NULL DEFAULT '{
  "createTicket": {"enabled":true,"label":"Create Ticket","prompt":"Create a ticket for this issue","icon":"ticket"},
  "searchTickets": {"enabled":true,"label":"Search Tickets","prompt":"Search tickets across the system","icon":"search"},
  "viewStats": {"enabled":true,"label":"View Stats","prompt":"Show ticket statistics","icon":"stats"},
  "searchKB": {"enabled":true,"label":"Search KB","prompt":"Search the knowledge base","icon":"book"},
  "assignToMe": {"enabled":true,"label":"Assign to Me","prompt":"Assign this ticket to me","icon":"userPlus"}
}';
