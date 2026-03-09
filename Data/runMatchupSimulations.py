"""
1v1 Pokemon matchup simulator.
Runs battles between Pokemon (head-to-head or full matrix).
Reads config from config.json (matchups section).
Uses Smogon presets by default for proper movesets.
Output: matchup_results.json, matchup_matrix.csv
"""
import json
import os
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
    url = f"{SMOGON_SETS_URL}/{format_id}.json"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "PokemonSimulator/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
    except Exception as e:
        print(f"  Warning: Could not load Smogon sets from {url}: {e}", flush=True)
        return {}
    if format_id == "gen9":
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


def run_single_battle(p1_set, p2_set, thread_no, level):
    """Run one 1v1 battle. Returns 'p1' or 'p2' for winner."""
    WORKER_FILES.mkdir(exist_ok=True)
    f1 = WORKER_FILES / f"{thread_no}1.txt"
    f2 = WORKER_FILES / f"{thread_no}2.txt"
    f1.write_text(p1_set, encoding="utf-8")
    f2.write_text(p2_set, encoding="utf-8")

    cmd = f"cd {Path(__file__).parent.parent / 'pokemon-showdown'} && node ./dist/sim/examples/Simulation-test-1 {thread_no} 0 0"
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
        return None
    except Exception:
        return None

    if "|win|Bot 1" in out:
        return "p1"
    if "|win|Bot 2" in out:
        return "p2"
    return None


def get_set_for_battle(species_name, learnsets, species_list, smogon_sets, use_smogon, level):
    """Get Showdown-format set for a Pokemon. Prefers Smogon if available."""
    if use_smogon and smogon_sets:
        _, set_data = get_smogon_set_for_species(species_name, smogon_sets)
        if set_data:
            return smogon_to_showdown(species_name, set_data, level)
    return get_default_set(species_name, learnsets, species_list, level)


def run_matchup(p1_name, p2_name, n_battles, thread_no, species_list, learnsets, level, smogon_sets=None, use_smogon=True):
    """Run n_battles between p1 and p2. Returns (p1_wins, p2_wins)."""
    p1_set = get_set_for_battle(p1_name, learnsets, species_list, smogon_sets, use_smogon, level)
    p2_set = get_set_for_battle(p2_name, learnsets, species_list, smogon_sets, use_smogon, level)

    p1_wins = 0
    p2_wins = 0
    for _ in range(n_battles):
        winner = run_single_battle(p1_set, p2_set, thread_no, level)
        if winner == "p1":
            p1_wins += 1
        elif winner == "p2":
            p2_wins += 1
    return p1_wins, p2_wins


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
    pokemon1 = m.get("pokemon1", "").strip()
    pokemon2 = m.get("pokemon2", "").strip()

    print("Stage 1/4: Loading dex data (species, learnsets)...", flush=True)
    species_list, learnsets = load_dex()
    print(f"  Loaded {len(species_list)} species.", flush=True)

    smogon_sets = {}
    if use_smogon:
        print(f"  Loading Smogon sets ({smogon_format})...", flush=True)
        smogon_sets = load_smogon_sets(smogon_format)
        print(f"  Loaded {len(smogon_sets)} species from Smogon.", flush=True)

    print("Stage 2/4: Building matchup list...", flush=True)
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

    total_battles = len(matchups) * n_battles
    print(f"Stage 3/4: Running {len(matchups)} matchup(s), {n_battles} battles each = {total_battles} total battles", flush=True)
    print(f"  Threads: {threads}, Level: {level}", flush=True)

    results = {}
    thread_names = list(range(1, threads + 1))
    lock = threading.Lock()

    def run_one(m):
        p1, p2 = m
        with lock:
            tn = thread_names.pop(0) if thread_names else 1
        try:
            w1, w2 = run_matchup(p1, p2, n_battles, str(tn), species_list, learnsets, level, smogon_sets, use_smogon)
            return (p1, p2, w1, w2)
        finally:
            with lock:
                thread_names.append(tn)

    with ThreadPoolExecutor(max_workers=threads) as ex:
        futures = [ex.submit(run_one, m) for m in matchups]
        done = 0
        for f in as_completed(futures):
            try:
                p1, p2, w1, w2 = f.result()
                key = f"{p1} vs {p2}"
                results[key] = {"p1": p1, "p2": p2, "p1_wins": w1, "p2_wins": w2, "total": w1 + w2}
                done += 1
                if done % 10 == 0 or done == len(matchups):
                    pct = 100 * done // len(matchups)
                    print(f"  Completed {done}/{len(matchups)} ({pct}%)", flush=True)
            except Exception as e:
                print(f"  Error: {e}", flush=True)

    print("Stage 4/4: Writing results...", flush=True)
    OUTPUT_FILE.parent.mkdir(exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    # Write CSV for matrix view
    csv_path = Path(__file__).parent / "matchup_matrix.csv"
    species_names = sorted(set(r["p1"] for r in results.values()) | set(r["p2"] for r in results.values()))
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write("Attacker,Defender,P1_Wins,P2_Wins,P1_WinRate\n")
        for k, v in results.items():
            total = v["total"] or 1
            rate = v["p1_wins"] / total
            f.write(f"{v['p1']},{v['p2']},{v['p1_wins']},{v['p2_wins']},{rate:.3f}\n")

    print(f"Done. Results: {OUTPUT_FILE}, {csv_path}", flush=True)


if __name__ == "__main__":
    main()
