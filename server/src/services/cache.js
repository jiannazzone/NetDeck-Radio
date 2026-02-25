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
  }

  delete(key) {
    this.store.delete(key);
  }

  has(key) {
    return this.get(key) !== null;
  }
}

export const cache = new Cache();
