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

  const cardMap = new Map(); // key -> { card, nameEl, freqEl, bandEl, metaEl, statsEl, net }
  let isFirstRender = true;

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
  const liveIndicator = el('span', { className: 'live-indicator', role: 'status', 'aria-live': 'polite' }, liveDot, liveText);

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

  function netKey(net) {
    return `${net.serverName}::${net.netName}`;
  }

  function createCard(net, index) {
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

    const nameEl = el('h3', { className: 'net-card__name' }, net.netName);
    const freqEl = el('div', { className: 'net-card__freq' }, freqText);
    const bandEl = net.band ? el('div', { className: 'net-card__band' }, net.band) : null;
    const metaEl = el('div', { className: 'net-card__meta' }, ...metaItems);
    const statsEl = el('div', { className: 'net-card__stats' }, ...statsItems);

    const children = [nameEl, freqEl];
    if (bandEl) children.push(bandEl);
    children.push(metaEl, statsEl);

    const card = el('a', {
      className: 'net-card',
      href: `#/net/${encodeURIComponent(net.serverName)}/${encodeURIComponent(net.netName)}`,
      'aria-label': net.netName,
    }, ...children);

    if (isFirstRender) {
      // Stagger card entrance animation on initial load
      card.style.animationDelay = `${index * 0.04}s`;
    } else {
      // New net appearing after initial load — green glow entrance
      card.classList.add('net-card--new');
      card.addEventListener('animationend', () => {
        card.classList.remove('net-card--new');
      }, { once: true });
    }

    return { card, nameEl, freqEl, bandEl, metaEl, statsEl, net };
  }

  function updateCard(entry, net) {
    const prev = entry.net;

    // Update frequency + mode
    const freqText = net.frequency
      ? `${net.frequency}${net.mode ? ` ${net.mode}` : ''}`
      : '\u2014';
    const prevFreqText = prev.frequency
      ? `${prev.frequency}${prev.mode ? ` ${prev.mode}` : ''}`
      : '\u2014';
    if (freqText !== prevFreqText) {
      entry.freqEl.textContent = freqText;
    }

    // Update band
    if (net.band !== prev.band) {
      if (net.band && entry.bandEl) {
        entry.bandEl.textContent = net.band;
      } else if (net.band && !entry.bandEl) {
        entry.bandEl = el('div', { className: 'net-card__band' }, net.band);
        entry.card.insertBefore(entry.bandEl, entry.metaEl);
      } else if (!net.band && entry.bandEl) {
        entry.bandEl.remove();
        entry.bandEl = null;
      }
    }

    // Update meta (NCS / Logger)
    if (net.netControl !== prev.netControl || net.logger !== prev.logger) {
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
      entry.metaEl.replaceChildren(...metaItems);
    }

    // Update stats (subscriber count / duration)
    if (net.subscriberCount !== prev.subscriberCount || net.date !== prev.date) {
      const statsItems = [];
      if (net.subscriberCount > 0) {
        statsItems.push(el('span', {}, `${net.subscriberCount} monitoring`));
      }
      if (net.date) {
        statsItems.push(el('span', {}, formatNetDuration(net.date)));
      }
      entry.statsEl.replaceChildren(...statsItems);
    }

    // Update href in case serverName changed (unlikely but safe)
    const href = `#/net/${encodeURIComponent(net.serverName)}/${encodeURIComponent(net.netName)}`;
    if (entry.card.getAttribute('href') !== href) {
      entry.card.setAttribute('href', href);
    }

    entry.net = net;
  }

  function syncCards() {
    const incomingKeys = new Set();

    nets.forEach((net, index) => {
      const key = netKey(net);
      incomingKeys.add(key);

      const existing = cardMap.get(key);
      if (existing) {
        updateCard(existing, net);
      } else {
        const entry = createCard(net, index);
        cardMap.set(key, entry);
      }
    });

    // Remove cards for nets that are no longer active
    for (const [key, entry] of cardMap) {
      if (!incomingKeys.has(key)) {
        entry.card.remove();
        cardMap.delete(key);
      }
    }

    isFirstRender = false;
  }

  function renderCards() {
    const filtered = searchTerm
      ? nets.filter((n) => n.netName.toLowerCase().includes(searchTerm.toLowerCase()))
      : nets;

    netCount.textContent = searchTerm
      ? `${filtered.length} of ${nets.length}`
      : `${nets.length} nets`;

    if (nets.length === 0) {
      grid.replaceChildren(el('p', { className: 'empty-state empty-state--dim' }, 'No active nets right now.'));
      return;
    }

    if (filtered.length === 0) {
      grid.replaceChildren(el('p', { className: 'empty-state' }, 'No nets match your search.'));
      return;
    }

    // Collect cards in filtered order — cards not matching search are simply detached
    const filteredCards = filtered.map((net) => {
      const entry = cardMap.get(netKey(net));
      return entry ? entry.card : null;
    }).filter(Boolean);

    grid.replaceChildren(...filteredCards);
  }

  function onUpdate(data) {
    nets = Array.isArray(data) ? data : (data.nets || []);
    age = data.age ?? 0;
    lastUpdate = Date.now();
    loading.style.display = 'none';
    syncCards();
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
  sse.on('nets', (data) => {
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
