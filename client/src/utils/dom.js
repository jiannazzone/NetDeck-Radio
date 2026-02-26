export function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      element.className = value;
    } else if (key.startsWith('on')) {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      element.setAttribute(key, value);
    }
  }

  for (const child of children) {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child) {
      element.appendChild(child);
    }
  }

  return element;
}

export function clearError(container) {
  const existing = container.querySelector('.error-state');
  if (existing) existing.remove();
}

export function showError(parent, beforeEl, message, onRetry) {
  clearError(parent);
  const errorDiv = el('div', { className: 'error-state' },
    el('p', {}, message),
    el('button', { className: 'retry-btn', onClick: onRetry }, 'Retry'),
  );
  parent.insertBefore(errorDiv, beforeEl);
}
