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
