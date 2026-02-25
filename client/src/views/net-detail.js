import { el } from '../utils/dom.js';
import { formatAge, formatDateTime } from '../utils/formatters.js';
import { getStatusClass } from '../utils/status-colors.js';
import { sse } from '../sse.js';
import { getCheckins } from '../api.js';

export function renderNetDetail(container, params) {
  const { serverName, netName } = params;
  let checkins = [];
  let pointer = 0;
  let age = null;
  let ageTimer = null;
  let lastUpdate = Date.now();

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

  container.appendChild(headerRow);
  container.appendChild(loading);
  container.appendChild(tableContainer);

  function updateFreshness() {
    if (age != null) {
      const elapsed = age + (Date.now() - lastUpdate);
      freshnessBadge.textContent = `Updated ${formatAge(elapsed)}`;
    }
  }

  function renderTable() {
    tableContainer.innerHTML = '';
    checkinCount.textContent = `${checkins.length} checkins`;

    if (checkins.length === 0) {
      tableContainer.appendChild(el('p', { className: 'empty-state' }, 'No checkins yet.'));
      return;
    }

    const table = el('table', { className: 'checkin-table' });
    const thead = el('thead', {},
      el('tr', {},
        el('th', {}, '#'),
        el('th', {}, 'Callsign'),
        el('th', {}, 'Name'),
        el('th', {}, 'Status'),
        el('th', {}, 'Location'),
        el('th', {}, 'Grid'),
        el('th', {}, 'Remarks'),
      ),
    );
    table.appendChild(thead);

    const tbody = el('tbody');
    for (const c of checkins) {
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
        el('td', { className: 'checkin-row__callsign' }, c.callsign),
        el('td', {}, c.preferredName || c.firstName),
        el('td', {}, c.statusLabel || ''),
        el('td', {}, location),
        el('td', {}, c.grid),
        el('td', {}, c.remarks),
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
    renderTable();
    updateFreshness();
  }

  // Load initial data via REST
  getCheckins(serverName, netName).then(onUpdate).catch((err) => {
    loading.textContent = 'Failed to load checkins.';
    console.error(err);
  });

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
