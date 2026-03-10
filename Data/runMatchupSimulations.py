"""
1v1 Pokemon matchup simulator.
Runs battles between Pokemon (head-to-head or full matrix).
Reads config from config.json (matchups section).
Uses Smogon presets by default for proper movesets.
Output: matchup_results.json, matchup_matrix.csv

Simulation strategies (simulationStrategy):
- full: Run every battle through Pokemon Showdown (most accurate, slowest)
- quick: 1 battle per matchup (5x faster, less accurate)
- sampled: Random sample of matchups (configurable fraction)
- heuristic: Type/BST-based estimate, no battles (instant, approximate)
"""
import json
import math
import os
import random
import re
import subprocess
import sys
import threading
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

DEX_DIR = Path(__file__).parent / "UsefulDatasets" / "dex-export"
WORKER_FILES = Path(__file__).parent / "WorkerFiles"
WORKER_OUTPUTS = Path(__file__).parent / "WorkerOutputs"
OUTPUT_FILE = Path(__file__).parent / "matchup_results.json"
SMOGON_SETS_URL = "https://data.pkmn.cc/sets"

# Priority order for "newest" mode: try formats newest-to-oldest, use first set found per species
NEWEST_FORMAT_PRIORITY = [
    "gen9ou", "gen9uu", "gen9ru", "gen9nu", "gen9pu", "gen9zu", "gen9",
    "gen8ou", "gen8uu", "gen8ru", "gen8nu", "gen8pu", "gen8zu", "gen8",
    "gen7ou", "gen7uu", "gen7ru", "gen7nu", "gen7pu", "gen7zu", "gen7",
    "gen6ou", "gen6uu", "gen6ru", "gen6nu", "gen6pu", "gen6zu", "gen6",
    "gen5ou", "gen5uu", "gen5ru", "gen5nu", "gen5pu", "gen5zu", "gen5",
    "gen4ou", "gen4uu", "gen4ru", "gen4nu", "gen4pu", "gen4zu", "gen4",
    "gen3ou", "gen3uu", "gen3ru", "gen3nu", "gen3pu", "gen3zu", "gen3",
    "gen2ou", "gen2uu", "gen2nu", "gen2pu", "gen2zu", "gen2",
    "gen1ou", "gen1uu", "gen1nu", "gen1pu", "gen1zu", "gen1",
]

# Type effectiveness: damageTaken 0=immune, 1=weak(2x), 2=resist(0.5x). Key: attacker_type -> defender_type
TYPE_EFFECTIVENESS = {
    "Normal": {"Rock": 0.5, "Ghost": 0, "Steel": 0.5},
    "Fire": {"Fire": 0.5, "Water": 0.5, "Grass": 2, "Ice": 2, "Bug": 2, "Rock": 0.5, "Dragon": 0.5, "Steel": 2},
    "Water": {"Fire": 2, "Water": 0.5, "Grass": 0.5, "Ground": 2, "Rock": 2, "Dragon": 0.5},
    "Electric": {"Water": 2, "Electric": 0.5, "Grass": 0.5, "Ground": 0, "Flying": 2, "Dragon": 0.5},
    "Grass": {"Fire": 0.5, "Water": 2, "Grass": 0.5, "Poison": 0.5, "Ground": 2, "Flying": 0.5, "Bug": 0.5, "Rock": 2, "Dragon": 0.5, "Steel": 0.5},
    "Ice": {"Fire": 0.5, "Water": 0.5, "Grass": 2, "Ice": 0.5, "Ground": 2, "Flying": 2, "Dragon": 2, "Steel": 0.5},
    "Fighting": {"Normal": 2, "Ice": 2, "Poison": 0.5, "Flying": 0.5, "Psychic": 0.5, "Bug": 0.5, "Rock": 2, "Ghost": 0, "Dark": 2, "Steel": 2, "Fairy": 0.5},
    "Poison": {"Grass": 2, "Poison": 0.5, "Ground": 0.5, "Rock": 0.5, "Ghost": 0.5, "Steel": 0, "Fairy": 2},
    "Ground": {"Fire": 2, "Electric": 2, "Grass": 0.5, "Poison": 2, "Flying": 0, "Bug": 0.5, "Rock": 2, "Steel": 2},
    "Flying": {"Electric": 0.5, "Grass": 2, "Fighting": 2, "Bug": 2, "Rock": 0.5, "Steel": 0.5},
    "Psychic": {"Fighting": 2, "Poison": 2, "Psychic": 0.5, "Dark": 0, "Steel": 0.5},
    "Bug": {"Fire": 0.5, "Grass": 2, "Fighting": 0.5, "Poison": 0.5, "Flying": 0.5, "Psychic": 2, "Ghost": 0.5, "Dark": 2, "Steel": 0.5, "Fairy": 0.5},
    "Rock": {"Fire": 2, "Ice": 2, "Fighting": 0.5, "Ground": 0.5, "Flying": 2, "Bug": 2, "Steel": 0.5},
    "Ghost": {"Normal": 0, "Psychic": 2, "Ghost": 2, "Dark": 0.5},
    "Dragon": {"Dragon": 2, "Steel": 0.5, "Fairy": 0},
    "Dark": {"Fighting": 0.5, "Psychic": 2, "Ghost": 2, "Dark": 0.5, "Fairy": 0.5},
    "Steel": {"Fire": 0.5, "Water": 0.5, "Electric": 0.5, "Ice": 2, "Rock": 2, "Steel": 0.5, "Fairy": 2},
    "Fairy": {"Fire": 0.5, "Fighting": 2, "Poison": 0.5, "Dragon": 2, "Dark": 2, "Steel": 0.5},
}


