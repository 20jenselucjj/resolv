'use client';

import { useEffect, useState, useCallback, Fragment, useRef } from 'react';
import {
  Plus, Trash2, Save, Play, Copy, Zap, Filter,
  Edit3, MessageSquare, CheckCircle, UserPlus, PlusCircle,
  Clock, GitBranch, Mail, X, ChevronUp, ChevronDown,
  Eye, RotateCcw, AlertCircle, Bell, GripVertical, Download, Upload
} from 'lucide-react';
import { api } from '@/lib/api';
import { Modal } from './SharedUI';

// ─── Types ──────────────────────────────────────────────────────────────────

interface VisualWorkflow {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  is_active: boolean;
  conditions: any[];
  steps: WorkflowStep[];
  execution_order: number;
  run_count: number;
  last_run_at: string | null;
  last_error: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  step_count?: number;
}

interface WorkflowStep {
  id: string;
  type: string;
  config: Record<string, any>;
}

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface SchemaData {
  triggers: { value: string; label: string; description: string }[];
  condition_fields: { value: string; label: string; type: string; options?: string[] }[];
  condition_operators: { value: string; label: string }[];
  step_types: {
    value: string; label: string; icon: string;
    config_fields: { key: string; label: string; type: string; options?: string[]; hint?: string }[];
  }[];
}

interface WorkflowExecution {
  id: string;
  workflow_id: string;
  trigger_type: string;
  status: string;
  steps_count: number;
  steps_executed: any[];
  error_message: string | null;
  duration_ms: number;
  started_at: string;
  completed_at: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  ticket_created: 'Ticket Created',
  ticket_updated: 'Ticket Updated',
  status_changed: 'Status Changed',
  ticket_assigned: 'Ticket Assigned',
  comment_added: 'Comment Added',
  ticket_resolved: 'Ticket Resolved',
  ticket_closed: 'Ticket Closed',
  scheduled: 'Scheduled',
  manual: 'Manual',
};

const STEP_ICONS: Record<string, React.ReactNode> = {
  set_field: <Edit3 size={16} />,
  send_notification: <Bell size={16} />,
  add_comment: <MessageSquare size={16} />,
  set_status: <CheckCircle size={16} />,
  assign_to: <UserPlus size={16} />,
  create_ticket: <PlusCircle size={16} />,
  delay: <Clock size={16} />,
  condition: <GitBranch size={16} />,
  send_email: <Mail size={16} />,
};

const STEP_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  set_field: { bg: '#f0f4ff', border: '#bfdbfe', text: '#2563eb' },
  send_notification: { bg: '#fdf2f8', border: '#fbcfe8', text: '#db2777' },
  add_comment: { bg: '#f0f9ff', border: '#bae6fd', text: '#0284c7' },
  set_status: { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' },
  assign_to: { bg: '#fef3c7', border: '#fde68a', text: '#d97706' },
  create_ticket: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  delay: { bg: '#fef9c3', border: '#fef08a', text: '#a16207' },
  condition: { bg: '#fce7f3', border: '#f9a8d4', text: '#be185d' },
  send_email: { bg: '#e0f2fe', border: '#bae6fd', text: '#0369a1' },
};

const DEFAULT_STEP_CONFIGS: Record<string, Record<string, any>> = {
  set_field: { field: 'priority', value: '' },
  send_notification: { recipients: ['assignee'], template: 'ticket_assigned' },
  add_comment: { body: '', is_internal: false },
  set_status: { status: 'open' },
  assign_to: { user_id: '', group_id: '' },
  create_ticket: { title: '', ticket_type: 'incident' },
  delay: { minutes: 30 },
  condition: { conditions: [], if_true: [], if_false: [] },
  send_email: { to: '', subject: '', body: '' },
};

// ─── Helper: config summary ─────────────────────────────────────────────────

function getStepSummary(step: WorkflowStep, stepTypes: SchemaData['step_types']): string {
  const typeDef = stepTypes.find(t => t.value === step.type);
  const label = typeDef?.label || step.type;
  const cfg = step.config || {};

  switch (step.type) {
    case 'set_field': return `Set ${cfg.field || 'field'} = ${cfg.value || '...'}`;
    case 'send_notification': return `Notify ${(cfg.recipients || []).join(', ')} via ${cfg.template || '...'}`;
    case 'add_comment': return `Add ${cfg.is_internal ? 'internal' : 'public'} comment`;
    case 'set_status': return `Change status to ${cfg.status || '...'}`;
    case 'assign_to': return `Assign to ${cfg.user_id || cfg.group_id || '...'}`;
    case 'create_ticket': return `Create ${cfg.ticket_type || 'ticket'}: ${cfg.title || '...'}`;
    case 'delay': return `Wait ${cfg.minutes || 0} minute(s)`;
    case 'condition': return `Branch: ${(cfg.conditions || []).length} condition(s)`;
    case 'send_email': return `Email to ${cfg.to || '...'}`;
    default: return label;
  }
}

