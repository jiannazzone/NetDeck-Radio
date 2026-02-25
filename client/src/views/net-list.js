import { el } from '../utils/dom.js';
import { formatAge, formatNetDuration } from '../utils/formatters.js';
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

  const liveIndicator = el('span', { className: 'live-indicator' },
    el('span', { className: 'live-dot' }),
    'Live',
  );
  const netCount = el('span', { className: 'net-count' });
  const freshnessBadge = el('span', { className: 'freshness-badge' });

  const header = el('div', { className: 'view-header' },
    searchInput,
    el('div', { className: 'view-header__right' },
      liveIndicator,
      netCount,
      freshnessBadge,
    ),
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

    netCount.textContent = searchTerm
      ? `${filtered.length} of ${nets.length}`
      : `${nets.length} nets`;

    if (filtered.length === 0 && nets.length > 0) {
      grid.appendChild(el('p', { className: 'empty-state' }, 'No nets match your search.'));
      return;
    }

    filtered.forEach((net, index) => {
      const metaItems = [];
      if (net.netControl) {
        metaItems.push(el('span', { className: 'net-card__meta-item' },
          el('span', { className: 'net-card__meta-label' }, 'NCS'),
          ` ${net.netControl}`,
        ));
      }
      if (net.logger) {
        metaItems.push(el('span', { className: 'net-card__meta-item' },
          el('span', { className: 'net-card__meta-label' }, 'Log'),
          ` ${net.logger}`,
        ));
      }

      const statsItems = [];
      if (net.subscriberCount > 0) {
        statsItems.push(el('span', {}, `${net.subscriberCount} monitoring`));
      }
      if (net.date) {
        statsItems.push(el('span', {}, formatNetDuration(net.date)));
      }

      const card = el('a', {
        className: 'net-card',
        href: `#/net/${encodeURIComponent(net.serverName)}/${encodeURIComponent(net.netName)}`,
      },
        el('h3', { className: 'net-card__name' }, net.netName),
        el('div', { className: 'net-card__freq' },
          `${net.frequency} ${net.mode}`,
        ),
        el('div', { className: 'net-card__band' }, net.band),
        el('div', { className: 'net-card__meta' }, ...metaItems),
        el('div', { className: 'net-card__stats' }, ...statsItems),
      );

      // Stagger card entrance animation
      card.style.animationDelay = `${index * 0.04}s`;

      grid.appendChild(card);
    });
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
