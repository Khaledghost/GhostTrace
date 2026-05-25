/**
 * Global toast notifications and API error surfacing.
 */
(() => {
  'use strict';

  let container;

  function ensureContainer() {
    if (container) return container;
    container = document.createElement('div');
    container.id = 'gt-toast-root';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
    return container;
  }

  function toast(message, type = 'info', durationMs = 4500) {
    const root = ensureContainer();
    const el = document.createElement('div');
    el.className = `gt-toast gt-toast--${type}`;
    el.textContent = message;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('gt-toast--show'));
    setTimeout(() => {
      el.classList.remove('gt-toast--show');
      setTimeout(() => el.remove(), 300);
    }, durationMs);
  }

  function handleApiError(err, context) {
    const msg = err?.message || 'Request failed';
    if (err?.status === 401) {
      toast('Session expired — redirecting to sign in', 'warn');
      setTimeout(() => { window.location.href = '/login.html'; }, 800);
      return;
    }
    if (err?.status === 403) {
      toast(msg || 'Permission denied', 'error');
      return;
    }
    if (err?.status >= 500) {
      toast(context ? `${context}: server error` : 'Server error — try again', 'error');
      return;
    }
    toast(context ? `${context}: ${msg}` : msg, 'error');
  }

  window.GT = { toast, handleApiError };
})();
