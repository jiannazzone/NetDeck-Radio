import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/cache.js', () => {
  const store = new Map();
  return {
    cache: {
      get: vi.fn((key) => {
        const entry = store.get(key);
        if (!entry) return null;
        if (Date.now() - entry.ts > entry.ttl) return null;
        return entry.data;
      }),
      getStale: vi.fn((key) => store.get(key)?.data ?? null),
      getWithMeta: vi.fn((key) => {
        const entry = store.get(key);
        if (!entry) return null;
        const age = Date.now() - entry.ts;
        return { data: entry.data, age, stale: age > entry.ttl };
      }),
      set: vi.fn((key, data, ttl) => store.set(key, { data, ts: Date.now(), ttl })),
      _store: store,
    },
  };
});

vi.mock('../utils/rate-limiter.js', () => ({
  canMakeRequest: vi.fn(() => true),
}));

vi.mock('../services/netlogger-client.js', () => ({
  fetchCheckins: vi.fn(),
  fetchPastNets: vi.fn(),
  fetchPastNetCheckins: vi.fn(),
}));

vi.mock('../services/xml-parser.js', () => ({
  parseCheckins: vi.fn(() => ({
    checkins: [{ serialNo: 1, callsign: 'W1AW' }],
    pointer: 1,
    count: 1,
  })),
  parsePastNets: vi.fn(() => [
    { netName: 'TestNet', serverName: 'NETLOGGER', netId: '1', closedAt: '2025-06-15 12:00' },
  ]),
}));

const { cache } = await import('../services/cache.js');
const { canMakeRequest } = await import('../utils/rate-limiter.js');
const { fetchCheckins, fetchPastNets } = await import('../services/netlogger-client.js');
const { apiRouter } = await import('../routes/api.js');

import express from 'express';
import { createServer } from 'node:http';

function makeApp() {
  const app = express();
  app.use('/api', apiRouter);
  return app;
}

function request(app, path) {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      fetch(`http://localhost:${port}${path}`)
        .then(async (res) => {
          const body = await res.json();
          server.close();
          resolve({ status: res.status, body });
        })
        .catch((err) => {
          server.close();
          reject(err);
        });
    });
  });
}

describe('API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache._store.clear();
    canMakeRequest.mockReturnValue(true);
    fetchCheckins.mockResolvedValue('<xml/>');
    fetchPastNets.mockResolvedValue('<xml/>');
  });

  describe('GET /api/health', () => {
    it('returns ok', async () => {
      const res = await request(makeApp(), '/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('GET /api/nets', () => {
    it('returns empty array when cache is empty', async () => {
      const res = await request(makeApp(), '/api/nets');
      expect(res.status).toBe(200);
      expect(res.body.nets).toEqual([]);
    });

    it('returns cached nets', async () => {
      cache.set('active-nets', [{ netName: 'MyNet' }], 60000);
      const res = await request(makeApp(), '/api/nets');
      expect(res.body.nets).toHaveLength(1);
      expect(res.body.nets[0].netName).toBe('MyNet');
    });

    it('filters by search param', async () => {
      cache.set('active-nets', [{ netName: 'Alpha' }, { netName: 'Beta' }], 60000);
      const res = await request(makeApp(), '/api/nets?search=alpha');
      expect(res.body.nets).toHaveLength(1);
      expect(res.body.nets[0].netName).toBe('Alpha');
    });
  });

  describe('GET /api/nets/:serverName/:netName/checkins', () => {
    it('returns cached checkins', async () => {
      cache.set('checkins:NETLOGGER:MyNet', { checkins: [{ callsign: 'K1ABC' }], pointer: 0, count: 1 }, 20000);
      const res = await request(makeApp(), '/api/nets/NETLOGGER/MyNet/checkins');
      expect(res.body.checkins[0].callsign).toBe('K1ABC');
    });

    it('fetches on-demand when cache is empty', async () => {
      fetchCheckins.mockResolvedValue('<xml/>');
      const res = await request(makeApp(), '/api/nets/NETLOGGER/MyNet/checkins');
      expect(fetchCheckins).toHaveBeenCalledWith('NETLOGGER', 'MyNet');
      expect(res.status).toBe(200);
    });

    it('serves stale data when rate limited', async () => {
      cache.set('checkins:NETLOGGER:MyNet', { checkins: [{ callsign: 'STALE' }], pointer: 0, count: 1 }, 1);
      // Expire the cache entry
      const entry = cache._store.get('checkins:NETLOGGER:MyNet');
      entry.ts -= 10000;
      canMakeRequest.mockReturnValue(false);
      const res = await request(makeApp(), '/api/nets/NETLOGGER/MyNet/checkins');
      expect(res.body.stale).toBe(true);
    });
  });

  describe('GET /api/past-nets', () => {
    it('fetches and returns past nets', async () => {
      fetchPastNets.mockResolvedValue('<xml/>');
      const res = await request(makeApp(), '/api/past-nets');
      expect(res.status).toBe(200);
      expect(res.body.nets).toBeDefined();
    });

    it('returns 429 when rate limited and no cache', async () => {
      canMakeRequest.mockReturnValue(false);
      const res = await request(makeApp(), '/api/past-nets');
      expect(res.status).toBe(429);
    });
  });
});
