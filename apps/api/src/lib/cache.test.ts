import { describe, it, expect, beforeEach } from 'vitest';
import { getCached, setCache, clearCache } from './cache';

describe('Cache', () => {
  beforeEach(() => {
    clearCache();
  });

  it('setCache stores a value', () => {
    setCache('test-key', { foo: 'bar' });
    expect(getCached('test-key')).toEqual({ foo: 'bar' });
  });

  it('getCached returns the value for a valid key', () => {
    setCache('my-key', 42);
    expect(getCached('my-key')).toBe(42);
  });

  it('getCached returns undefined for a non-existent key', () => {
    expect(getCached('does-not-exist')).toBeUndefined();
  });

  it('getCached returns undefined for an expired entry', async () => {
    // Use a TTL of 0 so the entry expires immediately
    setCache('ephemeral', 'gone', 0);
    // Give the event loop a tick so Date.now() advances past the expiry
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(getCached('ephemeral')).toBeUndefined();
  });

  it('clearCache without pattern clears all entries', () => {
    setCache('a', 1);
    setCache('b', 2);
    clearCache();
    expect(getCached('a')).toBeUndefined();
    expect(getCached('b')).toBeUndefined();
  });

  it('clearCache with pattern clears matching entries only', () => {
    setCache('users:1', 'alice');
    setCache('users:2', 'bob');
    setCache('config:theme', 'dark');
    clearCache('users');
    expect(getCached('users:1')).toBeUndefined();
    expect(getCached('users:2')).toBeUndefined();
    expect(getCached('config:theme')).toBe('dark');
  });
});
