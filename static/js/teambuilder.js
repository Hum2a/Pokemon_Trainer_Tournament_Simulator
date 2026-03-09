/**
 * Team Builder - Pokemon set creation
 */

const TeamBuilder = {
  dexData: { species: [], moves: [], abilities: [], items: [], learnsets: {}, natures: [] },
  team: [],

  toId(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  },

  async loadDexData() {
    try {
      const [species, moves, abilities, items, learnsets, natures] = await Promise.all([
        API.get('/dex/species').catch(() => []),
        API.get('/dex/moves').catch(() => []),
        API.get('/dex/abilities').catch(() => []),
        API.get('/dex/items').catch(() => []),
        API.get('/dex/learnsets').catch(() => ({})),
        API.get('/dex/natures').catch(() => []),
      ]);
      this.dexData = { species, moves, abilities, items, learnsets, natures };
      if (species.length === 0) {
        Logger.append('Dex data not loaded. Run Data/UsefulDatasets/fetch_dex_data.py first.', 'error');
        return;
      }
      const itemSelect = document.getElementById('builderItem');
      itemSelect.innerHTML = '<option value="">(none)</option>' + items.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
      const natureSelect = document.getElementById('builderNature');
      natureSelect.innerHTML = natures.map(n => `<option value="${n}">${n}</option>`).join('');
    } catch (e) {
      Logger.append('Failed to load dex data: ' + e.message, 'error');
    }
  },

  selectSpecies(species) {
    const sel = this.dexData.species.find(s => s.id === species.id || s.name === species.name);
    if (!sel) return;
    document.getElementById('builderSpecies').value = sel.name;
    document.getElementById('builderSpeciesList').innerHTML = '';
    document.getElementById('builderSpeciesList').style.display = 'none';

    const abs = sel.abilities || {};
    const abOpts = Object.values(abs).filter(Boolean);
    document.getElementById('builderAbility').innerHTML = abOpts.length ? abOpts.map(a => `<option value="${a}">${a}</option>`).join('') : '<option value="">(unknown)</option>';

    const baseId = (sel.baseSpecies && sel.baseSpecies !== sel.name) ? this.toId(sel.baseSpecies) : sel.id;
    let learnset = this.dexData.learnsets[sel.id] || this.dexData.learnsets[this.toId(sel.name)] || this.dexData.learnsets[baseId] || [];
    if (learnset.length === 0) learnset = this.dexData.moves.map(m => m.id);
    const moveOpts = learnset.map(mid => {
      const m = this.dexData.moves.find(x => this.toId(x.id) === this.toId(mid));
      return m ? { id: m.id, name: m.name } : { id: mid, name: mid.replace(/([a-z])([A-Z])/g, '$1 $2') };
    }).sort((a, b) => a.name.localeCompare(b.name));
    ['builderMove1', 'builderMove2', 'builderMove3', 'builderMove4'].forEach(id => {
      document.getElementById(id).innerHTML = '<option value="">(none)</option>' + moveOpts.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
    });
  },

  buildSet() {
    const species = document.getElementById('builderSpecies').value;
    const level = document.getElementById('builderLevel').value || 50;
    const ability = document.getElementById('builderAbility').value;
    const item = document.getElementById('builderItem').value;
    const nature = document.getElementById('builderNature').value;
    const moves = [1, 2, 3, 4].map(i => document.getElementById(`builderMove${i}`).value).filter(Boolean);
    if (!species) return null;
    const speciesLine = item ? `${species} @ ${item}` : species;
    let out = `|${speciesLine}\nLevel: ${level}\n${nature} Nature\n`;
    if (ability) out += `Ability: ${ability}\n`;
    moves.forEach(m => out += `- ${m}\n`);
    return out;
  },

  addToTeam() {
    const set = this.buildSet();
    if (set) {
      this.team.push(set);
      this.renderTeam();
      Logger.append('Added to team.');
    }
  },

  exportToEditor() {
    if (this.team.length === 0) {
      Logger.append('Add at least one Pokemon first.', 'error');
      return;
    }
    const content = this.team.join('\n') + '\n';
    const editor = document.getElementById('fileEditor');
    const current = editor.value;
    editor.value = current ? current.trimEnd() + '\n\n' + content : content;
    document.getElementById('editorFileSelect').value = 'Inputs/GymLeaderPokemon.txt';
    Logger.append(`Exported ${this.team.length} Pokemon(s) to editor.`);
  },

  escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  },

  renderTeam() {
    const el = document.getElementById('builderTeamList');
    el.innerHTML = this.team.map((set, i) => {
      const firstLine = this.escapeHtml(set.split('\n')[0].replace('|', ''));
      return `<div class="builder-team-item"><span>${firstLine}</span><span class="remove" data-idx="${i}">×</span></div>`;
    }).join('');
    el.querySelectorAll('.remove').forEach(btn => {
      btn.addEventListener('click', () => {
        this.team.splice(parseInt(btn.dataset.idx), 1);
        this.renderTeam();
      });
    });
  },

  init() {
    document.getElementById('builderSpecies').addEventListener('input', () => {
      const q = document.getElementById('builderSpecies').value.trim().toLowerCase();
      const list = document.getElementById('builderSpeciesList');
      if (q.length < 2) {
        list.innerHTML = '';
        list.style.display = 'none';
        return;
      }
      const matches = this.dexData.species.filter(s => s.name.toLowerCase().includes(q) || s.id.includes(q)).slice(0, 20);
      list.innerHTML = matches.map(s => `<div class="dropdown-item" data-id="${s.id}" data-name="${s.name}">${s.name}</div>`).join('');
      list.style.display = matches.length ? 'block' : 'none';
      list.querySelectorAll('.dropdown-item').forEach(el => {
        el.addEventListener('click', () => this.selectSpecies({ id: el.dataset.id, name: el.dataset.name }));
      });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#builderSpecies') && !e.target.closest('#builderSpeciesList')) {
        document.getElementById('builderSpeciesList').style.display = 'none';
      }
    });

    document.getElementById('builderAdd').addEventListener('click', () => this.addToTeam());
    document.getElementById('builderExport').addEventListener('click', () => this.exportToEditor());

    this.loadDexData();
  },
};
