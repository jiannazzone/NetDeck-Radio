import { el } from '../utils/dom.js';
import { formatAge, formatDateTime } from '../utils/formatters.js';
import { getStatusClass, STATUS_LEGEND } from '../utils/status-colors.js';
import { sse } from '../sse.js';
import { getCheckins } from '../api.js';

const SORTABLE_COLUMNS = [
  { key: 'serialNo', label: '#', getValue: (c) => c.serialNo },
  { key: 'callsign', label: 'Callsign', getValue: (c) => (c.callsign || '').toLowerCase() },
  { key: 'name', label: 'Name', getValue: (c) => (c.preferredName || c.firstName || '').toLowerCase() },
  { key: 'status', label: 'Status', getValue: (c) => (c.statusLabel || '').toLowerCase() },
  { key: 'location', label: 'Location', getValue: (c) => [c.cityCountry, c.state, c.country].filter((s) => s && s.trim()).join(', ').toLowerCase() },
  { key: 'grid', label: 'Grid', getValue: (c) => (c.grid || '').toLowerCase() },
];

function sortCheckins(checkins, sortColumn, sortDirection) {
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

export function renderNetDetail(container, params) {
  const { serverName, netName } = params;
  let checkins = [];
  let pointer = 0;
  let age = null;
  let ageTimer = null;
  let lastUpdate = Date.now();
  let sortColumn = 'serialNo';
  let sortDirection = 'asc';

  container.innerHTML = '';

  const backLink = el('a', { className: 'back-link', href: '#/' }, '\u2190 Back to nets');
  const title = el('h2', { className: 'view-title' }, decodeURIComponent(netName));
  const freshnessBadge = el('span', { className: 'freshness-badge' });
  const checkinCount = el('span', { className: 'checkin-count' });

  const headerRow = el('div', { className: 'view-header' },
    el('div', { className: 'view-header__left' }, backLink, title),
    el('div', { className: 'view-header__right' }, checkinCount, freshnessBadge),
  );

  const tableContainer = el('div', { className: 'table-container' });
  const loading = el('div', { className: 'loading' }, 'Loading checkins...');

  const legend = el('div', { className: 'status-legend' },
    ...STATUS_LEGEND.map(([label, color]) =>
      el('span', { className: 'status-legend__item' },
        el('span', { className: 'status-legend__dot', style: `background:${color}` }),
        label,
      )
    ),
  );

  container.appendChild(headerRow);
  container.appendChild(loading);
  container.appendChild(tableContainer);
  container.appendChild(legend);

  function updateFreshness() {
    if (age != null) {
      const elapsed = age + (Date.now() - lastUpdate);
      freshnessBadge.textContent = `Updated ${formatAge(elapsed)}`;
    }
  }

  function handleSort(key) {
    if (sortColumn === key) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = key;
      sortDirection = 'asc';
    }
    renderTable();
  }

  function renderTable() {
    tableContainer.innerHTML = '';
    checkinCount.textContent = `${checkins.length} checkins`;

    if (checkins.length === 0) {
      tableContainer.appendChild(el('p', { className: 'empty-state' }, 'No checkins yet.'));
      return;
    }

    const table = el('table', { className: 'checkin-table' });
    const headerCells = SORTABLE_COLUMNS.map((col) => {
      const isActive = sortColumn === col.key;
      const indicator = isActive
        ? el('span', { className: 'sort-indicator' }, sortDirection === 'asc' ? '\u25B2' : '\u25BC')
        : null;
      return el('th', {
        scope: 'col',
        className: 'sortable',
        onClick: () => handleSort(col.key),
      }, col.label, indicator);
    });
    headerCells.push(el('th', { scope: 'col' }, 'Remarks'));

    const thead = el('thead', {}, el('tr', {}, ...headerCells));
    table.appendChild(thead);

    const sorted = sortCheckins(checkins, sortColumn, sortDirection);
    const tbody = el('tbody');
    for (const c of sorted) {
      const isPointer = c.serialNo === pointer;
      const statusClass = getStatusClass(c.statusType || 'regular');
      const classes = [
        'checkin-row',
        statusClass,
        isPointer ? 'checkin-row--pointer' : '',
      ].filter(Boolean).join(' ');

      const location = [c.cityCountry, c.state, c.country]
        .filter((s) => s && s.trim())
        .join(', ');

      const row = el('tr', { className: classes },
        el('td', {}, String(c.serialNo)),
        el('td', { className: 'checkin-row__callsign' }, c.callsign || '\u2014'),
        el('td', {}, c.preferredName || c.firstName || '\u2014'),
        el('td', {}, c.statusLabel || ''),
        el('td', {}, location || '\u2014'),
        el('td', {}, c.grid || '\u2014'),
        el('td', {}, c.remarks || '\u2014'),
      );
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    tableContainer.appendChild(table);
  }

  function onUpdate(data) {
    checkins = data.checkins || [];
    pointer = data.pointer || 0;
    age = data.age ?? 0;
    lastUpdate = Date.now();
    loading.style.display = 'none';
    const existingError = container.querySelector('.error-state');
    if (existingError) existingError.remove();
    renderTable();
    updateFreshness();
  }

  function loadCheckins() {
    loading.style.display = '';
    loading.textContent = 'Loading checkins...';
    const existingError = container.querySelector('.error-state');
    if (existingError) existingError.remove();

    getCheckins(serverName, netName).then(onUpdate).catch((err) => {
      loading.style.display = 'none';
      console.error(err);
      const existingErr = container.querySelector('.error-state');
      if (existingErr) existingErr.remove();
      const errorDiv = el('div', { className: 'error-state' },
        el('p', {}, 'Failed to load checkins.'),
        el('button', { className: 'retry-btn', onClick: loadCheckins }, 'Retry'),
      );
      container.insertBefore(errorDiv, tableContainer);
    });
  }

  // Load initial data via REST
  loadCheckins();

  // Subscribe to SSE updates
  sse.removeAllListeners();
  sse.on('checkins', onUpdate);
  sse.connect({ subscribe: 'checkins', serverName, netName });

  ageTimer = setInterval(updateFreshness, 1000);

  return () => {
    clearInterval(ageTimer);
    sse.removeAllListeners();
    sse.disconnect();
  };
}
