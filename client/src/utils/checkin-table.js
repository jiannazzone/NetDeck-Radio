import { el } from './dom.js';
import { STATUS_LEGEND } from './status-colors.js';
import { SORTABLE_COLUMNS } from './checkin-sort.js';

export function buildStatusLegend() {
  return el('div', { className: 'status-legend' },
    ...STATUS_LEGEND.map(([label, color]) =>
      el('span', { className: 'status-legend__item' },
        el('span', { className: 'status-legend__dot', style: `background:${color}` }),
        label,
      )
    ),
  );
}

export function buildCheckinThead(sortColumn, sortDirection, onSort) {
  const headerCells = SORTABLE_COLUMNS.map((col) => {
    const isActive = sortColumn === col.key;
    const indicator = isActive
      ? el('span', { className: 'sort-indicator' }, sortDirection === 'asc' ? '\u25B2' : '\u25BC')
      : null;
    const ariaSort = isActive
      ? (sortDirection === 'asc' ? 'ascending' : 'descending')
      : 'none';
    return el('th', {
      scope: 'col',
      className: 'sortable',
      'aria-sort': ariaSort,
      tabindex: '0',
      onClick: () => onSort(col.key),
      onKeydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSort(col.key);
        }
      },
    }, col.label, indicator);
  });
  headerCells.push(el('th', { scope: 'col' }, 'Remarks'));
  return el('thead', {}, el('tr', {}, ...headerCells));
}

export function buildCheckinRowTds(cells) {
  return [
    el('td', {}, cells[0]),
    el('td', { className: 'checkin-row__callsign' }, cells[1]),
    el('td', {}, cells[2]),
    el('td', {}, cells[3]),
    el('td', {}, cells[4]),
    el('td', {}, cells[5]),
    el('td', {}, cells[6]),
    el('td', {}, cells[7]),
  ];
}

export function getCheckinRowCells(c) {
  const location = [c.cityCountry, c.state, c.country]
    .filter((s) => s && s.trim())
    .join(', ');
  const dxcc = c.dxccName
    ? [c.dxccFlag, c.dxccName].filter(Boolean).join(' ')
    : '\u2014';
  return [
    String(c.serialNo),
    c.callsign || '\u2014',
    c.preferredName || c.firstName || '\u2014',
    c.statusLabel || '',
    location || '\u2014',
    c.grid || '\u2014',
    dxcc,
    c.remarks || '\u2014',
  ];
}
