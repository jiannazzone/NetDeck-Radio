import { Router } from 'express';
import { cache } from '../services/cache.js';
import { fetchCheckins, fetchPastNets, fetchPastNetCheckins } from '../services/netlogger-client.js';
import { parsePastNets, parseCheckins } from '../services/xml-parser.js';
import { canMakeRequest } from '../utils/rate-limiter.js';
import { CACHE_TTL } from '../config.js';

export const apiRouter = Router();

apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

apiRouter.get('/nets', (req, res) => {
  const meta = cache.getWithMeta('active-nets');
  let nets = meta?.data || [];

  const search = req.query.search;
  if (search) {
    const lower = search.toLowerCase();
    nets = nets.filter((n) => n.netName.toLowerCase().includes(lower));
  }

  res.json({
    nets,
    age: meta?.age ?? null,
    stale: meta?.stale ?? true,
  });
});

apiRouter.get('/nets/:serverName/:netName/checkins', async (req, res) => {
  const { serverName, netName } = req.params;
  const cacheKey = `checkins:${serverName}:${netName}`;
  const meta = cache.getWithMeta(cacheKey);

  if (meta) {
    return res.json({
      ...meta.data,
      age: meta.age,
      stale: meta.stale,
    });
  }

  if (!canMakeRequest('GetCheckins')) {
    return res.json({ checkins: [], pointer: 0, count: 0, age: null, stale: true });
  }

  try {
    const xml = await fetchCheckins(serverName, netName);
    const data = parseCheckins(xml);
    cache.set(cacheKey, data, CACHE_TTL.checkins);
    res.json({ ...data, age: 0, stale: false });
  } catch (err) {
    console.error(`[API] Checkins fetch error for ${serverName}/${netName}:`, err.message);
    res.json({ checkins: [], pointer: 0, count: 0, age: null, stale: true });
  }
});

apiRouter.get('/past-nets', async (req, res) => {
  const interval = parseInt(req.query.interval, 10) || 7;
  const search = req.query.search || '';
  const cacheKey = 'past-nets';

  let nets = cache.get(cacheKey);

  if (!nets) {
    if (!canMakeRequest('GetPastNets')) {
      return res.status(429).json({ error: 'Rate limited' });
    }

    try {
      // Always fetch 7 days (the max UI interval) so shorter intervals
      // can be filtered from cache without additional API calls
      const xml = await fetchPastNets(7);
      nets = parsePastNets(xml);
      cache.set(cacheKey, nets, CACHE_TTL.pastNets);
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  // Filter by requested interval using closedAt date
  if (interval < 7) {
    const cutoff = new Date(Date.now() - interval * 24 * 60 * 60 * 1000);
    nets = nets.filter((n) => {
      if (!n.closedAt) return true;
      const closed = new Date(n.closedAt + ' UTC');
      return closed >= cutoff;
    });
  }

  if (search) {
    const lower = search.toLowerCase();
    nets = nets.filter((n) => n.netName.toLowerCase().includes(lower));
  }

  res.json({ nets });
});

apiRouter.get('/past-nets/:serverName/:netName/:netId/checkins', async (req, res) => {
  const { serverName, netName, netId } = req.params;
  const cacheKey = `past-checkins:${serverName}:${netName}:${netId}`;

  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  if (!canMakeRequest('GetPastNetCheckins')) {
    return res.status(429).json({ error: 'Rate limited' });
  }

  try {
    const xml = await fetchPastNetCheckins(serverName, netName, netId);
    const data = parseCheckins(xml);
    cache.set(cacheKey, data, CACHE_TTL.pastCheckins);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});
