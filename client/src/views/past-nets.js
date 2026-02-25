import { el } from '../utils/dom.js';
import { formatDateTime } from '../utils/formatters.js';
import { getPastNets, getPastNetCheckins } from '../api.js';
import { getStatusClass, STATUS_LEGEND } from '../utils/status-colors.js';

const INTERVAL_LABELS = { 1: 'last 24 hours', 3: 'last 3 days', 7: 'last 7 days' };

export function renderPastNets(container) {
  let interval = 7;
  let searchTerm = '';

  container.innerHTML = '';

  const searchInput = el('input', {
    className: 'search-bar',
    type: 'text',
    placeholder: 'Search past nets...',
  });

  // Segment control for interval selection
  const intervals = [
    { value: 1, label: '24h' },
    { value: 3, label: '3 days' },
    { value: 7, label: '7 days' },
  ];

  const segmentControl = el('div', { className: 'segment-control' });
  const buttons = [];

  for (const item of intervals) {
    const btn = el('button', {
      className: `segment-control__btn${item.value === interval ? ' segment-control__btn--active' : ''}`,
      onClick: () => {
        interval = item.value;
        buttons.forEach((b) =>
          b.classList.toggle('segment-control__btn--active', b === btn),
        );
        loadData();
      },
    }, item.label);
    buttons.push(btn);
    segmentControl.appendChild(btn);
  }

  const resultCount = el('span', { className: 'result-count' });

  const header = el('div', { className: 'view-header' },
    searchInput,
    el('div', { className: 'view-header__right' },
      resultCount,
      segmentControl,
    ),
  );

  const tableContainer = el('div', { className: 'table-container' });
  const loading = el('div', { className: 'loading' }, 'Loading past nets...');

  container.appendChild(header);
  container.appendChild(loading);
  container.appendChild(tableContainer);

  let debounceTimer = null;

  function renderTable(nets) {
    tableContainer.innerHTML = '';
    loading.style.display = 'none';

    resultCount.textContent = `${nets.length} nets`;

    if (nets.length === 0) {
      const label = INTERVAL_LABELS[interval] || `last ${interval} days`;
      const msg = searchTerm
        ? `No nets matching "${searchTerm}" in the ${label}.`
        : `No nets found in the ${label}.`;
      tableContainer.appendChild(el('p', { className: 'empty-state' }, msg));
      return;
    }

    const table = el('table', { className: 'past-nets-table' });
    const thead = el('thead', {},
      el('tr', {},
        el('th', {}, 'Net Name'),
        el('th', {}, 'Frequency'),
        el('th', {}, 'Mode'),
        el('th', {}, 'Band'),
        el('th', {}, 'NCS'),
        el('th', {}, 'Opened'),
        el('th', {}, 'Closed'),
      ),
    );
    table.appendChild(thead);

    const tbody = el('tbody');
    for (const net of nets) {
      const row = el('tr', {
        className: 'past-net-row',
        onClick: () => {
          location.hash = `#/past/${encodeURIComponent(net.serverName)}/${encodeURIComponent(net.netName)}/${encodeURIComponent(net.netId)}`;
        },
      },
        el('td', {}, net.netName || '\u2014'),
        el('td', {}, net.frequency || '\u2014'),
        el('td', {}, net.mode || '\u2014'),
        el('td', {}, net.band || '\u2014'),
        el('td', {}, net.netControl || '\u2014'),
        el('td', {}, formatDateTime(net.date) || '\u2014'),
        el('td', {}, formatDateTime(net.closedAt) || '\u2014'),
      );
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    tableContainer.appendChild(table);
  }

  async function loadData() {
    loading.style.display = '';
    loading.textContent = 'Loading past nets...';
    tableContainer.innerHTML = '';
    const existingError = container.querySelector('.error-state');
    if (existingError) existingError.remove();

    try {
      const data = await getPastNets(interval, searchTerm || undefined);
      renderTable(data.nets || []);
    } catch (err) {
      loading.style.display = 'none';
      console.error(err);
      const existingErr = container.querySelector('.error-state');
      if (existingErr) existingErr.remove();
      const errorDiv = el('div', { className: 'error-state' },
        el('p', {}, 'Failed to load past nets.'),
        el('button', { className: 'retry-btn', onClick: loadData }, 'Retry'),
      );
      container.insertBefore(errorDiv, tableContainer);
    }
  }

  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(loadData, 300);
  });

  loadData();

  return () => {
    clearTimeout(debounceTimer);
  };
}

export function renderPastNetDetail(container, params) {
  const { serverName, netName, netId } = params;

  container.innerHTML = '';

  const backLink = el('a', { className: 'back-link', href: '#/past' }, '\u2190 Back to past nets');
  const title = el('h2', { className: 'view-title' }, decodeURIComponent(netName));
  const subtitle = el('span', { className: 'view-subtitle' }, 'closed');
  const checkinCount = el('span', { className: 'checkin-count' });

  const headerRow = el('div', { className: 'view-header' },
    el('div', { className: 'view-header__left' }, backLink, title, subtitle),
    el('div', { className: 'view-header__right' }, checkinCount),
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

  function loadCheckins() {
    loading.style.display = '';
    loading.textContent = 'Loading checkins...';
    tableContainer.innerHTML = '';
    const existingError = container.querySelector('.error-state');
    if (existingError) existingError.remove();

    getPastNetCheckins(serverName, netName, netId)
      .then((data) => {
        loading.style.display = 'none';
        const checkins = data.checkins || [];

        checkinCount.textContent = `${checkins.length} checkins`;

        if (checkins.length === 0) {
          tableContainer.appendChild(el('p', { className: 'empty-state' }, 'No checkins found.'));
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
          const statusClass = getStatusClass(c.statusType || 'regular');
          const location = [c.cityCountry, c.state, c.country]
            .filter((s) => s && s.trim())
            .join(', ');

          const row = el('tr', { className: ['checkin-row', statusClass].filter(Boolean).join(' ') },
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
      })
      .catch((err) => {
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

  loadCheckins();
}
