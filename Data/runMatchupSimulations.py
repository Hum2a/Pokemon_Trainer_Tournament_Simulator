"""
1v1 Pokemon matchup simulator.
Runs battles between Pokemon (head-to-head or full matrix).
Reads config from config.json (matchups section).
Output: matchup_results.json, matchup_matrix.csv
"""
import json
import os
import re
import subprocess
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

DEX_DIR = Path(__file__).parent / "UsefulDatasets" / "dex-export"
WORKER_FILES = Path(__file__).parent / "WorkerFiles"
WORKER_OUTPUTS = Path(__file__).parent / "WorkerOutputs"
OUTPUT_FILE = Path(__file__).parent / "matchup_results.json"


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


def filter_species(species_list, learnsets, m):
    """Filter species by pool criteria. m = matchups config dict."""
    filtered = list(species_list)
    pool_filter = m.get("poolFilter", "all")
    if pool_filter == "all":
        return filtered
    if pool_filter == "type" and m.get("poolType"):
        filtered = [s for s in filtered if m["poolType"] in (s.get("types") or [])]
    elif pool_filter == "region" and m.get("poolRegion"):
        filtered = [s for s in filtered if s.get("region") == m["poolRegion"]]
    elif pool_filter == "evolution" and m.get("poolEvolutionStage"):
        filtered = [s for s in filtered if s.get("evolutionStage") == m["poolEvolutionStage"]]
    elif pool_filter == "ability" and m.get("poolAbility"):
        filtered = [s for s in filtered if m["poolAbility"] in (s.get("abilities") or {}).values()]
    elif pool_filter == "move" and m.get("poolMove"):
        move_id = m["poolMove"].lower().replace(" ", "").replace("-", "")
        result = []
        for s in filtered:
            sid = (s.get("id") or "").lower().replace(" ", "").replace("-", "")
            base_id = (s.get("baseSpecies") or s.get("id") or "").lower().replace(" ", "").replace("-", "")
            moves = learnsets.get(sid, learnsets.get(base_id, []))
            if isinstance(moves, list) and move_id in moves:
                result.append(s)
        filtered = result
    elif pool_filter == "role" and m.get("poolRole"):
        filtered = [s for s in filtered if s.get("role") == m["poolRole"]]
    elif pool_filter == "bst" and m.get("poolBst") and m.get("poolBst") != "any":
        filtered = [s for s in filtered if _matches_bst(s.get("bst", 0), m["poolBst"])]
    elif pool_filter == "typeCount" and m.get("poolTypeCount"):
        tc = 2 if m["poolTypeCount"] == "dual" else 1
        filtered = [s for s in filtered if s.get("typeCount", 1) == tc]
    elif pool_filter == "tags" and m.get("poolTags"):
        tag = m["poolTags"]
        filtered = [s for s in filtered if tag in (s.get("tags") or [])]
    elif pool_filter == "eggGroup" and m.get("poolEggGroup"):
        eg = m["poolEggGroup"]
        filtered = [s for s in filtered if eg in (s.get("eggGroups") or [])]
    elif pool_filter == "color" and m.get("poolColor"):
        filtered = [s for s in filtered if s.get("color") == m["poolColor"]]
    elif pool_filter == "generation" and m.get("poolGeneration"):
        try:
            gen = int(m["poolGeneration"])
            filtered = [s for s in filtered if s.get("generation") == gen]
        except (ValueError, TypeError):
            pass
    elif pool_filter == "weight" and m.get("poolWeight") and m.get("poolWeight") != "any":
        filtered = [s for s in filtered if _matches_weight(s.get("weightkg"), m["poolWeight"])]
    elif pool_filter == "height" and m.get("poolHeight") and m.get("poolHeight") != "any":
        filtered = [s for s in filtered if _matches_height(s.get("heightm"), m["poolHeight"])]
    elif pool_filter == "canMega" and m.get("poolCanMega"):
        want_mega = m["poolCanMega"] == "yes"
        filtered = [s for s in filtered if bool(s.get("canMega")) == want_mega]
    return filtered


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


def run_matchup(p1_name, p2_name, n_battles, thread_no, species_list, learnsets, level):
    """Run n_battles between p1 and p2. Returns (p1_wins, p2_wins)."""
    p1_set = get_default_set(p1_name, learnsets, species_list, level)
    p2_set = get_default_set(p2_name, learnsets, species_list, level)

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
    pokemon1 = m.get("pokemon1", "").strip()
    pokemon2 = m.get("pokemon2", "").strip()

    species_list, learnsets = load_dex()

    # Build matchup list
    matchups = []
    if mode == "head-to-head" and pokemon1 and pokemon2:
        matchups = [(pokemon1, pokemon2)]
    else:
        # Matrix mode: filter species
        filtered = filter_species(species_list, learnsets, m)
        filtered = [s.get("name", s.get("id", "")) for s in filtered if s.get("name")]
        filtered = filtered[:pool_limit]
        for i, a in enumerate(filtered):
            for b in filtered[i + 1 :]:  # no self, no duplicate (a,b) and (b,a)
                matchups.append((a, b))

    if not matchups:
        print("No matchups to run. For head-to-head, set pokemon1 and pokemon2. For matrix, check pool settings.")
        return

    print(f"Running {len(matchups)} matchup(s), {n_battles} battles each = {len(matchups) * n_battles} total battles")
    print(f"Threads: {threads}, Level: {level}")

    results = {}
    thread_names = list(range(1, threads + 1))
    lock = threading.Lock()

    def run_one(m):
        p1, p2 = m
        with lock:
            tn = thread_names.pop(0) if thread_names else 1
        try:
            w1, w2 = run_matchup(p1, p2, n_battles, str(tn), species_list, learnsets, level)
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
                    print(f"  Completed {done}/{len(matchups)}")
            except Exception as e:
                print(f"  Error: {e}")

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

    print(f"Done. Results: {OUTPUT_FILE}, {csv_path}")


if __name__ == "__main__":
    main()
