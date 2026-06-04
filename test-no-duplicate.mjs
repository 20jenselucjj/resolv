// Test the specific scenario: updating a ticket should not duplicate the response
async function testNoDuplicateResponse() {
  console.log('\n=== Testing No Duplicate Response ===\n');
  
  // Login as admin
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'lucas.jensen@sgcityutah.gov', password: 'Password123!' })
  });
  const loginData = await loginRes.json();
  const token = loginData.data.token;
  
  // Create a session
  const sessionRes = await fetch('http://localhost:3001/api/ai/sessions', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ title: 'Test duplicate fix' })
  });
  const sessionData = await sessionRes.json();
  const sessionId = sessionData.data.id;
  console.log(`Created session: ${sessionId}`);
  
  // First, create a ticket
  console.log('\n1. Creating a ticket...');
  const createRes = await fetch('http://localhost:3001/api/ai/chat', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ 
      session_id: sessionId, 
      message: 'Create a ticket for testing duplicate responses and tell me the ticket number' 
    })
  });
  const createData = await createRes.json();
  console.log('Create response:', createData.data.content.substring(0, 200));
  
  // Extract ticket number from response
  const ticketMatch = createData.data.content.match(/#(\d+)/);
  if (!ticketMatch) {
    console.log('❌ Could not find ticket number in response');
    return;
  }
  const ticketNumber = ticketMatch[1];
  console.log(`✓ Created ticket #${ticketNumber}`);
  
  // Now ask to update the ticket title
  console.log(`\n2. Updating ticket #${ticketNumber} title...`);
  const updateRes = await fetch('http://localhost:3001/api/ai/chat', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ 
      session_id: sessionId, 
      message: `update ticket ${ticketNumber} with a better title` 
    })
  });
  const updateData = await updateRes.json();
  const response = updateData.data.content;
  
  console.log('\nUpdate response:');
  console.log(response);
  
  // Check for duplication
  const lines = response.split('\n').filter(l => l.trim());
  const uniqueLines = [...new Set(lines)];
  
  if (lines.length !== uniqueLines.length) {
    console.log('\n❌ DUPLICATE DETECTED!');
    console.log(`Total lines: ${lines.length}, Unique lines: ${uniqueLines.length}`);
    
    // Find duplicates
    const lineCounts = {};
    lines.forEach(line => {
      lineCounts[line] = (lineCounts[line] || 0) + 1;
    });
    console.log('\nDuplicate lines:');
    Object.entries(lineCounts)
      .filter(([_, count]) => count > 1)
      .forEach(([line, count]) => {
        console.log(`  [${count}x] ${line}`);
      });
  } else {
    console.log('\n✓ No duplicates detected!');
  }
  
  // Also check if the same sentence appears twice
  const sentences = response.match(/[^.!?]+[.!?]+/g) || [];
  const uniqueSentences = [...new Set(sentences)];
  
  if (sentences.length !== uniqueSentences.length) {
    console.log('\n❌ DUPLICATE SENTENCES DETECTED!');
    console.log(`Total sentences: ${sentences.length}, Unique sentences: ${uniqueSentences.length}`);
  } else {
    console.log('✓ No duplicate sentences!');
  }
}

testNoDuplicateResponse().catch(console.error);
