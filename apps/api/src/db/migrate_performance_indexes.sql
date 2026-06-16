-- Performance Indexes for Foreign Keys & Hot Query Patterns
--
-- Adds missing indexes on foreign key columns and frequently filtered columns.
-- Uses IF NOT EXISTS so it is safe to re-run. Does NOT use CREATE INDEX CONCURRENTLY
-- because this migration runs through the Node.js runner (pool.query) which may
-- wrap in an implicit transaction. If you need concurrent builds on a live
-- production database, manually prefix with CONCURRENTLY and run outside a
-- transaction block, or use: psql -d yourdb -f migrate_performance_indexes.sql
--
-- Naming convention: idx_table_column

-- ═══════════════════════════════════════════════════════════════════════════════
--  SCHEMA.SQL — Foreign key indexes
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tickets_requested_by_id ON tickets(requested_by_id);
CREATE INDEX IF NOT EXISTS idx_tickets_merged_into_id ON tickets(merged_into_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_author_id ON ticket_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_edited_by_id ON ticket_comments(edited_by_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activity_actor_id ON ticket_activity(actor_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_id ON ai_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_session_id ON ai_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_comment_id ON ticket_attachments(comment_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_uploaded_by ON ticket_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_ticket_templates_category_id ON ticket_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sources_uploaded_by ON ai_knowledge_sources(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_qa_created_by ON ai_knowledge_qa(created_by);
CREATE INDEX IF NOT EXISTS idx_ai_rag_queries_session_id ON ai_rag_queries(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_files_uploaded_by ON ai_chat_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_ai_chat_files_ticket_id ON ai_chat_files(ticket_id);
CREATE INDEX IF NOT EXISTS idx_asset_groups_created_by ON asset_groups(created_by);
CREATE INDEX IF NOT EXISTS idx_asset_users_asset_id ON asset_users(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_users_user_id ON asset_users(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_activity_actor_id ON asset_activity(actor_id);
CREATE INDEX IF NOT EXISTS idx_asset_remote_sessions_initiated_by ON asset_remote_sessions(initiated_by);

-- ═══════════════════════════════════════════════════════════════════════════════
--  MIGRATION TABLES — Foreign key indexes
-- ═══════════════════════════════════════════════════════════════════════════════

-- agent_versions
CREATE INDEX IF NOT EXISTS idx_agent_versions_created_by ON agent_versions(created_by);

-- agent_commands
CREATE INDEX IF NOT EXISTS idx_agent_commands_created_by ON agent_commands(created_by);

-- report_schedules / report_execution_log
CREATE INDEX IF NOT EXISTS idx_report_schedules_created_by ON report_schedules(created_by);
CREATE INDEX IF NOT EXISTS idx_report_execution_log_schedule_id ON report_execution_log(schedule_id);
CREATE INDEX IF NOT EXISTS idx_report_execution_log_executed_by ON report_execution_log(executed_by);

-- approval_history
CREATE INDEX IF NOT EXISTS idx_approval_history_step_id ON approval_history(step_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_actor_id ON approval_history(actor_id);

-- changes
CREATE INDEX IF NOT EXISTS idx_changes_category_id ON changes(category_id);
CREATE INDEX IF NOT EXISTS idx_changes_requested_by_id ON changes(requested_by_id);
CREATE INDEX IF NOT EXISTS idx_changes_approval_id ON changes(approval_id);
CREATE INDEX IF NOT EXISTS idx_changes_ticket_id ON changes(ticket_id);

-- change_activity
CREATE INDEX IF NOT EXISTS idx_change_activity_actor_id ON change_activity(actor_id);

-- email_routing_rules
CREATE INDEX IF NOT EXISTS idx_email_routing_rules_assign_to_id ON email_routing_rules(assign_to_id);
CREATE INDEX IF NOT EXISTS idx_email_routing_rules_category_id ON email_routing_rules(category_id);

-- custom_field_definitions
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_created_by ON custom_field_definitions(created_by);

-- catalog_items / service_requests
CREATE INDEX IF NOT EXISTS idx_catalog_items_created_by ON catalog_items(created_by);
CREATE INDEX IF NOT EXISTS idx_service_requests_approval_id ON service_requests(approval_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_fulfilled_by ON service_requests(fulfilled_by);

-- scripts
CREATE INDEX IF NOT EXISTS idx_scripts_created_by ON scripts(created_by);

-- software_licenses / license_assignments
CREATE INDEX IF NOT EXISTS idx_software_licenses_created_by ON software_licenses(created_by);
CREATE INDEX IF NOT EXISTS idx_license_assignments_assigned_by ON license_assignments(assigned_by);

-- software_packages / software_deployments
CREATE INDEX IF NOT EXISTS idx_software_packages_created_by ON software_packages(created_by);
CREATE INDEX IF NOT EXISTS idx_software_deployments_deployed_by ON software_deployments(deployed_by);

-- ticket_watchers
CREATE INDEX IF NOT EXISTS idx_ticket_watchers_added_by ON ticket_watchers(added_by);

-- visual_workflows
CREATE INDEX IF NOT EXISTS idx_visual_workflows_created_by ON visual_workflows(created_by);

-- problems / problem_incident_links / problem_activity
CREATE INDEX IF NOT EXISTS idx_problems_created_by_id ON problems(created_by_id);
CREATE INDEX IF NOT EXISTS idx_problem_incident_links_created_by ON problem_incident_links(created_by);
CREATE INDEX IF NOT EXISTS idx_problem_activity_actor_id ON problem_activity(actor_id);

-- webhook_configs
CREATE INDEX IF NOT EXISTS idx_webhook_configs_created_by ON webhook_configs(created_by);

-- major_incident_timeline
CREATE INDEX IF NOT EXISTS idx_major_incident_timeline_author_id ON major_incident_timeline(author_id);

-- releases
CREATE INDEX IF NOT EXISTS idx_releases_created_by_id ON releases(created_by_id);

-- asset_usb_devices
CREATE INDEX IF NOT EXISTS idx_asset_usb_devices_asset_id ON asset_usb_devices(asset_id);

-- knowledge_article_attachments
CREATE INDEX IF NOT EXISTS idx_knowledge_article_attachments_uploaded_by ON knowledge_article_attachments(uploaded_by);

-- ═══════════════════════════════════════════════════════════════════════════════
--  ENUM-LIKE FILTER COLUMNS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ═══════════════════════════════════════════════════════════════════════════════
--  COMPOSITE INDEXES FOR HOT QUERY PATTERNS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tickets_created_by_status ON tickets(created_by_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_status ON tickets(assigned_to_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_status_priority_type ON tickets(status, priority, ticket_type);
