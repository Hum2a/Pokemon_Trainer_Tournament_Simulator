/**
 * Build, run, and parse actions
 */

const Actions = {
  pollInterval: null,

  async callAction(endpoint, label) {
    Logger.setStatus(true, label + '...');
    Logger.append(`Starting: ${label}`);
    try {
      const data = await API.post(`/${endpoint}`);
      if (data.output) Logger.append(data.output);
      Logger.append(`${label} completed.`);
      Outputs.refresh();
    } catch (e) {
      Logger.append(`${label} failed: ${e.message}`, 'error');
    }
    Logger.setStatus(false, 'Ready');
  },

  startPolling() {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(async () => {
      try {
        const data = await API.get('/status');
        const logEl = document.getElementById('logOutput');
        if (data.output && logEl) {
          logEl.textContent = data.output;
          logEl.scrollTop = logEl.scrollHeight;
        }
        if (!data.running) {
          clearInterval(this.pollInterval);
          this.pollInterval = null;
          Logger.setStatus(false, 'Ready');
          Logger.append('Task finished.');
          Outputs.refresh();
        }
      } catch (e) {}
    }, 1000);
  },

  async runTrainer() {
    await Config.save();
    Logger.setStatus(true, 'Running trainer simulations...');
    Logger.append('Starting trainer simulations (this may take a while).');
    try {
      await API.post('/run-trainer');
      this.startPolling();
    } catch (e) {
      Logger.append('Error: ' + e.message, 'error');
      Logger.setStatus(false, 'Ready');
    }
  },

  async runPokemon() {
    await Config.save();
    Logger.setStatus(true, 'Running Pokemon simulations...');
    Logger.append('Starting Pokemon simulations (this may take a while).');
    try {
      await API.post('/run-pokemon');
      this.startPolling();
    } catch (e) {
      Logger.append('Error: ' + e.message, 'error');
      Logger.setStatus(false, 'Ready');
    }
  },

  init() {
    document.getElementById('saveSettings').addEventListener('click', () => Config.save());

    document.getElementById('buildTrainer').addEventListener('click', async () => {
      await Config.save();
      await this.callAction('build-trainer', 'Build Trainer Battles');
    });
    document.getElementById('buildPokemon').addEventListener('click', async () => {
      await this.callAction('build-pokemon', 'Build Pokemon vs Leaders');
    });
    document.getElementById('runTrainer').addEventListener('click', () => this.runTrainer());
    document.getElementById('runPokemon').addEventListener('click', () => this.runPokemon());
    document.getElementById('parsePng').addEventListener('click', async () => {
      await Config.save();
      await this.callAction('parse-png', 'Parse to PNG');
    });
    document.getElementById('parseCsv').addEventListener('click', async () => {
      await Config.save();
      await this.callAction('parse-csv', 'Parse to CSV');
    });
  },
};
