/**
 * Realistic AI Test Suite — How real people actually talk
 * Tests natural language variations, edge cases, multi-turn flows, and boundary conditions
 */

const API = 'http://localhost:3001/api'

async function login(email, password) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`Login failed: ${j.error}`)
  return j.data
}

async function apiPost(path, token, body) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body)
  })
  return { status: r.status, data: await r.json() }
}

async function createSession(token) {
  const r = await apiPost('/ai/sessions', token, {})
  return r.data.data.id
}

async function chat(token, sessionId, message) {
  const r = await apiPost('/ai/chat', token, { session_id: sessionId, message })
  return {
    status: r.status,
    content: r.data.data?.content || '',
    tools: r.data.data?.tool_calls?.map(t => t.function?.name) || [],
    rag: r.data.data?.rag
  }
}

const results = []

async function test(category, name, fn) {
  const start = Date.now()
  try {
    const result = await fn()
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    results.push({ category, name, status: 'PASS', elapsed, details: result })
    console.log(`  ✓ [${category}] ${name} (${elapsed}s)`)
  } catch (e) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    results.push({ category, name, status: 'FAIL', elapsed, error: e.message })
    console.log(`  ✗ [${category}] ${name} (${elapsed}s) — ${e.message}`)
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg)
}

// ── Agent AI Realistic Tests ─────────────────────────────────────────────────

