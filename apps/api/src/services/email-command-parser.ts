// email-command-parser.ts — Parse email commands from subject line and body
// Enables users to control tickets via inbound email by recognizing bracketed
// subject tags ([Status:Resolved]) and body directives (@resolv close Fixed).

export interface EmailCommand {
  command: string;        // 'status' | 'priority' | 'assign' | 'close' | 'resolve' | 'reopen' | 'delete' | 'cc' | 'type' | 'category'
  value: string;          // The argument value
  raw: string;            // The original matched text
}

export interface ParsedEmailCommands {
  commands: EmailCommand[];
  cleanedSubject: string;   // Subject with command tags removed
  cleanedBody: string;      // Body with command lines removed
  ticketNumber: number | null;  // Extracted ticket number if any
}

// ── Subject command regex patterns ─────────────────────────────────────

const SUBJECT_COMMAND_PATTERNS: { command: string; pattern: RegExp }[] = [
  { command: 'status',   pattern: /\[Status\s*:\s*([^\]]+)\]/i },
  { command: 'priority', pattern: /\[Priority\s*:\s*([^\]]+)\]/i },
  { command: 'type',     pattern: /\[Type\s*:\s*([^\]]+)\]/i },
  { command: 'category', pattern: /\[Category\s*:\s*([^\]]+)\]/i },
  { command: 'assign',   pattern: /\[Assign\s*:\s*([^\]]+)\]/i },
  { command: 'close',    pattern: /\[Close\s*:\s*([^\]]+)\]/i },
  { command: 'resolve',  pattern: /\[Resolve\s*:\s*([^\]]+)\]/i },
  { command: 'reopen',   pattern: /\[Reopen\]/i },
  { command: 'delete',   pattern: /\[Delete\]/i },
  { command: 'cc',       pattern: /\[CC\s*:\s*([^\]]+)\]/i },
];

// ── Body @resolv directive regex ──────────────────────────────────────

const BODY_COMMAND_REGEX = /^@resolv\s+(\w+)\s*(.*)$/im;

// ── Valid command set ──────────────────────────────────────────────────

const VALID_COMMANDS = new Set([
  'status', 'priority', 'assign', 'close', 'resolve',
  'reopen', 'delete', 'cc', 'type', 'category',
]);

// ── Ticket number extraction (mirrors inbound-email.ts) ────────────────

