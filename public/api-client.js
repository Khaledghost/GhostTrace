/**
 * Authenticated API helper — all SOC routes require session cookie.
 */
(() => {
  'use strict';

  async function apiFetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const res = await fetch(path, {
      credentials: 'include',
      ...options,
      headers,
    });
    let data = {};
    const text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch { data = { error: text }; }
    }
    if (!res.ok) {
      const err = new Error(data.error || data.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  window.apiFetch = apiFetch;
})();
