import { EventEmitter } from 'node:events';
import { POLL_INTERVALS, CACHE_TTL } from '../config.js';
import { fetchActiveNets, fetchCheckins } from './netlogger-client.js';
import { parseActiveNets, parseCheckins } from './xml-parser.js';
import { cache } from './cache.js';
import { canMakeRequest } from '../utils/rate-limiter.js';

const WATCHER_TIMEOUT = 120_000; // 2 minutes (4x heartbeat interval)

export class Poller extends EventEmitter {
  constructor() {
    super();
    this.activeNetsTimer = null;
    this.checkinSchedulerTimer = null;
    this.checkinWatchers = new Map(); // key -> { refCount, serverName, netName, lastSeen, lastPolled, lastXml }
    this._lastActiveNetsXml = null;
  }

  start() {
    this.pollActiveNets();
    this.activeNetsTimer = setInterval(
      () => this.pollActiveNets(),
      POLL_INTERVALS.activeNets,
    );
    this.startCheckinScheduler();
    console.log('[Poller] Started active nets polling');
  }

  stop() {
    if (this.activeNetsTimer) {
      clearInterval(this.activeNetsTimer);
      this.activeNetsTimer = null;
    }
    if (this.checkinSchedulerTimer) {
      clearInterval(this.checkinSchedulerTimer);
      this.checkinSchedulerTimer = null;
    }
    this.checkinWatchers.clear();
    this._lastActiveNetsXml = null;
  }

  // Single polling loop: every 20s, poll the most-stale watched net.
  // This guarantees we never exceed the 3 calls/60s rate limit by design
  // (1 call per 20s interval = exactly 3/minute).
  startCheckinScheduler() {
    this.checkinSchedulerTimer = setInterval(
      () => this.pollNextCheckin(),
      POLL_INTERVALS.checkins,
    );
  }

  pollNextCheckin() {
    if (this.checkinWatchers.size === 0) return;

    const now = Date.now();
    let target = null;
    let oldestTime = Infinity;

    for (const [key, watcher] of this.checkinWatchers) {
      // Inline stale watcher cleanup (replaces separate cleanupTimer)
      if (now - watcher.lastSeen > WATCHER_TIMEOUT) {
        console.log(`[Poller] Cleaning up stale watcher for ${key} (inactive ${Math.round((now - watcher.lastSeen) / 1000)}s)`);
        this.checkinWatchers.delete(key);
        continue;
      }

      // Pick the watcher that was polled least recently.
      // Nets with no cached data get absolute priority (treated as lastPolled=0).
      const cacheKey = `checkins:${watcher.serverName}:${watcher.netName}`;
      const hasData = cache.getStale(cacheKey) !== null;
      const effectiveTime = hasData ? watcher.lastPolled : 0;

      if (effectiveTime < oldestTime) {
        oldestTime = effectiveTime;
        target = watcher;
      }
    }

    if (target) {
      this.pollCheckins(target.serverName, target.netName);
    }
  }

  touchWatcher(serverName, netName) {
    const key = `${serverName}:${netName}`;
    const existing = this.checkinWatchers.get(key);
    if (existing) {
      existing.lastSeen = Date.now();
    }
  }

  async pollActiveNets() {
    if (!canMakeRequest('GetActiveNets')) return;

    try {
      const xml = await fetchActiveNets();
      if (xml === this._lastActiveNetsXml) return;
      this._lastActiveNetsXml = xml;
      const nets = parseActiveNets(xml);
      cache.set('active-nets', nets, CACHE_TTL.activeNets);
      this.emit('nets', nets);
    } catch (err) {
      console.error('[Poller] Failed to poll active nets:', err.message);
    }
  }

  async pollCheckins(serverName, netName) {
    const key = `${serverName}:${netName}`;
    const cacheKey = `checkins:${serverName}:${netName}`;
    const watcher = this.checkinWatchers.get(key);

    if (!canMakeRequest('GetCheckins')) {
      console.warn('[Poller] Rate limited: GetCheckins (safety net)');
      return;
    }

    try {
      const xml = await fetchCheckins(serverName, netName);
      if (watcher && xml === watcher.lastXml) {
        watcher.lastPolled = Date.now();
        return;
      }
      const data = parseCheckins(xml);
      cache.set(cacheKey, data, CACHE_TTL.checkins);
      if (watcher) {
        watcher.lastPolled = Date.now();
        watcher.lastXml = xml;
      }
      this.emit(`checkins:${serverName}:${netName}`, data);
    } catch (err) {
      if (err.code === 404 && watcher) {
        console.log(`[Poller] Net "${netName}" no longer active, removing watcher`);
        this.checkinWatchers.delete(key);
      } else {
        console.error(`[Poller] Failed to poll checkins for ${netName}:`, err.message);
      }
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

    // Register the watcher with lastPolled=0 (highest scheduler priority).
    // An immediate poll is triggered below via process.nextTick().
    this.checkinWatchers.set(key, {
      refCount: 1,
      serverName,
      netName,
      lastSeen: Date.now(),
      lastPolled: 0,
    });

    console.log(`[Poller] Started watching ${key} (${this.checkinWatchers.size} net${this.checkinWatchers.size === 1 ? '' : 's'} active, polling every ${this.checkinWatchers.size * POLL_INTERVALS.checkins / 1000}s each)`);

    // Trigger immediate poll so SSE delivers data within ~1-2s even if the REST call failed.
    // pollCheckins() respects rate limits via canMakeRequest() internally.
    process.nextTick(() => this.pollCheckins(serverName, netName));
  }

  removeWatcher(serverName, netName) {
    const key = `${serverName}:${netName}`;
    const existing = this.checkinWatchers.get(key);
    if (!existing) return;

    existing.refCount--;
    console.log(`[Poller] Watcher removed for ${key} (refCount: ${existing.refCount})`);

    if (existing.refCount <= 0) {
      this.checkinWatchers.delete(key);
      console.log(`[Poller] Stopped watching ${key}`);
    }
  }
}

export const poller = new Poller();
