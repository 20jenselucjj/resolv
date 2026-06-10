import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool';

const createLicenseSchema = z.object({
  name: z.string().min(1).max(300),
  publisher: z.string().max(200).optional().nullable(),
  version: z.string().max(100).optional().nullable(),
  license_type: z.enum(['perpetual', 'subscription', 'concurrent', 'freeware', 'open_source', 'trial']),
  license_key: z.string().optional().nullable(),
  total_seats: z.number().int().min(0).default(0),
  purchase_date: z.string().optional().nullable(),
  expiry_date: z.string().optional().nullable(),
  renewal_date: z.string().optional().nullable(),
  cost_per_seat: z.number().optional().nullable(),
  total_cost: z.number().optional().nullable(),
  currency: z.string().max(10).default('USD'),
  vendor: z.string().max(200).optional().nullable(),
  purchase_order: z.string().max(100).optional().nullable(),
  invoice_number: z.string().max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
  alert_threshold: z.number().int().min(0).default(10),
  auto_match: z.boolean().default(true),
  match_pattern: z.string().max(500).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
});

const updateLicenseSchema = createLicenseSchema.partial();

const assignSchema = z.object({
  asset_id: z.string().uuid(),
});

const createContractSchema = z.object({
  name: z.string().min(1).max(300),
  contract_number: z.string().max(100).optional().nullable(),
  vendor: z.string().max(200).optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  auto_renew: z.boolean().optional().default(false),
  renewal_notice_days: z.number().int().default(30),
  terms: z.string().optional().nullable(),
  file_path: z.string().optional().nullable(),
});

const updateContractSchema = createContractSchema.partial();

function calculateCompliance(
  usedSeats: number,
  totalSeats: number,
  alertThreshold: number,
  expiryDate: string | null,
): string {
  if (expiryDate && new Date(expiryDate) < new Date()) {
    return 'expired';
  }
  if (totalSeats === 0) return 'compliant';
  const available = totalSeats - usedSeats;
  if (available < 0) return 'non_compliant';
  const usagePercent = (usedSeats / totalSeats) * 100;
  const threshold = 100 - alertThreshold;
  if (usagePercent >= threshold) return 'warning';
  return 'compliant';
}

async function recalculateLicenseCompliance(licenseId: string, client?: any): Promise<void> {
  const db = client || pool;
  const license = await db.query(
    `SELECT id, total_seats, alert_threshold, expiry_date FROM software_licenses WHERE id = $1`,
    [licenseId]
  );
  if (license.rows.length === 0) return;

  const lic = license.rows[0];
  const countResult = await db.query(
    `SELECT COUNT(*) as count FROM license_assignments WHERE license_id = $1`,
    [licenseId]
  );
  const usedSeats = parseInt(countResult.rows[0].count, 10);
  const complianceStatus = calculateCompliance(usedSeats, lic.total_seats, lic.alert_threshold, lic.expiry_date);

  await db.query(
    `UPDATE software_licenses SET used_seats = $1, compliance_status = $2 WHERE id = $3`,
    [usedSeats, complianceStatus, licenseId]
  );
}