function extractTicketNumber(subject: string): number | null {
  // Strategy 1: Look for "Ticket #NNN", "Incident #NNN", "SR #NNN", etc.
  const labeledMatch = subject.match(/(?:ticket|incident|problem|change|service\s*request|SR)\s*#(\d+)/i);
  if (labeledMatch) {
    const num = parseInt(labeledMatch[1], 10);
    if (!isNaN(num)) return num;
  }

  // Strategy 2: Look for [#NNN] pattern (bracketed)
  const bracketMatch = subject.match(/\[#(\d+)\]/);
  if (bracketMatch) {
    const num = parseInt(bracketMatch[1], 10);
    if (!isNaN(num)) return num;
  }

  // Strategy 3: Look for any #NNNNN (at least 2 digits to avoid false positives)
  const hashMatch = subject.match(/#(\d{2,})/);
  if (hashMatch) {
    const num = parseInt(hashMatch[1], 10);
    if (!isNaN(num)) return num;
  }

  return null;
}

// ── Subject line command parsing ───────────────────────────────────────

function parseSubjectCommands(subject: string): { commands: EmailCommand[]; cleanedSubject: string } {
  const commands: EmailCommand[] = [];
  let cleaned = subject;

  for (const { command, pattern } of SUBJECT_COMMAND_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match) {
      const value = match[1] !== undefined ? match[1].trim() : '';
      const raw = match[0];
      commands.push({ command, value, raw });
      // Remove the matched tag from subject
      cleaned = cleaned.replace(raw, '').trim();
    }
  }

  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return { commands, cleanedSubject: cleaned };
}

// ── Body @resolv command parsing ───────────────────────────────────────

function parseBodyCommands(body: string): { commands: EmailCommand[]; cleanedBody: string } {
  const commands: EmailCommand[] = [];
  const lines = body.split('\n');
  const remainingLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(BODY_COMMAND_REGEX);
    if (match) {
      const command = match[1].toLowerCase();
      if (VALID_COMMANDS.has(command)) {
        commands.push({
          command,
          value: match[2].trim(),
          raw: trimmed,
        });
        continue; // skip this line — it's a command
      }
    }
    remainingLines.push(line);
  }

  return {
    commands,
    cleanedBody: remainingLines.join('\n').trim(),
  };
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Parse email commands from subject line and body.
 *
 * Subject line supports bracketed tags:
 *   [Status:in_progress] [Priority:high] [Assign:user@example.com]
 *   [Close:reason] [Resolve:text] [Reopen] [Delete] [CC:user@example.com]
 *   [Type:change] [Category:Network]
 *
 * Body supports @resolv directives (one per line):
 *   @resolv status in_progress
 *   @resolv priority high
 *   @resolv assign user@example.com
 *
 * Also extracts ticket number from subject (#1234, Ticket #1234, [#1234], etc.).
 */
export function parseEmailCommands(subject: string, body: string): ParsedEmailCommands {
  const subjectResult = parseSubjectCommands(subject);
  const bodyResult = parseBodyCommands(body);
  const ticketNumber = extractTicketNumber(subject);

  // Subject commands take precedence over body commands for the same command type.
  // Merge: body commands come first so subject commands override duplicates.
  const commandMap = new Map<string, EmailCommand>();
  for (const cmd of bodyResult.commands) {
    commandMap.set(cmd.command, cmd);
  }
  for (const cmd of subjectResult.commands) {
    commandMap.set(cmd.command, cmd); // overrides body
  }

  const commands = Array.from(commandMap.values());

  console.log(`[email-command-parser] Parsed ${commands.length} command(s) from email`);

  return {
    commands,
    cleanedSubject: subjectResult.cleanedSubject,
    cleanedBody: bodyResult.cleanedBody,
    ticketNumber,
  };
}

// ── Permission validation ─────────────────────────────────────────────

interface PermissionCheck {
  allowed: boolean;
  reason?: string;
}

/**
 * Validate whether a sender is permitted to execute a given email command.
 *
 * Authorization matrix:
 * | Command   | Allowed Roles                          |
 * |-----------|----------------------------------------|
 * | status    | admin, manager, agent, user (own)*     |
 * | priority  | admin, manager, agent                  |
 * | assign    | admin, manager (need assign_tickets)    |
 * | close     | admin, manager, agent                   |
 * | resolve   | admin, manager, agent                   |
 * | reopen    | admin, manager, agent, user (own)*      |
 * | delete    | admin (need delete_tickets)             |
 * | cc        | admin, manager, agent, user (own)*      |
 * | type      | admin, manager, agent                   |
 * | category  | admin, manager, agent                   |
 *
 * * For user (own) — the caller must verify ticket ownership before applying.
 *   This function returns allowed=true for user role on these commands,
 *   leaving ownership checks to the caller.
 */
export function validateCommandPermission(
  command: string,
  senderRole: string,
  senderPermissions: string[],
): PermissionCheck {
  const role = senderRole.toLowerCase();
  const permissions = senderPermissions.map(p => p.toLowerCase());
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isAgent = role === 'agent';
  const isUser = role === 'user';

  switch (command) {
    case 'status':
      if (isAdmin || isManager || isAgent || isUser) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Status changes require admin, manager, agent, or user role' };

    case 'priority':
      if (isAdmin || isManager || isAgent) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Priority changes require admin, manager, or agent role' };

    case 'assign':
      if (isAdmin || isManager) {
        if (isAdmin || permissions.includes('assign_tickets')) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'Assign requires the assign_tickets permission' };
      }
      return { allowed: false, reason: 'Assign requires admin or manager role with assign_tickets permission' };

    case 'close':
      if (isAdmin || isManager || isAgent) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Closing tickets requires admin, manager, or agent role' };

    case 'resolve':
      if (isAdmin || isManager || isAgent) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Resolving tickets requires admin, manager, or agent role' };

    case 'reopen':
      if (isAdmin || isManager || isAgent || isUser) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Reopening tickets requires admin, manager, agent, or user role' };

    case 'delete':
      if (isAdmin) {
        if (permissions.includes('delete_tickets')) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'Delete requires the delete_tickets permission' };
      }
      return { allowed: false, reason: 'Deleting tickets requires admin role with delete_tickets permission' };

    case 'cc':
      if (isAdmin || isManager || isAgent || isUser) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'CC changes require admin, manager, agent, or user role' };

    case 'type':
      if (isAdmin || isManager || isAgent) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Type changes require admin, manager, or agent role' };

    case 'category':
      if (isAdmin || isManager || isAgent) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Category changes require admin, manager, or agent role' };

    default:
      return { allowed: false, reason: `Unknown command: ${command}` };
  }
}

// ── Value normalization & validation ───────────────────────────────────

interface NormalizedValue {
  valid: boolean;
  normalized: string;
  error?: string;
}

const VALID_STATUSES = new Set(['open', 'in_progress', 'waiting', 'resolved', 'closed']);
const STATUS_ALIASES: Record<string, string> = {
  'in progress': 'in_progress',
  'inprogress': 'in_progress',
  'pending': 'waiting',
  'done': 'resolved',
  'complete': 'closed',
  'finished': 'closed',
};

const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);
const PRIORITY_ALIASES: Record<string, string> = {
  'urgent': 'critical',
  'normal': 'medium',
  'important': 'high',
  'trivial': 'low',
};

