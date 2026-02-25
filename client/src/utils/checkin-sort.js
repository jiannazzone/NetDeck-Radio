export const SORTABLE_COLUMNS = [
  { key: 'serialNo', label: '#', getValue: (c) => c.serialNo },
  { key: 'callsign', label: 'Callsign', getValue: (c) => (c.callsign || '').toLowerCase() },
  { key: 'name', label: 'Name', getValue: (c) => (c.preferredName || c.firstName || '').toLowerCase() },
  { key: 'status', label: 'Status', getValue: (c) => (c.statusLabel || '').toLowerCase() },
  { key: 'location', label: 'Location', getValue: (c) => [c.cityCountry, c.state, c.country].filter((s) => s && s.trim()).join(', ').toLowerCase() },
  { key: 'grid', label: 'Grid', getValue: (c) => (c.grid || '').toLowerCase() },
];

export function sortCheckins(checkins, sortColumn, sortDirection) {
  const col = SORTABLE_COLUMNS.find((c) => c.key === sortColumn);
  if (!col) return checkins;
  const sorted = [...checkins].sort((a, b) => {
    const va = col.getValue(a);
    const vb = col.getValue(b);
    if (va < vb) return -1;
    if (va > vb) return 1;
    return 0;
  });
  return sortDirection === 'desc' ? sorted.reverse() : sorted;
}
