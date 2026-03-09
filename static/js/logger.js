/**
 * Logging and status display
 */

const Logger = {
  logEl: null,
  statusEl: null,
  statusTextEl: null,

  init() {
    this.logEl = document.getElementById('logOutput');
    this.statusEl = document.getElementById('status');
    this.statusTextEl = document.getElementById('statusText');
  },

  append(text, type = 'info') {
    if (!this.logEl) return;
    const line = document.createElement('div');
    line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    if (type === 'error') line.style.color = 'var(--danger)';
    this.logEl.appendChild(line);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  },

  clear() {
    if (this.logEl) this.logEl.innerHTML = '';
  },

  setStatus(running, text) {
    if (!this.statusEl || !this.statusTextEl) return;
    const dot = this.statusEl.querySelector('.status-dot');
    if (dot) dot.className = 'status-dot ' + (running ? 'running' : 'idle');
    this.statusTextEl.textContent = text;
  },
};
