/**
 * API client for Pokemon Battle Simulator
 */

const API = {
  base: '/api',

  async get(endpoint) {
    const res = await fetch(`${this.base}${endpoint}`);
    return res.ok ? res.json() : Promise.reject(new Error(res.statusText));
  },

  async post(endpoint, body) {
    const res = await fetch(`${this.base}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(window.App?.csrf?.header || {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  },
};
