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
  | 'sla_breach';

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
  ],
  agent: ['view_all_tickets', 'assign_tickets', 'manage_assets'],
  user: [],
  readonly: ['view_all_tickets', 'view_audit_log', 'manage_reports'],
};

// ─── SLA Defaults ────────────────────────────────────────────────────────────

export const DEFAULT_SLA_HOURS: Record<Priority, { response: number; resolution: number }> = {
  critical: { response: 1, resolution: 4 },
  high: { response: 4, resolution: 24 },
  medium: { response: 24, resolution: 72 },
  low: { response: 72, resolution: 168 },
};
