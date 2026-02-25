import { describe, it, expect } from 'vitest';
import { parseStatus } from '../utils/status-parser.js';

describe('parseStatus', () => {
  it('returns regular/Checked In for empty input', () => {
    expect(parseStatus('')).toEqual({ type: 'regular', label: 'Checked In', extra: '' });
  });

  it('returns regular/Checked In for null input', () => {
    expect(parseStatus(null)).toEqual({ type: 'regular', label: 'Checked In', extra: '' });
  });

  it('returns regular/Checked In for undefined input', () => {
    expect(parseStatus(undefined)).toEqual({ type: 'regular', label: 'Checked In', extra: '' });
  });

  it('returns regular/Checked In for whitespace-only input', () => {
    expect(parseStatus('   ')).toEqual({ type: 'regular', label: 'Checked In', extra: '' });
  });

  it.each([
    ['(nc)', 'net-control', 'Net Control'],
    ['(log)', 'logger', 'Logger'],
    ['(rel)', 'relayed', 'Relayed'],
    ['(vip)', 'vip', 'VIP'],
    ['(c/o)', 'checked-out', 'Checked Out'],
    ['(n/h)', 'not-heard', 'Not Heard'],
    ['(u)', 'short-time', 'Short Time'],
    ['(n/r)', 'no-response', 'No Response'],
  ])('parses %s as %s / %s', (code, type, label) => {
    const result = parseStatus(code);
    expect(result.type).toBe(type);
    expect(result.label).toBe(label);
    expect(result.extra).toBe('');
  });

  it('handles mixed case input', () => {
    const result = parseStatus('(NC)');
    expect(result.type).toBe('net-control');
    expect(result.label).toBe('Net Control');
  });

  it('handles uppercase codes', () => {
    const result = parseStatus('(VIP)');
    expect(result.type).toBe('vip');
    expect(result.label).toBe('VIP');
  });

  it('extracts extra text after status code', () => {
    const result = parseStatus('(nc) some note');
    expect(result.type).toBe('net-control');
    expect(result.label).toBe('Net Control');
    expect(result.extra).toBe('some note');
  });

  it('extracts extra text before status code', () => {
    const result = parseStatus('hello (log)');
    expect(result.type).toBe('logger');
    expect(result.extra).toBe('hello');
  });

  it('returns regular with raw text as extra for unknown codes', () => {
    const result = parseStatus('some random text');
    expect(result.type).toBe('regular');
    expect(result.label).toBe('Checked In');
    expect(result.extra).toBe('some random text');
  });

  it('returns regular with extra for unknown parenthetical codes', () => {
    const result = parseStatus('(xyz)');
    expect(result.type).toBe('regular');
    expect(result.label).toBe('Checked In');
  });
});
