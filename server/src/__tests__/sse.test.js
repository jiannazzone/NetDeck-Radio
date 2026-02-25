import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import express from 'express';
import { createServer } from 'node:http';

const mockPoller = new EventEmitter();
mockPoller.addWatcher = vi.fn();
mockPoller.removeWatcher = vi.fn();
mockPoller.touchWatcher = vi.fn();

vi.mock('../services/poller.js', () => ({
  poller: mockPoller,
}));

vi.mock('../services/cache.js', () => ({
  cache: {
    get: vi.fn(() => null),
    getStale: vi.fn(() => null),
    getWithMeta: vi.fn(() => null),
    set: vi.fn(),
  },
}));

const { sseRouter } = await import('../routes/sse.js');

function makeApp() {
  const app = express();
  app.use('/api/events', sseRouter);
  return app;
}

function request(app, path) {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      fetch(`http://localhost:${port}${path}`)
        .then(async (res) => {
          const body = res.headers.get('content-type')?.includes('json')
            ? await res.json()
            : await res.text();
          server.close();
          resolve({ status: res.status, body, headers: res.headers });
        })
        .catch((err) => {
          server.close();
          reject(err);
        });
    });
  });
}

describe('SSE subscribe validation', () => {
  it('returns 400 when subscribe param is missing', async () => {
    const app = makeApp();
    const res = await request(app, '/api/events');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/subscribe/);
  });

  it('returns 400 when subscribe param is invalid', async () => {
    const app = makeApp();
    const res = await request(app, '/api/events?subscribe=invalid');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/subscribe/);
  });

  it('returns 400 when checkins subscribe is missing serverName', async () => {
    const app = makeApp();
    const res = await request(app, '/api/events?subscribe=checkins&netName=MyNet');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/serverName/);
  });

  it('returns 400 when checkins subscribe is missing netName', async () => {
    const app = makeApp();
    const res = await request(app, '/api/events?subscribe=checkins&serverName=NETLOGGER');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/netName/);
  });
});
