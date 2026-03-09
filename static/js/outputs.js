/**
 * Outputs section - file downloads
 */

const Outputs = {
  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  },

  async refresh() {
    const grid = document.getElementById('outputsGrid');
    if (!grid) return;
    try {
      const files = await API.get('/outputs');
      if (files.length === 0) {
        grid.innerHTML = '<p class="muted">Run simulations and parse to generate outputs.</p>';
        return;
      }
      grid.innerHTML = files.map(f => `
        <div class="output-item">
          <a href="${API.base}/outputs/${encodeURIComponent(f.name)}" download>${f.name}</a>
          <span class="size">(${this.formatSize(f.size)})</span>
        </div>
      `).join('');
    } catch (e) {
      grid.innerHTML = '<p class="muted">Could not load outputs.</p>';
    }
  },

  init() {
    document.getElementById('refreshOutputs').addEventListener('click', () => this.refresh());
  },
};