def _type_effectiveness(attacker_type, defender_types):
    """Multiplier for attacker_type vs defender_type(s). 1.0 = neutral."""
    mult = 1.0
    chart = TYPE_EFFECTIVENESS.get(attacker_type, {})
    for dt in (defender_types or []):
        mult *= chart.get(dt, 1.0)
    return mult


def _heuristic_win_rate(p1_types, p1_bst, p2_types, p2_bst):
    """Estimate P1 win rate (0-1) from types and BST. Higher = P1 favored."""
    p1_off = max(_type_effectiveness(t, p2_types) for t in (p1_types or ["Normal"])) if p1_types else 1.0
    p2_off = max(_type_effectiveness(t, p1_types) for t in (p2_types or ["Normal"])) if p2_types else 1.0
    p1_bst = p1_bst or 400
    p2_bst = p2_bst or 400
    type_diff = math.log2(p1_off + 0.1) - math.log2(p2_off + 0.1)
    bst_diff = (p1_bst - p2_bst) / 600.0
    raw = 0.5 + 0.15 * type_diff + 0.05 * bst_diff
    return max(0.05, min(0.95, raw))


def load_dex():
    """Load species and learnsets from dex-export."""
    species_path = DEX_DIR / "species.json"
    learnsets_path = DEX_DIR / "learnsets.json"
    if not species_path.exists():
        raise FileNotFoundError("Run Data/UsefulDatasets/fetch_dex_data.py first")
    with open(species_path, encoding="utf-8") as f:
        species = json.load(f)
    learnsets = {}
    if learnsets_path.exists():
        with open(learnsets_path, encoding="utf-8") as f:
            raw = json.load(f)
        for sid, data in raw.items():
            if isinstance(data, list):
                learnsets[sid] = data
            elif isinstance(data, dict) and "learnset" in data:
                learnsets[sid] = list(data["learnset"].keys())
            else:
                learnsets[sid] = []
    return species, learnsets


def _matches_bst(bst, range_key):
    """Check if BST matches the given range."""
    if not range_key or range_key == "any":
        return True
    if range_key == "under400":
        return bst < 400
    if range_key == "400-500":
        return 400 <= bst < 500
    if range_key == "500-600":
        return 500 <= bst < 600
    if range_key == "600+":
        return bst >= 600
    return True


def _matches_weight(weightkg, range_key):
    """Check if weight matches the given range."""
    if not range_key or range_key == "any":
        return True
    w = weightkg if weightkg is not None else 0
    if range_key == "light":
        return w < 50
    if range_key == "medium":
        return 50 <= w <= 150
    if range_key == "heavy":
        return w > 150
    return True


def _matches_height(heightm, range_key):
    """Check if height matches the given range."""
    if not range_key or range_key == "any":
        return True
    h = heightm if heightm is not None else 0
    if range_key == "small":
        return h < 1
    if range_key == "medium":
        return 1 <= h <= 2
    if range_key == "large":
        return h > 2
    return True


