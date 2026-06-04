/**
 * Comprehensive AI Tool Test Harness
 * Tests all AI tools for both Agent AI (admin/agent) and Portal AI (user)
 * by calling the API endpoints directly.
 */

const API = 'http://localhost:3001/api'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function login(email, password) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`Login failed for ${email}: ${j.error || r.status}`)
  return j.data
}

async function apiGet(path, token) {
  const r = await fetch(`${API}${path}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return { status: r.status, data: await r.json() }
}

async function apiPost(path, token, body) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  })
  return { status: r.status, data: await r.json() }
}

async function createSession(token) {
  const r = await apiPost('/ai/sessions', token, {})
  if (r.status !== 200) throw new Error(`Create session failed: ${JSON.stringify(r.data)}`)
  return r.data.data.id
}

async function chat(token, sessionId, message, timeout = 60000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const r = await fetch(`${API}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ session_id: sessionId, message }),
      signal: controller.signal
    })
    clearTimeout(timer)
    const data = await r.json()
    return { status: r.status, data }
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

// ── Test Runner ──────────────────────────────────────────────────────────────

const results = []

async function test(name, fn) {
  const start = Date.now()
  try {
    const result = await fn()
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    results.push({ name, status: 'PASS', elapsed, details: result })
    console.log(`  ✓ ${name} (${elapsed}s)`)
  } catch (e) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    results.push({ name, status: 'FAIL', elapsed, error: e.message })
    console.log(`  ✗ ${name} (${elapsed}s) — ${e.message}`)
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg)
}

// ── Agent AI Tests (admin user) ──────────────────────────────────────────────

