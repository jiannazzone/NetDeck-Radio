import { el } from '../utils/dom.js';
import { formatAge, formatNetDuration } from '../utils/formatters.js';
import { sse } from '../sse.js';
import { getActiveNets } from '../api.js';

export function renderNetList(container) {
  let nets = [];
  let searchTerm = '';
  let age = null;
  let ageTimer = null;
  let searchTimer = null;

  container.innerHTML = '';

  const searchInput = el('input', {
    className: 'search-bar',
    type: 'text',
    placeholder: 'Search nets...',
  });
  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderCards, 150);
  });

  const liveDot = el('span', { className: 'live-dot' });
  const liveText = document.createTextNode('Live');
  const liveIndicator = el('span', { className: 'live-indicator' }, liveDot, liveText);

  sse.onStateChange = (state) => {
    if (state === 'connected') {
      liveIndicator.className = 'live-indicator';
      liveText.textContent = 'Live';
    } else {
      liveIndicator.className = 'live-indicator live-indicator--warn';
      liveText.textContent = 'Reconnecting\u2026';
    }
  };

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

    if (nets.length === 0) {
      grid.appendChild(el('p', { className: 'empty-state empty-state--dim' }, 'No active nets right now.'));
      return;
    }

    if (filtered.length === 0) {
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

      const freqText = net.frequency
        ? `${net.frequency}${net.mode ? ` ${net.mode}` : ''}`
        : '\u2014';

      const card = el('a', {
        className: 'net-card',
        href: `#/net/${encodeURIComponent(net.serverName)}/${encodeURIComponent(net.netName)}`,
      },
        el('h3', { className: 'net-card__name' }, net.netName),
        el('div', { className: 'net-card__freq' }, freqText),
        ...(net.band ? [el('div', { className: 'net-card__band' }, net.band)] : []),
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

  function loadNets() {
    loading.style.display = '';
    loading.textContent = 'Loading active nets...';
    // Remove any existing error state
    const existingError = container.querySelector('.error-state');
    if (existingError) existingError.remove();

    getActiveNets().then((data) => {
      onUpdate(data);
    }).catch((err) => {
      loading.style.display = 'none';
      console.error(err);
      const existingErr = container.querySelector('.error-state');
      if (existingErr) existingErr.remove();
      const errorDiv = el('div', { className: 'error-state' },
        el('p', {}, 'Failed to load nets.'),
        el('button', { className: 'retry-btn', onClick: loadNets }, 'Retry'),
      );
      container.insertBefore(errorDiv, grid);
    });
  }

  // Load initial data via REST
  loadNets();

  // Subscribe to SSE updates
  sse.removeAllListeners();
  const handler = sse.on('nets', (data) => {
    const existingError = container.querySelector('.error-state');
    if (existingError) existingError.remove();
    onUpdate({ nets: data, age: 0 });
  });
  sse.connect({ subscribe: 'nets' });

  ageTimer = setInterval(updateFreshness, 1000);

  return () => {
    clearInterval(ageTimer);
    clearTimeout(searchTimer);
    sse.onStateChange = null;
    sse.removeAllListeners();
    sse.disconnect();
  };
}