def _ensure_list(val):
    """Ensure value is a list (for multi-select filters)."""
    if val is None:
        return []
    if isinstance(val, list):
        return [x for x in val if x]
    return [val] if val else []


def filter_species(species_list, learnsets, m):
    """Filter species by pool criteria. All non-empty filters are ANDed together."""
    filtered = list(species_list)

    # Evolution stage (multi)
    evo = _ensure_list(m.get("poolEvolutionStages"))
    if evo:
        filtered = [s for s in filtered if s.get("evolutionStage") in evo]

    # Type (multi - Pokemon must have at least one of these types)
    types = _ensure_list(m.get("poolTypes"))
    if types:
        filtered = [s for s in filtered if any(t in (s.get("types") or []) for t in types)]

    # Category: all | legendary | regular
    cat = m.get("poolCategory", "all")
    if cat == "legendary":
        filtered = [s for s in filtered if (s.get("tags") or [])]
    elif cat == "regular":
        filtered = [s for s in filtered if not (s.get("tags") or [])]

    # Can Mega Evolve
    mega = m.get("poolCanMega", "all")
    if mega == "yes":
        filtered = [s for s in filtered if s.get("canMega")]
    elif mega == "no":
        filtered = [s for s in filtered if not s.get("canMega")]

    # Region (multi)
    regions = _ensure_list(m.get("poolRegions"))
    if regions:
        filtered = [s for s in filtered if s.get("region") in regions]

    # BST range
    bst = m.get("poolBst", "any")
    if bst and bst != "any":
        filtered = [s for s in filtered if _matches_bst(s.get("bst", 0), bst)]

    # Role (multi)
    roles = _ensure_list(m.get("poolRoles"))
    if roles:
        filtered = [s for s in filtered if s.get("role") in roles]

    # Ability (single)
    if m.get("poolAbility"):
        filtered = [s for s in filtered if m["poolAbility"] in (s.get("abilities") or {}).values()]

    # Move (single)
    if m.get("poolMove"):
        move_id = m["poolMove"].lower().replace(" ", "").replace("-", "")
        result = []
        for s in filtered:
            sid = (s.get("id") or "").lower().replace(" ", "").replace("-", "")
            base_id = (s.get("baseSpecies") or s.get("id") or "").lower().replace(" ", "").replace("-", "")
            moves = learnsets.get(sid, learnsets.get(base_id, []))
            if isinstance(moves, list) and move_id in moves:
                result.append(s)
        filtered = result

    # Tags (multi - specific legendary types)
    tags = _ensure_list(m.get("poolTags"))
    if tags:
        filtered = [s for s in filtered if any(t in (s.get("tags") or []) for t in tags)]

    # Egg group (multi)
    egg_groups = _ensure_list(m.get("poolEggGroups"))
    if egg_groups:
        filtered = [s for s in filtered if any(eg in (s.get("eggGroups") or []) for eg in egg_groups)]

    # Color (multi)
    colors = _ensure_list(m.get("poolColors"))
    if colors:
        filtered = [s for s in filtered if s.get("color") in colors]

    # Generation (multi)
    gens = _ensure_list(m.get("poolGenerations"))
    if gens:
        gen_set = {int(g) for g in gens if str(g).isdigit()}
        if gen_set:
            filtered = [s for s in filtered if s.get("generation") in gen_set]

    # Weight range
    if m.get("poolWeight") and m.get("poolWeight") != "any":
        filtered = [s for s in filtered if _matches_weight(s.get("weightkg"), m["poolWeight"])]

    # Height range
    if m.get("poolHeight") and m.get("poolHeight") != "any":
        filtered = [s for s in filtered if _matches_height(s.get("heightm"), m["poolHeight"])]

    # Type count (single vs dual)
    tc = m.get("poolTypeCount", "")
    if tc == "single":
        filtered = [s for s in filtered if (s.get("typeCount") or 1) == 1]
    elif tc == "dual":
        filtered = [s for s in filtered if (s.get("typeCount") or 1) == 2]

    return filtered


def _first(val):
    """Get first element from value (handles slash options in Smogon data)."""
    if val is None:
        return None
    if isinstance(val, list):
        return val[0] if val else None
    return val


def _flatten_moves(moves):
    """Flatten Smogon moves (can be str or [str, str] for slash options) to list of 4 moves."""
    if not moves or not isinstance(moves, list):
        return []
    result = []
    for m in moves[:4]:
        result.append(_first(m) if isinstance(m, list) else m)
    return [str(x) for x in result if x]


