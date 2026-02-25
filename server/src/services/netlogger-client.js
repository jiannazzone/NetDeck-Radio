import { NETLOGGER_API_BASE } from '../config.js';

async function fetchXml(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`NetLogger API HTTP ${response.status}: ${url}`);
  }
  return response.text();
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
