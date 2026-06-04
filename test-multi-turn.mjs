// Test the multi-turn conversation scenario that failed
import { readFileSync } from 'fs'

const API_URL = 'http://localhost:3001/api'

async function login(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.data.token
}

async function createSession(token, persona) {
  const res = await fetch(`${API_URL}/ai/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ persona })
  })
  const data = await res.json()
  return data.data.id
}

async function sendMessage(token, sessionId, message) {
  const res = await fetch(`${API_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ session_id: sessionId, message })
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  const data = await res.json()
  return data.data
}

async function test() {
  console.log('Testing multi-turn conversation...\n')
  
  const token = await login('lisa.garcia@company.com', 'Password123!')
  if (!token) {
    console.log('Login failed')
    return
  }
  console.log('✓ Logged in\n')
  
  const sessionId = await createSession(token, 'portal')
  console.log(`✓ Created session: ${sessionId}\n`)
  
  // Step 1
  console.log('Step 1: "I have a problem"')
  const r1 = await sendMessage(token, sessionId, 'I have a problem')
  console.log(`  Response: ${r1.content.substring(0, 100)}...\n`)
  
  // Step 2 (this failed before)
  console.log('Step 2: "it\'s my printer"')
  const r2 = await sendMessage(token, sessionId, "it's my printer")
  console.log(`  Response: ${r2.content.substring(0, 100)}...\n`)
  
  // Step 3
  console.log('Step 3: "yes create a ticket"')
  const r3 = await sendMessage(token, sessionId, 'yes create a ticket')
  console.log(`  Response: ${r3.content.substring(0, 100)}...\n`)
  
  console.log('✓ Multi-turn conversation completed successfully!')
}

test().catch(err => {
  console.error('✗ Test failed:', err.message)
  process.exit(1)
})
