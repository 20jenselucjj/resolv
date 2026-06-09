import { describe, it, expect } from 'vitest';

describe('categories route', () => {
  it('exports a default function', async () => {
    const mod = await import('./categories');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});
