import { el, showError, clearError } from '../utils/dom.js';
import { formatAge } from '../utils/formatters.js';
import { getStatusClass } from '../utils/status-colors.js';
import { sortCheckins } from '../utils/checkin-sort.js';
import { buildStatusLegend, buildCheckinThead, getCheckinRowCells, buildCheckinRowTds } from '../utils/checkin-table.js';
import { sse } from '../sse.js';
import { getCheckins, getActiveNets } from '../api.js';

export function renderNetDetail(container, params) {
  const { serverName, netName } = params;

  if (!serverName || !netName) {
    container.innerHTML = '<p class="error">Invalid net — missing server or net name.</p>';
    return;
  }

  let checkins = [];
  let pointer = 0;
  let age = null;
  let ageTimer = null;
  let lastUpdate = Date.now();
  let sortColumn = 'serialNo';
  let sortDirection = 'asc';
  let prevPointer = 0;
  const rowMap = new Map();   // serialNo -> { row, cellEls, cellValues, className }
  let table = null;
  let tbody = null;
  let prevSortKey = null;
  let prevSortDir = null;
  let myCallsign = (localStorage.getItem('myCallsign') || '').toUpperCase();

  container.innerHTML = '';

  const backLink = el('a', { className: 'back-link', href: '#/' }, '\u2190 Back to nets');
  const title = el('h2', { className: 'view-title' }, netName);
  const subtitle = el('span', { className: 'view-subtitle' });
  const freshnessBadge = el('span', { className: 'freshness-badge' });
  const checkinCount = el('span', { className: 'checkin-count' });

  const titleGroup = el('div', { className: 'view-title-group' }, backLink, title, subtitle);

  const headerRow = el('div', { className: 'view-header' },
    el('div', { className: 'view-header__left' }, titleGroup),
    el('div', { className: 'view-header__stats' }, checkinCount, freshnessBadge),
  );

  // Fetch net metadata to show frequency/band
  getActiveNets().then((data) => {
    const net = (data.nets || []).find((n) => n.serverName === serverName && n.netName === netName);
    if (!net) return;
    const parts = [];
    const freq = net.frequency || net.altNetName;
    if (freq) parts.push(el('span', { className: 'view-subtitle__freq' }, freq));
    if (net.mode) parts.push(document.createTextNode(` ${net.mode}`));
    if (net.band) {
      if (parts.length) parts.push(document.createTextNode(' \u00b7 '));
      parts.push(el('span', { className: 'view-subtitle__band' }, net.band));
    }
    parts.forEach((p) => subtitle.appendChild(p));
  }).catch(() => {});

  const tableContainer = el('div', { className: 'table-container' });
  const loading = el('div', { className: 'loading' }, 'Loading checkins...');

  const legend = buildStatusLegend();

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

  function getRowClassName(c, isPointer) {
    const statusClass = getStatusClass(c.statusType || 'regular');
    const isMine = myCallsign && (c.callsign || '').toUpperCase() === myCallsign;
    return ['checkin-row', statusClass, isPointer ? 'checkin-row--pointer' : '', isMine ? 'checkin-row--mine' : '']
      .filter(Boolean).join(' ');
  }

  function renderTable() {
    checkinCount.textContent = `${checkins.length} checkins`;

    if (checkins.length === 0) {
      if (table) {
        table.remove();
        table = null;
        tbody = null;
      }
      rowMap.clear();
      if (!tableContainer.querySelector('.empty-state')) {
        tableContainer.innerHTML = '';
        tableContainer.appendChild(el('p', { className: 'empty-state' }, 'No checkins yet.'));
      }
      prevPointer = pointer;
      return;
    }

    // Build table shell on first render
    if (!table) {
      tableContainer.innerHTML = '';
      table = el('table', { className: 'checkin-table' });
      table.appendChild(buildCheckinThead(sortColumn, sortDirection, handleSort));
      tbody = el('tbody');
      table.appendChild(tbody);
      tableContainer.appendChild(table);
      prevSortKey = sortColumn;
      prevSortDir = sortDirection;
    }

    // Rebuild thead only when sort changes
    if (sortColumn !== prevSortKey || sortDirection !== prevSortDir) {
      const oldThead = table.querySelector('thead');
      if (oldThead) oldThead.remove();
      table.insertBefore(buildCheckinThead(sortColumn, sortDirection, handleSort), tbody);
      prevSortKey = sortColumn;
      prevSortDir = sortDirection;
    }

    const sorted = sortCheckins(checkins, sortColumn, sortDirection);
    const incomingKeys = new Set(sorted.map((c) => c.serialNo));

    // Diff rows: update existing, create new
    for (const c of sorted) {
      const isPointer = c.serialNo === pointer;
      const cells = getCheckinRowCells(c);
      const className = getRowClassName(c, isPointer);
      const existing = rowMap.get(c.serialNo);

      if (existing) {
        // Patch changed cells
        for (let i = 0; i < cells.length; i++) {
          if (existing.cellValues[i] !== cells[i]) {
            existing.cellEls[i].textContent = cells[i];
            existing.cellValues[i] = cells[i];
          }
        }
        // Patch className
        if (existing.className !== className) {
          existing.row.className = className;
          existing.className = className;
        }
        // appendChild moves existing nodes to correct sort position
        tbody.appendChild(existing.row);
      } else {
        // Create new row
        const cellEls = buildCheckinRowTds(cells);
        const row = el('tr', { className }, ...cellEls);
        tbody.appendChild(row);
        rowMap.set(c.serialNo, { row, cellEls, cellValues: cells, className });
      }
    }

    // Remove rows no longer present
    for (const [serialNo, entry] of rowMap) {
      if (!incomingKeys.has(serialNo)) {
        entry.row.remove();
        rowMap.delete(serialNo);
      }
    }

    // Scroll to pointer row on change
    if (pointer !== prevPointer && pointer !== 0) {
      const pointerRow = tbody?.querySelector('.checkin-row--pointer');
      if (pointerRow) {
        pointerRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
    prevPointer = pointer;
  }

  function onUpdate(data) {
    checkins = data.checkins || [];
    pointer = data.pointer || 0;
    age = data.age ?? 0;
    lastUpdate = Date.now();
    loading.style.display = 'none';
    clearError(container);
    renderTable();
    updateFreshness();
  }

  function loadCheckins() {
    loading.style.display = '';
    loading.textContent = 'Loading checkins...';
    clearError(container);

    getCheckins(serverName, netName).then(onUpdate).catch((err) => {
      loading.style.display = 'none';
      console.error(err);
      showError(container, tableContainer, 'Failed to load checkins.', loadCheckins);
    });
  }

  // Load initial data via REST
  loadCheckins();

  // Subscribe to SSE updates
  sse.removeAllListeners();
  sse.on('checkins', onUpdate);
  sse.connect({ subscribe: 'checkins', serverName, netName });

  ageTimer = setInterval(updateFreshness, 1000);

  function onCallsignChange(e) {
    myCallsign = (e.detail?.callsign || '').toUpperCase();
    // Re-diff all rows to update the --mine class
    renderTable();
  }
  document.addEventListener('callsign-change', onCallsignChange);

  return () => {
    clearInterval(ageTimer);
    document.removeEventListener('callsign-change', onCallsignChange);
    sse.removeAllListeners();
    sse.disconnect();
  };
}
