export function formatAge(ms) {
  if (ms == null) return 'unknown';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr + ' UTC');
    return date.toLocaleString();
  } catch {
    return dateStr;
  }
}

export function formatNetDuration(dateStr) {
  if (!dateStr) return '';
  try {
    const start = new Date(dateStr + ' UTC');
    const ms = Date.now() - start.getTime();
    if (ms < 0) return '';
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  } catch {
    return '';
  }
}
