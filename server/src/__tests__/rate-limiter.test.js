import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('canMakeRequest (rate limiter)', () => {
  let canMakeRequest;

  beforeEach(async () => {
    vi.useFakeTimers();
    // Re-import fresh module each test to reset bucket state
    vi.resetModules();
    const mod = await import('../utils/rate-limiter.js');
    canMakeRequest = mod.canMakeRequest;
  });

  it('allows first call within limit', () => {
    expect(canMakeRequest('GetActiveNets')).toBe(true);
  });

  it('blocks when max calls exceeded', () => {
    // GetActiveNets has max: 1
    expect(canMakeRequest('GetActiveNets')).toBe(true);
    expect(canMakeRequest('GetActiveNets')).toBe(false);
  });

  it('allows calls again after window passes', () => {
    expect(canMakeRequest('GetActiveNets')).toBe(true);
    expect(canMakeRequest('GetActiveNets')).toBe(false);

    // Advance past the window (60s for GetActiveNets)
    vi.advanceTimersByTime(60_000);

    expect(canMakeRequest('GetActiveNets')).toBe(true);
  });

  it('allows up to max calls for endpoints with higher limits', () => {
    // GetCheckins has max: 3
    expect(canMakeRequest('GetCheckins')).toBe(true);
    expect(canMakeRequest('GetCheckins')).toBe(true);
    expect(canMakeRequest('GetCheckins')).toBe(true);
    expect(canMakeRequest('GetCheckins')).toBe(false);
  });

  it('returns true for unknown endpoints (no limit)', () => {
    expect(canMakeRequest('UnknownEndpoint')).toBe(true);
    expect(canMakeRequest('UnknownEndpoint')).toBe(true);
  });

  it('refills tokens proportionally over time', () => {
    // GetCheckins: max 3 per 60s window
    expect(canMakeRequest('GetCheckins')).toBe(true);
    expect(canMakeRequest('GetCheckins')).toBe(true);
    expect(canMakeRequest('GetCheckins')).toBe(true);
    expect(canMakeRequest('GetCheckins')).toBe(false);

    // Advance 20s = 1/3 of window, should refill 1 token
    vi.advanceTimersByTime(20_000);
    expect(canMakeRequest('GetCheckins')).toBe(true);
    expect(canMakeRequest('GetCheckins')).toBe(false);
  });
});
