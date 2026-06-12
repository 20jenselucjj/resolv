// @resolv/shared — Shared types and constants for the Resolv ITSM platform
// Used by both apps/api and apps/web

// ─── User Roles ──────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'manager' | 'agent' | 'user' | 'readonly';

// ─── Rules Engine Types ──────────────────────────────────────────────────────

export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'starts_with' | 'ends_with' | 'exists' | 'not_exists' | 'gt' | 'gte' | 'lt' | 'lte';

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value: any;
}

export interface RoleAssignmentRule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  match_type: 'all' | 'any';
  conditions: RuleCondition[];
  role: UserRole;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export type ApprovalStepType = 'role' | 'manager_of_requester' | 'user' | 'any_role';

export interface ApprovalStepDef {
  type: ApprovalStepType;
  role?: string;           // for type='role' or type='any_role'
  user_id?: string;        // for type='user'
}

export interface ApprovalRoutingRule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  match_type: 'all' | 'any';
  match_criteria: RuleCondition[];
  steps: ApprovalStepDef[];
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

// ─── Ticket Types ────────────────────────────────────────────────────────────

export type TicketType = 'incident' | 'service_request' | 'problem' | 'change';

// ─── Ticket Statuses ─────────────────────────────────────────────────────────

export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';

// ─── Priorities ──────────────────────────────────────────────────────────────

export type Priority = 'low' | 'medium' | 'high' | 'critical';

// ─── Asset Types ─────────────────────────────────────────────────────────────

export type AssetType = 'workstation' | 'laptop' | 'server' | 'mobile' | 'printer' | 'network_device' | 'other';

// ─── Asset Statuses ──────────────────────────────────────────────────────────

export type AssetStatus = 'active' | 'inactive' | 'retired' | 'maintenance' | 'disposed';

// ─── Agent Statuses ──────────────────────────────────────────────────────────

export type AgentStatus = 'online' | 'offline' | 'unknown';

// ─── Knowledge Article Statuses ──────────────────────────────────────────────

export type KnowledgeStatus = 'draft' | 'published' | 'archived';

// ─── User Sources ────────────────────────────────────────────────────────────

export type UserSource = 'manual' | 'google_workspace' | 'azure_ad' | 'ldap' | 'sso';

// ─── Notification Event Types ────────────────────────────────────────────────

export type NotificationEventType =
  | 'ticket_created'
  | 'ticket_updated'
  | 'status_changed'
  | 'ticket_assigned'
  | 'ticket_reassigned'
  | 'comment_added'
  | 'ticket_resolved'
  | 'ticket_closed'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_denied'
  | 'sla_breach'
  | 'change_submitted'
  | 'change_approved'
  | 'major_incident_declared'
  | 'major_incident_resolved'
  ;

// ─── Permissions ─────────────────────────────────────────────────────────────

export type Permission =
  | 'manage_users'
  | 'manage_sla'
  | 'manage_categories'
  | 'view_audit_log'
  | 'manage_automation'
  | 'view_all_tickets'
  | 'assign_tickets'
  | 'manage_assets'
  | 'manage_asset_groups'
  | 'manage_email_templates'
  | 'manage_notification_settings'
  | 'manage_portal'
  | 'manage_agent_settings'
  | 'manage_reports'
  | 'manage_webhooks'
  | 'manage_custom_fields'
  | 'manage_service_catalog'
  | 'manage_change_management'
  | 'manage_cmdb'
  | 'manage_major_incidents'
  | 'manage_releases'
  | 'manage_time_entries'
  ;

// ─── Default Role Permissions ────────────────────────────────────────────────

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [] as Permission[], // Admin bypasses all permission checks
  manager: [
    'manage_users', 'manage_sla', 'manage_categories', 'view_audit_log',
    'manage_automation', 'view_all_tickets', 'assign_tickets', 'manage_assets',
    'manage_asset_groups', 'manage_email_templates', 'manage_notification_settings',
    'manage_portal', 'manage_agent_settings', 'manage_reports',
    'manage_webhooks', 'manage_custom_fields', 'manage_service_catalog',
    'manage_change_management',
    'manage_cmdb', 'manage_major_incidents', 'manage_releases', 'manage_time_entries',
  ],
  agent: ['view_all_tickets', 'assign_tickets', 'manage_assets',
    'manage_cmdb', 'manage_major_incidents', 'manage_releases', 'manage_time_entries',
  ],
  user: [],
  readonly: ['view_all_tickets', 'view_audit_log', 'manage_reports'],
};

