import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatAge, formatDateTime, formatNetDuration } from '../utils/formatters.js';

describe('formatAge', () => {
  it('returns "unknown" for null', () => {
    expect(formatAge(null)).toBe('unknown');
  });

  it('returns "unknown" for undefined', () => {
    expect(formatAge(undefined)).toBe('unknown');
  });

  it('returns seconds for < 60s', () => {
    expect(formatAge(5000)).toBe('5s ago');
    expect(formatAge(0)).toBe('0s ago');
    expect(formatAge(59999)).toBe('59s ago');
  });

  it('returns minutes for >= 60s', () => {
    expect(formatAge(60000)).toBe('1m ago');
    expect(formatAge(120000)).toBe('2m ago');
    expect(formatAge(300000)).toBe('5m ago');
  });
});

describe('formatDateTime', () => {
  it('returns empty string for falsy input', () => {
    expect(formatDateTime('')).toBe('');
    expect(formatDateTime(null)).toBe('');
    expect(formatDateTime(undefined)).toBe('');
  });

  it('formats a valid date string', () => {
    const result = formatDateTime('2025-01-15 12:30');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns something for invalid date without crashing', () => {
    const result = formatDateTime('not-a-date');
    expect(typeof result).toBe('string');
  });
});

describe('formatNetDuration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T14:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty string for falsy input', () => {
    expect(formatNetDuration('')).toBe('');
    expect(formatNetDuration(null)).toBe('');
    expect(formatNetDuration(undefined)).toBe('');
  });

  it('returns minutes for < 60m', () => {
    expect(formatNetDuration('2025-06-15 13:15')).toBe('45m');
  });

  it('returns hours and minutes for >= 60m', () => {
    expect(formatNetDuration('2025-06-15 11:45')).toBe('2h 15m');
  });

  it('returns hours only when minutes are 0', () => {
    expect(formatNetDuration('2025-06-15 12:00')).toBe('2h');
  });

  it('returns empty string for future dates', () => {
    expect(formatNetDuration('2025-06-15 15:00')).toBe('');
  });
});
