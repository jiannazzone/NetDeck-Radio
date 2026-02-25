import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Cache } from '../services/cache.js';

describe('Cache', () => {
  let cache;

  beforeEach(() => {
    cache = new Cache();
    vi.useFakeTimers();
  });

  it('returns data within TTL', () => {
    cache.set('key', { value: 42 }, 5000);
    expect(cache.get('key')).toEqual({ value: 42 });
  });

  it('returns null after TTL expires', () => {
    cache.set('key', { value: 42 }, 5000);
    vi.advanceTimersByTime(6000);
    expect(cache.get('key')).toBeNull();
  });

  it('returns null for non-existent key', () => {
    expect(cache.get('missing')).toBeNull();
  });

  it('getStale returns data even after TTL expires', () => {
    cache.set('key', { value: 42 }, 5000);
    vi.advanceTimersByTime(6000);
    expect(cache.get('key')).toBeNull();
    expect(cache.getStale('key')).toEqual({ value: 42 });
  });

  it('getStale returns null for non-existent key', () => {
    expect(cache.getStale('missing')).toBeNull();
  });

  it('getWithMeta returns age and stale flag', () => {
    cache.set('key', { value: 42 }, 5000);
    vi.advanceTimersByTime(3000);

    const meta = cache.getWithMeta('key');
    expect(meta.data).toEqual({ value: 42 });
    expect(meta.age).toBeGreaterThanOrEqual(3000);
    expect(meta.stale).toBe(false);
  });

  it('getWithMeta marks as stale after TTL', () => {
    cache.set('key', { value: 42 }, 5000);
    vi.advanceTimersByTime(6000);

    const meta = cache.getWithMeta('key');
    expect(meta.stale).toBe(true);
    expect(meta.data).toEqual({ value: 42 });
  });

  it('getWithMeta returns null for non-existent key', () => {
    expect(cache.getWithMeta('missing')).toBeNull();
  });

  it('delete removes entry', () => {
    cache.set('key', { value: 42 }, 5000);
    cache.delete('key');
    expect(cache.get('key')).toBeNull();
    expect(cache.getStale('key')).toBeNull();
  });

  it('has returns true within TTL', () => {
    cache.set('key', { value: 42 }, 5000);
    expect(cache.has('key')).toBe(true);
  });

  it('has returns false after TTL expires', () => {
    cache.set('key', { value: 42 }, 5000);
    vi.advanceTimersByTime(6000);
    expect(cache.has('key')).toBe(false);
  });

  it('has returns false for non-existent key', () => {
    expect(cache.has('missing')).toBe(false);
  });

  it('overwrites existing key', () => {
    cache.set('key', { value: 1 }, 5000);
    cache.set('key', { value: 2 }, 5000);
    expect(cache.get('key')).toEqual({ value: 2 });
  });
});