const VALID_TYPES = new Set(['incident', 'service_request', 'problem', 'change']);
const TYPE_ALIASES: Record<string, string> = {
  'sr': 'service_request',
  'service request': 'service_request',
  'service': 'service_request',
  'bug': 'incident',
  'cr': 'change',
  'change request': 'change',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate and normalize a command value.
 *
 * - status: accepts 'open', 'in_progress', 'waiting', 'resolved', 'closed'
 *           and aliases: 'in progress'/'inprogress' → 'in_progress',
 *           'pending' → 'waiting', 'done' → 'resolved', 'complete'/'finished' → 'closed'
 * - priority: accepts 'low', 'medium', 'high', 'critical'
 *             and aliases: 'urgent' → 'critical', 'normal' → 'medium',
 *             'important' → 'high', 'trivial' → 'low'
 * - type: accepts 'incident', 'service_request', 'problem', 'change'
 *         and aliases: 'sr'/'service request'/'service' → 'service_request',
 *         'bug' → 'incident', 'cr'/'change request' → 'change'
 * - assign: must be a valid email format
 * - cc: must be a valid email format
 * - close / resolve / reopen / delete: any value is valid
 */
export function normalizeCommandValue(command: string, value: string): NormalizedValue {
  const trimmed = value.trim();

  switch (command) {
    case 'status': {
      const lower = trimmed.toLowerCase();
      if (VALID_STATUSES.has(lower)) {
        return { valid: true, normalized: lower };
      }
      const alias = STATUS_ALIASES[lower];
      if (alias) {
        return { valid: true, normalized: alias };
      }
      return {
        valid: false,
        normalized: trimmed,
        error: `Invalid status "${trimmed}". Valid values: ${Array.from(VALID_STATUSES).join(', ')}`,
      };
    }

    case 'priority': {
      const lower = trimmed.toLowerCase();
      if (VALID_PRIORITIES.has(lower)) {
        return { valid: true, normalized: lower };
      }
      const alias = PRIORITY_ALIASES[lower];
      if (alias) {
        return { valid: true, normalized: alias };
      }
      return {
        valid: false,
        normalized: trimmed,
        error: `Invalid priority "${trimmed}". Valid values: ${Array.from(VALID_PRIORITIES).join(', ')}`,
      };
    }

    case 'type': {
      const lower = trimmed.toLowerCase();
      if (VALID_TYPES.has(lower)) {
        return { valid: true, normalized: lower };
      }
      const alias = TYPE_ALIASES[lower];
      if (alias) {
        return { valid: true, normalized: alias };
      }
      return {
        valid: false,
        normalized: trimmed,
        error: `Invalid type "${trimmed}". Valid values: ${Array.from(VALID_TYPES).join(', ')}`,
      };
    }

    case 'assign':
    case 'cc': {
      if (!trimmed) {
        return {
          valid: false,
          normalized: trimmed,
          error: `${command} requires a valid email address`,
        };
      }
      if (EMAIL_REGEX.test(trimmed)) {
        return { valid: true, normalized: trimmed.toLowerCase() };
      }
      return {
        valid: false,
        normalized: trimmed,
        error: `Invalid email format for ${command}: "${trimmed}"`,
      };
    }

    case 'close':
    case 'resolve':
    case 'reopen':
    case 'delete': {
      // Any value is valid; just normalize whitespace
      return { valid: true, normalized: trimmed };
    }

    default:
      return {
        valid: false,
        normalized: trimmed,
        error: `Unknown command: ${command}`,
      };
  }
}
