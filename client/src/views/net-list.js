import { el } from '../utils/dom.js';
import { formatAge } from '../utils/formatters.js';
import { sse } from '../sse.js';
import { getActiveNets } from '../api.js';

export function renderNetList(container) {
  let nets = [];
  let searchTerm = '';
  let age = null;
  let ageTimer = null;

  container.innerHTML = '';

  const searchInput = el('input', {
    className: 'search-bar',
    type: 'text',
    placeholder: 'Search nets...',
  });
  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    renderCards();
  });

  const freshnessBadge = el('span', { className: 'freshness-badge' });
  const header = el('div', { className: 'view-header' },
    searchInput,
    freshnessBadge,
  );

  const grid = el('div', { className: 'net-grid' });
  const loading = el('div', { className: 'loading' }, 'Loading active nets...');

  container.appendChild(header);
  container.appendChild(loading);
  container.appendChild(grid);

  function updateFreshness() {
    if (age != null) {
      const elapsed = age + (Date.now() - lastUpdate);
      freshnessBadge.textContent = `Updated ${formatAge(elapsed)}`;
    }
  }

  let lastUpdate = Date.now();

  function renderCards() {
    grid.innerHTML = '';
    const filtered = searchTerm
      ? nets.filter((n) => n.netName.toLowerCase().includes(searchTerm.toLowerCase()))
      : nets;

    if (filtered.length === 0 && nets.length > 0) {
      grid.appendChild(el('p', { className: 'empty-state' }, 'No nets match your search.'));
      return;
    }

    for (const net of filtered) {
      const card = el('a', {
        className: 'net-card',
        href: `#/net/${encodeURIComponent(net.serverName)}/${encodeURIComponent(net.netName)}`,
      },
        el('h3', { className: 'net-card__name' }, net.netName),
        el('div', { className: 'net-card__freq' },
          `${net.frequency} ${net.mode}`,
        ),
        el('div', { className: 'net-card__band' }, net.band),
        el('div', { className: 'net-card__meta' },
          el('span', {}, `NCS: ${net.netControl}`),
          el('span', {}, `${net.subscriberCount} monitoring`),
        ),
      );
      grid.appendChild(card);
    }
  }

  function onUpdate(data) {
    nets = Array.isArray(data) ? data : (data.nets || []);
    age = data.age ?? 0;
    lastUpdate = Date.now();
    loading.style.display = 'none';
    renderCards();
    updateFreshness();
  }

  // Load initial data via REST
  getActiveNets().then((data) => {
    onUpdate(data);
  }).catch((err) => {
    loading.textContent = 'Failed to load nets. Retrying...';
    console.error(err);
  });

  // Subscribe to SSE updates
  sse.removeAllListeners();
  const handler = sse.on('nets', (data) => onUpdate({ nets: data, age: 0 }));
  sse.connect({ subscribe: 'nets' });

  ageTimer = setInterval(updateFreshness, 1000);

  return () => {
    clearInterval(ageTimer);
    sse.removeAllListeners();
    sse.disconnect();
  };
}
