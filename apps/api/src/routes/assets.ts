import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ZipArchive } = require('archiver') as { ZipArchive: any };

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Find the agent binary by checking multiple locations in order of preference
function findAgentBinary(): string | null {
  // 1. Env var override
  if (process.env.AGENT_BINARY_PATH && fs.existsSync(process.env.AGENT_BINARY_PATH)) {
    return process.env.AGENT_BINARY_PATH;
  }
  // 2. Copied into the API's uploads directory during build (production)
  const inUploads = path.join(UPLOAD_DIR, 'agent', 'ResolvAgent.exe');
  if (fs.existsSync(inUploads)) return inUploads;
  // 3. Monorepo dev path
  const devPath = path.resolve(process.cwd(), '../agent/node-agent/dist/ResolvAgent.exe');
  if (fs.existsSync(devPath)) return devPath;
  return null;
}

const createAssetSchema = z.object({
  name: z.string().min(1).max(255),
  display_name: z.string().max(255).optional(),
  asset_type: z.enum(['workstation', 'laptop', 'server', 'mobile', 'printer', 'network_device', 'other']).default('workstation'),
  status: z.enum(['active', 'inactive', 'retired', 'maintenance', 'disposed']).default('active'),
  serial_number: z.string().max(255).optional(),
  manufacturer: z.string().max(255).optional(),
  model: z.string().max(255).optional(),
  ip_address: z.string().max(45).optional(),
  mac_address: z.string().max(17).optional(),
  hostname: z.string().max(255).optional(),
  domain: z.string().max(255).optional(),
  os_name: z.string().max(255).optional(),
  os_version: z.string().max(255).optional(),
  asset_group_id: z.string().uuid().optional().nullable(),
  assigned_to_id: z.string().uuid().optional().nullable(),
  department: z.string().max(100).optional(),
  location: z.string().max(255).optional(),
  company: z.string().max(255).optional(),
  purchase_date: z.string().optional().nullable(),
  warranty_expiry: z.string().optional().nullable(),
  purchase_cost: z.number().optional().nullable(),
  vendor: z.string().max(255).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

const updateAssetSchema = createAssetSchema.partial();

const createGroupSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  color: z.string().max(20).default('#6366f1'),
  default_department: z.string().max(100).optional(),
  default_company: z.string().max(255).optional(),
  default_assigned_to_id: z.string().uuid().optional().nullable(),
  auto_join_rules: z.array(z.object({
    match: z.enum(['all', 'any']),
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.string(),
      value: z.string(),
    })),
  })).optional(),
  auto_join_enabled: z.boolean().optional(),
});

// Agent check-in payload schema
const ns = <T extends z.ZodTypeAny>(s: T) => s.nullish();
const agentCheckinSchema = z.object({
  hostname: z.string(),
  agent_version: z.string(),
  ip_address: ns(z.string()),
  mac_address: ns(z.string()),
  domain: ns(z.string()),
  os: z.object({
    platform: ns(z.string()),
    distro: ns(z.string()),
    release: ns(z.string()),
    build: ns(z.string()),
    arch: ns(z.string()),
  }).nullish(),
  hardware: z.object({
    cpu: z.object({
      manufacturer: ns(z.string()),
      brand: ns(z.string()),
      cores: ns(z.number()),
      physicalCores: ns(z.number()),
      speed: ns(z.number()),
      currentLoad: ns(z.number()),
    }).nullish(),
    mem: z.object({
      total: ns(z.number()),
      used: ns(z.number()),
      free: ns(z.number()),
    }).nullish(),
    graphics: z.object({
      controllers: z.array(z.object({
        model: ns(z.string()),
        vram: ns(z.number()),
      })).nullish(),
    }).nullish(),
    system: z.object({
      manufacturer: ns(z.string()),
      model: ns(z.string()),
      serial: ns(z.string()),
    }).nullish(),
    bios: z.object({
      vendor: ns(z.string()),
      version: ns(z.string()),
      releaseDate: ns(z.string()),
    }).nullish(),
    diskLayout: z.array(z.object({
      name: ns(z.string()),
      type: ns(z.string()),
      size: ns(z.number()),
      vendor: ns(z.string()),
    })).nullish(),
    fsSize: z.array(z.object({
      fs: ns(z.string()),
      size: ns(z.number()),
      used: ns(z.number()),
      available: ns(z.number()),
      mount: ns(z.string()),
    })).nullish(),
  }).nullish(),
  network_adapters: z.array(z.object({
    iface: z.string(),
    ip4: ns(z.string()),
    mac: ns(z.string()),
    netmask: ns(z.string()),
    gateway: ns(z.string()),
    type: ns(z.string()),
    speed: ns(z.number()),
    virtual: ns(z.boolean()),
    operstate: ns(z.string()),
  })).nullish(),
  software: z.array(z.object({
    name: z.string(),
    version: ns(z.string()),
    publisher: ns(z.string()),
    installDate: ns(z.string()),
    installLocation: ns(z.string()),
    sizeMB: ns(z.number()),
  })).nullish(),
  current_user: z.object({
    username: ns(z.string()),
    domain: ns(z.string()),
  }).nullish(),
  users: z.array(z.object({
    username: z.string(),
    domain: ns(z.string()),
    session_type: ns(z.string()),
    session_host: ns(z.string()),
    logged_in_at: ns(z.string()),
  })).nullish(),
});

