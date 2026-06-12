// Critical Gaps Smoke Tests
// Run: node --test apps/api/src/routes/tests/critical-gaps-smoke.mjs
// Requires a running API server with DATABASE_URL set

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

const API = process.env.TEST_API_URL || 'http://127.0.0.1:3001/api';

let token = null;
let testCiId = null;
let testRelId = null;
let testWebhookId = null;
let testDeliveryId = null;
let testTicketId = null;
let testMajorIncidentId = null;

async function apiPost(path, body, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  return { status: res.status, data };
}

async function apiGet(path, auth = true) {
  const headers = {};
  if (auth && token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { headers });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  return { status: res.status, data };
}

async function apiPatch(path, body, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  return { status: res.status, data };
}

async function apiDelete(path, auth = true) {
  const headers = {};
  if (auth && token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method: 'DELETE', headers });
  return { status: res.status };
}

describe('Critical Gaps: CMDB', async () => {
  before(async () => {
    // Login to get auth token
    const { data } = await apiPost('/auth/login', {
      email: process.env.TEST_ADMIN_EMAIL || 'admin@resolv.local',
      password: process.env.TEST_ADMIN_PASSWORD || 'password',
    }, false);
    if (data?.data?.token) token = data.data.token;
  });

  it('POST /cmdb - create a configuration item', async () => {
    const { status, data } = await apiPost('/cmdb', {
      name: 'Test Web Server',
      description: 'A test CI for smoke testing',
      ci_type: 'server',
      status: 'active',
      department: 'Engineering',
      location: 'DC-01',
      tags: ['web', 'test'],
    });
    assert.equal(status, 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
    assert.ok(data?.data?.id, 'Should return CI with id');
    testCiId = data.data.id;
  });

  it('GET /cmdb - list CIs', async () => {
    const { status } = await apiGet('/cmdb');
    assert.equal(status, 200);
  });

  it('GET /cmdb/:id - get single CI', async () => {
    const { status, data } = await apiGet(`/cmdb/${testCiId}`);
    assert.equal(status, 200);
    assert.equal(data?.data?.name, 'Test Web Server');
  });

  it('PATCH /cmdb/:id - update CI', async () => {
    const { status, data } = await apiPatch(`/cmdb/${testCiId}`, { description: 'Updated description' });
    assert.equal(status, 200);
    assert.equal(data?.data?.description, 'Updated description');
  });

  it('POST /cmdb/relationships - create CI relationship', async () => {
    // Create a second CI to relate to
    const { data: ci2 } = await apiPost('/cmdb', {
      name: 'Test Database',
      ci_type: 'database',
      status: 'active',
    });
    const targetId = ci2.data.id;

    const { status, data } = await apiPost('/cmdb/relationships', {
      source_id: testCiId,
      target_id: targetId,
      relationship_type: 'depends_on',
      description: 'Web server depends on database',
    });
    assert.equal(status, 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
    assert.ok(data?.data?.id);
    testRelId = data.data.id;
  });

  it('GET /cmdb/:id/graph - get CI graph', async () => {
    const { status } = await apiGet(`/cmdb/${testCiId}/graph`);
    assert.equal(status, 200);
  });

  it('DELETE /cmdb/relationships/:id - delete relationship', async () => {
    const { status } = await apiDelete(`/cmdb/relationships/${testRelId}`);
    assert.equal(status, 204);
  });

  it('DELETE /cmdb/:id - delete CI', async () => {
    const { status } = await apiDelete(`/cmdb/${testCiId}`);
    assert.equal(status, 204);
  });
});

describe('Critical Gaps: Webhooks', async () => {
  it('POST /webhooks - create webhook config', async () => {
    const { status, data } = await apiPost('/webhooks', {
      name: 'Test Webhook',
      url: 'https://httpbin.org/post',
      events: ['ticket.created', 'ticket.updated'],
      is_active: true,
      retry_count: 2,
      timeout_seconds: 15,
    });
    assert.equal(status, 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
    assert.ok(data?.data?.id);
    testWebhookId = data.data.id;
  });

  it('GET /webhooks - list webhooks', async () => {
    const { status } = await apiGet('/webhooks');
    assert.equal(status, 200);
  });

  it('GET /webhooks/:id - get single webhook', async () => {
    const { status, data } = await apiGet(`/webhooks/${testWebhookId}`);
    assert.equal(status, 200);
    assert.equal(data?.data?.name, 'Test Webhook');
  });

  it('PATCH /webhooks/:id - update webhook', async () => {
    const { status, data } = await apiPatch(`/webhooks/${testWebhookId}`, { name: 'Updated Webhook' });
    assert.equal(status, 200);
    assert.equal(data?.data?.name, 'Updated Webhook');
  });

  it('POST /webhooks/:id/test - send test event', async () => {
    const { status, data } = await apiPost(`/webhooks/${testWebhookId}/test`, {});
    assert.equal(status, 200);
    testDeliveryId = data?.data?.id;
  });

  it('GET /webhooks/:id/deliveries - list deliveries', async () => {
    const { status } = await apiGet(`/webhooks/${testWebhookId}/deliveries`);
    assert.equal(status, 200);
  });

  it('DELETE /webhooks/:id - cleanup', async () => {
    const { status } = await apiDelete(`/webhooks/${testWebhookId}`);
    assert.equal(status, 204);
  });
});

describe('Critical Gaps: Major Incidents', async () => {
  let ciTicketId = null;

  before(async () => {
    // Create a critical incident ticket to use for declaring a major incident
    const { data } = await apiPost('/tickets', {
      title: 'Critical outage for major incident test',
      description: 'Test ticket for major incident declaration smoke test',
      priority: 'critical',
      ticket_type: 'incident',
    });
    if (data?.data?.id) {
      ciTicketId = data.data.id;
    }
  });

  it('POST /major-incidents/declare - declare a major incident', async () => {
    if (!ciTicketId) {
      console.log('Skipping: could not create test ticket, ensure DB is seeded');
      return;
    }
    const { status, data } = await apiPost('/major-incidents/declare', {
      ticket_id: ciTicketId,
      bridge_url: 'https://meet.example.com/war-room',
      bridge_conference: '+1-555-0100',
      bridge_slack_channel: '#war-room',
      services_affected: ['email', 'vpn', 'portal'],
    });
    assert.equal(status, 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
    assert.ok(data?.data?.ticket_id);
    testMajorIncidentId = data.data.ticket_id;
  });

  it('GET /major-incidents - list major incidents', async () => {
    const { status } = await apiGet('/major-incidents');
    assert.equal(status, 200);
  });

  it('GET /major-incidents/:ticketId - get detail with timeline', async () => {
    if (!testMajorIncidentId) return;
    const { status, data } = await apiGet(`/major-incidents/${testMajorIncidentId}`);
    assert.equal(status, 200);
    assert.ok(Array.isArray(data?.data?.timeline));
  });

  it('POST /major-incidents/:ticketId/timeline - add timeline entry', async () => {
    if (!testMajorIncidentId) return;
    const { status, data } = await apiPost(`/major-incidents/${testMajorIncidentId}/timeline`, {
      entry_type: 'update',
      content: 'Engineering team is investigating the root cause',
    });
    assert.equal(status, 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
  });

  it('GET /major-incidents/:ticketId/timeline - list timeline', async () => {
    if (!testMajorIncidentId) return;
    const { status } = await apiGet(`/major-incidents/${testMajorIncidentId}/timeline`);
    assert.equal(status, 200);
  });

  it('PATCH /major-incidents/:ticketId - update incident', async () => {
    if (!testMajorIncidentId) return;
    const { status, data } = await apiPatch(`/major-incidents/${testMajorIncidentId}`, {
      incident_commander_id: null, // clears commander
    });
    assert.equal(status, 200);
  });

  it('POST /major-incidents/:ticketId/resolve - resolve', async () => {
    if (!testMajorIncidentId) return;
    const { status, data } = await apiPost(`/major-incidents/${testMajorIncidentId}/resolve`, {});
    assert.equal(status, 200);
    assert.equal(data?.data?.status, 'resolved');
  });

  it('POST /major-incidents/:ticketId/complete-pir - complete PIR', async () => {
    if (!testMajorIncidentId) return;
    const { status } = await apiPost(`/major-incidents/${testMajorIncidentId}/complete-pir`, {});
    assert.equal(status, 200);
  });
});

describe('Health Check', async () => {
  it('GET /health - API is running', async () => {
    const { status, data } = await apiGet('/health', false);
    assert.equal(status, 200);
    assert.ok(data?.data?.api === true);
  });
});
