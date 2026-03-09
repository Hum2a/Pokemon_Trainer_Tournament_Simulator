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
            learnsets = json.load(f)
    return species, learnsets


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
    level = m.get("setLevel", m.get("setLevel", 50))
    n_battles = m.get("battlesPerMatchup", 100)
    threads = m.get("noOfThreads", 4)
    mode = m.get("mode", "head-to-head")
    pool_filter = m.get("poolFilter", "all")
    pool_type = m.get("poolType", "")
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
        filtered = species_list
        if pool_filter == "type" and pool_type:
            filtered = [s for s in species_list if pool_type in (s.get("types") or [])]
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