const agentRegisterSchema = z.object({
  hostname: z.string(),
  agent_version: z.string(),
  agent_secret: z.string(),
});

interface MatchedUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

async function matchWindowsUser(username: string): Promise<MatchedUser | null> {
  // Strategy 1: exact match on windows_username column
  const winResult = await pool.query(
    `SELECT id, name, email, avatar_url FROM users WHERE windows_username=$1 AND is_active=true LIMIT 1`,
    [username]
  );
  if (winResult.rows.length > 0) return winResult.rows[0];

  // Strategy 2: username contains @ → direct email match
  if (username.includes('@')) {
    const emailResult = await pool.query(
      `SELECT id, name, email, avatar_url FROM users WHERE LOWER(email)=LOWER($1) AND is_active=true LIMIT 1`,
      [username]
    );
    if (emailResult.rows.length > 0) return emailResult.rows[0];
  }

  // Strategy 3: username as email local-part (e.g. "jdoe" → "jdoe@company.com")
  if (!username.includes('@')) {
    const localResult = await pool.query(
      `SELECT id, name, email, avatar_url FROM users WHERE LOWER(email) LIKE LOWER($1) AND is_active=true LIMIT 1`,
      [`${username}@%`]
    );
    if (localResult.rows.length > 0) return localResult.rows[0];
  }

  return null;
}

// ─── Auto-Join Rule Evaluation ─────────────────────────────────────────────

interface AutoJoinCondition {
  field: string;
  operator: string;
  value: string;
}

interface AutoJoinRule {
  match: 'all' | 'any';
  conditions: AutoJoinCondition[];
}

function evaluateCondition(condition: AutoJoinCondition, assetFields: Record<string, any>): boolean {
  const fieldVal = (assetFields[condition.field] || '').toString().toLowerCase();
  const condVal = condition.value.toLowerCase();

  switch (condition.operator) {
    case 'equals': return fieldVal === condVal;
    case 'not_equals': return fieldVal !== condVal;
    case 'contains': return fieldVal.includes(condVal);
    case 'starts_with': return fieldVal.startsWith(condVal);
    case 'ends_with': return fieldVal.endsWith(condVal);
    case 'in': return condVal.split(',').map(s => s.trim()).includes(fieldVal);
    case 'not_in': return !condVal.split(',').map(s => s.trim()).includes(fieldVal);
    default: return false;
  }
}

