import { el, showError, clearError } from '../utils/dom.js';
import { formatAge, formatNetDuration } from '../utils/formatters.js';
import { sse } from '../sse.js';
import { getActiveNets } from '../api.js';

const SORT_OPTIONS = [
  { key: 'time', label: 'Time', defaultDir: 'desc' },
  { key: 'name', label: 'A–Z', defaultDir: 'asc' },
  { key: 'active', label: 'Activity', defaultDir: 'desc' },
  { key: 'frequency', label: 'Frequency', defaultDir: 'asc' },
];

const SORT_KEYS = new Set(SORT_OPTIONS.map((o) => o.key));

function loadSortPrefs() {
  const key = localStorage.getItem('netdeck:sortKey');
  const dir = localStorage.getItem('netdeck:sortDir');
  return {
    sortKey: SORT_KEYS.has(key) ? key : 'time',
    sortDir: dir === 'asc' || dir === 'desc' ? dir : 'desc',
  };
}

function saveSortPrefs(key, dir) {
  localStorage.setItem('netdeck:sortKey', key);
  localStorage.setItem('netdeck:sortDir', dir);
}

export function renderNetList(container) {
  let nets = [];
  let searchTerm = '';
  const savedSort = loadSortPrefs();
  let sortKey = savedSort.sortKey;
  let sortDir = savedSort.sortDir;
  let age = null;
  let ageTimer = null;
  let searchTimer = null;

  const cardMap = new Map(); // key -> { card, nameEl, freqEl, bandEl, freqRow, metaEl, statsEl, net }
  let isFirstRender = true;

  container.innerHTML = '';

  const searchInput = el('input', {
    className: 'search-bar',
    type: 'text',
    placeholder: 'Search nets...',
    'aria-label': 'Search nets',
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
    } else if (state === 'failed') {
      liveIndicator.className = 'live-indicator live-indicator--dim';
      liveText.textContent = 'Disconnected';
    } else {
      liveIndicator.className = 'live-indicator live-indicator--warn';
      liveText.textContent = 'Reconnecting\u2026';
    }
  };

  const netCount = el('span', { className: 'net-count' });
  const freshnessBadge = el('span', { className: 'freshness-badge' });

  // Segment control for sort selection
  const sortControl = el('div', { className: 'segment-control' });
  const sortButtons = [];

  function updateSortButtons() {
    for (const { btn, option, arrow } of sortButtons) {
      const isActive = option.key === sortKey;
      btn.classList.toggle('segment-control__btn--active', isActive);
      arrow.textContent = isActive ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';
    }
  }

  for (const option of SORT_OPTIONS) {
    const arrow = el('span', { className: 'sort-indicator' });
    const btn = el('button', {
      className: `segment-control__btn${option.key === sortKey ? ' segment-control__btn--active' : ''}`,
      onClick: () => {
        if (sortKey === option.key) {
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortKey = option.key;
          sortDir = option.defaultDir;
        }
        saveSortPrefs(sortKey, sortDir);
        updateSortButtons();
        renderCards();
      },
    }, option.label, arrow);
    sortButtons.push({ btn, option, arrow });
    sortControl.appendChild(btn);
  }

  updateSortButtons();

  const header = el('div', { className: 'view-header' },
    searchInput,
    el('div', { className: 'view-header__right' },
      sortControl,
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
    const bandEl = net.band ? el('span', { className: 'net-card__band' }, net.band) : null;
    const freqRowChildren = [freqEl];
    if (bandEl) freqRowChildren.push(bandEl);
    const freqRow = el('div', { className: 'net-card__freq-row' }, ...freqRowChildren);
    const metaEl = el('div', { className: 'net-card__meta' }, ...metaItems);
    const statsEl = el('div', { className: 'net-card__stats' }, ...statsItems);

    const children = [nameEl, freqRow, metaEl, statsEl];

    const card = el('a', {
      className: 'net-card',
      href: `#/net/${encodeURIComponent(net.serverName)}/${encodeURIComponent(net.netName)}`,
      'aria-label': net.netName,
    }, ...children);

    if (isFirstRender) {
      // Stagger card entrance animation on initial load
      card.style.animationDelay = `${index * 0.04}s`;
      card.addEventListener('animationend', () => {
        card.classList.add('net-card--settled');
        card.style.animationDelay = '';
      }, { once: true });
    } else {
      // New net appearing after initial load — green glow entrance
      card.classList.add('net-card--new');
      card.addEventListener('animationend', () => {
        card.classList.remove('net-card--new');
        card.classList.add('net-card--settled');
      }, { once: true });
    }

    return { card, nameEl, freqEl, bandEl, freqRow, metaEl, statsEl, net };
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
        entry.bandEl = el('span', { className: 'net-card__band' }, net.band);
        entry.freqRow.appendChild(entry.bandEl);
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

  function sortNets(list) {
    const sorted = list.slice();
    const dir = sortDir === 'desc' ? -1 : 1;

    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'time': {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return (new Date(a.date) - new Date(b.date)) * dir;
        }
        case 'name': {
          if (!a.netName && !b.netName) return 0;
          if (!a.netName) return 1;
          if (!b.netName) return -1;
          return (a.netName).localeCompare(b.netName, undefined, { sensitivity: 'base' }) * dir;
        }
        case 'active': {
          const ac = a.subscriberCount || 0;
          const bc = b.subscriberCount || 0;
          if (ac === 0 && bc === 0) return 0;
          if (ac === 0) return 1;
          if (bc === 0) return -1;
          return (ac - bc) * dir;
        }
        case 'frequency': {
          const fa = parseFloat(a.frequency);
          const fb = parseFloat(b.frequency);
          const aValid = !isNaN(fa);
          const bValid = !isNaN(fb);
          if (!aValid && !bValid) return (a.netName || '').localeCompare(b.netName || '', undefined, { sensitivity: 'base' });
          if (!aValid) return 1;
          if (!bValid) return -1;
          if (fa !== fb) return (fa - fb) * dir;
          return (a.netName || '').localeCompare(b.netName || '', undefined, { sensitivity: 'base' });
        }
        default:
          return 0;
      }
    });

    return sorted;
  }

  function renderCards() {
    const filtered = searchTerm
      ? nets.filter((n) => (n.netName || '').toLowerCase().includes(searchTerm.toLowerCase()))
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

    // Sort then collect cards — cards not matching search are simply detached
    const sorted = sortNets(filtered);
    const filteredCards = sorted.map((net) => {
      const entry = cardMap.get(netKey(net));
      return entry ? entry.card : null;
    }).filter(Boolean);

    // --- FLIP animation for reordering ---

    // FIRST: snapshot current positions of cards already in the grid
    const beforeRects = new Map();
    const currentChildren = Array.from(grid.children);
    for (const child of currentChildren) {
      if (child.classList && child.classList.contains('net-card')) {
        beforeRects.set(child, child.getBoundingClientRect());
      }
    }

    // Check if order actually changed — skip animation if identical
    const orderChanged = filteredCards.length !== currentChildren.length ||
      filteredCards.some((card, i) => card !== currentChildren[i]);

    if (!orderChanged) return;

    // LAST: apply new DOM order
    grid.replaceChildren(...filteredCards);

    // Mark all existing cards as settled so replaceChildren doesn't replay
    // the cardIn entrance animation (which would fight the FLIP transform)
    for (const card of filteredCards) {
      if (beforeRects.has(card)) {
        card.classList.add('net-card--settled');
      }
    }

    // INVERT: for each card that was already visible, compute delta and
    // apply inverse transform so it visually stays at its old position
    const movedCards = [];
    for (const card of filteredCards) {
      const before = beforeRects.get(card);
      if (!before) continue; // new card — entrance animation handles it

      const after = card.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;

      if (dx === 0 && dy === 0) continue;

      card.style.transform = `translate(${dx}px, ${dy}px)`;
      card.style.transition = 'none';
      movedCards.push(card);
    }

    if (movedCards.length === 0) return;

    // Force reflow so the inverted positions take effect
    void grid.offsetHeight;

    // PLAY: animate each card from its old position to its new one
    for (const card of movedCards) {
      card.style.transition = 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)';
      card.style.transform = 'translate(0, 0)';

      card.addEventListener('transitionend', function cleanup(e) {
        if (e.propertyName === 'transform') {
          card.style.transition = '';
          card.style.transform = '';
          card.removeEventListener('transitionend', cleanup);
        }
      });
    }
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
    clearError(container);

    getActiveNets().then((data) => {
      onUpdate(data);
    }).catch((err) => {
      loading.style.display = 'none';
      console.error(err);
      showError(container, grid, 'Failed to load nets.', loadNets);
    });
  }

  // Load initial data via REST
  loadNets();

  // Subscribe to SSE updates
  sse.removeAllListeners();
  sse.on('nets', (data) => {
    clearError(container);
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
