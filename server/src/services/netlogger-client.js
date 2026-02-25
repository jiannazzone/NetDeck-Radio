import { NETLOGGER_API_BASE } from '../config.js';

const FETCH_TIMEOUT = 15_000;

async function fetchXml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`NetLogger API HTTP ${response.status}: ${url}`);
    }
    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchActiveNets(netNameLike) {
  let url = `${NETLOGGER_API_BASE}/GetActiveNets.php`;
  if (netNameLike) {
    url += `?NetNameLike=${encodeURIComponent(netNameLike)}`;
  }
  return fetchXml(url);
}

export async function fetchCheckins(serverName, netName) {
  const url = `${NETLOGGER_API_BASE}/GetCheckins.php?ServerName=${encodeURIComponent(serverName)}&NetName=${encodeURIComponent(netName)}`;
  return fetchXml(url);
}

export async function fetchPastNets(interval = 7, netNameLike) {
  let url = `${NETLOGGER_API_BASE}/GetPastNets.php?Interval=${interval}`;
  if (netNameLike) {
    url += `&NetNameLike=${encodeURIComponent(netNameLike)}`;
  }
  return fetchXml(url);
}

export async function fetchPastNetCheckins(serverName, netName, netId) {
  const url = `${NETLOGGER_API_BASE}/GetPastNetCheckins.php?ServerName=${encodeURIComponent(serverName)}&NetName=${encodeURIComponent(netName)}&NetID=${encodeURIComponent(netId)}`;
  return fetchXml(url);
}
