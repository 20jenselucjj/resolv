-- ITSM Default Settings Migration
-- Inserts default settings for ITSM modules: Problem, Change, Approval, CAB, On-Call, License

-- Problem Management Settings
INSERT INTO system_settings (key, value) VALUES
  ('problem_root_cause_template', '## Root Cause Analysis\n\n### What happened?\n\n### When was it detected?\n\n### Impact assessment\n\n### Timeline of events\n\n### Root cause\n\n### Contributing factors\n\n### Preventive measures'),
  ('problem_auto_link_enabled', 'true'),
  ('problem_auto_link_similarity', 'false'),
  ('problem_default_priority', 'medium'),
  ('ke_require_approval', 'false'),
  ('ke_auto_archive_days', '365')
ON CONFLICT (key) DO NOTHING;

-- Change Management Settings
INSERT INTO system_settings (key, value) VALUES
  ('change_auto_approve_standard', 'true'),
  ('change_risk_low_desc', 'Minimal impact, reversible, well-tested'),
  ('change_risk_medium_desc', 'Moderate impact, requires rollback plan'),
  ('change_risk_high_desc', 'Significant impact, requires careful review'),
  ('change_risk_critical_desc', 'Critical infrastructure, requires executive approval'),
  ('change_blackout_enabled', 'false'),
  ('change_blackout_message', 'Changes are currently frozen due to a business-critical period.'),
  ('change_pir_required', 'true'),
  ('change_pir_types', 'normal,emergency'),
  ('change_impl_plan_template', '## Implementation Plan\n\n### Pre-implementation steps\n\n### Implementation steps\n\n### Post-implementation verification\n\n### Rollback procedure'),
  ('change_rollback_template', '## Rollback Plan\n\n### Rollback trigger criteria\n\n### Rollback steps\n\n### Verification after rollback')
ON CONFLICT (key) DO NOTHING;

-- Approval Workflow Settings
INSERT INTO system_settings (key, value) VALUES
  ('approval_due_critical_hours', '4'),
  ('approval_due_high_hours', '24'),
  ('approval_due_medium_hours', '72'),
  ('approval_due_low_hours', '168'),
  ('approval_escalation_enabled', 'true'),
  ('approval_escalation_hours', '48'),
  ('approval_escalation_target', 'manager'),
  ('approval_normal_steps', 'manager'),
  ('approval_emergency_steps', 'admin'),
  ('approval_notify_created', 'true'),
  ('approval_notify_approved', 'true'),
  ('approval_notify_denied', 'true'),
  ('approval_notify_escalated', 'true')
ON CONFLICT (key) DO NOTHING;

-- License Settings
INSERT INTO system_settings (key, value) VALUES
  ('license_default_alert_threshold', '90'),
  ('license_default_renewal_days', '30'),
  ('license_default_currency', 'USD'),
  ('license_categories', 'Desktop Software,Server Software,Cloud Services,Development Tools,Security,Productivity,Infrastructure')
ON CONFLICT (key) DO NOTHING;