def _evs_to_str(evs):
    """Convert evs dict to Showdown format: 252 HP / 4 Def / 252 Spe."""
    if not evs or not isinstance(evs, dict):
        return ""
    order = ("hp", "atk", "def", "spa", "spd", "spe")
    parts = []
    for stat in order:
        v = evs.get(stat, 0)
        if v and v > 0:
            name = "SpA" if stat == "spa" else "SpD" if stat == "spd" else stat.upper()
            parts.append(f"{v} {name}")
    return " / ".join(parts) if parts else ""


def smogon_to_showdown(species_name, smogon_set, level=100):
    """Convert Smogon set dict to Pokemon Showdown export format string."""
    if not smogon_set:
        return None
    item = _first(smogon_set.get("item")) or ""
    ability = _first(smogon_set.get("ability")) or ""
    nature = _first(smogon_set.get("nature")) or "Hardy"
    evs_str = _evs_to_str(smogon_set.get("evs"))
    moves = _flatten_moves(smogon_set.get("moves"))
    while len(moves) < 4:
        moves.append("Struggle")

    lines = []
    if item:
        lines.append(f"{species_name} @ {item}")
    else:
        lines.append(species_name)
    lines.append(f"Level: {level}")
    if ability:
        lines.append(f"Ability: {ability}")
    if evs_str:
        lines.append(f"EVs: {evs_str}")
    lines.append(f"{nature} Nature")
    for m in moves:
        lines.append(f"- {m}")
    return "\n".join(lines)


def load_smogon_sets(format_id="gen9ou"):
    """Fetch Smogon sets from data.pkmn.cc. Returns {species: {setName: setData}}."""
    if format_id == "newest":
        merged = {}
        for fmt in NEWEST_FORMAT_PRIORITY:
            try:
                data = load_smogon_sets(fmt)
                for species, sets in data.items():
                    if species not in merged and isinstance(sets, dict) and sets:
                        set_names = list(sets.keys())
                        merged[species] = {set_names[0]: sets[set_names[0]]}
            except Exception:
                continue
        return merged
    url = f"{SMOGON_SETS_URL}/{format_id}.json"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "PokemonSimulator/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
    except Exception as e:
        print(
            f"  Info: Smogon sets for {format_id} unavailable ({e}). "
            "Using default/learnset-based sets instead—simulation will run normally.",
            flush=True,
        )
        return {}
    # Generation-level formats (gen9, gen8, etc.) have tier structure
    if re.match(r"^gen\d+$", format_id):
        tier_priority = ("ou", "uu", "ru", "nu", "pu", "zu")
        merged = {}
        for species, tiers in data.items():
            if not isinstance(tiers, dict):
                continue
            sets_for_species = {}
            for tier in tier_priority:
                tier_sets = tiers.get(tier, {})
                if isinstance(tier_sets, dict):
                    for name, s in tier_sets.items():
                        if name not in sets_for_species:
                            sets_for_species[name] = s
            if not sets_for_species:
                for tier, tier_sets in tiers.items():
                    if tier not in tier_priority and isinstance(tier_sets, dict):
                        for name, s in tier_sets.items():
                            if name not in sets_for_species:
                                sets_for_species[name] = s
            if sets_for_species:
                merged[species] = sets_for_species
        return merged
    return data


def get_smogon_set_for_species(species_name, smogon_sets):
    """Find best matching Smogon set for species. Returns (setName, setData) or (None, None)."""
    if not smogon_sets:
        return None, None
    sid = species_name.replace(" ", "").replace("-", "").lower()
    for smogon_species, sets in smogon_sets.items():
        smogon_id = smogon_species.replace(" ", "").replace("-", "").lower()
        if smogon_id == sid:
            set_names = list(sets.keys())
            if set_names:
                first_name = set_names[0]
                return first_name, sets.get(first_name)
            return None, None
    return None, None


