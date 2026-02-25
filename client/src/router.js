const routes = [];
let currentCleanup = null;

export function addRoute(pattern, handler) {
  routes.push({ pattern, handler });
}

export function navigate(hash) {
  location.hash = hash;
}

function matchRoute(hash) {
  const path = hash.replace(/^#/, '') || '/';

  for (const route of routes) {
    const params = matchPattern(route.pattern, path);
    if (params !== null) {
      return { handler: route.handler, params, pattern: route.pattern };
    }
  }
  return null;
}

function matchPattern(pattern, path) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

function getTitle(match) {
  if (!match) return 'NetDeck Radio';
  switch (match.pattern) {
    case '/': return 'Active Nets \u2014 NetDeck Radio';
    case '/net/:serverName/:netName': return `${match.params.netName} \u2014 NetDeck Radio`;
    case '/past': return 'Past Nets \u2014 NetDeck Radio';
    case '/past/:serverName/:netName/:netId': return `${match.params.netName} (closed) \u2014 NetDeck Radio`;
    default: return 'NetDeck Radio';
  }
}

function updateNavActive(path) {
  document.querySelectorAll('.app-header__link').forEach((link) => {
    const href = link.getAttribute('href');
    let active = false;
    if (href === '#/') {
      active = path === '/' || path.startsWith('/net/');
    } else if (href === '#/past') {
      active = path.startsWith('/past');
    }
    link.classList.toggle('app-header__link--active', active);
  });
}

function onHashChange() {
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  const match = matchRoute(location.hash);
  const app = document.getElementById('app');
  const path = location.hash.replace(/^#/, '') || '/';

  document.title = getTitle(match);
  updateNavActive(path);

  // View transition: fade out, swap, fade in
  app.classList.add('view-exit');
  setTimeout(() => {
    if (match) {
      currentCleanup = match.handler(app, match.params) || null;
    } else {
      app.innerHTML = '<p class="error">Page not found</p>';
    }
    requestAnimationFrame(() => {
      app.classList.remove('view-exit');
    });
  }, 120);
}

export function startRouter() {
  window.addEventListener('hashchange', onHashChange);
  onHashChange();
}