export default async function softwareLicenseRoutes(fastify: FastifyInstance) {

  // ─── Compliance Overview ─────────────────────────────────────────────────────

  fastify.get('/software-licenses/compliance/overview', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role === 'user') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const [totalResult, complianceResult, costResult, expiringResult, overAllocatedResult] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int as count FROM software_licenses`),
      pool.query(`SELECT compliance_status, COUNT(*)::int as count FROM software_licenses GROUP BY compliance_status`),
      pool.query(`SELECT COALESCE(SUM(total_cost), 0) as total_cost FROM software_licenses`),
      pool.query(`
        SELECT id, name, publisher, license_type, total_seats, used_seats, expiry_date, compliance_status
        FROM software_licenses
        WHERE expiry_date IS NOT NULL
          AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        ORDER BY expiry_date ASC
      `),
      pool.query(`
        SELECT id, name, publisher, license_type, total_seats, used_seats, compliance_status
        FROM software_licenses
        WHERE used_seats > total_seats
        ORDER BY (used_seats - total_seats) DESC
      `),
    ]);

    const complianceMap: Record<string, number> = {
      compliant: 0,
      warning: 0,
      non_compliant: 0,
      expired: 0,
    };
    for (const row of complianceResult.rows) {
      complianceMap[row.compliance_status] = row.count;
    }

    return reply.send({
      data: {
        total_licenses: totalResult.rows[0].count,
        compliant: complianceMap.compliant,
        warning: complianceMap.warning,
        non_compliant: complianceMap.non_compliant,
        expired: complianceMap.expired,
        total_cost: parseFloat(costResult.rows[0].total_cost) || 0,
        expiring_soon: expiringResult.rows,
        over_allocated: overAllocatedResult.rows,
      },
    });
  });

  // ─── License CRUD ────────────────────────────────────────────────────────────

  fastify.get('/software-licenses', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role === 'user') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { license_type, compliance_status, publisher, search, page = '1', limit = '50' } = request.query as any;
    const conditions: string[] = [];
    const vals: any[] = [];
    let paramIdx = 1;

    if (license_type) { conditions.push(`sl.license_type = $${paramIdx++}`); vals.push(license_type); }
    if (compliance_status) { conditions.push(`sl.compliance_status = $${paramIdx++}`); vals.push(compliance_status); }
    if (publisher) { conditions.push(`sl.publisher ILIKE $${paramIdx++}`); vals.push(`%${publisher}%`); }
    if (search) {
      conditions.push(`(sl.name ILIKE $${paramIdx} OR sl.publisher ILIKE $${paramIdx} OR sl.vendor ILIKE $${paramIdx})`);
      vals.push(`%${search}%`);
      paramIdx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    const countResult = await pool.query(`SELECT COUNT(*) FROM software_licenses sl ${where}`, vals);
    const total = parseInt(countResult.rows[0].count);

    vals.push(limitNum, offset);
    const result = await pool.query(`
      SELECT
        sl.*,
        u.name as created_by_name
      FROM software_licenses sl
      LEFT JOIN users u ON sl.created_by = u.id
      ${where}
      ORDER BY sl.name ASC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `, vals);

    // Build compliance summary
    const summaryResult = await pool.query(`
      SELECT compliance_status, COUNT(*)::int as count FROM software_licenses GROUP BY compliance_status
    `);
    const complianceSummary: Record<string, number> = {};
    for (const row of summaryResult.rows) {
      complianceSummary[row.compliance_status] = row.count;
    }

    return reply.send({
      data: result.rows,
      total,
      page: pageNum,
      pageSize: limitNum,
      compliance_summary: {
        total: Object.values(complianceSummary).reduce((a, b) => a + b, 0),
        compliant: complianceSummary.compliant || 0,
        warning: complianceSummary.warning || 0,
        non_compliant: complianceSummary.non_compliant || 0,
        expired: complianceSummary.expired || 0,
      },
    });
  });

  fastify.get('/software-licenses/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role === 'user') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { id } = request.params as { id: string };

    const [licenseResult, assignmentsResult, contractsResult] = await Promise.all([
      pool.query(`
        SELECT sl.*, u.name as created_by_name
        FROM software_licenses sl
        LEFT JOIN users u ON sl.created_by = u.id
        WHERE sl.id = $1
      `, [id]),
      pool.query(`
        SELECT la.*, a.name as asset_name, a.hostname as asset_hostname
        FROM license_assignments la
        JOIN assets a ON la.asset_id = a.id
        WHERE la.license_id = $1
        ORDER BY la.assigned_at DESC
      `, [id]),
      pool.query(`
        SELECT * FROM software_contracts WHERE license_id = $1 ORDER BY created_at DESC
      `, [id]),
    ]);

    if (licenseResult.rows.length === 0) {
      return reply.status(404).send({ error: 'License not found' });
    }

    return reply.send({
      data: {
        ...licenseResult.rows[0],
        assignments: assignmentsResult.rows,
        contracts: contractsResult.rows,
      },
    });
  });

  fastify.post('/software-licenses', { preHandler: [fastify.requirePermission('manage_licenses')] }, async (request: any, reply) => {
    const body = createLicenseSchema.parse(request.body);

    const result = await pool.query(`
      INSERT INTO software_licenses (
        name, publisher, version, license_type, license_key, total_seats,
        purchase_date, expiry_date, renewal_date, cost_per_seat, total_cost,
        currency, vendor, purchase_order, invoice_number, notes,
        alert_threshold, auto_match, match_pattern, category, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *
    `, [
      body.name, body.publisher || null, body.version || null, body.license_type,
      body.license_key || null, body.total_seats,
      body.purchase_date || null, body.expiry_date || null, body.renewal_date || null,
      body.cost_per_seat || null, body.total_cost || null,
      body.currency || 'USD', body.vendor || null, body.purchase_order || null,
      body.invoice_number || null, body.notes || null,
      body.alert_threshold ?? 10, body.auto_match ?? true, body.match_pattern || null,
      body.category || null, request.user.id,
    ]);

    // Initial compliance calculation
    await recalculateLicenseCompliance(result.rows[0].id);

    const updated = await pool.query(
      `SELECT sl.*, u.name as created_by_name FROM software_licenses sl
       LEFT JOIN users u ON sl.created_by = u.id WHERE sl.id = $1`,
      [result.rows[0].id]
    );

    return reply.status(201).send({ data: updated.rows[0] });
  });

  fastify.patch('/software-licenses/:id', { preHandler: [fastify.requirePermission('manage_licenses')] }, async (request: any, reply) => {
    const { id } = request.params as { id: string };
    const body = updateLicenseSchema.parse(request.body);

    const current = await pool.query(`SELECT * FROM software_licenses WHERE id = $1`, [id]);
    if (current.rows.length === 0) {
      return reply.status(404).send({ error: 'License not found' });
    }

    const allowedFields = [
      'name', 'publisher', 'version', 'license_type', 'license_key', 'total_seats',
      'purchase_date', 'expiry_date', 'renewal_date', 'cost_per_seat', 'total_cost',
      'currency', 'vendor', 'purchase_order', 'invoice_number', 'notes',
      'alert_threshold', 'auto_match', 'match_pattern', 'category', 'is_active',
    ];

    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(body)) {
      if (allowedFields.includes(k)) {
        sets.push(`${k}=$${i++}`);
        vals.push(v === undefined ? null : v);
      }
    }

    if (sets.length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    vals.push(id);
    await pool.query(
      `UPDATE software_licenses SET ${sets.join(', ')} WHERE id=$${i}`,
      vals
    );

    // Recalculate compliance if seats or expiry changed
    if (body.total_seats !== undefined || body.expiry_date !== undefined || body.alert_threshold !== undefined) {
      await recalculateLicenseCompliance(id);
    }

    const result = await pool.query(
      `SELECT sl.*, u.name as created_by_name FROM software_licenses sl
       LEFT JOIN users u ON sl.created_by = u.id WHERE sl.id = $1`,
      [id]
    );

    return reply.send({ data: result.rows[0] });
  });

  fastify.delete('/software-licenses/:id', { preHandler: [fastify.requirePermission('manage_licenses')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await pool.query(`SELECT id FROM software_licenses WHERE id=$1`, [id]);
    if (existing.rows.length === 0) return reply.status(404).send({ error: 'License not found' });
    await pool.query(`DELETE FROM software_licenses WHERE id=$1`, [id]);
    return reply.status(204).send();
  });

  // ─── Assignments ─────────────────────────────────────────────────────────────

  fastify.get('/software-licenses/:id/assignments', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role === 'user') {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const { id } = request.params as { id: string };
    const result = await pool.query(`
      SELECT la.*, a.name as asset_name, a.hostname as asset_hostname, a.asset_type,
             u.name as assigned_by_name
      FROM license_assignments la
      JOIN assets a ON la.asset_id = a.id
      LEFT JOIN users u ON la.assigned_by = u.id
      WHERE la.license_id = $1
      ORDER BY la.assigned_at DESC
    `, [id]);
    return reply.send({ data: result.rows });
  });

  fastify.post('/software-licenses/:id/assign', { preHandler: [fastify.requirePermission('manage_licenses')] }, async (request: any, reply) => {
    const { id } = request.params as { id: string };
    const body = assignSchema.parse(request.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check license exists
      const license = await client.query(`SELECT * FROM software_licenses WHERE id = $1`, [id]);
      if (license.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'License not found' });
      }

      // Check asset exists
      const asset = await client.query(`SELECT id, name FROM assets WHERE id = $1`, [body.asset_id]);
      if (asset.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Asset not found' });
      }

      // Check for duplicate assignment
      const existing = await client.query(
        `SELECT id FROM license_assignments WHERE license_id = $1 AND asset_id = $2`,
        [id, body.asset_id]
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return reply.status(409).send({ error: 'License already assigned to this asset' });
      }

      const lic = license.rows[0];
      const softwareName = `${lic.name}${lic.version ? ` ${lic.version}` : ''}`;

      await client.query(
        `INSERT INTO license_assignments (license_id, asset_id, software_name, assigned_by)
         VALUES ($1, $2, $3, $4)`,
        [id, body.asset_id, softwareName, request.user.id]
      );

      // Recalculate compliance
      await recalculateLicenseCompliance(id, client);

      await client.query('COMMIT');

      const assignment = await pool.query(`
        SELECT la.*, a.name as asset_name, a.hostname as asset_hostname
        FROM license_assignments la
        JOIN assets a ON la.asset_id = a.id
        WHERE la.license_id = $1 AND la.asset_id = $2
      `, [id, body.asset_id]);

      return reply.status(201).send({ data: assignment.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  fastify.delete('/software-licenses/:id/assignments/:assetId', { preHandler: [fastify.requirePermission('manage_licenses')] }, async (request, reply) => {
    const { id, assetId } = request.params as { id: string; assetId: string };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query(
        `SELECT id FROM license_assignments WHERE license_id = $1 AND asset_id = $2`,
        [id, assetId]
      );
      if (existing.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Assignment not found' });
      }

      await client.query(
        `DELETE FROM license_assignments WHERE license_id = $1 AND asset_id = $2`,
        [id, assetId]
      );

      await recalculateLicenseCompliance(id, client);

      await client.query('COMMIT');
      return reply.status(204).send();
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  // ─── Auto-Matching ───────────────────────────────────────────────────────────

  fastify.post('/software-licenses/:id/auto-match', { preHandler: [fastify.requirePermission('manage_licenses')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const license = await pool.query(`SELECT * FROM software_licenses WHERE id = $1`, [id]);
    if (license.rows.length === 0) {
      return reply.status(404).send({ error: 'License not found' });
    }

    const lic = license.rows[0];
    if (!lic.match_pattern) {
      return reply.status(400).send({ error: 'License has no match_pattern configured' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Find assets with matching software
      const matches = await client.query(`
        SELECT DISTINCT a.id as asset_id, a.name as asset_name, a.hostname as asset_hostname, asw.name as software_name
        FROM asset_software asw
        JOIN assets a ON a.id = asw.asset_id
        WHERE asw.name ILIKE $1
          AND a.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM license_assignments la2
            WHERE la2.license_id = $2 AND la2.asset_id = a.id
          )
      `, [`%${lic.match_pattern}%`, id]);

      const matched = matches.rows;
      if (matched.length === 0) {
        await client.query('COMMIT');
        return reply.send({ data: { matched_count: 0, matches: [] } });
      }

      // Create assignments for each match
      for (const match of matched) {
        await client.query(
          `INSERT INTO license_assignments (license_id, asset_id, software_name, assigned_by, is_auto_matched)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT (license_id, asset_id) DO NOTHING`,
          [id, match.asset_id, match.software_name, request.user.id]
        );
      }

      // Recalculate compliance
      await recalculateLicenseCompliance(id, client);

      await client.query('COMMIT');

      return reply.send({
        data: {
          matched_count: matched.length,
          matches: matched,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  fastify.post('/software-licenses/auto-match-all', { preHandler: [fastify.requirePermission('manage_licenses')] }, async (request: any, reply) => {
    const licenses = await pool.query(
      `SELECT id, name, match_pattern FROM software_licenses WHERE auto_match = true AND match_pattern IS NOT NULL AND match_pattern != ''`
    );

    let totalMatched = 0;
    const results: any[] = [];

    for (const lic of licenses.rows) {
      const matches = await pool.query(`
        SELECT DISTINCT a.id as asset_id, a.name as asset_name, asw.name as software_name
        FROM asset_software asw
        JOIN assets a ON a.id = asw.asset_id
        WHERE asw.name ILIKE $1
          AND a.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM license_assignments la2
            WHERE la2.license_id = $2 AND la2.asset_id = a.id
          )
      `, [`%${lic.match_pattern}%`, lic.id]);

      for (const match of matches.rows) {
        await pool.query(
          `INSERT INTO license_assignments (license_id, asset_id, software_name, assigned_by, is_auto_matched)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT (license_id, asset_id) DO NOTHING`,
          [lic.id, match.asset_id, match.software_name, request.user.id]
        );
      }

      if (matches.rows.length > 0) {
        await recalculateLicenseCompliance(lic.id);
        totalMatched += matches.rows.length;
        results.push({ license_id: lic.id, license_name: lic.name, matched_count: matches.rows.length });
      }
    }

    return reply.send({
      data: {
        total_matched: totalMatched,
        license_results: results,
      },
    });
  });

  // ─── Recalculate ─────────────────────────────────────────────────────────────

  fastify.post('/software-licenses/:id/recalculate', { preHandler: [fastify.requirePermission('manage_licenses')] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await pool.query(`SELECT id FROM software_licenses WHERE id=$1`, [id]);
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'License not found' });
    }

    await recalculateLicenseCompliance(id);

    const result = await pool.query(
      `SELECT sl.*, u.name as created_by_name FROM software_licenses sl
       LEFT JOIN users u ON sl.created_by = u.id WHERE sl.id = $1`,
      [id]
    );

    return reply.send({ data: result.rows[0] });
  });

  // ─── Bulk Import ────────────────────────────────────────────────────────────

  const importSchema = z.object({
    licenses: z.array(z.object({
      name: z.string().min(1).max(300),
      publisher: z.string().max(200).optional().nullable(),
      version: z.string().max(100).optional().nullable(),
      license_type: z.enum(['perpetual', 'subscription', 'concurrent', 'freeware', 'open_source', 'trial']).default('perpetual'),
      license_key: z.string().optional().nullable(),
      total_seats: z.number().int().min(0).default(1),
      purchase_date: z.string().optional().nullable(),
      expiry_date: z.string().optional().nullable(),
      cost_per_seat: z.number().optional().nullable(),
      total_cost: z.number().optional().nullable(),
      currency: z.string().max(10).default('USD'),
      vendor: z.string().max(200).optional().nullable(),
      category: z.string().max(100).optional().nullable(),
      notes: z.string().optional().nullable(),
    })).min(1).max(500),
  });

  fastify.post('/software-licenses/import', { preHandler: [fastify.requirePermission('manage_licenses')] }, async (request: any, reply) => {
    const body = importSchema.parse(request.body);

    const results: { row: number; name: string; status: 'imported' | 'error'; error?: string }[] = [];
    let importedCount = 0;

    for (let i = 0; i < body.licenses.length; i++) {
      const lic = body.licenses[i];
      try {
        const result = await pool.query(`
          INSERT INTO software_licenses (
            name, publisher, version, license_type, license_key, total_seats,
            purchase_date, expiry_date, cost_per_seat, total_cost,
            currency, vendor, category, notes, created_by
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          RETURNING id
        `, [
          lic.name, lic.publisher || null, lic.version || null, lic.license_type,
          lic.license_key || null, lic.total_seats ?? 1,
          lic.purchase_date || null, lic.expiry_date || null,
          lic.cost_per_seat || null, lic.total_cost || null,
          lic.currency || 'USD', lic.vendor || null,
          lic.category || null, lic.notes || null, request.user.id,
        ]);

        await recalculateLicenseCompliance(result.rows[0].id);

        importedCount++;
        results.push({ row: i + 1, name: lic.name, status: 'imported' });
      } catch (err: any) {
        const msg = err.message || 'Validation failed';
        results.push({ row: i + 1, name: lic.name, status: 'error', error: msg });
      }
    }

    return reply.status(importedCount > 0 ? 200 : 400).send({
      data: {
        total: body.licenses.length,
        imported: importedCount,
        failed: body.licenses.length - importedCount,
        results,
      },
    });
  });

  // ─── Export ──────────────────────────────────────────────────────────────────

  fastify.get('/software-licenses/export', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role === 'user') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { license_type, compliance_status, publisher, search } = request.query as any;
    const conditions: string[] = [];
    const vals: any[] = [];
    let paramIdx = 1;

    if (license_type) { conditions.push(`sl.license_type = $${paramIdx++}`); vals.push(license_type); }
    if (compliance_status) { conditions.push(`sl.compliance_status = $${paramIdx++}`); vals.push(compliance_status); }
    if (publisher) { conditions.push(`sl.publisher ILIKE $${paramIdx++}`); vals.push(`%${publisher}%`); }
    if (search) {
      conditions.push(`(sl.name ILIKE $${paramIdx} OR sl.publisher ILIKE $${paramIdx} OR sl.vendor ILIKE $${paramIdx})`);
      vals.push(`%${search}%`);
      paramIdx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT sl.*, u.name as created_by_name
      FROM software_licenses sl
      LEFT JOIN users u ON sl.created_by = u.id
      ${where}
      ORDER BY sl.name ASC
    `, vals);

    return reply.send({ data: result.rows, total: result.rows.length });
  });

  // ─── Contracts ───────────────────────────────────────────────────────────────

  fastify.get('/software-licenses/:id/contracts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    if (request.user.role === 'user') {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const { id } = request.params as { id: string };
    const result = await pool.query(
      `SELECT * FROM software_contracts WHERE license_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    return reply.send({ data: result.rows });
  });

  fastify.post('/software-licenses/:id/contracts', { preHandler: [fastify.requirePermission('manage_licenses')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = createContractSchema.parse(request.body);

    const license = await pool.query(`SELECT id FROM software_licenses WHERE id = $1`, [id]);
    if (license.rows.length === 0) {
      return reply.status(404).send({ error: 'License not found' });
    }

    const result = await pool.query(`
      INSERT INTO software_contracts (license_id, name, contract_number, vendor, start_date, end_date, auto_renew, renewal_notice_days, terms, file_path)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      id, body.name, body.contract_number || null, body.vendor || null,
      body.start_date || null, body.end_date || null, body.auto_renew ?? false,
      body.renewal_notice_days ?? 30, body.terms || null, body.file_path || null,
    ]);

    return reply.status(201).send({ data: result.rows[0] });
  });

  fastify.patch('/software-licenses/:id/contracts/:contractId', { preHandler: [fastify.requirePermission('manage_licenses')] }, async (request: any, reply) => {
    const { id, contractId } = request.params as { id: string; contractId: string };
    const body = updateContractSchema.parse(request.body);

    const existing = await pool.query(
      `SELECT id FROM software_contracts WHERE id = $1 AND license_id = $2`,
      [contractId, id]
    );
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Contract not found' });
    }

    const allowed = ['name', 'contract_number', 'vendor', 'start_date', 'end_date', 'auto_renew', 'renewal_notice_days', 'terms', 'file_path'];
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(body)) {
      if (allowed.includes(k)) {
        sets.push(`${k}=$${i++}`);
        vals.push(v === undefined ? null : v);
      }
    }

    if (sets.length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    vals.push(contractId);
    const result = await pool.query(
      `UPDATE software_contracts SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`,
      vals
    );

    return reply.send({ data: result.rows[0] });
  });

  fastify.delete('/software-licenses/:id/contracts/:contractId', { preHandler: [fastify.requirePermission('manage_licenses')] }, async (request, reply) => {
    const { id, contractId } = request.params as { id: string; contractId: string };
    const existing = await pool.query(
      `SELECT id FROM software_contracts WHERE id = $1 AND license_id = $2`,
      [contractId, id]
    );
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Contract not found' });
    }
    await pool.query(`DELETE FROM software_contracts WHERE id = $1`, [contractId]);
    return reply.status(204).send();
  });
}
