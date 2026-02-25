const BASE = '/api';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function getActiveNets(search) {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  return fetchJson(`${BASE}/nets${params}`);
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
