/**
 * Settings configuration
 */

const Config = {
  async load() {
    try {
      const config = await API.get('/config');
      const t = config.trainer || {};
      const p = config.pokemon || {};
      const parse = config.parse || {};

      document.getElementById('trainerThreads').value = t.noOfThreads ?? 4;
      document.getElementById('trainerLevel').value = t.setLevel ?? 50;
      document.getElementById('runNTimes').value = t.run_n_times ?? 100;
      document.getElementById('trainerN').value = t.n ?? '';
      document.getElementById('randomiseTeams').checked = t.RandomiseTeams ?? false;
      document.getElementById('trainerFilename').value = t.filename ?? 'Inputs/GymLeaderPokemon.txt';

      document.getElementById('pokemonThreads').value = p.noOfThreads ?? 4;
      document.getElementById('pokemonN').value = p.n ?? 2000;

      document.getElementById('outputFile').value = parse.output_file ?? 'output.txt';
    } catch (e) {
      Logger.append('Failed to load config: ' + e.message, 'error');
    }
  },

  async save() {
    const config = {
      trainer: {
        noOfThreads: parseInt(document.getElementById('trainerThreads').value) || 4,
        setLevel: parseInt(document.getElementById('trainerLevel').value) || null,
        RandomiseTeams: document.getElementById('randomiseTeams').checked,
        n: document.getElementById('trainerN').value ? parseInt(document.getElementById('trainerN').value) : null,
        run_n_times: parseInt(document.getElementById('runNTimes').value) || 100,
        filename: document.getElementById('trainerFilename').value || 'Inputs/GymLeaderPokemon.txt',
      },
      pokemon: {
        noOfThreads: parseInt(document.getElementById('pokemonThreads').value) || 4,
        n: document.getElementById('pokemonN').value ? parseInt(document.getElementById('pokemonN').value) : 2000,
      },
      parse: {
        output_file: document.getElementById('outputFile').value || 'output.txt',
      },
    };
    try {
      await API.post('/config', config);
      Logger.append('Settings saved.');
    } catch (e) {
      Logger.append('Failed to save: ' + e.message, 'error');
    }
  },
};