async function applyAutoJoinRules(assetId: string, assetFields: Record<string, any>, client?: any): Promise<void> {
  const query = client || pool;

  const { rows: groups } = await query.query(
    `SELECT id, name, auto_join_rules, auto_join_enabled,
            default_department, default_company, default_assigned_to_id
     FROM asset_groups
     WHERE auto_join_enabled = true AND auto_join_rules IS NOT NULL
       AND jsonb_array_length(auto_join_rules) > 0
     ORDER BY name ASC`
  );

  for (const group of groups) {
    const rules: AutoJoinRule[] = typeof group.auto_join_rules === 'string'
      ? JSON.parse(group.auto_join_rules)
      : group.auto_join_rules || [];

    if (rules.length === 0) continue;

    let matched = false;
    for (const rule of rules) {
      if (rule.match === 'all') {
        matched = rule.conditions.every(c => evaluateCondition(c, assetFields));
      } else {
        matched = rule.conditions.some(c => evaluateCondition(c, assetFields));
      }
      if (matched) break;
    }

    if (matched) {
      await query.query(
        `UPDATE assets SET asset_group_id = $1, updated_at = NOW() WHERE id = $2`,
        [group.id, assetId]
      );

      const defaultUpdates: string[] = [];
      const defaultParams: any[] = [];
      let idx = 1;

      if (group.default_department) {
        defaultUpdates.push(`department = COALESCE(NULLIF(department, ''), $${idx++})`);
        defaultParams.push(group.default_department);
      }
      if (group.default_company) {
        defaultUpdates.push(`company = COALESCE(NULLIF(company, ''), $${idx++})`);
        defaultParams.push(group.default_company);
      }
      if (group.default_assigned_to_id) {
        defaultUpdates.push(`assigned_to_id = COALESCE(assigned_to_id, $${idx++})`);
        defaultParams.push(group.default_assigned_to_id);
      }

      if (defaultUpdates.length > 0) {
        defaultParams.push(assetId);
        await query.query(
          `UPDATE assets SET ${defaultUpdates.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
          defaultParams
        );
      }

      await query.query(
        `INSERT INTO asset_activity (asset_id, actor_id, action, description, new_value)
         VALUES ($1, NULL, 'auto_assigned', 'Auto-assigned by group rules', $2)`,
        [assetId, group.name]
      ).catch(() => {});

      break;
    }
  }
}

export default async function assetRoutes(fastify: FastifyInstance) {
  // ─── Agent Download ─────────────────────────────────────────────────────────

  fastify.get('/assets/agent/download', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    // Fetch agent secret from settings
    const secretResult = await pool.query(`SELECT value FROM system_settings WHERE key='agent_secret_key'`);
    const agentSecret = secretResult.rows[0]?.value || '';

    // Determine server URL from request (the API server URL agents will call)
    const proto = (request.headers['x-forwarded-proto'] as string) || 'http';
    const host = (request.headers['x-forwarded-host'] as string) || (request.headers.host as string) || `localhost:${process.env.PORT || 3001}`;
    const serverUrl = `${proto}://${host}`;

    const exePath = findAgentBinary();
    if (!exePath) {
      return reply.status(400).send({
        error: 'Agent binary not found. Set AGENT_BINARY_PATH env var, or copy ResolvAgent.exe to uploads/agent/ResolvAgent.exe, or run: cd apps/agent/node-agent && npm run build'
      });
    }

    const configJson = JSON.stringify({ serverUrl, agentSecret }, null, 2);
    const origin = (request.headers.origin as string) || process.env.WEB_URL || 'http://localhost:3000';

    // Read the compiled exe and append the config with markers
    const exeBuffer = await fs.promises.readFile(exePath);
    const configMarker = '\n---RESOLV_CONFIG_START---\n' + configJson + '\n---RESOLV_CONFIG_END---\n';
    const finalBuffer = Buffer.concat([exeBuffer, Buffer.from(configMarker)]);

    reply.raw.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="ResolvAgent-Setup.exe"',
      'Content-Length': finalBuffer.length,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true'
    });
    reply.raw.end(finalBuffer);
  });

  // ─── Asset Groups ───────────────────────────────────────────────────────────

  fastify.get('/asset-groups', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const result = await pool.query(`
      SELECT ag.*, COUNT(a.id)::int as asset_count
      FROM asset_groups ag
      LEFT JOIN assets a ON a.asset_group_id = ag.id
      GROUP BY ag.id
      ORDER BY ag.name
    `);
    return reply.send({ data: result.rows });
  });

  fastify.post('/asset-groups', { preHandler: [fastify.requireRole(['admin', 'agent'])] }, async (request, reply) => {
    const body = createGroupSchema.parse(request.body);
    const user = (request as any).user;
    const result = await pool.query(
      `INSERT INTO asset_groups (name, description, color, created_by, default_department, default_company, default_assigned_to_id, auto_join_rules, auto_join_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [body.name, body.description || null, body.color, user.id,
       body.default_department || null, body.default_company || null, body.default_assigned_to_id || null,
       body.auto_join_rules ? JSON.stringify(body.auto_join_rules) : null,
       body.auto_join_enabled ?? null]
    );
    return reply.status(201).send({ data: result.rows[0] });
  });

  fastify.patch('/asset-groups/:id', { preHandler: [fastify.requireRole(['admin', 'agent'])] }, async (request: any, reply) => {
    const body = createGroupSchema.partial().parse(request.body);
    const { id } = request.params;
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (body.name !== undefined) { sets.push(`name=$${i++}`); vals.push(body.name); }
    if (body.description !== undefined) { sets.push(`description=$${i++}`); vals.push(body.description); }
    if (body.color !== undefined) { sets.push(`color=$${i++}`); vals.push(body.color); }
    if (body.default_department !== undefined) { sets.push(`default_department=$${i++}`); vals.push(body.default_department); }
    if (body.default_company !== undefined) { sets.push(`default_company=$${i++}`); vals.push(body.default_company); }
    if (body.default_assigned_to_id !== undefined) { sets.push(`default_assigned_to_id=$${i++}`); vals.push(body.default_assigned_to_id); }
    if (body.auto_join_rules !== undefined) { sets.push(`auto_join_rules=$${i++}`); vals.push(JSON.stringify(body.auto_join_rules)); }
    if (body.auto_join_enabled !== undefined) { sets.push(`auto_join_enabled=$${i++}`); vals.push(body.auto_join_enabled); }
    if (sets.length === 0) return reply.status(400).send({ error: 'No fields to update' });
    vals.push(id);
    const result = await pool.query(`UPDATE asset_groups SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, vals);
    if (result.rows.length === 0) return reply.status(404).send({ error: 'Group not found' });
    return reply.send({ data: result.rows[0] });
  });

  fastify.delete('/asset-groups/:id', { preHandler: [fastify.requireRole(['admin'])] }, async (request: any, reply) => {
    const { id } = request.params;
    // Unassign assets from group first
    await pool.query(`UPDATE assets SET asset_group_id = NULL WHERE asset_group_id = $1`, [id]);
    await pool.query(`DELETE FROM asset_groups WHERE id = $1`, [id]);
    return reply.status(204).send();
  });

  // ─── Assets ─────────────────────────────────────────────────────────────────

  fastify.get('/assets', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const { search, status, agent_status, asset_type, group_id, assigned_to, page = '1', limit = '50', sort = 'created_at', order = 'desc' } = request.query as any;
    const conditions: string[] = [];
    const vals: any[] = [];
    let i = 1;

    if (search) {
      conditions.push(`(a.name ILIKE $${i} OR a.hostname ILIKE $${i} OR a.ip_address ILIKE $${i} OR a.serial_number ILIKE $${i} OR a.manufacturer ILIKE $${i} OR a.model ILIKE $${i} OR a.display_name ILIKE $${i} OR a.os_name ILIKE $${i} OR a.os_version ILIKE $${i} OR a.domain ILIKE $${i} OR a.mac_address ILIKE $${i} OR a.notes ILIKE $${i} OR array_to_string(a.tags, ' ') ILIKE $${i})`);
      vals.push(`%${search}%`); i++;
    }
    if (status) { conditions.push(`a.status=$${i++}`); vals.push(status); }
    if (agent_status) { conditions.push(`a.agent_status=$${i++}`); vals.push(agent_status); }
    if (asset_type) { conditions.push(`a.asset_type=$${i++}`); vals.push(asset_type); }
    if (group_id) { conditions.push(`a.asset_group_id=$${i++}`); vals.push(group_id); }
    if (assigned_to) { conditions.push(`a.assigned_to_id=$${i++}`); vals.push(assigned_to); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const allowedSorts: Record<string, string> = {
      name: 'a.name', created_at: 'a.created_at', updated_at: 'a.updated_at',
      agent_last_seen: 'a.agent_last_seen', status: 'a.status', asset_type: 'a.asset_type',
    };
    const sortCol = allowedSorts[sort] || 'a.created_at';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    const countResult = await pool.query(`SELECT COUNT(*) FROM assets a ${where}`, vals);
    const total = parseInt(countResult.rows[0].count);

    vals.push(limitNum, offset);
    const result = await pool.query(`
      SELECT
        a.*,
        ag.name as group_name,
        ag.color as group_color,
        u.name as assigned_to_name,
        u.email as assigned_to_email,
        h.cpu_model, h.ram_total_gb, h.disk_total_gb, h.disk_used_gb
      FROM assets a
      LEFT JOIN asset_groups ag ON a.asset_group_id = ag.id
      LEFT JOIN users u ON a.assigned_to_id = u.id
      LEFT JOIN asset_hardware h ON h.asset_id = a.id
      ${where}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${i++} OFFSET $${i++}
    `, vals);

    return reply.send({ data: result.rows, total, page: pageNum, pageSize: limitNum });
  });

  fastify.get('/assets/stats', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const [total, byStatus, byType, agentStatus, recentActivity] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int as count FROM assets WHERE status != 'disposed'`),
      pool.query(`SELECT status, COUNT(*)::int as count FROM assets GROUP BY status`),
      pool.query(`SELECT asset_type, COUNT(*)::int as count FROM assets WHERE status != 'disposed' GROUP BY asset_type`),
      pool.query(`SELECT agent_status, COUNT(*)::int as count FROM assets WHERE status='active' GROUP BY agent_status`),
      pool.query(`SELECT action, description, created_at FROM asset_activity ORDER BY created_at DESC LIMIT 10`),
    ]);
    return reply.send({
      data: {
        total: total.rows[0].count,
        byStatus: byStatus.rows,
        byType: byType.rows,
        agentStatus: agentStatus.rows,
        recentActivity: recentActivity.rows,
      }
    });
  });

  fastify.post('/assets', { preHandler: [fastify.requireRole(['admin', 'agent'])] }, async (request: any, reply) => {
    const body = createAssetSchema.parse(request.body);
    const user = request.user;
    const result = await pool.query(`
      INSERT INTO assets (
        name, display_name, asset_type, status, serial_number, manufacturer, model,
        ip_address, mac_address, hostname, domain, os_name, os_version,
        asset_group_id, assigned_to_id, department, location, company,
        purchase_date, warranty_expiry, purchase_cost, vendor, notes, tags
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
      RETURNING *
    `, [
      body.name, body.display_name || null, body.asset_type, body.status,
      body.serial_number || null, body.manufacturer || null, body.model || null,
      body.ip_address || null, body.mac_address || null, body.hostname || null, body.domain || null,
      body.os_name || null, body.os_version || null,
      body.asset_group_id || null, body.assigned_to_id || null,
      body.department || null, body.location || null, body.company || null,
      body.purchase_date || null, body.warranty_expiry || null,
      body.purchase_cost || null, body.vendor || null, body.notes || null, body.tags,
    ]);
    await pool.query(
      `INSERT INTO asset_activity (asset_id, actor_id, action, description) VALUES ($1,$2,$3,$4)`,
      [result.rows[0].id, user.id, 'asset_created', `Asset "${body.name}" created manually`]
    );
    const createdAsset = result.rows[0];
    await applyAutoJoinRules(createdAsset.id, body);
    return reply.status(201).send({ data: createdAsset });
  });

  fastify.get('/assets/:id', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const { id } = request.params;
    const [asset, hardware, adapters, users, tickets, activity] = await Promise.all([
      pool.query(`
        SELECT a.*, ag.name as group_name, ag.color as group_color,
          u.name as assigned_to_name, u.email as assigned_to_email, u.avatar_url as assigned_to_avatar
        FROM assets a
        LEFT JOIN asset_groups ag ON a.asset_group_id = ag.id
        LEFT JOIN users u ON a.assigned_to_id = u.id
        WHERE a.id = $1
      `, [id]),
      pool.query(`SELECT * FROM asset_hardware WHERE asset_id=$1`, [id]),
      pool.query(`SELECT * FROM asset_network_adapters WHERE asset_id=$1 ORDER BY is_active DESC`, [id]),
      pool.query(`
        SELECT au.*, u.name as display_name, u.email as user_email, u.avatar_url as user_avatar
        FROM asset_users au
        LEFT JOIN users u ON au.user_id = u.id
        WHERE au.asset_id = $1 ORDER BY au.logged_in_at DESC LIMIT 20
      `, [id]),
      pool.query(`
        SELECT t.id, t.number, t.title, t.status, t.priority, t.created_at, u.name as created_by_name
        FROM tickets t LEFT JOIN users u ON t.created_by_id = u.id
        WHERE t.asset_id = $1 ORDER BY t.created_at DESC LIMIT 20
      `, [id]),
      pool.query(`
        SELECT aa.*, u.name as actor_name, u.avatar_url as actor_avatar
        FROM asset_activity aa
        LEFT JOIN users u ON aa.actor_id = u.id
        WHERE aa.asset_id = $1
        ORDER BY aa.created_at DESC
        LIMIT 50
      `, [id]),
    ]);
    if (asset.rows.length === 0) return reply.status(404).send({ error: 'Asset not found' });
    return reply.send({
      data: {
        ...asset.rows[0],
        hardware: hardware.rows[0] || null,
        network_adapters: adapters.rows,
        logged_users: users.rows,
        tickets: tickets.rows,
        activity: activity.rows,
      }
    });
  });

  fastify.get('/assets/:id/software', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const { id } = request.params;
    const { search, page = '1', limit = '100' } = request.query as any;
    const vals: any[] = [id];
    let where = 'WHERE asset_id=$1';
    if (search) { where += ` AND name ILIKE $2`; vals.push(`%${search}%`); }
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(500, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;
    const countResult = await pool.query(`SELECT COUNT(*) FROM asset_software ${where}`, vals);
    vals.push(limitNum, offset);
    const result = await pool.query(
      `SELECT * FROM asset_software ${where} ORDER BY name ASC LIMIT $${vals.length - 1} OFFSET $${vals.length}`,
      vals
    );
    return reply.send({ data: result.rows, total: parseInt(countResult.rows[0].count) });
  });

  fastify.get('/assets/:id/activity', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const { id } = request.params;
    const result = await pool.query(`
      SELECT aa.*, u.name as actor_name, u.avatar_url as actor_avatar
      FROM asset_activity aa
      LEFT JOIN users u ON aa.actor_id = u.id
      WHERE aa.asset_id = $1
      ORDER BY aa.created_at DESC
      LIMIT 100
    `, [id]);
    return reply.send({ data: result.rows });
  });

  fastify.patch('/assets/:id', { preHandler: [fastify.requireRole(['admin', 'agent'])] }, async (request: any, reply) => {
    const { id } = request.params;
    const body = updateAssetSchema.parse(request.body);
    const user = request.user;

    const allowed = [
      'name', 'display_name', 'asset_type', 'status', 'serial_number', 'manufacturer', 'model',
      'ip_address', 'mac_address', 'hostname', 'domain', 'os_name', 'os_version', 'os_build', 'os_arch',
      'asset_group_id', 'assigned_to_id', 'department', 'location', 'company',
      'purchase_date', 'warranty_expiry', 'purchase_cost', 'vendor', 'notes', 'tags',
    ];
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(body)) {
      if (allowed.includes(k)) { sets.push(`${k}=$${i++}`); vals.push(v); }
    }
    if (sets.length === 0) return reply.status(400).send({ error: 'No fields to update' });
    vals.push(id);
    const result = await pool.query(`UPDATE assets SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, vals);
    if (result.rows.length === 0) return reply.status(404).send({ error: 'Asset not found' });
    await pool.query(
      `INSERT INTO asset_activity (asset_id, actor_id, action, description) VALUES ($1,$2,$3,$4)`,
      [id, user.id, 'asset_updated', `Asset updated by ${user.name || user.email}`]
    );
    return reply.send({ data: result.rows[0] });
  });

  fastify.delete('/assets/:id', { preHandler: [fastify.requireRole(['admin'])] }, async (request: any, reply) => {
    const { id } = request.params;
    const existing = await pool.query(`SELECT id FROM assets WHERE id=$1`, [id]);
    if (existing.rows.length === 0) return reply.status(404).send({ error: 'Asset not found' });
    await pool.query(`DELETE FROM assets WHERE id=$1`, [id]);
    return reply.status(204).send();
  });

  // ─── Auto-Join Rules (Manual Trigger) ──────────────────────────────────────

  fastify.post('/assets/:id/apply-rules', { preHandler: [fastify.authenticate, fastify.requireRole(['admin', 'agent'])] }, async (request: any, reply) => {
    const { id } = request.params;
    const { rows } = await pool.query('SELECT * FROM assets WHERE id = $1', [id]);
    if (rows.length === 0) return reply.status(404).send({ error: 'Asset not found' });
    await applyAutoJoinRules(id, rows[0]);
    return reply.send({ data: { success: true, message: 'Auto-join rules applied' } });
  });

  fastify.post('/assets/apply-rules/all', { preHandler: [fastify.authenticate, fastify.requireRole(['admin'])] }, async (request, reply) => {
    const { rows } = await pool.query('SELECT * FROM assets');
    let applied = 0;

    // Process in chunks of 50 to avoid overwhelming DB
    const CHUNK_SIZE = 50;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      for (const asset of chunk) {
        const oldGroupId = asset.asset_group_id;
        await applyAutoJoinRules(asset.id, asset);
        const { rows: updated } = await pool.query('SELECT asset_group_id FROM assets WHERE id = $1', [asset.id]);
        if (updated[0]?.asset_group_id !== oldGroupId) applied++;
      }
    }

    return reply.send({ data: { success: true, message: `Rules applied to ${rows.length} assets, ${applied} reassigned` } });
  });

  // ─── Agent Registration ───────────────────────────────────────────────────────

  fastify.post('/assets/agent/register', async (request, reply) => {
    const body = agentRegisterSchema.parse(request.body);

    // Verify agent secret matches system setting
    const secretResult = await pool.query(`SELECT value FROM system_settings WHERE key='agent_secret_key'`);
    const agentSecret = secretResult.rows[0]?.value;
    if (!agentSecret || agentSecret !== body.agent_secret) {
      return reply.status(401).send({ error: 'Invalid agent secret' });
    }

    // Check if asset already exists for this hostname
    const existing = await pool.query(`SELECT id, agent_token FROM assets WHERE hostname=$1 OR name=$1`, [body.hostname]);
    if (existing.rows.length > 0) {
      const asset = existing.rows[0];
      // Return existing token (re-registration)
      await pool.query(`UPDATE assets SET agent_version=$1, agent_status='offline' WHERE id=$2`, [body.agent_version, asset.id]);
      return reply.send({ data: { asset_id: asset.id, agent_token: asset.agent_token } });
    }

    // Create new asset
    const agentToken = crypto.randomBytes(32).toString('hex');
    const result = await pool.query(`
      INSERT INTO assets (name, hostname, agent_version, agent_token, agent_status)
      VALUES ($1, $2, $3, $4, 'offline') RETURNING id, agent_token
    `, [body.hostname, body.hostname, body.agent_version, agentToken]);

    await pool.query(
      `INSERT INTO asset_activity (asset_id, action, description) VALUES ($1,'agent_registered','Agent registered for the first time')`,
      [result.rows[0].id]
    );

    const newAssetId = result.rows[0].id;
    await applyAutoJoinRules(newAssetId, { hostname: body.hostname, name: body.hostname });

    return reply.status(201).send({ data: { asset_id: newAssetId, agent_token: agentToken } });
  });

  // ─── Agent Check-In ───────────────────────────────────────────────────────────

  fastify.post('/assets/agent/checkin', async (request: any, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return reply.status(401).send({ error: 'Missing agent token' });
    const agentToken = authHeader.slice(7);

    const assetResult = await pool.query(`SELECT id FROM assets WHERE agent_token=$1`, [agentToken]);
    if (assetResult.rows.length === 0) return reply.status(401).send({ error: 'Invalid agent token' });
    const assetId = assetResult.rows[0].id;

    const body = agentCheckinSchema.parse(request.body);
    const { os, hardware, network_adapters, software, current_user, users } = body;

    // Disk totals: use physical diskLayout capacity, fsSize for used/free
    let diskTotal = 0, diskUsed = 0, diskFree = 0;
    if (hardware?.diskLayout) {
      for (const disk of hardware.diskLayout) {
        diskTotal += (disk.size || 0);
      }
    }
    if (hardware?.fsSize) {
      for (const fs of hardware.fsSize) {
        diskUsed += (fs.used || 0);
        diskFree += (fs.available || 0);
      }
    }
    // If no physical disk data, fall back to fsSize for total
    if (diskTotal === 0 && hardware?.fsSize) {
      for (const fs of hardware.fsSize) {
        diskTotal += (fs.size || 0);
      }
    }
    // Normalize used/free to not exceed physical disk capacity
    // (fsSize may sum partitions that share the same physical disk)
    const fsSum = diskUsed + diskFree;
    if (diskTotal > 0 && fsSum > diskTotal) {
      const ratio = diskTotal / fsSum;
      diskUsed = Math.round(diskUsed * ratio);
      diskFree = Math.round(diskFree * ratio);
    }
    // Ensure used+free never exceeds total
    if (diskUsed + diskFree > diskTotal) {
      diskFree = Math.max(0, diskTotal - diskUsed);
    }
    const toGB = (bytes: number) => parseFloat((bytes / 1024 / 1024 / 1024).toFixed(2));
    const ramTotal = hardware?.mem?.total ? toGB(hardware.mem.total) : null;
    const ramUsed = hardware?.mem?.used ? toGB(hardware.mem.used) : null;
    const ramFree = hardware?.mem?.free ? toGB(hardware.mem.free) : null;
    const gpu = hardware?.graphics?.controllers?.[0];

    // Update asset core fields
    await pool.query(`
      UPDATE assets SET
        hostname=$1, agent_version=$2, ip_address=$3, mac_address=$4, domain=$5,
        os_name=$6, os_version=$7, os_build=$8, os_arch=$9,
        manufacturer=$10, model=$11, serial_number=$12,
        agent_status='online', agent_last_seen=NOW()
      WHERE id=$13
    `, [
      body.hostname, body.agent_version, body.ip_address || null, body.mac_address || null, body.domain || null,
      os ? `${os.distro || os.platform || ''}`.trim() : null,
      os?.release || null, os?.build || null, os?.arch || null,
      hardware?.system?.manufacturer || null, hardware?.system?.model || null, hardware?.system?.serial || null,
      assetId,
    ]);

    // Evaluate auto-join rules for this asset
    await applyAutoJoinRules(assetId, {
      hostname: body.hostname,
      domain: body.domain || '',
      os_name: os ? `${os.distro || os.platform || ''}`.trim() : '',
      manufacturer: hardware?.system?.manufacturer || '',
      model: hardware?.system?.model || '',
      serial_number: hardware?.system?.serial || '',
    });

    // Upsert hardware
    await pool.query(`
      INSERT INTO asset_hardware (
        asset_id, cpu_manufacturer, cpu_model, cpu_cores, cpu_threads, cpu_speed_mhz, cpu_usage_percent,
        ram_total_gb, ram_used_gb, ram_free_gb,
        gpu_model, gpu_vram_gb,
        motherboard_manufacturer, motherboard_model,
        bios_version, bios_release_date,
        disk_total_gb, disk_used_gb, disk_free_gb, disks
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      ON CONFLICT (asset_id) DO UPDATE SET
        cpu_manufacturer=EXCLUDED.cpu_manufacturer, cpu_model=EXCLUDED.cpu_model,
        cpu_cores=EXCLUDED.cpu_cores, cpu_threads=EXCLUDED.cpu_threads,
        cpu_speed_mhz=EXCLUDED.cpu_speed_mhz, cpu_usage_percent=EXCLUDED.cpu_usage_percent,
        ram_total_gb=EXCLUDED.ram_total_gb, ram_used_gb=EXCLUDED.ram_used_gb, ram_free_gb=EXCLUDED.ram_free_gb,
        gpu_model=EXCLUDED.gpu_model, gpu_vram_gb=EXCLUDED.gpu_vram_gb,
        motherboard_manufacturer=EXCLUDED.motherboard_manufacturer, motherboard_model=EXCLUDED.motherboard_model,
        bios_version=EXCLUDED.bios_version, bios_release_date=EXCLUDED.bios_release_date,
        disk_total_gb=EXCLUDED.disk_total_gb, disk_used_gb=EXCLUDED.disk_used_gb, disk_free_gb=EXCLUDED.disk_free_gb,
        disks=EXCLUDED.disks, updated_at=NOW()
    `, [
      assetId,
      hardware?.cpu?.manufacturer || null,
      hardware?.cpu?.brand || null,
      hardware?.cpu?.physicalCores || null,
      hardware?.cpu?.cores || null,
      hardware?.cpu?.speed ? Math.round(hardware.cpu.speed * 1000) : null,
      hardware?.cpu?.currentLoad || null,
      ramTotal, ramUsed, ramFree,
      gpu?.model || null,
      gpu?.vram ? toGB(gpu.vram * 1024 * 1024) : null,
      hardware?.bios?.vendor || null,
      null, // motherboard model from separate source
      hardware?.bios?.version || null,
      hardware?.bios?.releaseDate || null,
      diskTotal ? toGB(diskTotal) : null,
      diskUsed ? toGB(diskUsed) : null,
      diskFree ? toGB(diskFree) : null,
      JSON.stringify(hardware?.diskLayout || []),
    ]);

    // Replace network adapters
    if (network_adapters) {
      await pool.query(`DELETE FROM asset_network_adapters WHERE asset_id=$1`, [assetId]);
      for (const adapter of network_adapters) {
        await pool.query(`
          INSERT INTO asset_network_adapters (asset_id, adapter_name, ip_address, mac_address, adapter_type, speed_mbps, is_virtual, is_active)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `, [
          assetId, adapter.iface, adapter.ip4 || null, adapter.mac || null,
          adapter.type || null, adapter.speed || null,
          adapter.virtual || false, adapter.operstate === 'up',
        ]);
      }
    }

    // Replace software inventory
    if (software && software.length > 0) {
      await pool.query(`DELETE FROM asset_software WHERE asset_id=$1`, [assetId]);
      for (let i = 0; i < software.length; i += 50) {
        const batch = software.slice(i, i + 50);
        const rows = batch.map((s, idx) => {
          const base = idx;
          return `($${base * 6 + 1},$${base * 6 + 2},$${base * 6 + 3},$${base * 6 + 4},$${base * 6 + 5},$${base * 6 + 6})`;
        });
        const vals = batch.flatMap(s => [
          assetId, s.name, s.version || null, s.publisher || null,
          s.installDate ? (() => {
            // Windows registry dates come as YYYYMMDD (no dashes)
            const d = s.installDate.length === 8 && /^\d{8}$/.test(s.installDate)
              ? `${s.installDate.slice(0,4)}-${s.installDate.slice(4,6)}-${s.installDate.slice(6,8)}`
              : s.installDate;
            const parsed = new Date(d);
            return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
          })() : null,
          s.sizeMB || null,
        ]);
        await pool.query(
          `INSERT INTO asset_software (asset_id, name, version, publisher, install_date, size_mb) VALUES ${rows.join(', ')}`,
          vals
        );
      }
    }

    // Update logged-in user sessions
    const userSessions = (users && users.length > 0) ? users : (current_user ? [{
      username: current_user.username,
      domain: current_user.domain,
      session_type: null,
      session_host: null,
      logged_in_at: new Date().toISOString(),
    }] : []);
    // Filter out SYSTEM and other non-human accounts
    const nonHumanAccounts = ['SYSTEM', 'LOCAL SERVICE', 'NETWORK SERVICE', 'SELF'];
    const humanSessions = userSessions.filter((u) => u.username && !nonHumanAccounts.includes(u.username.toUpperCase()));
    if (humanSessions.length > 0) {
      // Mark all existing sessions as not current for this asset
      await pool.query(`UPDATE asset_users SET is_current=false WHERE asset_id=$1`, [assetId]);

      // Batch resolve user matching — collect all usernames, query once
      const usernames: string[] = humanSessions
        .map((u: any) => u.username)
        .filter((n: string | undefined): n is string => !!n);
      const uniqueUsernames = [...new Set(usernames)];
      const matchedMap = new Map<string, string | null>();

      if (uniqueUsernames.length > 0) {
        // Match any of them: windows_username, email, or email local-part
        const matchResult = await pool.query(
          `SELECT id, windows_username, email FROM users WHERE is_active=true AND (
            windows_username = ANY($1) OR LOWER(email) = ANY($1)
          )`,
          [uniqueUsernames]
        );
        for (const row of matchResult.rows) {
          const rowId: string = row.id;
          const rowWinUser: string | null = row.windows_username ?? null;
          const rowEmail: string = (row.email ?? '').toLowerCase();
          for (const u of uniqueUsernames) {
            if (!matchedMap.has(u) && (rowWinUser === u || rowEmail === u.toLowerCase())) {
              matchedMap.set(u, rowId);
            }
          }
        }
        // Local-part matching for leftovers
        const unmatched = uniqueUsernames.filter(u => !matchedMap.has(u) && !u.includes('@'));
        if (unmatched.length > 0) {
          const localResult = await pool.query(
            `SELECT id, email FROM users WHERE is_active=true AND LOWER(email) LIKE ANY($1)`,
            [unmatched.map(u => `${u.toLowerCase()}@%`)]
          );
          for (const row of localResult.rows) {
            const rowId: string = row.id;
            const localPart: string = (row.email ?? '').split('@')[0].toLowerCase();
            for (const u of unmatched) {
              if (!matchedMap.has(u) && u.toLowerCase() === localPart) {
                matchedMap.set(u, rowId);
                break;
              }
            }
          }
        }
      }

      // Batch insert all sessions
      const values: any[] = [];
      const placeholders: string[] = [];
      humanSessions.forEach((u: Record<string, any>, i) => {
        const base = i * 7;
        placeholders.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},true,$${base + 5},$${base + 6},$${base + 7})`);
        const username = u.username || '';
        const domain = u.domain || null;
        const matchedUserId = matchedMap.get(username) || null;
        const loggedInAt = u.logged_in_at ? new Date(u.logged_in_at) : new Date();
        const sessionType = u.session_type || null;
        const sessionHost = u.session_host || null;
        values.push(assetId, username, domain, matchedUserId, loggedInAt, sessionType, sessionHost);
      });
      await pool.query(
        `INSERT INTO asset_users (asset_id, username, domain, user_id, is_current, logged_in_at, session_type, session_host) VALUES ${placeholders.join(',')}`,
        values
      );
    }

    // Log check-in activity with richer detail
    const softwareCount = software?.length || 0;
    const userInfo = humanSessions.length > 0
      ? `, ${humanSessions.length} user${humanSessions.length > 1 ? 's' : ''}: ${humanSessions.map((u) => u.username).join(', ')}`
      : '';
    await pool.query(
      `INSERT INTO asset_activity (asset_id, action, description) VALUES ($1, 'agent_checkin', $2)`,
      [assetId, `Agent checked in — ${softwareCount} software packages, ${(network_adapters || []).length} network adapters${userInfo}`]
    );

    // Log user session activity for each detected human user
    for (const u of humanSessions) {
      // Check if this user was already active (exists with is_current=true in the last hour)
      const existing = await pool.query(
        `SELECT id FROM asset_users WHERE asset_id=$1 AND username=$2 AND logged_in_at > NOW() - INTERVAL '1 hour' LIMIT 1`,
        [assetId, u.username]
      );
      if (existing.rows.length === 0) {
        await pool.query(
          `INSERT INTO asset_activity (asset_id, action, description) VALUES ($1, 'user_logged_in', $2)`,
          [assetId, `User "${u.username}" logged into this endpoint`]
        );
      }
    }

    return reply.send({ data: { ok: true, asset_id: assetId } });
  });

  // Agent heartbeat (lightweight, just updates last_seen and status)
  fastify.post('/assets/agent/heartbeat', async (request: any, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return reply.status(401).send({ error: 'Missing agent token' });
    const agentToken = authHeader.slice(7);
    const result = await pool.query(
      `UPDATE assets SET agent_status='online', agent_last_seen=NOW() WHERE agent_token=$1 RETURNING id`,
      [agentToken]
    );
    if (result.rows.length === 0) return reply.status(401).send({ error: 'Invalid agent token' });
    return reply.send({ data: { ok: true } });
  });

  // Agent disconnect (set offline)
  fastify.post('/assets/agent/disconnect', async (request: any, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return reply.status(401).send({ error: 'Missing agent token' });
    const agentToken = authHeader.slice(7);
    await pool.query(`UPDATE assets SET agent_status='offline' WHERE agent_token=$1`, [agentToken]);
    return reply.send({ data: { ok: true } });
  });

  // Get assets used by a specific user (based on matched user sessions)
  fastify.get('/users/:id/assets', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const { id } = request.params;
    const result = await pool.query(`
      SELECT DISTINCT a.id, a.name, a.hostname, a.asset_type, a.agent_status, a.agent_last_seen,
        au.username as last_username, au.logged_in_at as last_seen_at
      FROM asset_users au
      JOIN assets a ON au.asset_id = a.id
      WHERE au.user_id = $1
      ORDER BY au.logged_in_at DESC
    `, [id]);
    return reply.send({ data: result.rows });
  });
}
