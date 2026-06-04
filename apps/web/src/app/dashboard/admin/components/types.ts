// --- Admin Page Types ---

export interface AdminStats {
  tickets: {
    total: number;
    by_status: Record<string, number>;
    by_priority: Record<string, number>;
    by_type: Record<string, number>;
    created_today: number;
    resolved_today: number;
    avg_resolution_hours: number;
  };
  users: {
    total: number;
    by_role: Record<string, number>;
    active_count: number;
  };
  sla: {
    breached_count: number;
    at_risk_count: number;
  };
  recent_activity: AuditEntry[];
}

export interface AuditEntry {
  id: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  timestamp?: string;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  description?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent' | 'user';
  department?: string;
  is_active: boolean;
  avatarUrl?: string;
  source?: string;        // 'manual' | 'google_workspace' | 'azure_ad' | 'ldap' | 'sso'
  locked?: boolean;
  locked_at?: string;
  locked_reason?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
  icon?: string;
  is_active: boolean;
}

export interface SLAPolicy {
  id: string;
  name: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  response_time_hours: number;
  resolution_time_hours: number;
  is_active: boolean;
}

export interface AdminSetting {
  key: string;
  value: string;
  label: string;
  type: 'string' | 'number' | 'boolean';
  group?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  condition?: string;
  action: string;
  action_value: string;
  enabled: boolean;
  actionValue?: string;
}

export interface WorkingHour {
  day: string;
  enabled: boolean;
  start: string;
  end: string;
}

export interface WorkingHourAPI {
  day: string;
  enabled: boolean;
  start_time: string;
  end_time: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export interface AIConfig {
  enabled: boolean;
  provider: string;
  base_url: string;
  api_key?: string;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  allowed_roles: string[];
  max_messages_per_day: number;
  // Portal AI (self-service)
  portal_enabled: boolean;
  portal_model: string;
  portal_temperature: number;
  portal_max_tokens: number;
  portal_system_prompt: string;
  portal_allowed_roles: string[];
  portal_tools?: {
    getTicketDetails: boolean;
    createTickets: boolean;
    getMyTickets: boolean;
    searchKnowledge: boolean;
    searchTickets: boolean;
    addAttachments: boolean;
    searchUsers: boolean;
    addComments: boolean;
    getStats: boolean;
  };
  portal_behavior?: {
    responseLength: 'short' | 'medium' | 'long';
    includeCitations: boolean;
    includeSources: boolean;
    fallbackToWeb: boolean;
    maxCitations: number;
  };
  // Tool toggles
  tools?: {
    searchTickets: boolean;
    createTickets: boolean;
    getTicketDetails: boolean;
    getMyTickets: boolean;
    searchKnowledge: boolean;
    getStats: boolean;
    updateTickets: boolean;
    addComments: boolean;
    searchUsers: boolean;
    addAttachments: boolean;
  };
  // Behavior settings
  behavior?: {
    responseLength: 'short' | 'medium' | 'long';
    includeCitations: boolean;
    includeSources: boolean;
    fallbackToWeb: boolean;
    maxCitations: number;
  };
  // Legacy rules (flat text array — replaced by guidelines)
  rules?: string[];
  // Structured behavioral guidelines
  guidelines?: {
    agent: AiGuidelinesSection;
    portal: AiGuidelinesSection;
  };
}

export interface AiGuidelinesSection {
  ticketLookup: string;
  autonomousExecution?: string;
  conversationalTone: string;
  ticketCreationWorkflow: string;
  priorityGuidelines?: string;
  ticketTypeGuidelines?: string;
  categoryGuidelines?: string;
  ticketEditingWorkflow?: string;
  commentWorkflow: string;
  enumRule?: string;
  hallucinationGuard?: string;
  toolUsageRules?: string;
}

export interface TimeSeriesPoint {
  date: string;
  created: number;
  resolved: number;
}

export interface TimeSeriesData {
  tickets: TimeSeriesPoint[];
  sla: { date: string; breached: number }[];
  avg_resolution: { date: string; hours: number }[];
}

export interface NotificationChannel {
  email: boolean;
  in_app: boolean;
}

export interface NotificationSettings {
  ticket_created: NotificationChannel;
  ticket_assigned: NotificationChannel;
  ticket_updated: NotificationChannel;
  ticket_resolved: NotificationChannel;
  sla_breach: NotificationChannel;
  comment_added: NotificationChannel;
}

export interface WorkflowTransition {
  id: string;
  from_status: string;
  to_status: string;
  required_fields: string[];
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
}

export interface AgentPerformance {
  id: string;
  name: string;
  email: string;
  tickets_assigned: number;
  tickets_resolved: number;
  avg_response_hours: number;
  avg_resolution_hours: number;
  csat_avg: number;
}

export interface RolePermission {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface RolePermissions {
  id: string;
  label: string;
  description: string;
  color: string;
  bg: string;
  permissions: RolePermission[];
}

export interface MaintenanceMode {
  enabled: boolean;
  message: string;
}
