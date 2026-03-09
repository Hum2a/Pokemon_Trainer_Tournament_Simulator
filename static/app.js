/**
 * Pokemon Battle Simulator - UI Logic
 */

const API = '/api';

// DOM elements
const statusEl = document.getElementById('status');
const statusText = document.getElementById('statusText');
const logOutput = document.getElementById('logOutput');
const outputsGrid = document.getElementById('outputsGrid');

// Collapsible panels
document.querySelectorAll('[data-toggle]').forEach(el => {
  el.addEventListener('click', () => {
    const panel = el.closest('.panel');
    panel.classList.toggle('collapsed');
  });
});

// Load config on init
async function loadConfig() {
  try {
    const res = await fetch(`${API}/config`);
    const config = await res.json();
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
    appendLog('Failed to load config: ' + e.message, 'error');
  }
}

// Save config
async function saveConfig() {
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
    await fetch(`${API}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    appendLog('Settings saved.');
  } catch (e) {
    appendLog('Failed to save: ' + e.message, 'error');
  }
}

document.getElementById('saveSettings').addEventListener('click', saveConfig);

// Append to log
function appendLog(text, type = 'info') {
  const line = document.createElement('div');
  line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  if (type === 'error') line.style.color = 'var(--danger)';
  logOutput.appendChild(line);
  logOutput.scrollTop = logOutput.scrollHeight;
}

// Clear log
document.getElementById('clearLog').addEventListener('click', () => {
  logOutput.innerHTML = '';
});

// Set status
function setStatus(running, text) {
  const dot = statusEl.querySelector('.status-dot');
  dot.className = 'status-dot ' + (running ? 'running' : 'idle');
  statusText.textContent = text;
}

// Call API and handle response
async function callAction(endpoint, label) {
  setStatus(true, label + '...');
  appendLog(`Starting: ${label}`);
  try {
    const res = await fetch(`${API}/${endpoint}`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (data.output) appendLog(data.output);
    if (data.ok !== false) {
      appendLog(`${label} completed.`);
      refreshOutputs();
    } else {
      appendLog(`${label} failed.`, 'error');
    }
  } catch (e) {
    appendLog(`${label} error: ${e.message}`, 'error');
  }
  setStatus(false, 'Ready');
}

// Poll status for long-running tasks
let pollInterval = null;
function startPolling() {
  if (pollInterval) return;
  pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`${API}/status`);
      const data = await res.json();
      if (data.output) {
        logOutput.textContent = data.output;
        logOutput.scrollTop = logOutput.scrollHeight;
      }
      if (!data.running) {
        clearInterval(pollInterval);
        pollInterval = null;
        setStatus(false, 'Ready');
        appendLog('Task finished.');
        refreshOutputs();
      }
    } catch (e) {}
  }, 1000);
}

// Action buttons
document.getElementById('buildTrainer').addEventListener('click', async () => {
  await saveConfig();
  await callAction('build-trainer', 'Build Trainer Battles');
});

document.getElementById('buildPokemon').addEventListener('click', async () => {
  await callAction('build-pokemon', 'Build Pokemon vs Leaders');
});

document.getElementById('runTrainer').addEventListener('click', async () => {
  await saveConfig();
  setStatus(true, 'Running trainer simulations...');
  appendLog('Starting trainer simulations (this may take a while).');
  try {
    await fetch(`${API}/run-trainer`, { method: 'POST' });
    startPolling();
  } catch (e) {
    appendLog('Error: ' + e.message, 'error');
    setStatus(false, 'Ready');
  }
});

document.getElementById('runPokemon').addEventListener('click', async () => {
  await saveConfig();
  setStatus(true, 'Running Pokemon simulations...');
  appendLog('Starting Pokemon simulations (this may take a while).');
  try {
    await fetch(`${API}/run-pokemon`, { method: 'POST' });
    startPolling();
  } catch (e) {
    appendLog('Error: ' + e.message, 'error');
    setStatus(false, 'Ready');
  }
});

document.getElementById('parsePng').addEventListener('click', async () => {
  await saveConfig();
  await callAction('parse-png', 'Parse to PNG');
});

document.getElementById('parseCsv').addEventListener('click', async () => {
  await saveConfig();
  await callAction('parse-csv', 'Parse to CSV');
});

// Outputs
async function refreshOutputs() {
  try {
    const res = await fetch(`${API}/outputs`);
    const files = await res.json();
    if (files.length === 0) {
      outputsGrid.innerHTML = '<p class="muted">Run simulations and parse to generate outputs.</p>';
      return;
    }
    outputsGrid.innerHTML = files.map(f => `
      <div class="output-item">
        <a href="${API}/outputs/${encodeURIComponent(f.name)}" download>${f.name}</a>
        <span class="size">(${formatSize(f.size)})</span>
      </div>
    `).join('');
  } catch (e) {
    outputsGrid.innerHTML = '<p class="muted">Could not load outputs.</p>';
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

document.getElementById('refreshOutputs').addEventListener('click', refreshOutputs);

// File editor
async function loadFile() {
  const path = document.getElementById('editorFileSelect').value;
  try {
    const res = await fetch(`${API}/files/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    if (data.ok) {
      document.getElementById('fileEditor').value = data.content;
      appendLog(`Loaded ${path}`);
    } else {
      appendLog('Load failed: ' + (data.error || 'Unknown'), 'error');
    }
  } catch (e) {
    appendLog('Load error: ' + e.message, 'error');
  }
}