async function runAgentTests() {
  console.log('\n═══════════════════════════════════════════════')
  console.log('  AGENT AI TESTS (admin: lucas.jensen)')
  console.log('═══════════════════════════════════════════════')

  const admin = await login('lucas.jensen@sgcityutah.gov', 'Password123!')
  console.log(`  Logged in as ${admin.user.name} (${admin.user.role})`)
  const token = admin.token
  let sessionId

  // 1. Create session
  await test('Agent: Create session', async () => {
    sessionId = await createSession(token)
    assert(sessionId, 'No session ID returned')
    return `Session: ${sessionId}`
  })

  // 2. Test get_stats tool
  await test('Agent: get_stats — "How many open tickets are there?"', async () => {
    const r = await chat(token, sessionId, 'How many open tickets are there right now?')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    assert(r.data.data, 'No data in response')
    const content = r.data.data.content || ''
    const toolCalls = r.data.data.tool_calls || []
    assert(toolCalls.length > 0 || content.length > 0, 'Empty response')
    return `Tools: [${toolCalls.map(t => t.function?.name).join(', ')}] | Response: ${content.substring(0, 150)}...`
  })

  // 3. Test search_tickets tool
  await test('Agent: search_tickets — "Show me critical tickets"', async () => {
    const r = await chat(token, sessionId, 'Show me all critical priority tickets')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    const toolCalls = r.data.data.tool_calls || []
    assert(toolCalls.length > 0 || content.length > 0, 'Empty response')
    return `Tools: [${toolCalls.map(t => t.function?.name).join(', ')}] | Response: ${content.substring(0, 150)}...`
  })

  // 4. Test get_ticket tool (by number)
  await test('Agent: get_ticket — "What is ticket #1?"', async () => {
    const r = await chat(token, sessionId, 'What is the status of ticket #1?')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    const toolCalls = r.data.data.tool_calls || []
    return `Tools: [${toolCalls.map(t => t.function?.name).join(', ')}] | Response: ${content.substring(0, 150)}...`
  })

  // 5. Test search_knowledge tool
  await test('Agent: search_knowledge — "How do I reset my password?"', async () => {
    const r = await chat(token, sessionId, 'How do I reset my password? Check the knowledge base.')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    const toolCalls = r.data.data.tool_calls || []
    return `Tools: [${toolCalls.map(t => t.function?.name).join(', ')}] | Response: ${content.substring(0, 150)}...`
  })

  // 6. Test search_users tool
  await test('Agent: search_users — "Find user David Smith"', async () => {
    const r = await chat(token, sessionId, 'Look up David Smith in the system')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    const toolCalls = r.data.data.tool_calls || []
    return `Tools: [${toolCalls.map(t => t.function?.name).join(', ')}] | Response: ${content.substring(0, 150)}...`
  })

  // 7. Test get_my_tickets tool
  await test('Agent: get_my_tickets — "Show my tickets"', async () => {
    const r = await chat(token, sessionId, 'Show me my submitted tickets')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    const toolCalls = r.data.data.tool_calls || []
    return `Tools: [${toolCalls.map(t => t.function?.name).join(', ')}] | Response: ${content.substring(0, 150)}...`
  })

  // 8. Test create_ticket tool
  await test('Agent: create_ticket — "Create a ticket for broken printer"', async () => {
    const r = await chat(token, sessionId, 'Create a ticket: The printer on floor 2 is jammed and showing error code E-404. It is an incident, medium priority, category Printer & Peripherals.')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    const toolCalls = r.data.data.tool_calls || []
    const hasCreate = toolCalls.some(t => t.function?.name === 'create_ticket')
    return `Tools: [${toolCalls.map(t => t.function?.name).join(', ')}] | create_ticket called: ${hasCreate} | Response: ${content.substring(0, 150)}...`
  })

  // 9. Test update_ticket tool
  await test('Agent: update_ticket — "Change ticket #1 priority to high"', async () => {
    const r = await chat(token, sessionId, 'Update ticket #1 — change the priority to high')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    const toolCalls = r.data.data.tool_calls || []
    return `Tools: [${toolCalls.map(t => t.function?.name).join(', ')}] | Response: ${content.substring(0, 150)}...`
  })

  // 10. Test add_comment tool
  await test('Agent: add_comment — "Add a note to ticket #1"', async () => {
    const r = await chat(token, sessionId, 'Add a comment to ticket #1: "Investigating the issue, will update shortly."')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    const toolCalls = r.data.data.tool_calls || []
    return `Tools: [${toolCalls.map(t => t.function?.name).join(', ')}] | Response: ${content.substring(0, 150)}...`
  })

  // 11. Test RAG retrieval (WiFi question should match knowledge source)
  await test('Agent: RAG — "WiFi issues in conference room"', async () => {
    const r = await chat(token, sessionId, 'We are having WiFi connectivity issues in a conference room. What should we do?')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    const rag = r.data.data.rag
    return `RAG: ${JSON.stringify(rag)} | Response: ${content.substring(0, 150)}...`
  })

  // 12. Test phishing question (should match QA pair)
  await test('Agent: RAG QA — "I think I got a phishing email"', async () => {
    const r = await chat(token, sessionId, 'I think I just received a phishing email. What should I do?')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    const rag = r.data.data.rag
    return `RAG: ${JSON.stringify(rag)} | Response: ${content.substring(0, 150)}...`
  })

  // 13. Test SLA breach query
  await test('Agent: search_tickets SLA — "Are there any SLA breached tickets?"', async () => {
    const r = await chat(token, sessionId, 'Are there any tickets that have breached their SLA?')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    const toolCalls = r.data.data.tool_calls || []
    return `Tools: [${toolCalls.map(t => t.function?.name).join(', ')}] | Response: ${content.substring(0, 150)}...`
  })

  // 14. Test non-existent ticket
  await test('Agent: get_ticket — non-existent ticket #99999', async () => {
    const r = await chat(token, sessionId, 'Check ticket #99999 for me')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    return `Response: ${content.substring(0, 200)}...`
  })

  // 15. Test conversational / no-tool question
  await test('Agent: General — "Hello, what can you help me with?"', async () => {
    const r = await chat(token, sessionId, 'Hello! What can you help me with?')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    assert(content.length > 0, 'Empty response')
    return `Response: ${content.substring(0, 200)}...`
  })

  return token
}

// ── Portal AI Tests (regular user) ───────────────────────────────────────────

