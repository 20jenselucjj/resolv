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
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent' | 'user';
  department?: string;
  is_active: boolean;
  avatarUrl?: string;
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
}
