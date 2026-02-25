const BASE = '/api';
const FETCH_TIMEOUT = 10_000;

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API error: ${res.status}${body ? ` — ${body}` : ''}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function getActiveNets() {
  return fetchJson(`${BASE}/nets`);
}

export function getCheckins(serverName, netName) {
  return fetchJson(
    `${BASE}/nets/${encodeURIComponent(serverName)}/${encodeURIComponent(netName)}/checkins`,
  );
}

export function getPastNets(interval = 7, search) {
  const params = new URLSearchParams();
  if (interval) params.set('interval', interval);
  if (search) params.set('search', search);
  return fetchJson(`${BASE}/past-nets?${params}`);
}

export function getPastNetCheckins(serverName, netName, netId) {
  return fetchJson(
    `${BASE}/past-nets/${encodeURIComponent(serverName)}/${encodeURIComponent(netName)}/${encodeURIComponent(netId)}/checkins`,
  );
}
