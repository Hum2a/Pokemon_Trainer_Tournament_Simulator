/**
 * Team Builder - Pokemon set creation with filters and Smogon import
 */

const TeamBuilder = {
  dexData: { species: [], moves: [], abilities: [], items: [], learnsets: {}, natures: [] },
  team: [],
  smogonSets: null,
  selectedSpecies: null,

  toId(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  },

  getFilteredSpecies() {
    const typeFilter = document.getElementById('builderFilterType')?.value || '';
    const regionFilter = document.getElementById('builderFilterRegion')?.value || '';
    const roleFilter = document.getElementById('builderFilterRole')?.value || '';
    return this.dexData.species.filter(s => {
      if (typeFilter && !(s.types || []).includes(typeFilter)) return false;
      if (regionFilter && s.region !== regionFilter) return false;
      if (roleFilter && s.role !== roleFilter) return false;
      return true;
    });
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

  pickFirst(val) {
    if (Array.isArray(val)) return val[0];
    return val;
  },

  flattenMoves(moves) {
    const result = [];
    for (const m of moves || []) {
      result.push(Array.isArray(m) ? m[0] : m);
    }
    return result.slice(0, 4);
  },

  smogonLookupKey(data, species) {
    const name = species?.name;
    if (!name || !data) return null;
    if (data[name]) return data[name];
    const id = species?.id || '';
    const base = species?.baseSpecies || name;
    if (base !== name && data[base]) return data[base];
    const alt = name.replace(/\s+/g, '-');
    if (data[alt]) return data[alt];
    return null;
  },

  async loadSmogonSets() {
    const species = this.selectedSpecies;
    if (!species) return;
    const format = document.getElementById('builderSmogonFormat')?.value || 'gen9ou';
    const el = document.getElementById('builderSmogonSets');
    el.innerHTML = '<span class="smogon-sets-loading">Loading...</span>';
    try {
      const data = await API.get(`/smogon/sets/${format}`);
      const sets = this.smogonLookupKey(data, species);
      if (!sets || Object.keys(sets).length === 0) {
        el.innerHTML = '<span class="smogon-sets-loading">No sets for this Pokemon in this format.</span>';
        return;
      }
      this.smogonSets = sets;
      el.innerHTML = Object.keys(sets).map(name =>
        `<button type="button" class="smogon-set-btn" data-set="${this.escapeHtml(name)}">${this.escapeHtml(name)}</button>`
      ).join('');
      el.querySelectorAll('.smogon-set-btn').forEach(btn => {
        btn.addEventListener('click', () => this.importSmogonSet(btn.dataset.set));
      });
    } catch (e) {
      el.innerHTML = '<span class="smogon-sets-loading">Could not load sets.</span>';
      Logger.append('Smogon sets: ' + e.message, 'error');
    }
  },

  importSmogonSet(setName) {
    const set = this.smogonSets?.[setName];
    if (!set) return;
    const ability = this.pickFirst(set.ability);
    const item = this.pickFirst(set.item);
    const nature = this.pickFirst(set.nature) || 'Hardy';
    const moves = this.flattenMoves(set.moves);
    if (ability) {
      const abSelect = document.getElementById('builderAbility');
      const opts = Array.from(abSelect.options);
      const match = opts.find(o => o.value === ability);
      if (match) abSelect.value = ability;
    }
    if (item) {
      const itemSelect = document.getElementById('builderItem');
      const opts = Array.from(itemSelect.options);
      const match = opts.find(o => o.value === item);
      if (match) itemSelect.value = item;
    }
    document.getElementById('builderNature').value = nature;
    [1, 2, 3, 4].forEach((i, idx) => {
      const moveSelect = document.getElementById(`builderMove${i}`);
      const moveName = moves[idx];
      if (moveName && moveSelect) {
        const opts = Array.from(moveSelect.options);
        const match = opts.find(o => o.value === moveName);
        if (match) moveSelect.value = moveName;
      }
    });
    Logger.append(`Imported Smogon set: ${setName}`);
  },

  selectSpecies(species) {
    const filtered = this.getFilteredSpecies();
    const sel = filtered.find(s => s.id === species.id || s.name === species.name)
      || this.dexData.species.find(s => s.id === species.id || s.name === species.name);
    if (!sel) return;
    this.selectedSpecies = sel;
    document.getElementById('builderSpecies').value = sel.name;
    document.getElementById('builderSpeciesList').innerHTML = '';
    document.getElementById('builderSpeciesList').style.display = 'none';

    const statLabels = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
    const stats = sel.baseStats || {};
    ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].forEach(stat => {
      const el = document.querySelector(`#builderStats [data-stat="${stat}"]`);
      if (el) el.textContent = `${statLabels[stat]} ${stats[stat] ?? '—'}`;
    });

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

    this.loadSmogonSets();
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

  updateSpeciesDropdown() {
    const q = document.getElementById('builderSpecies').value.trim().toLowerCase();
    const list = document.getElementById('builderSpeciesList');
    let filtered = this.getFilteredSpecies();
    if (q.length >= 2) {
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(q) || s.id.includes(q)
      );
    }
    const limit = q.length >= 2 ? 25 : 50;
    const matches = filtered.slice(0, limit);
    list.innerHTML = matches.map(s => `<div class="dropdown-item" data-id="${s.id}" data-name="${s.name}">${s.name}</div>`).join('');
    list.style.display = matches.length ? 'block' : 'none';
    list.querySelectorAll('.dropdown-item').forEach(el => {
      el.addEventListener('click', () => this.selectSpecies({ id: el.dataset.id, name: el.dataset.name }));
    });
  },

  init() {
    const speciesInput = document.getElementById('builderSpecies');
    speciesInput.addEventListener('input', () => this.updateSpeciesDropdown());
    speciesInput.addEventListener('focus', () => this.updateSpeciesDropdown());

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#builderSpecies') && !e.target.closest('#builderSpeciesList')) {
        document.getElementById('builderSpeciesList').style.display = 'none';
      }
    });

    ['builderFilterType', 'builderFilterRegion', 'builderFilterRole'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => this.updateSpeciesDropdown());
    });

    document.getElementById('builderSmogonFormat')?.addEventListener('change', () => {
      if (this.selectedSpecies) this.loadSmogonSets();
    });

    document.getElementById('builderAdd').addEventListener('click', () => this.addToTeam());
    document.getElementById('builderExport').addEventListener('click', () => this.exportToEditor());

    this.loadDexData();
  },
};