def custom_set_to_showdown(species_name, custom, level=100):
    """Convert custom set dict to Pokemon Showdown export format string."""
    if not custom or not isinstance(custom, dict):
        return None
    moves = custom.get("moves")
    if not isinstance(moves, list):
        moves = []
    moves = [str(m).strip() for m in moves[:4] if m]
    while len(moves) < 4:
        moves.append("Struggle")
    ability = (custom.get("ability") or "").strip()
    item = (custom.get("item") or "").strip()
    nature = (custom.get("nature") or "Hardy").strip()
    evs = custom.get("evs")
    evs_str = ""
    if evs and isinstance(evs, dict):
        order = ("hp", "atk", "def", "spa", "spd", "spe")
        parts = []
        for stat in order:
            v = evs.get(stat, 0)
            if v and int(v) > 0:
                name = "SpA" if stat == "spa" else "SpD" if stat == "spd" else stat.upper()
                parts.append(f"{int(v)} {name}")
        evs_str = " / ".join(parts) if parts else ""

    lines = []
    if item:
        lines.append(f"{species_name} @ {item}")
    else:
        lines.append(species_name)
    lines.append(f"Level: {level}")
    if ability:
        lines.append(f"Ability: {ability}")
    if evs_str:
        lines.append(f"EVs: {evs_str}")
    lines.append(f"{nature} Nature")
    for m in moves:
        lines.append(f"- {m}")
    return "\n".join(lines)


def get_default_set(species_name, learnsets, species_list, level=50):
    """Generate a minimal Showdown set for a species."""
    sid = species_name.replace(" ", "").replace("-", "").lower()
    # Find species data
    spec = next((s for s in species_list if s.get("id") == sid or s.get("name") == species_name), None)
    if not spec:
        spec = next((s for s in species_list if sid in s.get("id", "").lower()), None)
    name = spec.get("name", species_name) if spec else species_name
    abilities = spec.get("abilities", {}) if spec else {}
    ab = next((v for v in abilities.values() if v), "No Ability")

    raw = learnsets.get(sid, learnsets.get(spec.get("id", ""), [])) if spec else []
    if isinstance(raw, dict):
        moves = list(raw.keys())[:4]
    else:
        moves = (raw or [])[:4]
    # Convert move ids to names (capitalize)
    move_names = [m.replace("-", " ").title() for m in moves] if moves else ["Tackle", "Growl", "Scratch", "Ember"]
    while len(move_names) < 4:
        move_names.append("Struggle")

    lines = [
        name,
        f"Level: {level}",
        "Hardy Nature",
        f"Ability: {ab}",
        *[f"- {m}" for m in move_names[:4]],
    ]
    return "\n".join(lines)


def _format_to_gen(smogon_format):
    """Extract gen from smogon format: gen5ou -> gen5, gen9 -> gen9."""
    if not smogon_format:
        return "gen9"
    m = re.match(r"^(gen\d+)", str(smogon_format).lower())
    return m.group(1) if m else "gen9"


def run_single_battle(p1_set, p2_set, thread_no, level, sim_format="gen9"):
    """Run one 1v1 battle. Returns ('p1'|'p2'|None, battle_log)."""
    WORKER_FILES.mkdir(exist_ok=True)
    f1 = WORKER_FILES / f"{thread_no}1.txt"
    f2 = WORKER_FILES / f"{thread_no}2.txt"
    f1.write_text(p1_set, encoding="utf-8")
    f2.write_text(p2_set, encoding="utf-8")

    cmd = f"cd {Path(__file__).parent.parent / 'pokemon-showdown'} && node ./dist/sim/examples/Simulation-test-1 {thread_no} 0 0 {sim_format}"
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=str(Path(__file__).parent),
        )
        out = (result.stdout or "") + (result.stderr or "")
    except subprocess.TimeoutExpired:
        return None, "(timeout)"
    except Exception as e:
        return None, f"(error: {e})"

    winner = None
    if "|win|Bot 1" in out:
        winner = "p1"
    elif "|win|Bot 2" in out:
        winner = "p2"
    return winner, out


def get_set_for_battle(species_name, learnsets, species_list, smogon_sets, use_smogon, level, custom_sets=None):
    """Get Showdown-format set for a Pokemon. Prefers: custom > Smogon > default."""
    if custom_sets:
        for key, custom in custom_sets.items():
            key_norm = key.replace(" ", "").replace("-", "").lower()
            name_norm = species_name.replace(" ", "").replace("-", "").lower()
            if key_norm == name_norm:
                result = custom_set_to_showdown(species_name, custom, level)
                if result:
                    return result
    if use_smogon and smogon_sets:
        _, set_data = get_smogon_set_for_species(species_name, smogon_sets)
        if set_data:
            return smogon_to_showdown(species_name, set_data, level)
    return get_default_set(species_name, learnsets, species_list, level)