async function saveFile() {
  const path = document.getElementById('editorFileSelect').value;
  const content = document.getElementById('fileEditor').value;
  try {
    const res = await fetch(`${API}/files/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    });
    const data = await res.json();
    if (data.ok) {
      appendLog(`Saved ${path}`);
    } else {
      appendLog('Save failed: ' + (data.error || 'Unknown'), 'error');
    }
  } catch (e) {
    appendLog('Save error: ' + e.message, 'error');
  }
}

document.getElementById('loadFile').addEventListener('click', loadFile);
document.getElementById('saveFile').addEventListener('click', saveFile);

document.getElementById('loadExample').addEventListener('click', async () => {
  const path = 'Inputs/Videos/Trainer Tournament 1+2/GymLeaderPokemon.txt';
  try {
    const res = await fetch(`${API}/files/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    if (data.ok) {
      document.getElementById('fileEditor').value = data.content;
      document.getElementById('editorFileSelect').value = 'Inputs/GymLeaderPokemon.txt';
      appendLog('Loaded example. Save to overwrite your file.');
    } else {
      appendLog('Example not found: ' + (data.error || ''), 'error');
    }
  } catch (e) {
    appendLog('Load example error: ' + e.message, 'error');
  }
});

// Sync editor file select with trainer filename when it changes
document.getElementById('editorFileSelect').addEventListener('change', () => {
  const path = document.getElementById('editorFileSelect').value;
  if (path === 'Inputs/GymLeaderPokemon.txt') {
    document.getElementById('trainerFilename').value = path;
  }
});

// Team Builder
let dexData = { species: [], moves: [], abilities: [], items: [], learnsets: {}, natures: [] };
let builderTeam = [];

async function loadDexData() {
  try {
    const [species, moves, abilities, items, learnsets, natures] = await Promise.all([
      fetch(`${API}/dex/species`).then(r => r.ok ? r.json() : []),
      fetch(`${API}/dex/moves`).then(r => r.ok ? r.json() : []),
      fetch(`${API}/dex/abilities`).then(r => r.ok ? r.json() : []),
      fetch(`${API}/dex/items`).then(r => r.ok ? r.json() : []),
      fetch(`${API}/dex/learnsets`).then(r => r.ok ? r.json() : {}),
      fetch(`${API}/dex/natures`).then(r => r.ok ? r.json() : []),
    ]);
    dexData = { species, moves, abilities, items, learnsets, natures };
    if (species.length === 0) {
      appendLog('Dex data not loaded. Run Data/UsefulDatasets/fetch_dex_data.py first.', 'error');
      return;
    }
    // Populate items and natures
    const itemSelect = document.getElementById('builderItem');
    itemSelect.innerHTML = '<option value="">(none)</option>' + items.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
    const natureSelect = document.getElementById('builderNature');
    natureSelect.innerHTML = natures.map(n => `<option value="${n}">${n}</option>`).join('');
  } catch (e) {
    appendLog('Failed to load dex data: ' + e.message, 'error');
  }
}

