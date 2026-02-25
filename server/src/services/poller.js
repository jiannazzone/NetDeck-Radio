import { EventEmitter } from 'node:events';
import { POLL_INTERVALS, CACHE_TTL } from '../config.js';
import { fetchActiveNets, fetchCheckins } from './netlogger-client.js';
import { parseActiveNets, parseCheckins } from './xml-parser.js';
import { cache } from './cache.js';
import { canMakeRequest } from '../utils/rate-limiter.js';

class Poller extends EventEmitter {
  constructor() {
    super();
    this.activeNetsTimer = null;
    this.checkinWatchers = new Map(); // key -> { refCount, timer }
  }

  start() {
    this.pollActiveNets();
    this.activeNetsTimer = setInterval(
      () => this.pollActiveNets(),
      POLL_INTERVALS.activeNets,
    );
    console.log('[Poller] Started active nets polling');
  }

  stop() {
    if (this.activeNetsTimer) {
      clearInterval(this.activeNetsTimer);
      this.activeNetsTimer = null;
    }
    for (const [key, watcher] of this.checkinWatchers) {
      clearInterval(watcher.timer);
    }
    this.checkinWatchers.clear();
  }

  async pollActiveNets() {
    if (!canMakeRequest('GetActiveNets')) {
      console.warn('[Poller] Rate limited: GetActiveNets');
      return;
    }

    try {
      const xml = await fetchActiveNets();
      const nets = parseActiveNets(xml);
      cache.set('active-nets', nets, CACHE_TTL.activeNets);
      this.emit('nets', nets);
    } catch (err) {
      console.error('[Poller] Failed to poll active nets:', err.message);
    }
  }

  async pollCheckins(serverName, netName) {
    if (!canMakeRequest('GetCheckins')) {
      console.warn('[Poller] Rate limited: GetCheckins');
      return;
    }

    const cacheKey = `checkins:${serverName}:${netName}`;
    try {
      const xml = await fetchCheckins(serverName, netName);
      const data = parseCheckins(xml);
      cache.set(cacheKey, data, CACHE_TTL.checkins);
      this.emit(`checkins:${serverName}:${netName}`, data);
    } catch (err) {
      console.error(`[Poller] Failed to poll checkins for ${netName}:`, err.message);
    }
  }

  addWatcher(serverName, netName) {
    const key = `${serverName}:${netName}`;
    const existing = this.checkinWatchers.get(key);

    if (existing) {
      existing.refCount++;
      console.log(`[Poller] Watcher added for ${key} (refCount: ${existing.refCount})`);
      return;
    }

    // Poll immediately, then on interval
    this.pollCheckins(serverName, netName);
    const timer = setInterval(
      () => this.pollCheckins(serverName, netName),
      POLL_INTERVALS.checkins,
    );

    this.checkinWatchers.set(key, { refCount: 1, timer, serverName, netName });
    console.log(`[Poller] Started watching ${key}`);
  }

  removeWatcher(serverName, netName) {
    const key = `${serverName}:${netName}`;
    const existing = this.checkinWatchers.get(key);
    if (!existing) return;

    existing.refCount--;
    console.log(`[Poller] Watcher removed for ${key} (refCount: ${existing.refCount})`);

    if (existing.refCount <= 0) {
      clearInterval(existing.timer);
      this.checkinWatchers.delete(key);
      console.log(`[Poller] Stopped watching ${key}`);
    }
  }
}

export const poller = new Poller();
