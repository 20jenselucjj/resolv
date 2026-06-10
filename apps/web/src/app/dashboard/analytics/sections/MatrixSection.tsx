'use client';

import { Fragment, useMemo, useState, useCallback } from 'react';
import {
  Grid3x3, BarChart3, Table, ChevronRight, ChevronDown,
  RotateCcw, Filter, X,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { Ticket } from '../types';
import { DrillDownModal } from '../components/shared';
import type { DrillDownState, DrillDownLevel } from '../types';
import PinButton from '../components/shared/PinButton';

// ── Constants ──────────────────────────────────────────────────────────

const RECORD_FILTERS = [
  { value: 'active', label: 'Active Service Records' },
  { value: 'all', label: 'All Records' },
  { value: 'closed', label: 'Closed Records' },
] as const;

const TYPE_OPTIONS = [
  { value: 'incident', label: 'Incident' },
  { value: 'service_request', label: 'Service Request' },
  { value: 'problem', label: 'Problem' },
  { value: 'change', label: 'Change' },
] as const;

type AxisKey = 'priority' | 'status' | 'category' | 'assignee' | 'day' | 'week' | 'month';

const AXIS_OPTIONS: { value: AxisKey; label: string }[] = [
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
  { value: 'category', label: 'Category' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const SUB_VERTICAL_OPTIONS: { value: AxisKey | 'none'; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'category', label: 'Category' },
];

const CHART_MODES = ['table', 'chart'] as const;
type ChartMode = (typeof CHART_MODES)[number];
type ChartStyle = 'grouped' | 'stacked' | 'heatmap';

// ── Color & Style Helpers ─────────────────────────────────────────────

const THEME = {
  teal: 'var(--accent, #0D9488)',
  tealHover: 'var(--accent-hover, #0F766E)',
  headerBg: 'var(--bg-secondary, #f5f5f5)',
  headerText: 'var(--text, #1f2937)',
  rowHover: 'var(--bg-secondary, #f9fafb)',
  heatLow: 'var(--accent-subtle, #eff6ff)',
  heatMed: 'var(--accent-border, #93c5fd)',
  heatHigh: 'var(--accent, #1e40af)',
  border: 'var(--border, #dde1e7)',
  borderSubtle: 'var(--border-subtle, #eef0f3)',
  text: 'var(--text, #1F2937)',
  textSecondary: 'var(--text-secondary, #4B5563)',
  textMuted: 'var(--text-muted, #9CA3AF)',
  bgElevated: 'var(--bg-elevated, #fff)',
  bgSecondary: 'var(--bg-secondary, #f8f9fb)',
};

function heatColor(count: number, max: number): string {
  if (max === 0) return 'transparent';
  const ratio = count / max;
  if (ratio === 0) return 'transparent';
  if (ratio < 0.25) return 'var(--accent-subtle, #eff6ff)';
  if (ratio < 0.5) return 'var(--accent-border, #bfdbfe)';
  if (ratio < 0.75) return 'var(--accent-border, #93c5fd)';
  return 'var(--accent, #3b82f6)';
}

function heatTextColor(count: number, max: number): string {
  if (max === 0) return 'var(--text-secondary, #4B5563)';
  const ratio = count / max;
  return ratio > 0.5 ? 'var(--bg-elevated, #fff)' : 'var(--text-secondary, #4B5563)';
}

// ── Axis Value Extraction ────────────────────────────────────────────

function getAxisValue(ticket: Ticket, axis: AxisKey): string {
  switch (axis) {
    case 'priority':
      return ticket.priority || 'unknown';
    case 'status':
      return ticket.status || 'unknown';
    case 'category':
      return ticket.category_name || ticket.category_id || 'Uncategorized';
    case 'assignee':
      return ticket.assigned_to_name || 'Unassigned';
    case 'day': {
      const d = new Date(ticket.created_at);
      return d.toISOString().slice(0, 10);
    }
    case 'week': {
      const d = new Date(ticket.created_at);
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      const days = Math.floor((d.getTime() - startOfYear.getTime()) / 86400000);
      const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
      return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
    }
    case 'month':
      return new Date(ticket.created_at).toISOString().slice(0, 7);
    default:
      return 'unknown';
  }
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Types ─────────────────────────────────────────────────────────────

interface PivotRow {
  id: string;
  label: string;
  depth: number; // 0 = top-level (All or vertical-group row), 1 = sub-vertical
  parentId: string | null;
  cells: Record<string, number>;
  total: number;
}

interface PivotResult {
  columns: string[]; // horizontal axis values (sorted)
  rows: PivotRow[];
  grandTotal: number;
  maxCellValue: number;
  maxCellLabel: string;
}

// ── Props ─────────────────────────────────────────────────────────────

interface MatrixSectionProps {
  filteredTickets: Ticket[];
  isAdminOrAgent: boolean;
  isMetricPinned?: (key: string) => boolean;
  handlePin?: (key: string, label: string, type?: string, config?: any) => void;
  handleUnpin?: (key: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────

export default function MatrixSection({ filteredTickets, isAdminOrAgent, isMetricPinned, handlePin, handleUnpin }: MatrixSectionProps) {
  // ── Control Panel State ──────────────────────────────────────────────
  const [recordFilter, setRecordFilter] = useState<string>('active');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [horizontalAxis, setHorizontalAxis] = useState<AxisKey>('priority');
  const [verticalAxis, setVerticalAxis] = useState<AxisKey>('assignee');
  const [subVerticalAxis, setSubVerticalAxis] = useState<AxisKey | 'none'>('status');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

  // ── Matrix State ─────────────────────────────────────────────────────
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [percentageMode, setPercentageMode] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>('table');
  const [chartStyle, setChartStyle] = useState<ChartStyle>('grouped');

  // ── Drill-Down State ─────────────────────────────────────────────────
  const [drillDown, setDrillDown] = useState<DrillDownState>({
    levels: [],
    isOpen: false,
    tickets: [],
    loading: false,
  });

  // ── Applied axes (after clicking Apply) ──────────────────────────────
  const [appliedHAxis, setAppliedHAxis] = useState<AxisKey>('priority');
  const [appliedVAxis, setAppliedVAxis] = useState<AxisKey>('assignee');
  const [appliedSubVAxis, setAppliedSubVAxis] = useState<AxisKey | 'none'>('status');

  // ── Filter the tickets first ─────────────────────────────────────────
  const tickets = useMemo(() => {
    let result = filteredTickets;

    // Record type filter
    if (recordFilter === 'active') {
      result = result.filter((t) =>
        ['open', 'in_progress', 'pending'].includes(t.status),
      );
    } else if (recordFilter === 'closed') {
      result = result.filter((t) =>
        ['resolved', 'closed'].includes(t.status),
      );
    }

    // Type pills filter (if any selected)
    if (selectedTypes.length > 0) {
      result = result.filter((t) => selectedTypes.includes(t.ticket_type));
    }

    return result;
  }, [filteredTickets, recordFilter, selectedTypes]);

  // ── Advanced filter modal state ──────────────────────────────────────
  const [advStatusFilter, setAdvStatusFilter] = useState<string[]>([]);
  const [advPriorityFilter, setAdvPriorityFilter] = useState<string[]>([]);

  // ── Build pivot data ─────────────────────────────────────────────────
  const pivot = useMemo((): PivotResult => {
    const hAxis = appliedHAxis;
    const vAxis = appliedVAxis;
    const subVAxis = appliedSubVAxis;

    // Collect all unique values
    const hValues = new Set<string>();
    const vValues = new Set<string>();
    const svValues = new Map<string, Set<string>>(); // vKey -> Set<svKey>

    // Cell storage: key = `${vKey}|${svKey}` → { hKey: count }
    const cellMap = new Map<string, Map<string, number>>();

    tickets.forEach((t) => {
      const hVal = getAxisValue(t, hAxis);
      const vVal = getAxisValue(t, vAxis);
      const svVal = subVAxis !== 'none' ? getAxisValue(t, subVAxis) : '__none__';

      hValues.add(hVal);
      vValues.add(vVal);

      if (!svValues.has(vVal)) svValues.set(vVal, new Set());
      svValues.get(vVal)!.add(svVal);

      const cellKey = `${vVal}|${svVal}`;
      if (!cellMap.has(cellKey)) cellMap.set(cellKey, new Map());
      const row = cellMap.get(cellKey)!;
      row.set(hVal, (row.get(hVal) || 0) + 1);
    });

    // Sort values
    const sortedColumns = Array.from(hValues).sort();
    const sortedVertical = Array.from(vValues).sort();

    // Build rows
    const rows: PivotRow[] = [];
    let grandTotal = 0;
    let maxCellValue = 0;
    let maxCellLabel = '';

    // "All" row (grand total)
    const allCells: Record<string, number> = {};
    sortedColumns.forEach((h) => {
      allCells[h] = 0;
    });

    // Process each vertical value
    sortedVertical.forEach((vVal) => {
      const svSet = svValues.get(vVal) || new Set<string>();
      const sortedSv = Array.from(svSet).sort();

      // Subtotal row for this vertical value
      const subtotalCells: Record<string, number> = {};
      sortedColumns.forEach((h) => {
        subtotalCells[h] = 0;
      });

      const svChildren: PivotRow[] = [];
      sortedSv.forEach((svVal) => {
        const cellKey = `${vVal}|${svVal}`;
        const rowMap = cellMap.get(cellKey);
        const svCells: Record<string, number> = {};
        let svTotal = 0;

        sortedColumns.forEach((h) => {
          const count = rowMap?.get(h) || 0;
          svCells[h] = count;
          svTotal += count;
          subtotalCells[h] += count;
          allCells[h] += count;
        });

        if (svTotal > 0 || svVal === '__none__') {
          const label = svVal === '__none__' ? '' : formatLabel(svVal);
          svChildren.push({
            id: `${vVal}|${svVal}`,
            label,
            depth: 1,
            parentId: vVal,
            cells: svCells,
            total: svTotal,
          });

          // Track max
          sortedColumns.forEach((h) => {
            if (svCells[h] > maxCellValue) {
              maxCellValue = svCells[h];
              maxCellLabel = `${formatLabel(vVal)} / ${formatLabel(h)}`;
            }
          });
        }
      });

      const vTotal = sortedColumns.reduce((s, h) => s + subtotalCells[h], 0);
      grandTotal += vTotal;

      // Add subtotal row (depth 0)
      rows.push({
        id: vVal,
        label: formatLabel(vVal),
        depth: 0,
        parentId: null,
        cells: subtotalCells,
        total: vTotal,
        children: svChildren,
      } as PivotRow & { children: PivotRow[] });
    });

    // Add All row at the top
    const allRow: PivotRow = {
      id: '__all__',
      label: 'All',
      depth: 0,
      parentId: null,
      cells: allCells,
      total: grandTotal,
    };
    rows.unshift(allRow);

    return {
      columns: sortedColumns,
      rows,
      grandTotal,
      maxCellValue,
      maxCellLabel,
    };
  }, [tickets, appliedHAxis, appliedVAxis, appliedSubVAxis]);

  // ── Sort rows ────────────────────────────────────────────────────────
  const sortedRows = useMemo(() => {
    if (!sortColumn) return pivot.rows;

    const isAllColumn = sortColumn === '__all__';

    return pivot.rows.map((row) => {
      if ('children' in row && row.depth === 0 && row.id !== '__all__') {
        const r = row as PivotRow & { children: PivotRow[] };
        return {
          ...r,
          children: [...r.children].sort((a, b) => {
            const aVal = isAllColumn ? a.total : (a.cells[sortColumn] || 0);
            const bVal = isAllColumn ? b.total : (b.cells[sortColumn] || 0);
            return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
          }),
        };
      }
      return row;
    });
  }, [pivot.rows, sortColumn, sortDir]);

  // ── Count active assignees (summary) ────────────────────────────────
  const uniqueAssignees = useMemo(() => {
    const names = new Set<string>();
    tickets.forEach((t) => {
      if (t.assigned_to_name) names.add(t.assigned_to_name);
    });
    return names.size;
  }, [tickets]);

  const avgPerCell = useMemo(() => {
    const nonEmptyCount = pivot.rows.reduce((sum, row) => {
      const cellCount = Object.values(row.cells).filter((c) => c > 0).length;
      return sum + cellCount;
    }, 0);
    return nonEmptyCount > 0 ? (pivot.grandTotal / nonEmptyCount) : 0;
  }, [pivot]);

  // ── Expand / Collapse handlers ──────────────────────────────────────
  const toggleExpand = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Sort handler ─────────────────────────────────────────────────────
  const handleSort = useCallback(
    (col: string) => {
      if (sortColumn === col) {
        setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      } else {
        setSortColumn(col);
        setSortDir('desc');
      }
    },
    [sortColumn],
  );

  // ── Apply handler ────────────────────────────────────────────────────
  const handleApply = useCallback(() => {
    setAppliedHAxis(horizontalAxis);
    setAppliedVAxis(verticalAxis);
    setAppliedSubVAxis(subVerticalAxis);
    setExpandedRows(new Set());
    setSortColumn(null);
  }, [horizontalAxis, verticalAxis, subVerticalAxis]);

  // ── Reset handler ────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setHorizontalAxis('priority');
    setVerticalAxis('assignee');
    setSubVerticalAxis('status');
    setAppliedHAxis('priority');
    setAppliedVAxis('assignee');
    setAppliedSubVAxis('status');
    setRecordFilter('active');
    setSelectedTypes([]);
    setExpandedRows(new Set());
    setSortColumn(null);
    setPercentageMode(false);
  }, []);

  // ── Cell click → drill down ─────────────────────────────────────────
  const handleCellClick = useCallback(
    (hVal: string, vRow: PivotRow, svRow?: PivotRow) => {
      const levels: DrillDownLevel[] = [];

      // Vertical level
      if (svRow) {
        levels.push({
          label: `${formatLabel(appliedVAxis)}: ${vRow.label}`,
          filterKey: appliedVAxis === 'assignee' ? 'assignee' : appliedVAxis === 'status' ? 'status' : appliedVAxis === 'priority' ? 'priority' : 'status',
          filterValue: vRow.id === '__all__' ? '' : vRow.id,
          count: 0,
        });
        levels.push({
          label: `${formatLabel(appliedSubVAxis)}: ${svRow.label}`,
          filterKey: appliedSubVAxis === 'status' ? 'status' : appliedSubVAxis === 'priority' ? 'priority' : 'category' as any,
          filterValue: svRow.label.toLowerCase(),
          count: 0,
        });
      } else if (vRow.id !== '__all__') {
        levels.push({
          label: `${formatLabel(appliedVAxis)}: ${vRow.label}`,
          filterKey: appliedVAxis === 'assignee' ? 'assignee' : appliedVAxis === 'status' ? 'status' : appliedVAxis === 'priority' ? 'priority' : 'status',
          filterValue: vRow.id,
          count: 0,
        });
      }

      // Horizontal level
      levels.push({
        label: `${formatLabel(appliedHAxis)}: ${formatLabel(hVal)}`,
        filterKey: appliedHAxis === 'priority' ? 'priority' : appliedHAxis === 'status' ? 'status' : appliedHAxis === 'category' ? 'category' : appliedHAxis === 'assignee' ? 'assignee' : 'status',
        filterValue: hVal,
        count: 0,
      });

      // Filter tickets
      const filtered = tickets.filter((t) => {
        // Vertical axis filter
        if (vRow.id !== '__all__') {
          const vTicketVal = getAxisValue(t, appliedVAxis);
          if (vTicketVal !== vRow.id) return false;
        }
        // Sub-vertical filter
        if (svRow) {
          const svTicketVal = getAxisValue(t, appliedSubVAxis as AxisKey);
          if (formatLabel(svTicketVal) !== svRow.label) return false;
        }
        // Horizontal axis filter
        const hTicketVal = getAxisValue(t, appliedHAxis);
        if (hTicketVal !== hVal) return false;
        return true;
      });

      setDrillDown({
        levels,
        isOpen: true,
        tickets: filtered,
        loading: false,
      });
    },
    [tickets, appliedHAxis, appliedVAxis, appliedSubVAxis],
  );

  // ── Drill-down handlers ──────────────────────────────────────────────
  const closeDrillDown = useCallback(() => {
    setDrillDown((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const drillUp = useCallback(() => {
    setDrillDown((prev) => {
      const newLevels = prev.levels.slice(0, -1);
      // Re-filter
      const filtered = tickets.filter((t) => {
        return newLevels.every((level) => {
          const key = level.filterKey === 'assignee' ? 'assigned_to_name'
            : level.filterKey === 'category' ? 'category_name'
              : level.filterKey === 'ticket_type' ? 'ticket_type'
                : level.filterKey;
          const tVal = (t as any)[key] || '';
          const match = tVal.toString().toLowerCase() === level.filterValue.toLowerCase();
          return match;
        });
      });
      return {
        ...prev,
        levels: newLevels,
        tickets: filtered,
        loading: false,
      };
    });
  }, [tickets]);

  // ── Chart data preparation ─────────────────────────────────────────
  const chartData = useMemo(() => {
    if (pivot.rows.length <= 1) return [];

    // Use only depth-0 rows (excluding "All")
    const vLabels: string[] = [];
    const vColorMap: Record<string, string> = {};

    pivot.columns.forEach((h, i) => {
      vColorMap[h] = `hsl(${(i * 45 + 200) % 360}, 65%, 55%)`;
    });

    const data = pivot.columns.map((hVal) => {
      const entry: Record<string, any> = { name: formatLabel(hVal) };
      pivot.rows.forEach((row) => {
        if (row.id === '__all__') return;
        entry[row.id] = row.cells[hVal] || 0;
      });
      return entry;
    });

    return data;
  }, [pivot]);

  const chartSeries = useMemo(() => {
    if (pivot.rows.length <= 1) return [];
    return pivot.rows
      .filter((r) => r.id !== '__all__')
      .map((r, i) => ({
        dataKey: r.id,
        name: r.label,
        color: `hsl(${(i * 45 + 200) % 360}, 65%, 55%)`,
      }));
  }, [pivot]);

  // ── Render ───────────────────────────────────────────────────────────

  const cellStyleBase: React.CSSProperties = {
    padding: '6px 10px',
    fontSize: 14,
    borderRight: '1px solid var(--border, #dde1e7)',
    borderBottom: '1px solid var(--border-subtle, #eef0f3)',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  };

  const headerStyle: React.CSSProperties = {
    ...cellStyleBase,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    color: THEME.headerText,
    background: THEME.headerBg,
    position: 'sticky',
    top: 0,
    zIndex: 2,
    cursor: 'pointer',
    userSelect: 'none',
  };

  const handleTypePill = useCallback((type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Grid3x3 size={18} />
          Matrix / Cross-Tab Analysis
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          Multi-dimensional pivot table for cross-tabulating ticket dimensions.
        </p>
      </div>

      {/* ── Control Panel ──────────────────────────────────────────── */}
      <div
        className="matrix-control-panel"
        style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
          padding: '12px 16px', background: THEME.bgSecondary,
          borderRadius: 10, border: `1px solid ${THEME.borderSubtle}`,
        }}
      >
        {/* Record Type Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: THEME.textSecondary, whiteSpace: 'nowrap' }}>
            Filter By:
          </label>
          <select
            value={recordFilter}
            onChange={(e) => setRecordFilter(e.target.value)}
            style={{
              padding: '4px 8px', fontSize: 12, borderRadius: 6,
              border: `1px solid ${THEME.border}`, background: THEME.bgElevated,
              color: THEME.text, cursor: 'pointer',
            }}
          >
            {RECORD_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        <div style={{ width: 1, height: 24, background: THEME.border }} />

        {/* Type Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {TYPE_OPTIONS.map((opt) => {
            const active = selectedTypes.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => handleTypePill(opt.value)}
                style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 600,
                  borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: active ? THEME.teal : THEME.bgElevated,
                  color: active ? '#fff' : THEME.textSecondary,
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Advanced Filter */}
        <button
          onClick={() => setShowAdvancedFilter(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
            fontSize: 11, fontWeight: 500, borderRadius: 6, border: 'none',
            background: 'transparent', color: THEME.teal, cursor: 'pointer',
          }}
        >
          <Filter size={12} />
          Advanced Filter
        </button>

        <div style={{ flex: 1, minWidth: 8 }} />

        {/* Horizontal Axis */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: THEME.textSecondary, whiteSpace: 'nowrap' }}>
            Horizontal:
          </label>
          <select
            value={horizontalAxis}
            onChange={(e) => setHorizontalAxis(e.target.value as AxisKey)}
            style={{
              padding: '4px 8px', fontSize: 12, borderRadius: 6,
              border: `1px solid ${THEME.border}`, background: THEME.bgElevated,
              color: THEME.text, cursor: 'pointer',
            }}
          >
            {AXIS_OPTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        {/* Vertical Axis */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: THEME.textSecondary, whiteSpace: 'nowrap' }}>
            Vertical:
          </label>
          <select
            value={verticalAxis}
            onChange={(e) => setVerticalAxis(e.target.value as AxisKey)}
            style={{
              padding: '4px 8px', fontSize: 12, borderRadius: 6,
              border: `1px solid ${THEME.border}`, background: THEME.bgElevated,
              color: THEME.text, cursor: 'pointer',
            }}
          >
            {AXIS_OPTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        {/* Sub-Vertical Axis */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: THEME.textSecondary, whiteSpace: 'nowrap' }}>
            Sub:
          </label>
          <select
            value={subVerticalAxis}
            onChange={(e) => setSubVerticalAxis(e.target.value as AxisKey | 'none')}
            style={{
              padding: '4px 8px', fontSize: 12, borderRadius: 6,
              border: `1px solid ${THEME.border}`, background: THEME.bgElevated,
              color: THEME.text, cursor: 'pointer',
            }}
          >
            {SUB_VERTICAL_OPTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        {/* Apply */}
        <button
          onClick={handleApply}
          style={{
            padding: '6px 16px', fontSize: 12, fontWeight: 600,
            borderRadius: 6, border: 'none', cursor: 'pointer',
            background: THEME.teal, color: '#fff',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = THEME.tealHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = THEME.teal; }}
        >
          Apply
        </button>

        {/* Reset */}
        <button
          onClick={handleReset}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px',
            fontSize: 11, fontWeight: 500, borderRadius: 6, border: 'none',
            background: 'transparent', color: THEME.textMuted, cursor: 'pointer',
          }}
        >
          <RotateCcw size={12} />
          Reset
        </button>
      </div>

      {/* ── Empty State ──────────────────────────────────────────── */}
      {tickets.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
          <Grid3x3 size={48} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
          <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 6, color: 'var(--text-secondary)' }}>No data available</p>
          <p style={{ fontSize: 14, maxWidth: 420, margin: '0 auto', lineHeight: 1.5 }}>
            No tickets match your current filter criteria. Adjust the record filter, ticket types, or axis selections to see pivot analytics.
          </p>
        </div>
      ) : (
      <>
      {/* ── Visualization & Percentage Toggle ─────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Pin current view */}
          {isMetricPinned && handlePin && handleUnpin && (
            <PinButton
              size={14}
              isPinned={isMetricPinned(chartMode === 'table' ? 'matrix_table' : 'matrix_chart')}
              onPin={() => handlePin(
                chartMode === 'table' ? 'matrix_table' : 'matrix_chart',
                chartMode === 'table' ? 'Matrix Table' : 'Matrix Chart',
                chartMode === 'table' ? 'table' : 'chart',
              )}
              onUnpin={() => handleUnpin(chartMode === 'table' ? 'matrix_table' : 'matrix_chart')}
            />
          )}
          {/* Table / Chart toggle */}
          <div
            style={{
              display: 'flex', borderRadius: 6, border: `1px solid ${THEME.border}`,
              overflow: 'hidden',
            }}
          >
            {CHART_MODES.map((mode) => (
              <button
                key={mode}
                onClick={() => setChartMode(mode)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 12px', fontSize: 11, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  background: chartMode === mode ? THEME.teal : THEME.bgElevated,
                  color: chartMode === mode ? '#fff' : THEME.textSecondary,
                  transition: 'all 0.15s',
                }}
              >
                {mode === 'table' ? <Table size={14} /> : <BarChart3 size={14} />}
                {mode === 'table' ? 'Table' : 'Chart'}
              </button>
            ))}
          </div>

          {/* Chart style toggle (only when chart view) */}
          {chartMode === 'chart' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {(['grouped', 'stacked', 'heatmap'] as ChartStyle[]).map((style) => (
                <button
                  key={style}
                  onClick={() => setChartStyle(style)}
                  style={{
                    padding: '4px 10px', fontSize: 10, fontWeight: 500,
                    borderRadius: 4, border: 'none', cursor: 'pointer',
                    background: chartStyle === style ? THEME.bgSecondary : 'transparent',
                    color: chartStyle === style ? THEME.text : THEME.textMuted,
                    textTransform: 'capitalize',
                  }}
                >
                  {style === 'heatmap' ? 'Heat Map' : style}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Percentage toggle */}
        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 500, color: THEME.textSecondary,
            cursor: 'pointer', userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={percentageMode}
            onChange={() => setPercentageMode((p) => !p)}
            style={{ accentColor: THEME.teal }}
          />
          Show Percentages
        </label>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .matrix-control-panel { flex-direction: column !important; align-items: stretch !important; }
          .matrix-control-panel > div { width: 100%; }
        }
      `}</style>

      {/* ── Main Content: Table or Chart ──────────────────────────── */}
      {chartMode === 'table' ? (
        <>
          {/* ── Matrix Table ──────────────────────────────────────── */}
          <div style={{ overflowX: 'auto', borderRadius: 10, border: `1px solid ${THEME.border}` }}>
            <table
              style={{
                width: '100%', borderCollapse: 'collapse',
                fontSize: 14,
              }}
            >
              {/* ── Header ────────────────────────────────────────── */}
              <thead>
                <tr>
                  {/* Row label column */}
                  <th
                    style={{
                      ...headerStyle,
                      textAlign: 'left', minWidth: 180,
                      position: 'sticky', left: 0, zIndex: 3,
                      borderRight: `2px solid ${THEME.border}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{formatLabel(appliedVAxis)}</span>
                      {appliedSubVAxis !== 'none' && (
                        <span style={{ color: THEME.textMuted, fontWeight: 400, textTransform: 'none' }}>
                          / {formatLabel(appliedSubVAxis)}
                        </span>
                      )}
                    </div>
                  </th>

                  {/* All column */}
                  <th
                    style={{
                      ...headerStyle,
                      cursor: 'pointer',
                      minWidth: 50,
                    }}
                    onClick={() => handleSort('__all__')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      All
                      {sortColumn === '__all__' && (
                        <span style={{ fontSize: 10 }}>{sortDir === 'desc' ? '▼' : '▲'}</span>
                      )}
                    </div>
                  </th>

                  {/* Horizontal axis columns */}
                  {pivot.columns.map((hVal) => (
                    <th
                      key={hVal}
                      style={{
                        ...headerStyle,
                        cursor: 'pointer',
                        minWidth: 80,
                      }}
                      onClick={() => handleSort(hVal)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        {formatLabel(hVal)}
                        {sortColumn === hVal && (
                          <span style={{ fontSize: 10 }}>{sortDir === 'desc' ? '▼' : '▲'}</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {pivot.rows.map((row) => {
                  const hasChildren = 'children' in row && (row as any).children?.length > 0;
                  const children = hasChildren ? (row as any).children as PivotRow[] : [];
                  const isExpanded = expandedRows.has(row.id);
                  const maxVal = pivot.maxCellValue || 1;

                  return (
                    <Fragment key={row.id}>
                      {/* ── Top-level row (depth 0) ─────────────── */}
                      <tr
                        style={{
                          background: row.id === '__all__' ? THEME.bgSecondary : 'var(--bg-card)',
                        }}
                        onMouseEnter={(e) => {
                          if (row.id !== '__all__') e.currentTarget.style.background = THEME.rowHover;
                        }}
                        onMouseLeave={(e) => {
                          if (row.id !== '__all__') e.currentTarget.style.background = 'var(--bg-card)';
                        }}
                      >
                        {/* Row label */}
                        <td
                          style={{
                            ...cellStyleBase,
                            textAlign: 'left',
                            fontWeight: row.id === '__all__' ? 700 : 600,
                            position: 'sticky', left: 0, zIndex: 1,
                            background: 'inherit',
                            borderRight: `2px solid ${THEME.border}`,
                            cursor: hasChildren ? 'pointer' : 'default',
                          }}
                          onClick={() => hasChildren && toggleExpand(row.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {hasChildren && (
                              <span style={{ display: 'flex', color: THEME.textMuted }}>
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </span>
                            )}
                            {!hasChildren && <span style={{ width: 14 }} />}
                            <span>{row.label}</span>
                            <span style={{ fontSize: 11, color: THEME.textMuted, fontWeight: 400 }}>
                              ({row.total})
                            </span>
                          </div>
                        </td>

                        {/* "All" column value */}
                        <td
                          style={{
                            ...cellStyleBase,
                            fontWeight: 700,
                            color: THEME.teal,
                            background: 'inherit',
                          }}
                          onClick={() => handleCellClick('__all__', row)}
                        >
                          {percentageMode
                            ? `${((row.total / (pivot.grandTotal || 1)) * 100).toFixed(1)}%`
                            : row.total}
                        </td>

                        {/* Cell values for each horizontal column */}
                        {pivot.columns.map((hVal) => {
                          const count = row.cells[hVal] || 0;
                          const bg = count > 0 ? heatColor(count, maxVal) : 'transparent';
                          const fg = count > 0 ? heatTextColor(count, maxVal) : THEME.textSecondary;
                          return (
                            <td
                              key={hVal}
                              style={{
                                ...cellStyleBase,
                                background: bg,
                                color: fg,
                                fontFamily: count > 0 ? 'ui-monospace, monospace' : 'inherit',
                                cursor: count > 0 ? 'pointer' : 'default',
                                fontWeight: count > 0 ? 600 : 400,
                                transition: 'opacity 0.1s',
                              }}
                              onClick={() => count > 0 && handleCellClick(hVal, row)}
                              title={
                                count > 0
                                  ? `${row.label}, ${formatLabel(hVal)}: ${count} ticket${count !== 1 ? 's' : ''}`
                                  : ''
                              }
                              onMouseEnter={(e) => {
                                if (count > 0) e.currentTarget.style.opacity = '0.8';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = '1';
                              }}
                            >
                              {percentageMode
                                ? `${((count / (pivot.grandTotal || 1)) * 100).toFixed(1)}%`
                                : count || '-'}
                            </td>
                          );
                        })}
                      </tr>

                      {/* ── Sub-vertical rows (depth 1, if expanded) ── */}
                      {hasChildren && isExpanded && children.map((child) => (
                        <tr
                          key={child.id}
                          style={{ background: 'var(--bg-card)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = THEME.rowHover; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; }}
                        >
                          <td
                            style={{
                              ...cellStyleBase,
                              textAlign: 'left',
                              fontWeight: 400,
                              paddingLeft: 40,
                              position: 'sticky', left: 0, zIndex: 1,
                              background: 'inherit',
                              borderRight: `2px solid ${THEME.border}`,
                              fontSize: 13,
                              color: THEME.textSecondary,
                            }}
                          >
                            {child.label}
                          </td>

                          {/* Sub-vertical "All" column */}
                          <td
                            style={{
                              ...cellStyleBase,
                              fontWeight: 600,
                              color: THEME.textSecondary,
                              background: 'inherit',
                            }}
                            onClick={() => handleCellClick('__all__', row, child)}
                          >
                            {percentageMode
                              ? `${((child.total / (pivot.grandTotal || 1)) * 100).toFixed(1)}%`
                              : child.total}
                          </td>

                          {/* Sub-vertical cells */}
                          {pivot.columns.map((hVal) => {
                            const count = child.cells[hVal] || 0;
                            const bg = count > 0 ? heatColor(count, maxVal) : 'transparent';
                            const fg = count > 0 ? heatTextColor(count, maxVal) : THEME.textMuted;
                            return (
                              <td
                                key={hVal}
                                style={{
                                  ...cellStyleBase,
                                  background: bg,
                                  color: fg,
                                  fontFamily: count > 0 ? 'ui-monospace, monospace' : 'inherit',
                                  cursor: count > 0 ? 'pointer' : 'default',
                                  fontWeight: count > 0 ? 500 : 400,
                                  fontSize: 13,
                                  transition: 'opacity 0.1s',
                                }}
                                onClick={() => count > 0 && handleCellClick(hVal, row, child)}
                                title={
                                  count > 0
                                    ? `${child.label}, ${formatLabel(hVal)}: ${count} ticket${count !== 1 ? 's' : ''}`
                                    : ''
                                }
                                onMouseEnter={(e) => {
                                  if (count > 0) e.currentTarget.style.opacity = '0.8';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.opacity = '1';
                                }}
                              >
                                {percentageMode
                                  ? `${((count / (pivot.grandTotal || 1)) * 100).toFixed(1)}%`
                                  : count || '-'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}

                {/* ── Grand Total Row (footer) ──────────────────── */}
                <tr style={{ background: THEME.headerBg }}>
                  <td
                    style={{
                      ...cellStyleBase,
                      textAlign: 'left', fontWeight: 700,
                      position: 'sticky', left: 0, zIndex: 1,
                      background: THEME.headerBg,
                      borderRight: `2px solid ${THEME.border}`,
                      fontSize: 12, textTransform: 'uppercase',
                    }}
                  >
                    Grand Total
                  </td>
                  <td style={{ ...cellStyleBase, fontWeight: 700, color: THEME.teal, background: THEME.headerBg }}>
                    {percentageMode ? '100%' : pivot.grandTotal}
                  </td>
                  {pivot.columns.map((hVal) => {
                    const colTotal = pivot.rows.reduce((s, r) => s + (r.cells[hVal] || 0), 0);
                    return (
                      <td
                        key={hVal}
                        style={{
                          ...cellStyleBase,
                          fontWeight: 700,
                          background: THEME.headerBg,
                          color: THEME.headerText,
                        }}
                      >
                        {percentageMode
                          ? `${((colTotal / (pivot.grandTotal || 1)) * 100).toFixed(1)}%`
                          : colTotal}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* ── Chart View ─────────────────────────────────────────── */
        <div
          style={{
            padding: 16,
            borderRadius: 10,
            border: `1px solid ${THEME.border}`,
            background: THEME.bgElevated,
          }}
        >
          {chartStyle === 'heatmap' ? (
            /* Heatmap */
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'inline-block', minWidth: '100%' }}>
                {/* Column headers */}
                <div style={{ display: 'flex', marginLeft: 140 }}>
                  <div style={{ width: 50, flexShrink: 0 }} />
                  {pivot.columns.map((hVal) => (
                    <div
                      key={hVal}
                      style={{
                        width: 80, padding: '4px 6px', textAlign: 'center',
                        fontSize: 10, fontWeight: 600, color: THEME.textSecondary,
                        textTransform: 'uppercase', flexShrink: 0,
                      }}
                    >
                      {formatLabel(hVal)}
                    </div>
                  ))}
                </div>

                {/* Rows */}
                {pivot.rows.map((row) => {
                  if (row.id === '__all__') return null;
                  return (
                    <div key={row.id} style={{ display: 'flex', alignItems: 'center' }}>
                      <div
                        style={{
                          width: 140, padding: '4px 8px', flexShrink: 0,
                          fontSize: 12, fontWeight: 600, color: THEME.text,
                          textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}
                      >
                        {row.label}
                      </div>
                      <div style={{ width: 50, padding: '4px 6px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: THEME.teal, flexShrink: 0 }}>
                        {row.total}
                      </div>
                      {pivot.columns.map((hVal) => {
                        const count = row.cells[hVal] || 0;
                        const maxV = pivot.maxCellValue || 1;
                        const bg = count > 0 ? heatColor(count, maxV) : 'transparent';
                        const fg = count > 0 ? heatTextColor(count, maxV) : THEME.textMuted;
                        return (
                          <div
                            key={hVal}
                            style={{
                              width: 80, height: 32, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: bg, color: fg, fontSize: 12,
                              fontFamily: 'ui-monospace, monospace',
                              fontWeight: count > 0 ? 600 : 400,
                              border: `1px solid ${THEME.borderSubtle}`,
                              cursor: count > 0 ? 'pointer' : 'default',
                              transition: 'opacity 0.1s',
                            }}
                            title={
                              count > 0
                                ? `${row.label}, ${formatLabel(hVal)}: ${count} ticket${count !== 1 ? 's' : ''}`
                                : ''
                            }
                            onClick={() => count > 0 && handleCellClick(hVal, row)}
                          >
                            {count || '-'}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Legend */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 11, color: THEME.textMuted }}>
                  <span>Low</span>
                  <div style={{ width: 120, height: 10, borderRadius: 4, background: 'linear-gradient(to right, #eff6ff, #bfdbfe, #3b82f6)' }} />
                  <span>High</span>
                </div>
              </div>
            </div>
          ) : (
            /* Grouped or Stacked Bar Chart */
            chartData.length > 0 && chartSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={THEME.borderSubtle} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: THEME.textMuted, fontSize: 11 }}
                    axisLine={{ stroke: THEME.border }}
                    tickLine={false}
                    tickMargin={8}
                    angle={chartData.length > 8 ? -35 : 0}
                    textAnchor={chartData.length > 8 ? 'end' : 'middle'}
                  />
                  <YAxis
                    tick={{ fill: THEME.textMuted, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: THEME.bgElevated,
                      border: `1px solid ${THEME.border}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="rect"
                    iconSize={10}
                    formatter={(value: string) => (
                      <span style={{ color: THEME.textSecondary, fontSize: 11 }}>{value}</span>
                    )}
                  />
                  {chartSeries.map((s) => (
                    <Bar
                      key={s.dataKey}
                      dataKey={s.dataKey}
                      name={s.name}
                      fill={s.color}
                      radius={3}
                      stackId={chartStyle === 'stacked' ? 'stack' : undefined}
                      animationDuration={800}
                      animationEasing="ease-out"
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: THEME.textMuted, fontSize: 14 }}>
                No chart data available. Choose different axes or add more tickets.
              </div>
            )
          )}
        </div>
      )}
      </>
      )}

      {/* ── Summary Statistics ────────────────────────────────────── */}
      <div
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
        }}
      >
        <SummaryCard
          label="Total Records"
          value={pivot.grandTotal.toLocaleString()}
          subtitle={`${tickets.length} filtered tickets`}
          accent={THEME.teal}
        />
        <SummaryCard
          label="Unique Assignees"
          value={uniqueAssignees.toLocaleString()}
          subtitle={appliedVAxis === 'assignee' ? 'Vertical axis dimension' : 'From ticket data'}
          accent="#3b82f6"
        />
        <SummaryCard
          label="Avg per Cell"
          value={avgPerCell.toFixed(1)}
          subtitle="Non-empty cells average"
          accent="#8b5cf6"
        />
        <SummaryCard
          label="Max Cell Value"
          value={pivot.maxCellValue.toLocaleString()}
          subtitle={pivot.maxCellLabel || '-'}
          accent="#f97316"
        />
      </div>

      {/* ── Admin Note ───────────────────────────────────────────── */}
      {!isAdminOrAgent && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Additional matrix views and cross-tab analysis features available for admin users.
        </p>
      )}

      {/* ── Drill-Down Modal ──────────────────────────────────────── */}
      <DrillDownModal
        state={drillDown}
        onClose={closeDrillDown}
        onDrillUp={drillUp}
        onNavigateToTickets={() => {}}
        title="Cell Details"
      />

      {/* ── Advanced Filter Modal ────────────────────────────────── */}
      {showAdvancedFilter && (
        <AdvancedFilterModal
          statusFilter={advStatusFilter}
          priorityFilter={advPriorityFilter}
          onStatusChange={setAdvStatusFilter}
          onPriorityChange={setAdvPriorityFilter}
          onClose={() => setShowAdvancedFilter(false)}
          onApply={() => setShowAdvancedFilter(false)}
        />
      )}
    </div>
  );
}

// ── Summary Card ─────────────────────────────────────────────────────
function SummaryCard({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 10,
        border: '1px solid var(--border, #dde1e7)',
        background: 'var(--bg-elevated, #fff)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, color: THEME.textMuted, textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontSize: 24, fontWeight: 700, color: accent }}>
        {value}
      </span>
      <span style={{ fontSize: 11, color: THEME.textMuted }}>
        {subtitle}
      </span>
    </div>
  );
}

// ── Advanced Filter Modal ────────────────────────────────────────────
const STATUS_OPTIONS = ['open', 'in_progress', 'pending', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['critical', 'high', 'medium', 'low'];

function AdvancedFilterModal({
  statusFilter,
  priorityFilter,
  onStatusChange,
  onPriorityChange,
  onClose,
  onApply,
}: {
  statusFilter: string[];
  priorityFilter: string[];
  onStatusChange: (v: string[]) => void;
  onPriorityChange: (v: string[]) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: THEME.bgElevated,
          border: `1px solid ${THEME.border}`,
          borderRadius: 16,
          width: '100%', maxWidth: 480,
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 24px', borderBottom: `1px solid ${THEME.border}`,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: THEME.text }}>
            <Filter size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Advanced Filters
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 6, borderRadius: 8, display: 'flex',
              color: THEME.textMuted,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 24px', overflow: 'auto', flex: 1 }}>
          {/* Status filter */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: THEME.text, display: 'block', marginBottom: 8 }}>
              Status
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {STATUS_OPTIONS.map((opt) => {
                const active = statusFilter.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() =>
                      onStatusChange(
                        active
                          ? statusFilter.filter((s) => s !== opt)
                          : [...statusFilter, opt],
                      )
                    }
                    style={{
                      padding: '4px 12px', fontSize: 12, fontWeight: 500,
                      borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: active ? THEME.teal : THEME.bgSecondary,
                      color: active ? '#fff' : THEME.textSecondary,
                      textTransform: 'capitalize',
                    }}
                  >
                    {opt.replace(/_/g, ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority filter */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: THEME.text, display: 'block', marginBottom: 8 }}>
              Priority
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PRIORITY_OPTIONS.map((opt) => {
                const active = priorityFilter.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() =>
                      onPriorityChange(
                        active
                          ? priorityFilter.filter((p) => p !== opt)
                          : [...priorityFilter, opt],
                      )
                    }
                    style={{
                      padding: '4px 12px', fontSize: 12, fontWeight: 500,
                      borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: active ? THEME.teal : THEME.bgSecondary,
                      color: active ? '#fff' : THEME.textSecondary,
                      textTransform: 'capitalize',
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex', justifyContent: 'flex-end', gap: 8,
            padding: '14px 24px', borderTop: `1px solid ${THEME.border}`,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', fontSize: 12, fontWeight: 500,
              borderRadius: 6, border: `1px solid ${THEME.border}`,
              background: THEME.bgElevated, color: THEME.textSecondary,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            style={{
              padding: '8px 16px', fontSize: 12, fontWeight: 600,
              borderRadius: 6, border: 'none',
              background: THEME.teal, color: '#fff',
              cursor: 'pointer',
            }}
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