async function runAgentRealisticTests() {
  console.log('\n═══════════════════════════════════════════════')
  console.log('  AGENT AI — REALISTIC USER SCENARIOS')
  console.log('═══════════════════════════════════════════════')

  const admin = await login('lucas.jensen@sgcityutah.gov', 'Password123!')
  const token = admin.token
  let sessionId

  await test('Setup', 'Create session', async () => {
    sessionId = await createSession(token)
    return `Session: ${sessionId}`
  })

  // ── Vague/Ambiguous Requests ───────────────────────────────────────────
  await test('Vague', '"help"', async () => {
    const r = await chat(token, sessionId, 'help')
    assert(r.status === 200, `HTTP ${r.status}`)
    assert(r.content.length > 10, 'Response too short')
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Vague', '"my computer is slow"', async () => {
    const r = await chat(token, sessionId, 'my computer is slow')
    assert(r.status === 200, `HTTP ${r.status}`)
    // Should either troubleshoot or offer to create a ticket
    return `Tools: [${r.tools.join(', ')}] | Response: ${r.content.substring(0, 100)}...`
  })

  await test('Vague', '"nothing works"', async () => {
    const r = await chat(token, sessionId, 'nothing works')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Vague', '"I have a problem"', async () => {
    const r = await chat(token, sessionId, 'I have a problem')
    assert(r.status === 200, `HTTP ${r.status}`)
    // Should ask clarifying questions
    return `Response: ${r.content.substring(0, 100)}...`
  })

  // ── Urgent/Emotional Requests ──────────────────────────────────────────
  await test('Urgent', '"I CAN\'T WORK HELP"', async () => {
    const r = await chat(token, sessionId, 'I CAN\'T WORK HELP')
    assert(r.status === 200, `HTTP ${r.status}`)
    // Should recognize urgency
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Urgent', '"this is urgent!!! please help"', async () => {
    const r = await chat(token, sessionId, 'this is urgent!!! please help')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Urgent', '"EVERYTHING IS BROKEN"', async () => {
    const r = await chat(token, sessionId, 'EVERYTHING IS BROKEN')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  // ── Ticket References (Weird Formats) ──────────────────────────────────
  await test('Ticket Ref', '"42" (just a number)', async () => {
    const r = await chat(token, sessionId, '42')
    assert(r.status === 200, `HTTP ${r.status}`)
    // Should recognize this as a ticket number
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Ticket Ref', '"that thing from yesterday"', async () => {
    const r = await chat(token, sessionId, 'that thing from yesterday')
    assert(r.status === 200, `HTTP ${r.status}`)
    // Should ask for clarification
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Ticket Ref', '"the ticket you made"', async () => {
    const r = await chat(token, sessionId, 'the ticket you made')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  // ── Multi-Part Requests ────────────────────────────────────────────────
  await test('Multi', '"check ticket 5 and create a new one"', async () => {
    const r = await chat(token, sessionId, 'check ticket 5 and also create a new ticket for my printer being broken')
    assert(r.status === 200, `HTTP ${r.status}`)
    // Should handle both requests
    return `Tools: [${r.tools.join(', ')}] | Response: ${r.content.substring(0, 100)}...`
  })

  await test('Multi', '"show my tickets and stats"', async () => {
    const r = await chat(token, sessionId, 'show my tickets and also give me stats')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Tools: [${r.tools.join(', ')}] | Response: ${r.content.substring(0, 100)}...`
  })

  // ── Non-IT Questions (Should Decline) ──────────────────────────────────
  await test('Off-Topic', '"what\'s the weather"', async () => {
    const r = await chat(token, sessionId, 'what\'s the weather like today?')
    assert(r.status === 200, `HTTP ${r.status}`)
    // Should politely decline or redirect to IT
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Off-Topic', '"who\'s the president"', async () => {
    const r = await chat(token, sessionId, 'who\'s the president?')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Off-Topic', '"tell me a joke"', async () => {
    const r = await chat(token, sessionId, 'tell me a joke')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  // ── Typo-Heavy Messages ────────────────────────────────────────────────
  await test('Typos', '"my wfi is not workin"', async () => {
    const r = await chat(token, sessionId, 'my wfi is not workin')
    assert(r.status === 200, `HTTP ${r.status}`)
    // Should understand "wifi" from "wfi"
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Typos', '"computr slow pls help"', async () => {
    const r = await chat(token, sessionId, 'computr slow pls help')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  // ── Indirect/Polite Requests ───────────────────────────────────────────
  await test('Indirect', '"can you help me with something?"', async () => {
    const r = await chat(token, sessionId, 'can you help me with something?')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Indirect', '"I have a question"', async () => {
    const r = await chat(token, sessionId, 'I have a question')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  // ── Tool Selection Accuracy ────────────────────────────────────────────
  await test('Tool Select', '"how many tickets are breached?" (should use get_stats)', async () => {
    const r = await chat(token, sessionId, 'how many tickets are breached?')
    assert(r.status === 200, `HTTP ${r.status}`)
    // Should call get_stats, not search_tickets
    const hasStats = r.tools.includes('get_stats')
    return `Tools: [${r.tools.join(', ')}] | get_stats called: ${hasStats}`
  })

  await test('Tool Select', '"find john smith" (should use search_users)', async () => {
    const r = await chat(token, sessionId, 'find john smith')
    assert(r.status === 200, `HTTP ${r.status}`)
    const hasUsers = r.tools.includes('search_users')
    return `Tools: [${r.tools.join(', ')}] | search_users called: ${hasUsers}`
  })

  await test('Tool Select', '"what\'s on my plate?" (should use get_my_tickets)', async () => {
    const r = await chat(token, sessionId, 'what\'s on my plate?')
    assert(r.status === 200, `HTTP ${r.status}`)
    const hasMyTickets = r.tools.includes('get_my_tickets')
    return `Tools: [${r.tools.join(', ')}] | get_my_tickets called: ${hasMyTickets}`
  })

  // ── Edge Cases ─────────────────────────────────────────────────────────
  await test('Edge', 'Very long message (500+ chars)', async () => {
    const longMsg = 'I have a problem. '.repeat(30) + 'It\'s really bad.'
    const r = await chat(token, sessionId, longMsg)
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Edge', 'Message with special characters: @#$%^&*()', async () => {
    const r = await chat(token, sessionId, 'my computer @#$% is broken!!!')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Edge', 'Message in all caps', async () => {
    const r = await chat(token, sessionId, 'MY PRINTER IS NOT WORKING')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Edge', 'Message with numbers only: "12345"', async () => {
    const r = await chat(token, sessionId, '12345')
    assert(r.status === 200, `HTTP ${r.status}`)
    // Should treat as ticket number
    return `Response: ${r.content.substring(0, 100)}...`
  })

  // ── Hallucination Resistance ───────────────────────────────────────────
  await test('Hallucination', '"what\'s in ticket 999999?" (non-existent)', async () => {
    const r = await chat(token, sessionId, 'what\'s in ticket 999999?')
    assert(r.status === 200, `HTTP ${r.status}`)
    // Should say "not found", not fabricate details
    const hasNotFound = /not found|doesn't exist|no ticket/i.test(r.content)
    return `Says not found: ${hasNotFound} | Response: ${r.content.substring(0, 100)}...`
  })

  await test('Hallucination', '"who\'s assigned to ticket 1?" (may not exist)', async () => {
    const r = await chat(token, sessionId, 'who\'s assigned to ticket 1?')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  // ── Agent-Specific Capabilities ────────────────────────────────────────
  await test('Agent', '"assign ticket 10 to sarah chen"', async () => {
    const r = await chat(token, sessionId, 'assign ticket 10 to sarah chen')
    assert(r.status === 200, `HTTP ${r.status}`)
    // Should use update_ticket with assigned_to_name
    const hasUpdate = r.tools.includes('update_ticket')
    return `Tools: [${r.tools.join(', ')}] | update_ticket called: ${hasUpdate}`
  })

  await test('Agent', '"create a ticket for david.smith@company.com"', async () => {
    const r = await chat(token, sessionId, 'create a ticket for david.smith@company.com about his broken laptop')
    assert(r.status === 200, `HTTP ${r.status}`)
    // Should use search_users first, then create_ticket
    return `Tools: [${r.tools.join(', ')}] | Response: ${r.content.substring(0, 100)}...`
  })

  await test('Agent', '"show me all tickets assigned to me"', async () => {
    const r = await chat(token, sessionId, 'show me all tickets assigned to me')
    assert(r.status === 200, `HTTP ${r.status}`)
    // Should use search_tickets with appropriate filter
    return `Tools: [${r.tools.join(', ')}] | Response: ${r.content.substring(0, 100)}...`
  })

  return token
}

// ── Portal AI Realistic Tests ────────────────────────────────────────────────

async function runPortalRealisticTests() {
  console.log('\n═══════════════════════════════════════════════')
  console.log('  PORTAL AI — REALISTIC USER SCENARIOS')
  console.log('═══════════════════════════════════════════════')

  const user = await login('lisa.garcia@company.com', 'Password123!')
  const token = user.token
  let sessionId

  await test('Setup', 'Create session', async () => {
    sessionId = await createSession(token)
    return `Session: ${sessionId}`
  })

  // ── Vague Portal Requests ──────────────────────────────────────────────
  await test('Vague', '"I need help"', async () => {
    const r = await chat(token, sessionId, 'I need help')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Vague', '"something\'s wrong with my computer"', async () => {
    const r = await chat(token, sessionId, 'something\'s wrong with my computer')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Vague', '"it\'s not working"', async () => {
    const r = await chat(token, sessionId, 'it\'s not working')
    assert(r.status === 200, `HTTP ${r.status}`)
    // Should ask what "it" is
    return `Response: ${r.content.substring(0, 100)}...`
  })

  // ── Portal Users Don't Know Ticket Numbers ─────────────────────────────
  await test('No Ticket#', '"check my ticket" (no number)', async () => {
    const r = await chat(token, sessionId, 'check my ticket')
    assert(r.status === 200, `HTTP ${r.status}`)
    // Should ask for ticket number or show their tickets
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('No Ticket#', '"what\'s the status of my thing?"', async () => {
    const r = await chat(token, sessionId, 'what\'s the status of my thing?')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  // ── Common IT Problems (Portal) ────────────────────────────────────────
  await test('Common', '"I forgot my password"', async () => {
    const r = await chat(token, sessionId, 'I forgot my password')
    assert(r.status === 200, `HTTP ${r.status}`)
    // Should provide self-help or offer to create ticket
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Common', '"my email isn\'t working"', async () => {
    const r = await chat(token, sessionId, 'my email isn\'t working')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Common', '"I can\'t connect to the internet"', async () => {
    const r = await chat(token, sessionId, 'I can\'t connect to the internet')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Common', '"my printer won\'t print"', async () => {
    const r = await chat(token, sessionId, 'my printer won\'t print')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  // ── Portal Users Requesting Things ─────────────────────────────────────
  await test('Request', '"I need a new monitor"', async () => {
    const r = await chat(token, sessionId, 'I need a new monitor')
    assert(r.status === 200, `HTTP ${r.status}`)
    // Should offer to create a ticket
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Request', '"can I get photoshop?"', async () => {
    const r = await chat(token, sessionId, 'can I get photoshop?')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Request', '"I need access to the shared drive"', async () => {
    const r = await chat(token, sessionId, 'I need access to the shared drive')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  // ── Portal Boundary Enforcement ────────────────────────────────────────
  await test('Boundary', '"show me all tickets" (should only show own)', async () => {
    const r = await chat(token, sessionId, 'show me all tickets')
    assert(r.status === 200, `HTTP ${r.status}`)
    // Should only show user's own tickets, not all tickets
    return `Tools: [${r.tools.join(', ')}] | Response: ${r.content.substring(0, 100)}...`
  })

  await test('Boundary', '"create a ticket for john.doe@company.com" (portal can\'t)', async () => {
    const r = await chat(token, sessionId, 'create a ticket for john.doe@company.com')
    assert(r.status === 200, `HTTP ${r.status}`)
    // Portal users can only create tickets for themselves
    return `Response: ${r.content.substring(0, 100)}...`
  })

  // ── Portal RAG/Knowledge Base ──────────────────────────────────────────
  await test('RAG', '"how do I reset my password?" (should find KB)', async () => {
    const r = await chat(token, sessionId, 'how do I reset my password?')
    assert(r.status === 200, `HTTP ${r.status}`)
    const hasRAG = r.rag !== null
    return `RAG used: ${hasRAG} | Response: ${r.content.substring(0, 100)}...`
  })

  await test('RAG', '"wifi password?" (should find KB)', async () => {
    const r = await chat(token, sessionId, 'wifi password?')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `RAG used: ${r.rag !== null} | Response: ${r.content.substring(0, 100)}...`
  })

  // ── Portal Emotional/Urgent ────────────────────────────────────────────
  await test('Urgent', '"HELP I CAN\'T ACCESS ANYTHING"', async () => {
    const r = await chat(token, sessionId, 'HELP I CAN\'T ACCESS ANYTHING')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Urgent', '"this is really urgent please help"', async () => {
    const r = await chat(token, sessionId, 'this is really urgent please help')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  // ── Portal Typos ───────────────────────────────────────────────────────
  await test('Typos', '"my computr is brokn"', async () => {
    const r = await chat(token, sessionId, 'my computr is brokn')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Typos', '"intrnet not workin"', async () => {
    const r = await chat(token, sessionId, 'intrnet not workin')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  // ── Portal Multi-Turn ──────────────────────────────────────────────────
  await test('Multi-Turn', 'Step 1: "I have a problem"', async () => {
    const r = await chat(token, sessionId, 'I have a problem')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Multi-Turn', 'Step 2: "it\'s my printer"', async () => {
    const r = await chat(token, sessionId, 'it\'s my printer')
    assert(r.status === 200, `HTTP ${r.status}`)
    return `Response: ${r.content.substring(0, 100)}...`
  })

  await test('Multi-Turn', 'Step 3: "yes create a ticket"', async () => {
    const r = await chat(token, sessionId, 'yes create a ticket')
    assert(r.status === 200, `HTTP ${r.status}`)
    const hasCreate = r.tools.includes('create_ticket')
    return `Tools: [${r.tools.join(', ')}] | create_ticket called: ${hasCreate}`
  })

  return token
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════╗')
  console.log('║   REALISTIC AI TEST SUITE — NATURAL LANGUAGE ║')
  console.log('╚═══════════════════════════════════════════════╝')
  console.log(`  Started at: ${new Date().toISOString()}`)

  try {
    await runAgentRealisticTests()
  } catch (e) {
    console.error(`\nFATAL: Agent tests aborted: ${e.message}`)
  }

  try {
    await runPortalRealisticTests()
  } catch (e) {
    console.error(`\nFATAL: Portal tests aborted: ${e.message}`)
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

  // Group by category
  const categories = [...new Set(results.map(r => r.category))]
  console.log('\n  BY CATEGORY:')
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat)
    const catPassed = catResults.filter(r => r.status === 'PASS').length
    console.log(`    ${cat}: ${catPassed}/${catResults.length} passed`)
  }

  if (failed > 0) {
    console.log('\n  FAILED TESTS:')
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    ✗ [${r.category}] ${r.name}`)
      console.log(`      Error: ${r.error}`)
    })
  }

  console.log(`\n  Finished at: ${new Date().toISOString()}`)
  
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => {
  console.error('Unhandled error:', e)
  process.exit(2)
})
