/**
 * Pokemon Builds file editor
 */

const FileEditor = {
  async load() {
    const path = document.getElementById('editorFileSelect').value;
    try {
      const data = await API.post('/files/read', { path });
      document.getElementById('fileEditor').value = data.content;
      Logger.append(`Loaded ${path}`);
    } catch (e) {
      Logger.append('Load failed: ' + e.message, 'error');
    }
  },

  async save() {
    const path = document.getElementById('editorFileSelect').value;
    const content = document.getElementById('fileEditor').value;
    try {
      await API.post('/files/write', { path, content });
      Logger.append(`Saved ${path}`);
    } catch (e) {
      Logger.append('Save failed: ' + e.message, 'error');
    }
  },

  async loadExample() {
    const path = 'Inputs/Videos/Trainer Tournament 1+2/GymLeaderPokemon.txt';
    try {
      const data = await API.post('/files/read', { path });
      document.getElementById('fileEditor').value = data.content;
      document.getElementById('editorFileSelect').value = 'Inputs/GymLeaderPokemon.txt';
      Logger.append('Loaded example. Save to overwrite your file.');
    } catch (e) {
      Logger.append('Example not found: ' + e.message, 'error');
    }
  },

  init() {
    document.getElementById('loadFile').addEventListener('click', () => this.load());
    document.getElementById('saveFile').addEventListener('click', () => this.save());
    document.getElementById('loadExample').addEventListener('click', () => this.loadExample());

    document.getElementById('editorFileSelect').addEventListener('change', () => {
      const path = document.getElementById('editorFileSelect').value;
      if (path === 'Inputs/GymLeaderPokemon.txt') {
        document.getElementById('trainerFilename').value = path;
      }
    });

    document.getElementById('clearLog').addEventListener('click', () => Logger.clear());
  },
};