def run_matchup(p1_name, p2_name, n_battles, thread_no, species_list, learnsets, level, smogon_sets=None, use_smogon=True, custom_sets=None, sim_format="gen9"):
    """Run n_battles between p1 and p2. Returns (p1_wins, p2_wins, battle_logs)."""
    p1_set = get_set_for_battle(p1_name, learnsets, species_list, smogon_sets, use_smogon, level, custom_sets)
    p2_set = get_set_for_battle(p2_name, learnsets, species_list, smogon_sets, use_smogon, level, custom_sets)

    p1_wins = 0
    p2_wins = 0
    logs = []
    for i in range(n_battles):
        winner, log = run_single_battle(p1_set, p2_set, thread_no, level, sim_format)
        logs.append({"winner": winner, "log": log})
        if winner == "p1":
            p1_wins += 1
        elif winner == "p2":
            p2_wins += 1
    return p1_wins, p2_wins, logs


def main():
    config_path = Path(__file__).parent / "config.json"
    config = {}
    if config_path.exists():
        with open(config_path, encoding="utf-8") as f:
            config = json.load(f)

    # Support nested config from UI
    m = config.get("matchups", config)
    level = m.get("setLevel", m.get("setLevel", 100))
    n_battles = m.get("battlesPerMatchup", 5)
    threads = m.get("noOfThreads", 4)
    mode = m.get("mode", "head-to-head")
    pool_limit = m.get("poolLimit", 50)
    use_smogon = m.get("useSmogonSets", True)
    smogon_format = m.get("smogonFormat", "gen9ou")
    custom_sets = m.get("customSets") or {}
    pokemon1 = m.get("pokemon1", "").strip()
    pokemon2 = m.get("pokemon2", "").strip()
    strategy = m.get("simulationStrategy", "full")
    sample_fraction = max(0.05, min(1.0, float(m.get("sampleFraction", 0.2))))

    if strategy == "quick":
        n_battles = 1
        print("  Strategy: quick (1 battle per matchup)", flush=True)

    if strategy != "heuristic":
        print("Stage 0/5: Building pokemon-showdown...", flush=True)
        ps_dir = Path(__file__).parent.parent / "pokemon-showdown"
        build_result = subprocess.run(
            ["node", "build"],
            cwd=str(ps_dir),
            capture_output=True,
            text=True,
            timeout=120,
        )
        if build_result.returncode != 0:
            err = (build_result.stdout or "") + (build_result.stderr or "")
            print(f"  Build failed: {err[:500]}", flush=True)
            sys.exit(1)
        print("  Build complete.", flush=True)

    print("Stage 1/5: Loading dex data (species, learnsets)...", flush=True)
    species_list, learnsets = load_dex()
    print(f"  Loaded {len(species_list)} species.", flush=True)

    smogon_sets = {}
    if use_smogon and strategy != "heuristic":
        print(f"  Loading Smogon sets ({smogon_format})...", flush=True)
        smogon_sets = load_smogon_sets(smogon_format)
        print(f"  Loaded {len(smogon_sets)} species from Smogon.", flush=True)

    print("Stage 2/5: Building matchup list...", flush=True)
    matchups = []
    if mode == "head-to-head" and pokemon1 and pokemon2:
        matchups = [(pokemon1, pokemon2)]
        print(f"  Mode: Head-to-head ({pokemon1} vs {pokemon2})", flush=True)
    else:
        filtered = filter_species(species_list, learnsets, m)
        filtered = [s.get("name", s.get("id", "")) for s in filtered if s.get("name")]
        filtered = filtered[:pool_limit]
        for i, a in enumerate(filtered):
            for b in filtered[i + 1 :]:
                matchups.append((a, b))
        print(f"  Mode: Matrix. Pool: {len(filtered)} Pokemon -> {len(matchups)} matchup(s)", flush=True)

    if not matchups:
        print("No matchups to run. For head-to-head, set pokemon1 and pokemon2. For matrix, check pool settings.", flush=True)
        return

    if strategy == "sampled" and len(matchups) > 1:
        k = max(1, int(len(matchups) * sample_fraction))
        matchups = random.sample(matchups, k)
        print(f"  Strategy: sampled ({sample_fraction:.0%} = {len(matchups)} matchups)", flush=True)

    total_battles = len(matchups) * n_battles
    sim_format = _format_to_gen(smogon_format)

    if strategy == "heuristic":
        print("Stage 3/5: Heuristic mode (type/BST estimate, no battles)", flush=True)
        species_lookup = {s.get("name", s.get("id", "")): s for s in species_list if s.get("name") or s.get("id")}
        results = {}
        battle_logs = {}
        for i, (p1, p2) in enumerate(matchups):
            s1 = species_lookup.get(p1, {})
            s2 = species_lookup.get(p2, {})
            wr = _heuristic_win_rate(
                s1.get("types"),
                s1.get("bst"),
                s2.get("types"),
                s2.get("bst"),
            )
            total = n_battles
            p1_wins = int(round(wr * total))
            p2_wins = total - p1_wins
            key = f"{p1} vs {p2}"
            results[key] = {"p1": p1, "p2": p2, "p1_wins": p1_wins, "p2_wins": p2_wins, "total": total}
            battle_logs[key] = [{"winner": "p1" if wr >= 0.5 else "p2", "log": "(heuristic estimate)"} for _ in range(total)]
            if (i + 1) % 50 == 0 or i == 0:
                print(f"  Estimated {i + 1}/{len(matchups)} matchups...", flush=True)
    else:
        print(f"Stage 3/5: Running {len(matchups)} matchup(s), {n_battles} battles each = {total_battles} total battles", flush=True)
        print(f"  Threads: {threads}, Level: {level}, Sim format: {sim_format}", flush=True)

        results = {}
        battle_logs = {}
        thread_names = list(range(1, threads + 1))
        lock = threading.Lock()

        def run_one(args):
            idx, matchup = args
            p1, p2 = matchup
            print(f"  Running {p1} vs {p2} ({idx + 1}/{len(matchups)})...", flush=True)
            with lock:
                tn = thread_names.pop(0) if thread_names else 1
            try:
                w1, w2, logs = run_matchup(p1, p2, n_battles, str(tn), species_list, learnsets, level, smogon_sets, use_smogon, custom_sets, sim_format)
                return (p1, p2, w1, w2, logs)
            finally:
                with lock:
                    thread_names.append(tn)

        with ThreadPoolExecutor(max_workers=threads) as ex:
            futures = [ex.submit(run_one, (i, matchup)) for i, matchup in enumerate(matchups)]
            done = 0
            for f in as_completed(futures):
                try:
                    p1, p2, w1, w2, logs = f.result()
                    key = f"{p1} vs {p2}"
                    results[key] = {"p1": p1, "p2": p2, "p1_wins": w1, "p2_wins": w2, "total": w1 + w2}
                    battle_logs[key] = logs
                    done += 1
                    pct = 100 * done // len(matchups)
                    print(f"  Completed {p1} vs {p2} — {done}/{len(matchups)} ({pct}%)", flush=True)
                except Exception as e:
                    print(f"  Error: {e}", flush=True)

    print("Stage 4/5: Writing results...", flush=True)
    OUTPUT_FILE.parent.mkdir(exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    # Write battle logs
    logs_path = Path(__file__).parent / "matchup_battle_logs.json"
    with open(logs_path, "w", encoding="utf-8") as f:
        json.dump(battle_logs, f, indent=2)

    # Write CSV for matrix view
    csv_path = Path(__file__).parent / "matchup_matrix.csv"
    species_names = sorted(set(r["p1"] for r in results.values()) | set(r["p2"] for r in results.values()))
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write("Attacker,Defender,P1_Wins,P2_Wins,P1_WinRate\n")
        for k, v in results.items():
            total = v["total"] or 1
            rate = v["p1_wins"] / total
            f.write(f"{v['p1']},{v['p2']},{v['p1_wins']},{v['p2_wins']},{rate:.3f}\n")

    # Write simulation metadata (pool, pokemon sets) for saved simulations
    pool = species_names
    pokemon_sets = {}
    for name in pool:
        s = get_set_for_battle(name, learnsets, species_list, smogon_sets, use_smogon, level, custom_sets)
        if s:
            pokemon_sets[name] = s
    metadata_path = Path(__file__).parent / "matchup_simulation_metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump({"pool": pool, "pokemon_sets": pokemon_sets}, f, indent=2)

    print(f"Done. Results: {OUTPUT_FILE}, {csv_path}, {logs_path}, {metadata_path}", flush=True)


if __name__ == "__main__":
    main()