// ─── CMDB Types ──────────────────────────────────────────────────────────────

export type CIRelationshipType =
  | 'depends_on'
  | 'runs_on'
  | 'connects_to'
  | 'contains'
  | 'member_of'
  | 'provides'
  | 'uses'
  | 'backed_by'
  ;

export interface ConfigurationItem {
  id: string;
  name: string;
  description?: string;
  ci_type: string;
  asset_id?: string | null;
  department?: string;
  location?: string;
  owner_id?: string | null;
  owner_name?: string;
  status: 'active' | 'inactive' | 'maintenance' | 'retired';
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface CIRelationship {
  id: string;
  source_id: string;
  target_id: string;
  relationship_type: CIRelationshipType;
  description?: string;
  created_at: string;
}

// ─── Webhook Types ───────────────────────────────────────────────────────────

export type WebhookEventType =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.status_changed'
  | 'ticket.assigned'
  | 'ticket.resolved'
  | 'ticket.closed'
  | 'comment.added'
  | 'sla.breached'
  | 'change.submitted'
  | 'change.approved'
  | 'change.completed'
  | 'problem.identified'
  | 'problem.resolved'
  | 'major_incident.declared'
  | 'major_incident.resolved'
  ;

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: WebhookEventType[];
  is_active: boolean;
  retry_count: number;
  timeout_seconds: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: string;
  payload: any;
  status: 'success' | 'failed' | 'retrying';
  status_code?: number;
  response_body?: string;
  error_message?: string;
  attempt_count: number;
  duration_ms?: number;
  created_at: string;
}

// ─── Major Incident Types ────────────────────────────────────────────────────

export type MajorIncidentStatus = 'active' | 'stabilized' | 'resolved' | 'post_review';

export interface MajorIncident {
  ticket_id: string;
  incident_commander_id?: string | null;
  incident_commander_name?: string;
  bridge_url?: string;
  bridge_conference?: string;
  bridge_slack_channel?: string;
  declaration_time: string;
  resolved_time?: string | null;
  services_affected: string[];
  timeline: MajorIncidentTimelineEntry[];
  comms_template?: string;
  pir_completed: boolean;
  pir_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface MajorIncidentTimelineEntry {
  id: string;
  major_incident_ticket_id: string;
  timestamp: string;
  entry_type: 'declaration' | 'update' | 'milestone' | 'communication' | 'resolution' | 'pir';
  content: string;
  author_id?: string;
  author_name?: string;
  created_at: string;
}

// ─── Release Management Types ────────────────────────────────────────────────

export type ReleaseStatus =
  | 'planned'
  | 'in_development'
  | 'in_testing'
  | 'staged'
  | 'deployed'
  | 'completed'
  | 'rolled_back'
  | 'cancelled';

export interface Release {
  id: string;
  number: number;
  name: string;
  description: string;
  version?: string;
  status: ReleaseStatus;
  priority: Priority;
  release_owner_id?: string;
  release_owner_name?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  actual_start?: string;
  actual_end?: string;
  release_notes?: string;
  risk_level?: string;
  created_by_id: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

// ─── Time Entry Types ────────────────────────────────────────────────────────

export interface TimeEntry {
  id: string;
  ticket_id: string;
  user_id: string;
  user_name?: string;
  time_spent_minutes: number;
  description?: string;
  billable: boolean;
  date: string;
  created_at: string;
  updated_at: string;
}

// ─── SLA Defaults ────────────────────────────────────────────────────────────

export const DEFAULT_SLA_HOURS: Record<Priority, { response: number; resolution: number }> = {
  critical: { response: 1, resolution: 4 },
  high: { response: 4, resolution: 24 },
  medium: { response: 24, resolution: 72 },
  low: { response: 72, resolution: 168 },
};
