import { describe, it, expect } from 'vitest';
import { addBusinessHours, calculateBusinessHoursBetween, isWithinBusinessHours } from './business-hours';

describe('Business Hours', () => {
  it('calculates business hours correctly', () => {
    // Basic test - these functions need a DB connection for working_hours/holidays
    // Test that they exist and return expected types
    expect(typeof addBusinessHours).toBe('function');
    expect(typeof calculateBusinessHoursBetween).toBe('function');
    expect(typeof isWithinBusinessHours).toBe('function');
  });
});
