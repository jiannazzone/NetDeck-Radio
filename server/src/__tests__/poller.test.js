import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies before importing Poller
vi.mock('../services/netlogger-client.js', () => ({
  fetchActiveNets: vi.fn(),
  fetchCheckins: vi.fn(),
}));

vi.mock('../services/xml-parser.js', () => ({
  parseActiveNets: vi.fn(() => [{ netName: 'TestNet', serverName: 'NETLOGGER' }]),
  parseCheckins: vi.fn(() => ({ checkins: [{ callsign: 'W1AW' }], pointer: 1, count: 1 })),
}));

vi.mock('../utils/rate-limiter.js', () => ({
  canMakeRequest: vi.fn(() => true),
}));

vi.mock('../services/cache.js', () => {
  const store = new Map();
  return {
    cache: {
      get: vi.fn((key) => store.get(key)?.data ?? null),
      getStale: vi.fn((key) => store.get(key)?.data ?? null),
      set: vi.fn((key, data, ttl) => store.set(key, { data, ttl })),
      _store: store,
    },
  };
});

const { fetchActiveNets, fetchCheckins } = await import('../services/netlogger-client.js');
const { canMakeRequest } = await import('../utils/rate-limiter.js');
const { cache } = await import('../services/cache.js');

const { Poller } = await import('../services/poller.js');

describe('Poller', () => {
  let poller;

  beforeEach(() => {
    vi.useFakeTimers();
    poller = new Poller();
    vi.clearAllMocks();
    cache._store.clear();
    fetchActiveNets.mockResolvedValue('<xml>nets</xml>');
    fetchCheckins.mockResolvedValue('<xml>checkins</xml>');
    canMakeRequest.mockReturnValue(true);
  });

  afterEach(() => {
    poller.stop();
    vi.useRealTimers();
  });

  describe('watcher lifecycle', () => {
    it('addWatcher creates a new watcher with refCount 1', () => {
      poller.addWatcher('NETLOGGER', 'TestNet');
      expect(poller.checkinWatchers.size).toBe(1);
      const watcher = poller.checkinWatchers.get('NETLOGGER:TestNet');
      expect(watcher.refCount).toBe(1);
    });

    it('addWatcher increments refCount for existing watcher', () => {
      poller.addWatcher('NETLOGGER', 'TestNet');
      poller.addWatcher('NETLOGGER', 'TestNet');
      const watcher = poller.checkinWatchers.get('NETLOGGER:TestNet');
      expect(watcher.refCount).toBe(2);
    });

    it('removeWatcher decrements refCount', () => {
      poller.addWatcher('NETLOGGER', 'TestNet');
      poller.addWatcher('NETLOGGER', 'TestNet');
      poller.removeWatcher('NETLOGGER', 'TestNet');
      const watcher = poller.checkinWatchers.get('NETLOGGER:TestNet');
      expect(watcher.refCount).toBe(1);
    });

    it('removeWatcher deletes watcher when refCount reaches 0', () => {
      poller.addWatcher('NETLOGGER', 'TestNet');
      poller.removeWatcher('NETLOGGER', 'TestNet');
      expect(poller.checkinWatchers.size).toBe(0);
    });

    it('removeWatcher is safe for non-existent watcher', () => {
      poller.removeWatcher('NETLOGGER', 'NoNet');
      expect(poller.checkinWatchers.size).toBe(0);
    });

    it('touchWatcher updates lastSeen', () => {
      poller.addWatcher('NETLOGGER', 'TestNet');
      const before = poller.checkinWatchers.get('NETLOGGER:TestNet').lastSeen;
      vi.advanceTimersByTime(5000);
      poller.touchWatcher('NETLOGGER', 'TestNet');
      const after = poller.checkinWatchers.get('NETLOGGER:TestNet').lastSeen;
      expect(after).toBeGreaterThan(before);
    });
  });

  describe('pollNextCheckin', () => {
    it('does nothing with no watchers', () => {
      poller.pollNextCheckin();
      expect(fetchCheckins).not.toHaveBeenCalled();
    });

    it('picks the watcher with oldest lastPolled', () => {
      poller.addWatcher('NETLOGGER', 'Net1');
      poller.addWatcher('NETLOGGER', 'Net2');
      // Both start with lastPolled=0, but we can set one to be more recent
      poller.checkinWatchers.get('NETLOGGER:Net1').lastPolled = Date.now();
      cache.set('checkins:NETLOGGER:Net1', { checkins: [] }, 20000);

      poller.pollNextCheckin();
      // Net2 has lastPolled=0 and no cache, so it should be picked
      expect(fetchCheckins).toHaveBeenCalledWith('NETLOGGER', 'Net2');
    });

    it('cleans up stale watchers', () => {
      poller.addWatcher('NETLOGGER', 'StaleNet');
      vi.advanceTimersByTime(130_000); // Past 2min timeout
      poller.pollNextCheckin();
      expect(poller.checkinWatchers.size).toBe(0);
    });
  });

  describe('pollActiveNets', () => {
    it('emits nets event on new data', async () => {
      const handler = vi.fn();
      poller.on('nets', handler);
      await poller.pollActiveNets();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('skips emit when XML unchanged', async () => {
      const handler = vi.fn();
      poller.on('nets', handler);
      await poller.pollActiveNets();
      await poller.pollActiveNets();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('skips when rate limited', async () => {
      canMakeRequest.mockReturnValue(false);
      await poller.pollActiveNets();
      expect(fetchActiveNets).not.toHaveBeenCalled();
    });
  });
});
