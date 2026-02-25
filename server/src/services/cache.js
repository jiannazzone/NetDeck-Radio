const MAX_ENTRIES = 500;

export class Cache {
  constructor() {
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) return null;
    return entry.data;
  }

  getStale(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    return entry.data;
  }

  getWithMeta(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    return {
      data: entry.data,
      age: Date.now() - entry.timestamp,
      stale: Date.now() - entry.timestamp > entry.ttl,
    };
  }

  set(key, data, ttl) {
    this.store.set(key, { data, timestamp: Date.now(), ttl });
    if (this.store.size > MAX_ENTRIES) {
      const oldest = this.store.keys().next().value;
      this.store.delete(oldest);
    }
  }

  delete(key) {
    this.store.delete(key);
  }

  has(key) {
    return this.get(key) !== null;
  }
}

export const cache = new Cache();
