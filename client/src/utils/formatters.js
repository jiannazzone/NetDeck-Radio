export function formatAge(ms) {
  if (ms == null) return 'unknown';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

export function formatFrequency(freq) {
  if (!freq) return '';
  const num = parseFloat(freq);
  if (isNaN(num)) return freq;
  return num.toFixed(freq.includes('.') ? freq.split('.')[1]?.length || 0 : 0);
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
