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
      return { handler: route.handler, params };
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

function onHashChange() {
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  const match = matchRoute(location.hash);
  const app = document.getElementById('app');

  if (match) {
    currentCleanup = match.handler(app, match.params) || null;
  } else {
    app.innerHTML = '<p class="error">Page not found</p>';
  }

  // Update active nav link
  document.querySelectorAll('.app-header__link').forEach((link) => {
    const href = link.getAttribute('href');
    link.classList.toggle(
      'app-header__link--active',
      location.hash === href || (href === '#/' && !location.hash),
    );
  });
}

export function startRouter() {
  window.addEventListener('hashchange', onHashChange);
  onHashChange();
}
