import { el } from '../utils/dom.js';
import { formatDateTime } from '../utils/formatters.js';
import { getPastNets, getPastNetCheckins } from '../api.js';
import { getStatusClass } from '../utils/status-colors.js';

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
      tableContainer.appendChild(el('p', { className: 'empty-state' }, 'No past nets found.'));
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
        el('td', {}, net.netName),
        el('td', {}, net.frequency),
        el('td', {}, net.mode),
        el('td', {}, net.band),
        el('td', {}, net.netControl),
        el('td', {}, formatDateTime(net.date)),
        el('td', {}, formatDateTime(net.closedAt)),
      );
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    tableContainer.appendChild(table);
  }

  async function loadData() {
    loading.style.display = '';
    tableContainer.innerHTML = '';
    try {
      const data = await getPastNets(interval, searchTerm || undefined);
      renderTable(data.nets || []);
    } catch (err) {
      loading.textContent = 'Failed to load past nets.';
      console.error(err);
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

  container.appendChild(headerRow);
  container.appendChild(loading);
  container.appendChild(tableContainer);

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
    })
    .catch((err) => {
      loading.textContent = 'Failed to load checkins.';
      console.error(err);
    });
}
