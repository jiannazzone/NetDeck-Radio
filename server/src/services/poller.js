import { EventEmitter } from 'node:events';
import { POLL_INTERVALS, CACHE_TTL } from '../config.js';
import { fetchActiveNets, fetchCheckins } from './netlogger-client.js';
import { parseActiveNets, parseCheckins } from './xml-parser.js';
import { cache } from './cache.js';
import { canMakeRequest } from '../utils/rate-limiter.js';

const WATCHER_TIMEOUT = 120_000; // 2 minutes (4x heartbeat interval)
const CLEANUP_INTERVAL = 60_000; // check every 60s

class Poller extends EventEmitter {
  constructor() {
    super();
    this.activeNetsTimer = null;
    this.cleanupTimer = null;
    this.checkinWatchers = new Map(); // key -> { refCount, timer, lastSeen }
  }

  start() {
    this.pollActiveNets();
    this.activeNetsTimer = setInterval(
      () => this.pollActiveNets(),
      POLL_INTERVALS.activeNets,
    );
    this.startCleanup();
    console.log('[Poller] Started active nets polling');
  }

  stop() {
    if (this.activeNetsTimer) {
      clearInterval(this.activeNetsTimer);
      this.activeNetsTimer = null;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    for (const [key, watcher] of this.checkinWatchers) {
      clearInterval(watcher.timer);
    }
    this.checkinWatchers.clear();
  }

  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, watcher] of this.checkinWatchers) {
        if (now - watcher.lastSeen > WATCHER_TIMEOUT) {
          console.log(`[Poller] Cleaning up stale watcher for ${key} (inactive ${Math.round((now - watcher.lastSeen) / 1000)}s)`);
          clearInterval(watcher.timer);
          this.checkinWatchers.delete(key);
        }
      }
    }, CLEANUP_INTERVAL);
  }

  touchWatcher(serverName, netName) {
    const key = `${serverName}:${netName}`;
    const existing = this.checkinWatchers.get(key);
    if (existing) {
      existing.lastSeen = Date.now();
    }
  }

  async pollActiveNets() {
    if (!canMakeRequest('GetActiveNets')) {
      console.warn('[Poller] Rate limited: GetActiveNets');
      const stale = cache.getStale('active-nets');
      if (stale) this.emit('nets', stale);
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
    const cacheKey = `checkins:${serverName}:${netName}`;

    if (!canMakeRequest('GetCheckins')) {
      console.warn('[Poller] Rate limited: GetCheckins');
      const stale = cache.getStale(cacheKey);
      if (stale) this.emit(`checkins:${serverName}:${netName}`, stale);
      return;
    }

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
      existing.lastSeen = Date.now();
      console.log(`[Poller] Watcher added for ${key} (refCount: ${existing.refCount})`);
      return;
    }

    // Poll immediately, then on interval
    this.pollCheckins(serverName, netName);
    const timer = setInterval(
      () => this.pollCheckins(serverName, netName),
      POLL_INTERVALS.checkins,
    );

    this.checkinWatchers.set(key, { refCount: 1, timer, serverName, netName, lastSeen: Date.now() });
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
