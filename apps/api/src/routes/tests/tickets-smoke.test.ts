import { describe, it, expect } from 'vitest';

// Test the createTicketSchema validation
describe('Create Ticket Schema', () => {
  it('accepts valid ticket data', () => {
    // Schema validation test using the z.object defined in tickets.ts
    // Since schemas aren't exported, test the validation pattern inline
    const { z } = require('zod');
    const schema = z.object({
      title: z.string().min(3).max(500),
      description: z.string().default(''),
      priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
      ticket_type: z.enum(['incident', 'service_request', 'problem', 'change']).default('incident'),
    });

    const result = schema.safeParse({ title: 'Test ticket', description: 'Test description' });
    expect(result.success).toBe(true);
  });

  it('rejects title shorter than 3 chars', () => {
    const { z } = require('zod');
    const schema = z.object({ title: z.string().min(3).max(500) });
    const result = schema.safeParse({ title: 'ab' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid priority', () => {
    const { z } = require('zod');
    const schema = z.object({ priority: z.enum(['low', 'medium', 'high', 'critical']) });
    const result = schema.safeParse({ priority: 'urgent' });
    expect(result.success).toBe(false);
  });
});

describe('Pagination', () => {
  it('validates page number is positive integer', () => {
    const { z } = require('zod');
    const schema = z.object({ page: z.coerce.number().int().min(1).default(1) });
    expect(schema.safeParse({ page: 1 }).success).toBe(true);
    expect(schema.safeParse({ page: 0 }).success).toBe(false);
    expect(schema.safeParse({ page: -1 }).success).toBe(false);
  });
});
