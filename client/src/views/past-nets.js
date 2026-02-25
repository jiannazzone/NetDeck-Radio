import { el } from '../utils/dom.js';
import { formatDateTime } from '../utils/formatters.js';
import { getPastNets, getPastNetCheckins } from '../api.js';

export function renderPastNets(container) {
  let interval = 7;
  let searchTerm = '';

  container.innerHTML = '';

  const searchInput = el('input', {
    className: 'search-bar',
    type: 'text',
    placeholder: 'Search past nets...',
  });

  const intervalSelect = el('select', { className: 'interval-select' },
    el('option', { value: '1' }, 'Last 24 hours'),
    el('option', { value: '3' }, 'Last 3 days'),
    el('option', { value: '7', selected: 'selected' }, 'Last 7 days'),
  );

  const header = el('div', { className: 'view-header' },
    searchInput,
    intervalSelect,
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

  intervalSelect.addEventListener('change', (e) => {
    interval = parseInt(e.target.value, 10);
    loadData();
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
  const subtitle = el('span', { className: 'view-subtitle' }, '(closed)');

  const headerRow = el('div', { className: 'view-header' },
    el('div', { className: 'view-header__left' }, backLink, title, subtitle),
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
          el('th', {}, 'Location'),
          el('th', {}, 'Grid'),
          el('th', {}, 'Remarks'),
        ),
      );
      table.appendChild(thead);

      const tbody = el('tbody');
      for (const c of checkins) {
        const location = [c.cityCountry, c.state, c.country]
          .filter((s) => s && s.trim())
          .join(', ');

        const row = el('tr', { className: 'checkin-row' },
          el('td', {}, String(c.serialNo)),
          el('td', { className: 'checkin-row__callsign' }, c.callsign),
          el('td', {}, c.preferredName || c.firstName),
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
