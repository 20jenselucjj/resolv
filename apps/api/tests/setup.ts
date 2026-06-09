// Shared test utilities
export function createMockUser(overrides: Partial<any> = {}) {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'admin',
    ...overrides,
  };
}

export function createMockTicket(overrides: Partial<any> = {}) {
  return {
    id: 'test-ticket-id',
    number: 1,
    title: 'Test Ticket',
    description: 'Test description',
    status: 'open',
    priority: 'medium',
    ticket_type: 'incident',
    created_by_id: 'test-user-id',
    ...overrides,
  };
}