function toId(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function selectSpecies(species) {
  const sel = dexData.species.find(s => s.id === species.id || s.name === species.name);
  if (!sel) return;
  document.getElementById('builderSpecies').value = sel.name;
  document.getElementById('builderSpeciesList').innerHTML = '';
  document.getElementById('builderSpeciesList').style.display = 'none';

  // Abilities
  const abs = sel.abilities || {};
  const abOpts = Object.values(abs).filter(Boolean);
  const abSelect = document.getElementById('builderAbility');
  abSelect.innerHTML = abOpts.length ? abOpts.map(a => `<option value="${a}">${a}</option>`).join('') : '<option value="">(unknown)</option>';

  // Moves - from learnset (try base species if forme); fallback to all moves if no learnset
  const baseId = (sel.baseSpecies && sel.baseSpecies !== sel.name) ? toId(sel.baseSpecies) : sel.id;
  let learnset = dexData.learnsets[sel.id] || dexData.learnsets[toId(sel.name)] || dexData.learnsets[baseId] || [];
  if (learnset.length === 0) learnset = dexData.moves.map(m => m.id);
  const moveOpts = learnset.map(mid => {
    const m = dexData.moves.find(x => toId(x.id) === toId(mid));
    return m ? { id: m.id, name: m.name } : { id: mid, name: mid.replace(/([a-z])([A-Z])/g, '$1 $2') };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const moveSelects = ['builderMove1', 'builderMove2', 'builderMove3', 'builderMove4'];
  const emptyOpt = '<option value="">(none)</option>';
  moveSelects.forEach((id, i) => {
    const selEl = document.getElementById(id);
    selEl.innerHTML = emptyOpt + moveOpts.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
  });
}

document.getElementById('builderSpecies').addEventListener('input', () => {
  const q = document.getElementById('builderSpecies').value.trim().toLowerCase();
  const list = document.getElementById('builderSpeciesList');
  if (q.length < 2) {
    list.innerHTML = '';
    list.style.display = 'none';
    return;
  }
  const matches = dexData.species.filter(s => s.name.toLowerCase().includes(q) || s.id.includes(q)).slice(0, 20);
  list.innerHTML = matches.map(s => `<div class="dropdown-item" data-id="${s.id}" data-name="${s.name}">${s.name}</div>`).join('');
  list.style.display = matches.length ? 'block' : 'none';
  list.querySelectorAll('.dropdown-item').forEach(el => {
    el.addEventListener('click', () => selectSpecies({ id: el.dataset.id, name: el.dataset.name }));
  });
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#builderSpecies') && !e.target.closest('#builderSpeciesList')) {
    document.getElementById('builderSpeciesList').style.display = 'none';
  }
});

function buildShowdownSet() {
  const species = document.getElementById('builderSpecies').value;
  const level = document.getElementById('builderLevel').value || 50;
  const ability = document.getElementById('builderAbility').value;
  const item = document.getElementById('builderItem').value;
  const nature = document.getElementById('builderNature').value;
  const moves = [1, 2, 3, 4].map(i => document.getElementById(`builderMove${i}`).value).filter(Boolean);
  if (!species) return null;
  const speciesLine = item ? `${species} @ ${item}` : species;
  let out = `|${speciesLine}\n`;
  out += `Level: ${level}\n`;
  out += `${nature} Nature\n`;
  if (ability) out += `Ability: ${ability}\n`;
  moves.forEach(m => out += `- ${m}\n`);
  return out;
}

document.getElementById('builderAdd').addEventListener('click', () => {
  const set = buildShowdownSet();
  if (set) {
    builderTeam.push(set);
    renderBuilderTeam();
    appendLog('Added to team.');
  }
});

document.getElementById('builderExport').addEventListener('click', () => {
  if (builderTeam.length === 0) {
    appendLog('Add at least one Pokemon first.', 'error');
    return;
  }
  const content = builderTeam.join('\n') + '\n';
  const editor = document.getElementById('fileEditor');
  const current = editor.value;
  editor.value = current ? current.trimEnd() + '\n\n' + content : content;
  document.getElementById('editorFileSelect').value = 'Inputs/GymLeaderPokemon.txt';
  appendLog(`Exported ${builderTeam.length} Pokemon(s) to editor.`);
});

function renderBuilderTeam() {
  const el = document.getElementById('builderTeamList');
  el.innerHTML = builderTeam.map((set, i) => {
    const firstLine = set.split('\n')[0].replace('|', '');
    return `<div class="builder-team-item"><span>${firstLine}</span><span class="remove" data-idx="${i}">×</span></div>`;
  }).join('');
  el.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', () => {
      builderTeam.splice(parseInt(btn.dataset.idx), 1);
      renderBuilderTeam();
    });
  });
}

// Init
loadConfig();
refreshOutputs();
loadDexData();
