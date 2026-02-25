import { RATE_LIMITS } from '../config.js';

class TokenBucket {
  constructor(max, windowMs) {
    this.max = max;
    this.windowMs = windowMs;
    this.tokens = max;
    this.lastRefill = Date.now();
  }

  refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / this.windowMs) * this.max;
    this.tokens = Math.min(this.max, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  tryConsume() {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

const buckets = new Map();

for (const [endpoint, config] of Object.entries(RATE_LIMITS)) {
  buckets.set(endpoint, new TokenBucket(config.max, config.windowMs));
}

export function canMakeRequest(endpoint) {
  const bucket = buckets.get(endpoint);
  if (!bucket) return true;
  return bucket.tryConsume();
}
