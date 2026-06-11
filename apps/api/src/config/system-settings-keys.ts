export const SYSTEM_SETTINGS_KEYS = {
  // General
  COMPANY_NAME: 'company_name',
  SUPPORT_EMAIL: 'support_email',
  TIMEZONE: 'timezone',
  DATE_FORMAT: 'date_format',
  TIME_FORMAT: 'time_format',

  // Ticket defaults
  TICKETS_PER_PAGE: 'tickets_per_page',
  DEFAULT_PRIORITY: 'default_priority',
  DEFAULT_TICKET_TYPE: 'default_ticket_type',
  MAX_FAILED_ATTEMPTS: 'max_failed_attempts',
  AUTO_CLOSE_RESOLVED_DAYS: 'auto_close_resolved_days',

  // SLA
  SLA_ENABLED: 'sla_enabled',
  SLA_RESPONSE_HOURS: 'sla_response_hours',
  SLA_RESOLUTION_HOURS: 'sla_resolution_hours',

  // Email
  EMAIL_NOTIFICATIONS_ENABLED: 'email_notifications_enabled',
  MAX_ATTACHMENT_SIZE_MB: 'max_attachment_size_mb',

  // Working hours
  WORKING_HOURS_ENABLED: 'working_hours_enabled',

  // Portal
  PORTAL_HERO_TITLE: 'portal_hero_title',
  PORTAL_HERO_SUBTITLE: 'portal_hero_subtitle',
  PORTAL_COMPANY_NAME: 'portal_company_name',

  // Status labels
  STATUS_LABEL_OPEN: 'status_label_open',
  STATUS_LABEL_IN_PROGRESS: 'status_label_in_progress',
  STATUS_LABEL_WAITING: 'status_label_waiting',
  STATUS_LABEL_RESOLVED: 'status_label_resolved',
  STATUS_LABEL_CLOSED: 'status_label_closed',
  CUSTOM_STATUSES: 'custom_statuses',
  STATUS_ORDER: 'status_order',
  STATUS_TICKET_TYPES: 'status_ticket_types',

  // Canned responses
  CANNED_RESPONSES: 'canned_responses',

  // Roles
  ROLE_PERMISSIONS: 'role_permissions',

  // Notification config
  NOTIFICATION_SETTINGS: 'notification_settings',
  NOTIFICATION_SCHEDULE_CONFIG: 'notification_schedule_config',
  SATISFACTION_SURVEY_CONFIG: 'satisfaction_survey_config',
  ESCALATION_CONFIG: 'escalation_config',
  THROTTLING_CONFIG: 'throttling_config',
  BUSINESS_HOURS_CONFIG: 'business_hours_config',

  // Email
  EMAIL_TEMPLATES: 'email_templates',
  SMTP_OAUTH_CONFIG: 'smtp_oauth_config',

  // Problem Management
  PROBLEM_ROOT_CAUSE_TEMPLATE: 'problem_root_cause_template',
  PROBLEM_AUTO_LINK_ENABLED: 'problem_auto_link_enabled',
  PROBLEM_AUTO_LINK_SIMILARITY: 'problem_auto_link_similarity',
  KE_REQUIRE_APPROVAL: 'ke_require_approval',
  KE_AUTO_ARCHIVE_DAYS: 'ke_auto_archive_days',
  PROBLEM_DEFAULT_PRIORITY: 'problem_default_priority',

  // Change Management
  CHANGE_AUTO_APPROVE_STANDARD: 'change_auto_approve_standard',
  CHANGE_CAB_RISK_THRESHOLD: 'change_cab_risk_threshold',
  CHANGE_BLACKOUT_ENABLED: 'change_blackout_enabled',
  CHANGE_BLACKOUT_MESSAGE: 'change_blackout_message',
  CHANGE_PIR_REQUIRED: 'change_pir_required',
  CHANGE_PIR_TYPES: 'change_pir_types',
  CHANGE_IMPL_PLAN_TEMPLATE: 'change_impl_plan_template',
  CHANGE_ROLLBACK_TEMPLATE: 'change_rollback_template',

  // Approval Workflows
  APPROVAL_DUE_CRITICAL_HOURS: 'approval_due_critical_hours',
  APPROVAL_DUE_HIGH_HOURS: 'approval_due_high_hours',
  APPROVAL_DUE_MEDIUM_HOURS: 'approval_due_medium_hours',
  APPROVAL_DUE_LOW_HOURS: 'approval_due_low_hours',
  APPROVAL_ESCALATION_ENABLED: 'approval_escalation_enabled',
  APPROVAL_ESCALATION_HOURS: 'approval_escalation_hours',
  APPROVAL_ESCALATION_TARGET: 'approval_escalation_target',
  APPROVAL_NORMAL_STEPS: 'approval_normal_steps',
  APPROVAL_EMERGENCY_STEPS: 'approval_emergency_steps',

  // Reopen Policy
  REOPEN_WINDOW_DAYS: 'reopen_window_days',

  // Agent
  AGENT_SECRET_KEY: 'agent_secret_key',

  // Maintenance
  MAINTENANCE_MODE: 'maintenance_mode',
} as const;

export type SystemSettingKey = typeof SYSTEM_SETTINGS_KEYS[keyof typeof SYSTEM_SETTINGS_KEYS];