async function runPortalTests() {
  console.log('\n═══════════════════════════════════════════════')
  console.log('  PORTAL AI TESTS (user: lisa.garcia)')
  console.log('═══════════════════════════════════════════════')

  const user = await login('lisa.garcia@company.com', 'Password123!')
  console.log(`  Logged in as ${user.user.name} (${user.user.role})`)
  const token = user.token
  let sessionId

  // 1. Create session
  await test('Portal: Create session', async () => {
    sessionId = await createSession(token)
    assert(sessionId, 'No session ID returned')
    return `Session: ${sessionId}`
  })

  // 2. Test get_my_tickets (portal scoped)
  await test('Portal: get_my_tickets — "Show my tickets"', async () => {
    const r = await chat(token, sessionId, 'Show me all my tickets')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    const toolCalls = r.data.data.tool_calls || []
    return `Tools: [${toolCalls.map(t => t.function?.name).join(', ')}] | Response: ${content.substring(0, 150)}...`
  })

  // 3. Test search_knowledge
  await test('Portal: search_knowledge — "How to connect to WiFi?"', async () => {
    const r = await chat(token, sessionId, 'How do I connect to the corporate WiFi?')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    const toolCalls = r.data.data.tool_calls || []
    return `Tools: [${toolCalls.map(t => t.function?.name).join(', ')}] | Response: ${content.substring(0, 150)}...`
  })

  // 4. Test create_ticket (portal)
  await test('Portal: create_ticket — "My mouse is broken"', async () => {
    const r = await chat(token, sessionId, 'My mouse keeps disconnecting. I need help with this. Please create a ticket.')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    const toolCalls = r.data.data.tool_calls || []
    return `Tools: [${toolCalls.map(t => t.function?.name).join(', ')}] | Response: ${content.substring(0, 150)}...`
  })

  // 5. Test get_ticket (portal — own ticket)
  await test('Portal: get_ticket — "Check ticket #1"', async () => {
    const r = await chat(token, sessionId, 'Can you check ticket #1 for me?')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    return `Response: ${content.substring(0, 200)}...`
  })

  // 6. Test search_tickets (portal scoped)
  await test('Portal: search_tickets — "Any open tickets?"', async () => {
    const r = await chat(token, sessionId, 'Do I have any open tickets?')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    const toolCalls = r.data.data.tool_calls || []
    return `Tools: [${toolCalls.map(t => t.function?.name).join(', ')}] | Response: ${content.substring(0, 150)}...`
  })

  // 7. Test phishing question (RAG QA)
  await test('Portal: RAG QA — "I clicked a suspicious link"', async () => {
    const r = await chat(token, sessionId, 'I accidentally clicked a link in a suspicious email. What should I do?')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    const rag = r.data.data.rag
    return `RAG: ${JSON.stringify(rag)} | Response: ${content.substring(0, 150)}...`
  })

  // 8. Test software installation question (RAG QA)
  await test('Portal: RAG QA — "I need new software installed"', async () => {
    const r = await chat(token, sessionId, 'I need to get VS Code installed on my work laptop. How do I request that?')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    const toolCalls = r.data.data.tool_calls || []
    return `Tools: [${toolCalls.map(t => t.function?.name).join(', ')}] | Response: ${content.substring(0, 150)}...`
  })

  // 9. Test add_comment (portal — on own ticket)
  await test('Portal: add_comment — "Add info to my ticket"', async () => {
    // First find a ticket this user owns
    const tickets = await apiGet('/tickets?limit=1', token)
    if (tickets.data.data?.length > 0) {
      const ticketNum = tickets.data.data[0].number
      const r = await chat(token, sessionId, `Add a comment to ticket #${ticketNum}: "I just restarted my computer but the issue persists."`)
      assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
      const content = r.data.data.content || ''
      const toolCalls = r.data.data.tool_calls || []
      return `Tools: [${toolCalls.map(t => t.function?.name).join(', ')}] | Response: ${content.substring(0, 150)}...`
    }
    return 'Skipped — user has no tickets'
  })

  // 10. Test general greeting
  await test('Portal: General — "Hi, I need help"', async () => {
    const r = await chat(token, sessionId, 'Hi, I need some help with my computer.')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    assert(content.length > 0, 'Empty response')
    return `Response: ${content.substring(0, 200)}...`
  })

  // 11. Test get_stats (portal scoped)
  await test('Portal: get_stats — "How many tickets do I have?"', async () => {
    const r = await chat(token, sessionId, 'How many tickets do I have?')
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    const content = r.data.data.content || ''
    const toolCalls = r.data.data.tool_calls || []
    return `Tools: [${toolCalls.map(t => t.function?.name).join(', ')}] | Response: ${content.substring(0, 150)}...`
  })

  return token
}

