# Pokemon Battle Simulator - UI Implementation Plan

## Overview

Create a web-based UI that exposes every function of the Pokemon Trainer Tournament Simulator through buttons, settings, and visual feedback.

---

## Current System Summary

### Core Functions
| Function | Script | Purpose |
|----------|--------|---------|
| Build Trainer Battles | `BuildBattles.py` | Generate trainer vs trainer matchups from GymLeaderTeams.json → tournament_battles.json |
| Build Pokemon vs Leaders | `BuildBattles_pokemon-vs-leaders_Gen1.py` | Generate Pokemon vs gym leader matchups (Gen 1) |
| Run Trainer Simulations | `runSimulations.py` | Execute trainer tournament (multithreaded) |
| Run Pokemon Simulations | `runPokemonSimulations.py` | Execute Pokemon vs leaders gauntlet |
| Parse to PNG | `parseOutput.py` | Parse output.txt → battle_matrix_plot.png |
| Parse to CSV | `parseOutput_CSV.py` | Parse output.txt → trainer_stats.csv, battle_matrix.csv |
| Find Errors | `ErrorChecking/findErrors.py` | Detect battles with errors |
| Remove Errors | `ErrorChecking/removeErrors.py` | Remove errored battles from output |
| Get Battles to Rerun | `ErrorChecking/get_battles_to_rerun.py` | List battles needing rerun |

### Configurable Parameters
- **BuildBattles**: `RUN_N_TIMES` (battles per matchup, default 100)
- **runSimulations**: `noOfThreads`, `setLevel`, `RandomiseTeams`, `n` (battle cap), `filename`
- **runPokemonSimulations**: `noOfThreads`, `n` (battle cap)
- **parseOutput**: `file_path` (output.txt)

---

## Architecture

### Tech Stack
- **Backend**: Flask (Python) - integrates with existing Python scripts
- **Frontend**: HTML/CSS/JS - single-page app, no build step
- **Long-running tasks**: Background threads + Server-Sent Events (SSE) for progress

### File Structure
```
Pokemon_Trainer_Tournament_Simulator/
├── app.py                 # Flask app + API
├── config.json            # Runtime config (written by UI)
├── static/
│   ├── style.css
│   └── app.js
├── templates/
│   └── index.html
├── Data/
│   ├── BuildBattles.py    # (refactored: config support)
│   ├── runSimulations.py # (refactored: config support)
│   └── ...
└── UI_PLAN.md
```

---

## UI Layout

### 1. Header
- Title: "Pokemon Battle Simulator"
- Status indicator (idle / running / error)

### 2. Settings Panel (collapsible)
- **Trainer Tournament**
  - Threads (1–64)
  - Level override (e.g. 50, or "Use build levels")
  - Battles per matchup (RUN_N_TIMES)
  - Battle cap (n) for testing
  - Randomise teams (checkbox)
  - Pokemon file (GymLeaderPokemon.txt path)
- **Pokemon Tournament**
  - Threads
  - Battle cap
- **Paths**
  - Input/Output directory (Data/)

### 3. Action Buttons (grouped by workflow)
- **Build Phase**
  - [Build Trainer Battles]
  - [Build Pokemon vs Leaders]
- **Run Phase**
  - [Run Trainer Simulations]
  - [Run Pokemon Simulations]
- **Parse Phase**
  - [Parse to PNG Matrix]
  - [Parse to CSV]
- **Error Handling**
  - [Find Errors]
  - [Get Battles to Rerun]
  - [Remove Errors]

### 4. Progress / Log Area
- Real-time log output (stdout/stderr from scripts)
- Progress bar for simulations
- Estimated time remaining (when available)

### 5. Outputs Section
- Links to generated files: output.txt, battle_matrix_plot.png, trainer_stats.csv, battle_matrix.csv
- Preview for PNG
- Download buttons

---

## Implementation Phases

### Phase 1: Backend & Config
- Add `config.json` support to scripts (or CLI args)
- Create Flask app with endpoints for each action
- Implement subprocess/thread execution for long-running tasks

### Phase 2: Core UI
- HTML structure with sections above
- CSS styling (Pokemon-themed, readable)
- JS to call API, show/hide sections

### Phase 3: Progress & Feedback
- SSE or polling for simulation progress
- Log streaming
- Error display

### Phase 4: Polish
- File browser / path picker
- Validation before run
- Responsive layout

---

## API Endpoints

| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/` | Serve UI |
| GET | `/api/config` | Get current config |
| POST | `/api/config` | Save config |
| POST | `/api/build-trainer` | Run BuildBattles.py |
| POST | `/api/build-pokemon` | Run BuildBattles_pokemon-vs-leaders_Gen1.py |
| POST | `/api/run-trainer` | Run runSimulations.py |
| POST | `/api/run-pokemon` | Run runPokemonSimulations.py |
| POST | `/api/parse-png` | Run parseOutput.py |
| POST | `/api/parse-csv` | Run parseOutput_CSV.py |
| GET | `/api/status` | Get current task status |
| GET | `/api/logs` | Stream logs (SSE) |
| GET | `/api/outputs/<filename>` | Download output file |

---

## Notes

- Scripts run from `Data/` directory (cwd) so paths work
- Pokemon Showdown must be built (`node build`) before simulations
- Error checking scripts use project-specific paths; may need adaptation for main flow
