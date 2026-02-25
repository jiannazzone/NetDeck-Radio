const STATUS_CODES = {
  '(nc)':  { type: 'net-control',   label: 'Net Control' },
  '(log)': { type: 'logger',        label: 'Logger' },
  '(rel)': { type: 'relayed',       label: 'Relayed' },
  '(vip)': { type: 'vip',           label: 'VIP' },
  '(c/o)': { type: 'checked-out',   label: 'Checked Out' },
  '(n/h)': { type: 'not-heard',     label: 'Not Heard' },
  '(u)':   { type: 'short-time',    label: 'Short Time' },
  '(n/r)': { type: 'no-response',   label: 'No Response' },
};

const STATUS_PATTERN = /\([a-z/]+\)/gi;

export function parseStatus(raw) {
  if (!raw || !raw.trim()) {
    return { type: 'regular', label: 'Checked In', extra: '' };
  }

  const lower = raw.toLowerCase();

  for (const [code, info] of Object.entries(STATUS_CODES)) {
    if (lower.includes(code)) {
      const extra = raw.replace(STATUS_PATTERN, '').trim();
      return { ...info, extra };
    }
  }

  return { type: 'regular', label: 'Checked In', extra: raw.trim() };
}