// ── Config & Endpoint Tests ──────────────────────────────────────────────────

async function runConfigTests(adminToken) {
  console.log('\n═══════════════════════════════════════════════')
  console.log('  CONFIG & ENDPOINT TESTS')
  console.log('═══════════════════════════════════════════════')

  await test('GET /ai/config — admin can read config', async () => {
    const r = await apiGet('/ai/config', adminToken)
    assert(r.status === 200, `HTTP ${r.status}`)
    assert(r.data.data, 'No config data')
    const cfg = r.data.data
    return `Provider: ${cfg.provider}, Model: ${cfg.model}, Enabled: ${cfg.enabled}, Portal: ${cfg.portal_enabled}`
  })

  await test('GET /ai/sessions — list sessions', async () => {
    const r = await apiGet('/ai/sessions', adminToken)
    assert(r.status === 200, `HTTP ${r.status}`)
    assert(Array.isArray(r.data.data), 'Not an array')
    return `${r.data.data.length} sessions`
  })

  await test('GET /ai/knowledge/sources — admin can list sources', async () => {
    const r = await apiGet('/ai/knowledge/sources', adminToken)
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Sources: ${JSON.stringify(r.data.data?.length ?? r.data)}`
  })

  await test('GET /ai/rag/config — admin can read RAG config', async () => {
    const r = await apiGet('/ai/rag/config', adminToken)
    assert(r.status === 200, `HTTP ${r.status}`)
    return `RAG Config: ${JSON.stringify(r.data.data).substring(0, 150)}`
  })

  await test('GET /ai/rag/analytics — admin can read analytics', async () => {
    const r = await apiGet('/ai/rag/analytics', adminToken)
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Analytics: ${JSON.stringify(r.data.data).substring(0, 150)}`
  })

  await test('POST /ai/rag/test — test RAG retrieval', async () => {
    const r = await apiPost('/ai/rag/test', adminToken, { query: 'password reset', limit: 3 })
    assert(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`)
    return `RAG Test: ${JSON.stringify(r.data.data).substring(0, 200)}`
  })
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════╗')
  console.log('║     RESOLV AI COMPREHENSIVE TEST HARNESS     ║')
  console.log('╚═══════════════════════════════════════════════╝')
  console.log(`  Started at: ${new Date().toISOString()}`)

  let adminToken
  try {
    adminToken = await runAgentTests()
  } catch (e) {
    console.error(`\nFATAL: Agent tests aborted: ${e.message}`)
  }

  try {
    await runPortalTests()
  } catch (e) {
    console.error(`\nFATAL: Portal tests aborted: ${e.message}`)
  }

  if (adminToken) {
    try {
      await runConfigTests(adminToken)
    } catch (e) {
      console.error(`\nFATAL: Config tests aborted: ${e.message}`)
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n╔═══════════════════════════════════════════════╗')
  console.log('║                  TEST SUMMARY                 ║')
  console.log('╚═══════════════════════════════════════════════╝')

  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  const totalTime = results.reduce((sum, r) => sum + parseFloat(r.elapsed), 0).toFixed(1)

  console.log(`\n  Total:  ${results.length}`)
  console.log(`  Passed: ${passed} ✓`)
  console.log(`  Failed: ${failed} ✗`)
  console.log(`  Time:   ${totalTime}s`)

  if (failed > 0) {
    console.log('\n  FAILED TESTS:')
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    ✗ ${r.name}`)
      console.log(`      Error: ${r.error}`)
    })
  }

  console.log('\n  DETAILED RESULTS:')
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✓' : '✗'
    console.log(`    ${icon} ${r.name} (${r.elapsed}s)`)
    if (r.details) console.log(`      → ${r.details}`)
    if (r.error) console.log(`      ✗ ${r.error}`)
  })

  console.log(`\n  Finished at: ${new Date().toISOString()}`)
  
  // Exit with error code if any tests failed
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => {
  console.error('Unhandled error:', e)
  process.exit(2)
})
