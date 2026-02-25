export const PORT = parseInt(process.env.SERVER_PORT || process.env.PORT || '3000', 10);
export const NODE_ENV = process.env.NODE_ENV || 'development';

export const NETLOGGER_API_BASE = 'https://www.netlogger.org/api';

export const POLL_INTERVALS = {
  activeNets: 60_000,
  checkins: 20_000,
};

export const CACHE_TTL = {
  activeNets: 60_000,
  checkins: 20_000,
  pastNets: 120_000,
  pastCheckins: 300_000,
};

export const RATE_LIMITS = {
  GetActiveNets: { max: 1, windowMs: 60_000 },
  GetCheckins: { max: 3, windowMs: 60_000 },
  GetPastNets: { max: 1, windowMs: 60_000 },
  GetPastNetCheckins: { max: 10, windowMs: 60_000 },
};

export const SSE_HEARTBEAT_INTERVAL = 30_000;