function getStepLabel(stepType: string, stepTypes: SchemaData['step_types']): string {
  return stepTypes.find(t => t.value === stepType)?.label || stepType;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function WorkflowDesignerTab({ showAlert, setConfirmModal }: {
  showAlert: (m: string, t?: 'success' | 'error') => void;
  setConfirmModal: (m: { open: boolean; title: string; message: string; onConfirm: () => void } | null) => void;
}) {
  const [workflows, setWorkflows] = useState<VisualWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [schema, setSchema] = useState<SchemaData | null>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<VisualWorkflow | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [showExecutions, setShowExecutions] = useState<string | null>(null);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [executionsLoading, setExecutionsLoading] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Editor form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formTrigger, setFormTrigger] = useState('ticket_created');
  const [formConditions, setFormConditions] = useState<Condition[]>([]);
  const [formSteps, setFormSteps] = useState<WorkflowStep[]>([]);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const [showStepPicker, setShowStepPicker] = useState(false);
  const [addStepAfterIndex, setAddStepAfterIndex] = useState<number | null>(null);

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Run Now state
  const [runningWorkflowId, setRunningWorkflowId] = useState<string | null>(null);

  // Import ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load schema and workflows
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [schemaRes, listRes] = await Promise.all([
        api.get<{ data: SchemaData }>('/workflows/visual/schema'),
        api.get<{ data: VisualWorkflow[]; total: number; totalPages: number }>('/workflows/visual?pageSize=100'),
      ]);
      setSchema(schemaRes.data);
      setWorkflows(listRes.data);
      setTotalPages(listRes.totalPages || 1);
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to load workflow data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Load executions ────────────────────────────────────────────────────

  const loadExecutions = useCallback(async (workflowId: string) => {
    setExecutionsLoading(true);
    try {
      const res = await api.get<{ data: WorkflowExecution[]; total: number; totalPages: number }>(
        `/workflows/visual/${workflowId}/executions?pageSize=50`
      );
      setExecutions(res.data);
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to load executions', 'error');
    } finally {
      setExecutionsLoading(false);
    }
  }, [showAlert]);

  // ─── Open editor ────────────────────────────────────────────────────────

  const openNewWorkflow = () => {
    setIsNew(true);
    setFormName('');
    setFormDesc('');
    setFormTrigger('ticket_created');
    setFormConditions([]);
    setFormSteps([]);
    setSelectedStepIndex(null);
    setShowStepPicker(false);
    setAddStepAfterIndex(null);
    setTestResult(null);
    setEditingWorkflow(null);
    setShowEditor(true);
  };

  const openEditWorkflow = (wf: VisualWorkflow) => {
    setIsNew(false);
    setFormName(wf.name);
    setFormDesc(wf.description || '');
    setFormTrigger(wf.trigger_type);
    setFormConditions(typeof wf.conditions === 'string' ? JSON.parse(wf.conditions) : (wf.conditions || []));
    setFormSteps(typeof wf.steps === 'string' ? JSON.parse(wf.steps) : (wf.steps || []));
    setSelectedStepIndex(null);
    setShowStepPicker(false);
    setAddStepAfterIndex(null);
    setTestResult(null);
    setEditingWorkflow(wf);
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingWorkflow(null);
    setSelectedStepIndex(null);
    setTestResult(null);
  };

  // ─── Step management ────────────────────────────────────────────────────

  const addStep = (type: string) => {
    const stepId = `step_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newStep: WorkflowStep = {
      id: stepId,
      type,
      config: { ...(DEFAULT_STEP_CONFIGS[type] || {}) },
    };

    const newSteps = [...formSteps];
    if (addStepAfterIndex !== null && addStepAfterIndex >= 0) {
      newSteps.splice(addStepAfterIndex + 1, 0, newStep);
    } else {
      newSteps.push(newStep);
    }
    setFormSteps(newSteps);
    setSelectedStepIndex(addStepAfterIndex !== null && addStepAfterIndex >= 0 ? addStepAfterIndex + 1 : newSteps.length - 1);
    setShowStepPicker(false);
  };

  const deleteStep = (index: number) => {
    const newSteps = formSteps.filter((_, i) => i !== index);
    setFormSteps(newSteps);
    if (selectedStepIndex === index) {
      setSelectedStepIndex(null);
    } else if (selectedStepIndex !== null && selectedStepIndex > index) {
      setSelectedStepIndex(selectedStepIndex - 1);
    }
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index >= formSteps.length - 1) return;

    const newSteps = [...formSteps];
    const target = direction === 'up' ? index - 1 : index + 1;
    [newSteps[index], newSteps[target]] = [newSteps[target], newSteps[index]];
    setFormSteps(newSteps);
    setSelectedStepIndex(target);
  };

  const updateStepConfig = (index: number, key: string, value: any) => {
    const newSteps = [...formSteps];
    newSteps[index] = {
      ...newSteps[index],
      config: { ...newSteps[index].config, [key]: value },
    };
    setFormSteps(newSteps);
  };

  // ─── Drag-and-drop handlers ─────────────────────────────────────────────

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newSteps = [...formSteps];
    const [moved] = newSteps.splice(dragIndex, 1);
    newSteps.splice(index, 0, moved);
    setFormSteps(newSteps);
    setSelectedStepIndex(index);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // ─── Conditions ─────────────────────────────────────────────────────────

  const addCondition = () => {
    setFormConditions([...formConditions, { field: 'priority', operator: 'is', value: '' }]);
  };

  const updateCondition = (index: number, key: keyof Condition, value: string) => {
    const newConds = [...formConditions];
    newConds[index] = { ...newConds[index], [key]: value };
    setFormConditions(newConds);
  };

  const removeCondition = (index: number) => {
    setFormConditions(formConditions.filter((_, i) => i !== index));
  };

  // ─── Save ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!formName.trim()) {
      showAlert('Workflow name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName,
        description: formDesc,
        trigger_type: formTrigger,
        conditions: formConditions,
        steps: formSteps,
        execution_order: editingWorkflow?.execution_order || 0,
      };

      if (isNew) {
        await api.post('/workflows/visual', payload);
        showAlert('Workflow created');
      } else if (editingWorkflow) {
        await api.patch(`/workflows/visual/${editingWorkflow.id}`, payload);
        showAlert('Workflow updated');
      }
      closeEditor();
      loadData();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to save workflow', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle active ──────────────────────────────────────────────────────

  const handleToggle = async (id: string) => {
    try {
      await api.patch(`/workflows/visual/${id}/toggle`, {});
      showAlert('Workflow toggled');
      loadData();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to toggle workflow', 'error');
    }
  };

  // ─── Duplicate ──────────────────────────────────────────────────────────

  const handleDuplicate = async (id: string) => {
    try {
      await api.post(`/workflows/visual/${id}/duplicate`, {});
      showAlert('Workflow duplicated');
      loadData();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to duplicate workflow', 'error');
    }
  };

  // ─── Delete ─────────────────────────────────────────────────────────────

  const handleDelete = (id: string) => {
    setConfirmModal({
      open: true,
      title: 'Delete Workflow',
      message: 'Are you sure you want to delete this workflow? All execution history will also be removed.',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.delete(`/workflows/visual/${id}`);
          showAlert('Workflow deleted');
          loadData();
          if (editingWorkflow?.id === id) closeEditor();
        } catch (err: any) {
          showAlert(err?.serverError || err?.message || 'Failed to delete workflow', 'error');
        }
      },
    });
  };

  // ─── Test run ───────────────────────────────────────────────────────────

  const handleTest = async () => {
    if (!editingWorkflow && !isNew) return;
    setTesting(true);
    setTestResult(null);
    try {
      const workflowId = editingWorkflow?.id;
      if (!workflowId) {
        // For new unsaved workflows, use the local state
        const steps = formSteps;
        const result = runDryLocally(formConditions, steps, {});
        setTestResult(result);
        showAlert('Test completed', 'success');
        return;
      }
      const res = await api.post<{ data: any }>(`/workflows/visual/${workflowId}/test`, {
        sample_ticket: { title: 'Test Ticket', status: 'open', priority: 'medium' },
      });
      setTestResult(res.data);
      showAlert('Test completed', 'success');
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Test failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  const runDryLocally = (conditions: Condition[], steps: WorkflowStep[], triggerData: any) => {
    const executionLog: any[] = [];
    // Evaluate conditions
    const condResult = conditions.length === 0 || conditions.every(c => {
      const val = triggerData[c.field] || '';
      return String(val).toLowerCase().includes(c.value.toLowerCase());
    });

    for (const step of steps) {
      executionLog.push({
        step_id: step.id,
        type: step.type,
        config: step.config,
        status: 'completed',
        output: { dry_run: true, message: `${getStepLabel(step.type, schema?.step_types || [])} would execute` },
      });
    }

    return {
      status: condResult ? 'completed' : 'skipped',
      steps_executed: executionLog,
      duration_ms: 0,
    };
  };

  // ─── Import / Export ────────────────────────────────────────────────────

  const handleExportAll = async () => {
    try {
      const res = await api.get<{ data: VisualWorkflow[] }>('/workflows/visual?pageSize=100');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'workflows.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showAlert('Workflows exported', 'success');
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Failed to export workflows', 'error');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('Expected an array of workflows');
      for (const wf of data) {
        if (!wf.name || !wf.trigger_type || !Array.isArray(wf.conditions) || !Array.isArray(wf.steps)) {
          throw new Error('Invalid workflow structure');
        }
        await api.post('/workflows/visual', {
          name: wf.name,
          description: wf.description || '',
          trigger_type: wf.trigger_type,
          conditions: wf.conditions,
          steps: wf.steps,
          execution_order: wf.execution_order || 0,
        });
      }
      showAlert(`Imported ${data.length} workflow(s)`, 'success');
      loadData();
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Import failed', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ─── Run Now ────────────────────────────────────────────────────────────

  const handleRunNow = async (id: string) => {
    setRunningWorkflowId(id);
    try {
      await api.post(`/workflows/visual/${id}/test`, {});
      showAlert('Workflow executed successfully', 'success');
    } catch (err: any) {
      showAlert(err?.serverError || err?.message || 'Run failed', 'error');
    } finally {
      setRunningWorkflowId(null);
    }
  };

  // ─── Render: Workflow List ──────────────────────────────────────────────

  const renderList = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Description */}
      <div style={{
        padding: '16px 20px', borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GitBranch size={18} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Visual Workflow Designer</span>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          Build automation workflows using a structured step-by-step configuration interface.
          Define triggers, conditions, and a sequence of actions that execute automatically
          when a matching event occurs. Each step type has its own configurable fields.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button className="btn btn-ghost" onClick={handleExportAll}><Download size={14} /> Export All</button>
        <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()}><Upload size={14} /> Import</button>
        <input type="file" ref={fileInputRef} accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        <button className="btn btn-primary" onClick={openNewWorkflow}><Plus size={14} /> New Workflow</button>
      </div>

      <div className="card" style={{ overflow: 'hidden', position: 'relative', minHeight: '100px' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
            <RotateCcw className="spin" size={24} />
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Workflow</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Trigger</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Steps</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Runs</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Last Run</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workflows.map(wf => (
              <tr key={wf.id} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: wf.is_active ? 1 : 0.6, cursor: 'pointer' }}
                onClick={() => openEditWorkflow(wf)}>
                <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>{wf.name}</td>
                <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)' }}>
                    {TRIGGER_LABELS[wf.trigger_type] || wf.trigger_type}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{wf.step_count || 0}</td>
                <td style={{ padding: '12px 16px' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggle(wf.id); }}
                    style={{
                      background: wf.is_active ? 'var(--success-bg)' : 'var(--bg-tertiary)',
                      color: wf.is_active ? 'var(--success)' : 'var(--text-muted)',
                      border: `1px solid ${wf.is_active ? 'var(--success-border)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-full)', padding: '3px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    {wf.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{wf.run_count || 0}</td>
                <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {wf.last_run_at ? new Date(wf.last_run_at).toLocaleString() : '—'}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                    {wf.trigger_type === 'manual' && (
                      <button className="btn btn-ghost" style={{ padding: '4px', color: 'var(--accent)' }} title="Run Now"
                        onClick={() => handleRunNow(wf.id)} disabled={runningWorkflowId === wf.id}>
                        {runningWorkflowId === wf.id ? <RotateCcw className="spin" size={14} /> : <Play size={14} />}
                      </button>
                    )}
                    <button className="btn btn-ghost" style={{ padding: '4px' }} title="Duplicate"
                      onClick={() => handleDuplicate(wf.id)}><Copy size={14} /></button>
                    <button className="btn btn-ghost" style={{ padding: '4px' }} title="Executions"
                      onClick={() => { setShowExecutions(wf.id); loadExecutions(wf.id); }}><Eye size={14} /></button>
                    <button className="btn btn-ghost" style={{ padding: '4px', color: 'var(--danger)' }} title="Delete"
                      onClick={() => handleDelete(wf.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && workflows.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No workflows configured. Click "New Workflow" to create one.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Executions Modal */}
      {showExecutions && (
        <Modal title={`Executions: ${workflows.find(w => w.id === showExecutions)?.name || ''}`} onClose={() => { setShowExecutions(null); setSelectedExecution(null); }} maxWidth="700px">
          {executionsLoading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading...</div>
          ) : selectedExecution ? (
            <div>
              <button className="btn btn-ghost" style={{ marginBottom: '16px' }} onClick={() => setSelectedExecution(null)}>
                ← Back to list
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><strong style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Status:</strong>{' '}
                    <StatusBadge status={selectedExecution.status} /></div>
                  <div><strong style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Duration:</strong>{' '}
                    <span style={{ fontSize: '13px' }}>{selectedExecution.duration_ms}ms</span></div>
                  <div><strong style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Started:</strong>{' '}
                    <span style={{ fontSize: '13px' }}>{new Date(selectedExecution.started_at).toLocaleString()}</span></div>
                  <div><strong style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Trigger:</strong>{' '}
                    <span style={{ fontSize: '13px' }}>{TRIGGER_LABELS[selectedExecution.trigger_type] || selectedExecution.trigger_type}</span></div>
                </div>
                {selectedExecution.error_message && (
                  <div style={{ padding: '8px 12px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '13px' }}>
                    <AlertCircle size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                    {selectedExecution.error_message}
                  </div>
                )}
                {selectedExecution.steps_executed && selectedExecution.steps_executed.length > 0 && (
                  <div>
                    <strong style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Steps Executed:</strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(typeof selectedExecution.steps_executed === 'string' ? JSON.parse(selectedExecution.steps_executed) : selectedExecution.steps_executed).map((s: any, i: number) => (
                        <div key={i} style={{
                          padding: '8px 12px', borderRadius: 'var(--radius-md)',
                          background: s.status === 'completed' ? 'var(--success-bg)' : 'var(--danger-bg)',
                          border: `1px solid ${s.status === 'completed' ? 'var(--success-border)' : 'var(--danger-border)'}`,
                          fontSize: '12px',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600 }}>{getStepLabel(s.type, schema?.step_types || [])}</span>
                            <span style={{ textTransform: 'capitalize', color: s.status === 'completed' ? 'var(--success)' : 'var(--danger)' }}>{s.status}</span>
                          </div>
                          {s.output && (
                            <div style={{ marginTop: '4px', color: 'var(--text-secondary)', fontSize: '11px', fontFamily: 'monospace' }}>
                              {JSON.stringify(s.output).substring(0, 120)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              {executions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No executions yet</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
                      <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Started</th>
                      <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Steps</th>
                      <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executions.map(ex => (
                      <tr key={ex.id} style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                        onClick={() => setSelectedExecution(ex)}>
                        <td style={{ padding: '8px 12px' }}><StatusBadge status={ex.status} /></td>
                        <td style={{ padding: '8px 12px', fontSize: '12px' }}>{new Date(ex.started_at).toLocaleString()}</td>
                        <td style={{ padding: '8px 12px', fontSize: '12px' }}>{ex.steps_count || 0}</td>
                        <td style={{ padding: '8px 12px', fontSize: '12px' }}>{ex.duration_ms}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );

  // ─── Render: Workflow Editor ────────────────────────────────────────────

  const renderEditor = () => {
    if (!schema) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              {isNew ? 'New Workflow' : `Edit: ${editingWorkflow?.name}`}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" onClick={() => {
              if (editingWorkflow && !isNew) handleDuplicate(editingWorkflow.id);
            }} disabled={!editingWorkflow || isNew}><Copy size={14} /> Duplicate</button>
            <button className="btn btn-ghost" onClick={handleTest} disabled={testing}>
              {testing ? <RotateCcw className="spin" size={14} /> : <Play size={14} />} Test
            </button>
            <button className={`btn btn-primary btn-save${saving ? ' saving' : ''}`} onClick={handleSave} disabled={saving}>
              {saving ? <RotateCcw className="spin" size={14} /> : <Save size={14} />} Save
            </button>
            <button className="btn btn-ghost" onClick={closeEditor}><X size={14} /> Cancel</button>
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div style={{
            padding: '16px', borderRadius: 'var(--radius-lg)',
            background: testResult.status === 'completed' ? 'var(--success-bg)' :
                        testResult.status === 'skipped' ? 'var(--warning-bg)' : 'var(--danger-bg)',
            border: `1px solid ${testResult.status === 'completed' ? 'var(--success-border)' :
                      testResult.status === 'skipped' ? 'var(--warning-border)' : 'var(--danger-border)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <strong style={{ fontSize: '14px' }}>Test Result: {testResult.status.toUpperCase()}</strong>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>({testResult.duration_ms}ms)</span>
            </div>
            {testResult.steps_executed && testResult.steps_executed.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {testResult.steps_executed.map((s: any, i: number) => (
                  <div key={i} style={{
                    padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                    background: s.status === 'completed' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                    fontSize: '12px', display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontWeight: 500 }}>{getStepLabel(s.type, schema.step_types)}</span>
                    <span style={{ textTransform: 'capitalize', color: s.status === 'completed' ? 'var(--success)' : 'var(--danger)' }}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Basic Info */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Workflow Name *</label>
            <input className="input" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Auto-assign critical tickets" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Trigger Type</label>
            <select className="select" value={formTrigger} onChange={e => setFormTrigger(e.target.value)}>
              {schema.triggers.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Description</label>
          <textarea className="input" value={formDesc} onChange={e => setFormDesc(e.target.value)}
            placeholder="Describe what this workflow does..." rows={2}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        {/* Conditions Section */}
        <div className="card" style={{ padding: '16px', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={16} style={{ color: 'var(--warning)' }} />
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Conditions</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                (All conditions must match — AND logic)
              </span>
            </div>
            <button className="btn btn-ghost" onClick={addCondition} style={{ fontSize: '12px' }}>
              <Plus size={12} /> Add Condition
            </button>
          </div>

          {formConditions.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
              No conditions — workflow runs on every {TRIGGER_LABELS[formTrigger] || formTrigger} event
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {formConditions.map((cond, i) => (
                <div key={i} style={{
                  display: 'flex', gap: '8px', alignItems: 'center',
                  padding: '8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg)',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', minWidth: '20px' }}>{i + 1}.</span>
                  <select className="select" value={cond.field} onChange={e => updateCondition(i, 'field', e.target.value)} style={{ flex: 1 }}>
                    {schema.condition_fields.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                  <select className="select" value={cond.operator} onChange={e => updateCondition(i, 'operator', e.target.value)} style={{ width: '140px' }}>
                    {schema.condition_operators.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {cond.operator !== 'is_empty' && cond.operator !== 'is_not_empty' ? (
                    <input className="input" value={cond.value} onChange={e => updateCondition(i, 'value', e.target.value)}
                      placeholder="value" style={{ flex: 1 }} />
                  ) : (
                    <div style={{ flex: 1, fontSize: '12px', color: 'var(--text-muted)' }}>—</div>
                  )}
                  <button className="btn btn-ghost" style={{ padding: '4px', color: 'var(--danger)' }} onClick={() => removeCondition(i)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Steps Flowchart Section */}
        <div className="card" style={{ padding: '24px', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <GitBranch size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Workflow Steps</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }}>
            {/* Trigger node */}
            <div style={{
              padding: '10px 20px', background: 'var(--accent-subtle)',
              border: '2px solid var(--accent)', borderRadius: 'var(--radius-lg)',
              textAlign: 'center', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <Zap size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>
                {schema.triggers.find(t => t.value === formTrigger)?.label || formTrigger}
              </span>
            </div>

            {/* Condition node (if any) */}
            {formConditions.length > 0 && (
              <>
                <div style={{ width: '2px', height: '20px', background: 'var(--border)' }} />
                <div style={{
                  padding: '6px 14px', background: 'var(--warning-bg)',
                  border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-md)',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <Filter size={14} style={{ color: 'var(--warning)' }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--warning)' }}>
                    {formConditions.length} condition{formConditions.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </>
            )}

            {/* Steps */}
            {formSteps.length === 0 ? (
              <>
                <div style={{ width: '2px', height: '20px', background: 'var(--border)' }} />
                <AddStepButton onClick={() => { setShowStepPicker(true); setAddStepAfterIndex(null); }} />
              </>
            ) : (
              formSteps.map((step, i) => (
                <Fragment key={step.id}>
                  <div style={{ width: '2px', height: '16px', background: 'var(--border)' }} />
                  {/* Drop indicator before this step */}
                  {dragOverIndex === i && dragIndex !== i && (
                    <div style={{ width: '320px', maxWidth: '420px', height: '0', borderTop: '2px dashed var(--accent)', margin: '2px 0' }} />
                  )}
                  {/* Step Card */}
                  <div
                    draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; handleDragStart(i); }}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDrop={(e) => handleDrop(e, i)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedStepIndex(i)}
                    style={{
                      padding: '10px 16px', borderRadius: 'var(--radius-lg)',
                      background: selectedStepIndex === i ? 'var(--bg)' : 'var(--bg)',
                      border: selectedStepIndex === i
                        ? '2px solid var(--accent)'
                        : `1px solid ${STEP_COLORS[step.type]?.border || 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                      minWidth: '320px', maxWidth: '420px', position: 'relative',
                      transition: 'border-color 0.2s',
                      opacity: dragIndex === i ? 0.5 : 1,
                    }}
                  >
                    {/* Drag handle */}
                    <div style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <GripVertical size={16} />
                    </div>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: 'var(--radius-md)',
                      background: STEP_COLORS[step.type]?.bg || 'var(--bg-tertiary)',
                      color: STEP_COLORS[step.type]?.text || 'var(--text-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {STEP_ICONS[step.type] || <Zap size={16} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                        {getStepLabel(step.type, schema.step_types)}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {getStepSummary(step, schema.step_types)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                      <button className="btn btn-ghost" style={{ padding: '3px' }}
                        onClick={(e) => { e.stopPropagation(); moveStep(i, 'up'); }}
                        disabled={i === 0}><ChevronUp size={14} /></button>
                      <button className="btn btn-ghost" style={{ padding: '3px' }}
                        onClick={(e) => { e.stopPropagation(); moveStep(i, 'down'); }}
                        disabled={i >= formSteps.length - 1}><ChevronDown size={14} /></button>
                      <button className="btn btn-ghost" style={{ padding: '3px', color: 'var(--danger)' }}
                        onClick={(e) => { e.stopPropagation(); deleteStep(i); }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {/* Add step button after this step */}
                  <div style={{ width: '2px', height: '12px', background: 'var(--border)' }} />
                  <AddStepButton onClick={() => { setShowStepPicker(true); setAddStepAfterIndex(i); }} />
                </Fragment>
              ))
            )}

            {/* Final drop zone */}
            <div style={{ width: '2px', height: '16px', background: 'var(--border)' }} />
            {dragOverIndex === formSteps.length && dragIndex !== formSteps.length && (
              <div style={{ width: '320px', maxWidth: '420px', height: '0', borderTop: '2px dashed var(--accent)', margin: '2px 0' }} />
            )}
            <div
              style={{ width: '320px', maxWidth: '420px', height: '8px' }}
              onDragOver={(e) => { e.preventDefault(); setDragOverIndex(formSteps.length); }}
              onDrop={(e) => handleDrop(e, formSteps.length)}
            />

            {/* End node */}
            <div style={{ width: '2px', height: '20px', background: 'var(--border)' }} />
            <div style={{
              width: '16px', height: '16px', borderRadius: '50%',
              border: '2px solid var(--border)', background: 'var(--bg-secondary)',
            }} />
          </div>
        </div>

        {/* Step Pick Modal */}
        {showStepPicker && (
          <Modal title="Add Step" onClose={() => setShowStepPicker(false)} maxWidth="600px">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {schema.step_types.map(st => (
                <div key={st.value}
                  onClick={() => addStep(st.value)}
                  style={{
                    padding: '12px', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)', cursor: 'pointer',
                    background: 'var(--bg-secondary)', transition: 'all 0.15s',
                    display: 'flex', gap: '10px', alignItems: 'flex-start',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-subtle)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                >
                  <div style={{
                    width: '28px', height: '28px', borderRadius: 'var(--radius-sm)',
                    background: STEP_COLORS[st.value]?.bg || 'var(--bg-tertiary)',
                    color: STEP_COLORS[st.value]?.text || 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {STEP_ICONS[st.value] || <Zap size={14} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{st.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {st.config_fields.length} config field(s)
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setShowStepPicker(false)}>Cancel</button>
            </div>
          </Modal>
        )}

        {/* Step Config Panel */}
        {selectedStepIndex !== null && formSteps[selectedStepIndex] && (
          <div className="card" style={{
            padding: '20px', border: '2px solid var(--accent)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: 'var(--radius-sm)',
                  background: STEP_COLORS[formSteps[selectedStepIndex].type]?.bg || 'var(--bg-tertiary)',
                  color: STEP_COLORS[formSteps[selectedStepIndex].type]?.text || 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {STEP_ICONS[formSteps[selectedStepIndex].type] || <Zap size={14} />}
                </div>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>
                  Configure: {getStepLabel(formSteps[selectedStepIndex].type, schema.step_types)}
                </span>
              </div>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setSelectedStepIndex(null)}><X size={14} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {(() => {
                const stepTypeDef = schema.step_types.find(t => t.value === formSteps[selectedStepIndex].type);
                if (!stepTypeDef) return <div style={{ color: 'var(--text-muted)' }}>Unknown step type</div>;

                return stepTypeDef.config_fields.map(field => (
                  <div key={field.key}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                      {field.label}
                    </label>
                    {field.type === 'select' ? (
                      <select className="select" value={String(formSteps[selectedStepIndex].config[field.key] ?? '')}
                        onChange={e => updateStepConfig(selectedStepIndex, field.key, e.target.value)}>
                        {(field.options || []).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'multi_select' ? (
                      <select className="select" multiple
                        value={formSteps[selectedStepIndex].config[field.key] || []}
                        onChange={e => {
                          const vals = Array.from(e.target.selectedOptions, opt => opt.value);
                          updateStepConfig(selectedStepIndex, field.key, vals);
                        }}
                        style={{ minHeight: '80px' }}>
                        {(field.options || []).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'boolean' ? (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!formSteps[selectedStepIndex].config[field.key]}
                          onChange={e => updateStepConfig(selectedStepIndex, field.key, e.target.checked)} />
                        <span style={{ fontSize: '13px' }}>Enabled</span>
                      </label>
                    ) : field.type === 'textarea' ? (
                      <textarea className="input" value={String(formSteps[selectedStepIndex].config[field.key] ?? '')}
                        onChange={e => updateStepConfig(selectedStepIndex, field.key, e.target.value)}
                        rows={3} style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
                        placeholder={field.hint || ''}
                      />
                    ) : field.type === 'number' ? (
                      <input className="input" type="number" value={Number(formSteps[selectedStepIndex].config[field.key] ?? 0)}
                        onChange={e => updateStepConfig(selectedStepIndex, field.key, parseInt(e.target.value) || 0)}
                        style={{ width: '120px' }}
                      />
                    ) : field.type === 'conditions' ? (
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        Nested conditions configured in the condition branch step
                      </div>
                    ) : (
                      <input className="input" value={String(formSteps[selectedStepIndex].config[field.key] ?? '')}
                        onChange={e => updateStepConfig(selectedStepIndex, field.key, e.target.value)}
                        placeholder={field.hint || ''}
                      />
                    )}
                    {field.hint && field.type !== 'number' && field.type !== 'boolean' && field.type !== 'conditions' && field.type !== 'textarea' && field.type !== 'select' && field.type !== 'multi_select' && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{field.hint}</div>
                    )}
                  </div>
                ));
              })()}
            </div>

            {/* Variable interpolation hints */}
            <div style={{
              marginTop: '16px', padding: '10px 14px', background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Variable Interpolation
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <code style={{ background: 'var(--bg)', padding: '1px 6px', borderRadius: '4px' }}>{'{{ticket.id}}'}</code>
                <code style={{ background: 'var(--bg)', padding: '1px 6px', borderRadius: '4px' }}>{'{{ticket.title}}'}</code>
                <code style={{ background: 'var(--bg)', padding: '1px 6px', borderRadius: '4px' }}>{'{{ticket.number}}'}</code>
                <code style={{ background: 'var(--bg)', padding: '1px 6px', borderRadius: '4px' }}>{'{{ticket.status}}'}</code>
                <code style={{ background: 'var(--bg)', padding: '1px 6px', borderRadius: '4px' }}>{'{{ticket.priority}}'}</code>
                <code style={{ background: 'var(--bg)', padding: '1px 6px', borderRadius: '4px' }}>{'{{ticket.requestor_name}}'}</code>
                <code style={{ background: 'var(--bg)', padding: '1px 6px', borderRadius: '4px' }}>{'{{ticket.assignee_name}}'}</code>
              </div>
            </div>
          </div>
        )}

        {/* Bottom actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
          <div>
            {editingWorkflow && !isNew && (
              <button className="btn btn-ghost" style={{ color: 'var(--danger)' }}
                onClick={() => handleDelete(editingWorkflow.id)}>
                <Trash2 size={14} /> Delete Workflow
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" onClick={closeEditor}>Cancel</button>
            <button className={`btn btn-primary btn-save${saving ? ' saving' : ''}`} onClick={handleSave} disabled={saving}>
              {saving ? <RotateCcw className="spin" size={14} /> : <Save size={14} />} Save Workflow
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div>
      {showEditor && schema ? renderEditor() : renderList()}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    completed: { bg: 'var(--success-bg)', color: 'var(--success)', border: 'var(--success-border)' },
    failed: { bg: 'var(--danger-bg)', color: 'var(--danger)', border: 'var(--danger-border)' },
    skipped: { bg: 'var(--warning-bg)', color: 'var(--warning)', border: 'var(--warning-border)' },
    running: { bg: 'var(--accent-subtle)', color: 'var(--accent)', border: 'var(--accent-border)' },
  };
  const s = colors[status] || colors.running;
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 'var(--radius-full)', padding: '2px 8px', fontSize: '11px', fontWeight: 700,
      textTransform: 'capitalize',
    }}>
      {status}
    </span>
  );
}

function AddStepButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        width: '36px', height: '36px', borderRadius: '50%',
        background: 'var(--bg)', border: '2px dashed var(--border-strong)',
        color: 'var(--text-muted)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-subtle)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--bg)'; }}
      title="Add step"
    >
      <Plus size={16} />
    </button>
  );
}
