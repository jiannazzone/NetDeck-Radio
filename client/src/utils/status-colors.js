export const STATUS_LEGEND = [
  ['Net Control', '#a78bfa'],
  ['Logger', '#c4b5fd'],
  ['Relayed', '#fb923c'],
  ['VIP', '#f87171'],
  ['Not Heard', '#fbbf24'],
  ['Short Time', '#2dd4bf'],
  ['No Response', '#4ade80'],
  ['Checked Out', '#64748b'],
  ['Working', '#e8a135'],
];

export const STATUS_CLASSES = {
  'net-control': 'status--net-control',
  'logger': 'status--logger',
  'relayed': 'status--relayed',
  'vip': 'status--vip',
  'checked-out': 'status--checked-out',
  'not-heard': 'status--not-heard',
  'short-time': 'status--short-time',
  'no-response': 'status--no-response',
  'regular': '',
};

export function getStatusClass(statusType) {
  return STATUS_CLASSES[statusType] || '';
}
