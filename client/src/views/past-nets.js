import { el, showError, clearError } from '../utils/dom.js';
import { formatDateTime } from '../utils/formatters.js';
import { getPastNets, getPastNetCheckins } from '../api.js';
import { getStatusClass } from '../utils/status-colors.js';
import { sortCheckins } from '../utils/checkin-sort.js';
import { buildStatusLegend, buildCheckinThead, getCheckinRowCells, buildCheckinRowTds } from '../utils/checkin-table.js';

const INTERVAL_LABELS = { 1: 'last 24 hours', 3: 'last 3 days', 7: 'last 7 days' };

export function renderPastNets(container) {
  let interval = 7;
  let searchTerm = '';

  container.innerHTML = '';

  const searchInput = el('input', {
    className: 'search-bar',
    type: 'text',
    placeholder: 'Search past nets...',
    'aria-label': 'Search past nets',
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
        el('th', { scope: 'col' }, 'Net Name'),
        el('th', { scope: 'col' }, 'Frequency'),
        el('th', { scope: 'col' }, 'Mode'),
        el('th', { scope: 'col' }, 'Band'),
        el('th', { scope: 'col' }, 'NCS'),
        el('th', { scope: 'col' }, 'Opened'),
        el('th', { scope: 'col' }, 'Closed'),
      ),
    );
    table.appendChild(thead);

    const tbody = el('tbody');
    for (const net of nets) {
      const navigate = () => {
        location.hash = `#/past/${encodeURIComponent(net.serverName)}/${encodeURIComponent(net.netName)}/${encodeURIComponent(net.netId)}`;
      };
      const row = el('tr', {
        className: 'past-net-row',
        tabindex: '0',
        onClick: navigate,
        onKeydown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate();
          }
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
    clearError(container);

    try {
      const data = await getPastNets(interval, searchTerm || undefined);
      renderTable(data.nets || []);
    } catch (err) {
      loading.style.display = 'none';
      console.error(err);
      showError(container, tableContainer, 'Failed to load past nets.', loadData);
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

  if (!serverName || !netName || !netId) {
    container.innerHTML = '<p class="error">Invalid past net — missing server name, net name, or ID.</p>';
    return;
  }

  let checkins = [];
  let sortColumn = 'serialNo';
  let sortDirection = 'asc';

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

  const legend = buildStatusLegend();

  container.appendChild(headerRow);
  container.appendChild(loading);
  container.appendChild(tableContainer);
  container.appendChild(legend);

  function handleSort(key) {
    if (sortColumn === key) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = key;
      sortDirection = 'asc';
    }
    renderCheckinTable();
  }

  function renderCheckinTable() {
    tableContainer.innerHTML = '';
    checkinCount.textContent = `${checkins.length} checkins`;

    if (checkins.length === 0) {
      tableContainer.appendChild(el('p', { className: 'empty-state' }, 'No checkins found.'));
      return;
    }

    const table = el('table', { className: 'checkin-table' });
    table.appendChild(buildCheckinThead(sortColumn, sortDirection, handleSort));

    const sorted = sortCheckins(checkins, sortColumn, sortDirection);
    const tbody = el('tbody');
    for (const c of sorted) {
      const statusClass = getStatusClass(c.statusType || 'regular');
      const cells = getCheckinRowCells(c);
      const row = el('tr', { className: ['checkin-row', statusClass].filter(Boolean).join(' ') },
        ...buildCheckinRowTds(cells),
      );
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    tableContainer.appendChild(table);
  }

  function loadCheckins() {
    loading.style.display = '';
    loading.textContent = 'Loading checkins...';
    tableContainer.innerHTML = '';
    clearError(container);

    getPastNetCheckins(serverName, netName, netId)
      .then((data) => {
        loading.style.display = 'none';
        checkins = data.checkins || [];
        renderCheckinTable();
      })
      .catch((err) => {
        loading.style.display = 'none';
        console.error(err);
        showError(container, tableContainer, 'Failed to load checkins.', loadCheckins);
      });
  }

  loadCheckins();
}
