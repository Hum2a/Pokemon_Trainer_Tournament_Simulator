# Pokémon Battle Simulator Environment

[![CI](https://github.com/cRz-Shadows/Pokemon_Trainer_Tournament_Simulator/actions/workflows/ci.yml/badge.svg)](https://github.com/cRz-Shadows/Pokemon_Trainer_Tournament_Simulator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Node.js 20+](https://img.shields.io/badge/node-20+-green.svg)](https://nodejs.org/)

Large-scale Pokémon Showdown simulations: trainer vs trainer, Pokémon vs leaders, and 1v1 matchup matrices. Parses results to PNG/CSV. Web UI for config, team building, and running simulations.

## Table of Contents

- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Deployment](#deployment)
- [Running Simulations](#running-simulations-yourself)
- [Matchup Simulator](#matchup-simulator)
- [Project Structure](#project-structure)
- [Modifications to Pokémon Showdown](#modifications-to-pokémon-showdown)
- [Contributing](#contributing)
- [Community & Other Projects](#discussion-and-community)

## Requirements
* Python (tested on version 3.10.12, but any Python 3 version should suffice)
* Node.js (tested on node 21.1.0 / npm 8.10.2, but any version should suffice)
* The following python libraries:
    * json
    * itertools
    * re
    * collections
    * matplotlib
    * numpy
    * PIL
    * csv
    * subprocess
    * threading
    * time
    * timeit

## Quick Start

```bash
git clone --recursive https://github.com/cRz-Shadows/Pokemon_Trainer_Tournament_Simulator.git
cd Pokemon_Trainer_Tournament_Simulator
pip install -r requirements.txt
cd pokemon-showdown && npm install && node build && cd ..
cd frontend && npm install && npm run build && cd ..
python app.py
```

Open http://127.0.0.1:5000 in your browser.

## Deployment

To deploy to a live site, use **Render** (recommended). Netlify and Cloudflare are not suitable for this app because it requires a Python backend, Node.js subprocesses, and long-running simulations.

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for platform comparison and step-by-step Render instructions.

## Running Simulations Yourself

### Web UI (Recommended)
A web interface is available to run all simulator functions through buttons and settings:

1. Install Python dependencies: `pip install -r requirements.txt`
2. Build the frontend: `cd frontend && npm install && npm run build`
3. From the project root, run: `python app.py`
4. Open http://127.0.0.1:5000 in your browser

**Development mode** (hot reload): Run Flask and Vite in separate terminals:
- Terminal 1: `python app.py` (API on port 5000)
- Terminal 2: `cd frontend && npm run dev` (UI on port 5173, proxies API to 5000)

The UI has two main sections:

- **Matchup Simulator** – 1v1 Pokemon battles (head-to-head or matrix mode). See below.
- **Trainer Tournament** – Build battles from team files, run trainer simulations, parse results to PNG/CSV, and download outputs. Uses the Team Builder, File Editor, and Settings panel.

### Matchup Simulator

The **Matchup Simulator** runs 1v1 Pokemon battles between two modes:

- **Head-to-Head:** Pick two Pokemon and run battles between them.
- **Matrix:** Run every Pokemon in a filtered pool against each other (all vs all).

**Pool filters** (Matrix mode) let you narrow the pool with multiple combinable filters. Each filter section is collapsible—use **Expand all** / **Collapse all** to manage the layout. Filter options use text chips: click a label to toggle it on (highlighted) or off (muted).

| Filter | Options |
|--------|---------|
| Evolution stage | First stage, Mid evolution, Full evolution |
| Type | Any of 18 types (multi-select) |
| Category | All, Legendary/Mythical, Regular only |
| Can Mega Evolve | All, Yes, No |
| Region | Kanto, Johto, Hoenn, Sinnoh, Unova, Kalos, Alola, Galar, Paldea, Other |
| BST range | Any, Under 400, 400–500, 500–600, 600+ |
| Type count | Any, Single type, Dual type |
| Role | Physical Attacker, Special Attacker, Wall, Mixed, Balanced |
| Ability / Move | Optional dropdowns to require a specific ability or learnable move |
| Tags | Mythical, Restricted Legendary, Sub-Legendary, Paradox, Ultra Beast |
| Egg group, Color, Generation | Multi-select options |
| Weight / Height | Range dropdowns |

Filters combine with **AND** logic; within each multi-select (e.g. types), **OR** logic applies. Set a **Pool size limit** and use **Maximum** to cap at the number of Pokemon matching the current filters.

**Smogon presets:** By default, simulations use movesets from [Smogon](https://www.smogon.com/) (e.g. gen9ou) instead of minimal learnset-based sets. This produces more realistic battles. Toggle **Use Smogon presets** and choose a format (gen9ou, gen9uu, gen9ru, gen9nu, gen9pu, gen9zu, gen9). Pokemon without Smogon sets fall back to default sets.

**Matchup Analytics** (after running simulations) includes:

- **Pool Sets:** Lists all Pokemon in the pool and their Smogon set (or "Default" if none). Use the format dropdown to match your simulation format.
- Summary stats, win rate charts, dominance scores, heatmaps, and a searchable matchup table.

**Outputs:** `matchup_results.json` (per-matchup win counts) and `matchup_matrix.csv` (win rate matrix). Download from the Outputs panel.

### Project structure

The codebase is modular. See `.cursor/rules/` for conventions. Key directories:
- `app.py` – entry point
- `src/` – backend (config, security, services, routes)
- `frontend/` – React + Vite + Tailwind frontend (builds to `frontend/dist/`)

**Team Builder:** To use the Team Builder (pick any Pokemon, moves, abilities, items), run once:
```
cd Data/UsefulDatasets && python fetch_dex_data.py
```
This fetches dex data from Pokemon Showdown's CDN. Then build Pokemon in the UI and export to the editor.

### Command Line
See [manual.md](https://github.com/cRz-Shadows/Pokemon_Trainer_Tournament_Simulator/blob/main/manual.md).
Since there is a submodule in the repo, make sure to clone using `git clone --recursive https://github.com/cRz-Shadows/Pokemon_Trainer_Tournament_Simulator`. If you wish to run a set of simulations, everything you need is located in the 'Data' directory.



## Modifications to Pokémon Showdown

* The code for our heuristics based bot can be found in "/pokemon-showdown/sim/examples/Simulation-test-1.ts". This is the file to edit if you with to modify the AI. Note that this AI extends "/pokemon-showdown/sim/tools/random-player-ai.ts". All calls to "chooseMove()," "chooseSwitch()," "choosePokemon()," and "chooseTeamPreview()" have also been modified in this file to pass in requests so that the bot can use that data when selecting what to do.

* In the file "/pokemon-showdown/sim/pokemon.ts," the "getSwitchRequestData()" function has been modified to include additional information for each Pokémon in each request message sent through the battle stream. Specifically, the modifications added information on the Pokémon's current boost table, its position on the battlefield, its maximum possible HP, any status effects applied to it, the species name, and whether it is trapped.

* In the file "/pokemon-showdown/sim/side.ts," the "getRequestData()" function has been modified to include information on any current side conditions on the battlefield, such as tailwind or trick room. Additionally, information on the foe has been added.

* In the file "/pokemon-showdown/sim/dex-moves.ts," The DataMove class' constructor has been modified to allow for checking how many times a multi-hit move hits.



## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards. See [CHANGELOG.md](CHANGELOG.md) for version history.

## Check Out My Other Projects
* Pokemon Crystal Legacy: https://www.youtube.com/watch?v=oeJBVY3z_uE&t=55s
* Pokemon Crystal Legacy Github: https://github.com/cRz-Shadows/Pokemon_Crystal_Legacy
* Pokemon Yellow Legacy: https://www.youtube.com/watch?v=jTH2fVqHPwc&t=1s
* Pokemon Yellow Legacy Github: https://github.com/cRz-Shadows/Pokemon_Yellow_Legacy



## Discussion and Community
* YouTube: https://www.youtube.com/@smithplayspokemon
* Discord: https://discord.gg/Wupx8tHRVS
* Reddit: https://www.reddit.com/r/PokemonLegacy
* Twitter: https://twitter.com/TheSmithPlays
* Instagram: https://www.instagram.com/thesmithplays/
