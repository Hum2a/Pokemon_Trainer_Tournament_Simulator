"""
Background services: script execution
"""

import subprocess
import sys
import threading
from pathlib import Path

import json

from src.config import DATA_DIR, CONFIG_PATH, get_config

current_task = None
current_proc = None
task_output = []
task_lock = threading.Lock()


def run_script(script_name, args=None, capture=True):
    """Run a Python script from the Data directory. Returns (success, output)."""
    cmd = ["python", script_name]
    if args:
        cmd.extend(str(a) for a in args)
    cwd = str(DATA_DIR)
    print(f"[Simulation] Running {script_name}...", flush=True)
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=capture,
            text=True,
            timeout=86400,
        )
        out = (result.stdout or "") + (result.stderr or "")
        if out:
            for line in out.splitlines():
                print(f"  {line}", flush=True)
        status = "OK" if result.returncode == 0 else f"exit {result.returncode}"
        print(f"[Simulation] {script_name} finished ({status})", flush=True)
        return result.returncode == 0, out
    except subprocess.TimeoutExpired:
        print(f"[Simulation] {script_name} timed out", flush=True)
        return False, "Task timed out"
    except Exception as e:
        print(f"[Simulation] {script_name} error: {e}", flush=True)
        return False, str(e)


def run_script_background(script_name, args=None):
    """Run script in background, appending output to task_output."""
    global current_task, current_proc, task_output

    def run():
        global current_task, current_proc, task_output
        with task_lock:
            task_output = []
            current_task = script_name
            current_proc = None

        print(f"[Simulation] Starting background task: {script_name}", flush=True)
        cmd = ["python", script_name]
        if args:
            cmd.extend(str(a) for a in args)
        cwd = str(DATA_DIR)
        proc = subprocess.Popen(
            cmd,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        with task_lock:
            current_proc = proc
        try:
            for line in iter(proc.stdout.readline, ""):
                with task_lock:
                    task_output.append(line)
                sys.stdout.write(line)
                sys.stdout.flush()
        finally:
            proc.wait()
        with task_lock:
            current_proc = None
            current_task = None
        rc = proc.returncode if proc else -1
        print(f"[Simulation] Background task finished: {script_name} (exit {rc})", flush=True)

    t = threading.Thread(target=run, daemon=True)
    t.start()
    return True


def terminate_task():
    """Terminate the currently running background task. Returns True if a task was terminated."""
    with task_lock:
        proc = current_proc
    if proc is not None:
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        except Exception:
            pass
        return True
    return False


def get_task_status():
    """Return current task status and output."""
    with task_lock:
        return {
            "running": current_task is not None,
            "task": current_task,
            "output": "".join(task_output[-10000:]),
        }


def write_trainer_config():
    """Write flat config for runSimulations.py."""
    config = get_config()
    cfg = config.get("trainer", {})
    write_config = {
        "noOfThreads": cfg.get("noOfThreads", 4),
        "setLevel": cfg.get("setLevel", 50),
        "RandomiseTeams": cfg.get("RandomiseTeams", False),
        "n": cfg.get("n"),
        "filename": cfg.get("filename", "Inputs/GymLeaderPokemon.txt"),
    }
    _write_script_config(write_config)


def write_pokemon_config():
    """Write flat config for runPokemonSimulations.py."""
    config = get_config()
    cfg = config.get("pokemon", {})
    write_config = {
        "noOfThreads": cfg.get("noOfThreads", 4),
        "n": cfg.get("n", 2000),
    }
    _write_script_config(write_config)


def write_parse_config():
    """Write flat config for parse scripts."""
    config = get_config()
    cfg = config.get("parse", {})
    _write_script_config({"output_file": cfg.get("output_file", "output.txt")})


def _ensure_list(val):
    if val is None:
        return []
    if isinstance(val, list):
        return [x for x in val if x]
    return [val] if val else []


def write_matchup_config():
    """Write flat config for runMatchupSimulations.py."""
    config = get_config()
    cfg = config.get("matchups", {})
    _write_script_config({
        "noOfThreads": cfg.get("noOfThreads", 4),
        "setLevel": cfg.get("setLevel", 100),
        "battlesPerMatchup": cfg.get("battlesPerMatchup", 5),
        "mode": cfg.get("mode", "head-to-head"),
        "poolEvolutionStages": _ensure_list(cfg.get("poolEvolutionStages")),
        "poolTypes": _ensure_list(cfg.get("poolTypes")),
        "poolCategory": cfg.get("poolCategory", "all"),
        "poolCanMega": cfg.get("poolCanMega", "all"),
        "poolRegions": _ensure_list(cfg.get("poolRegions")),
        "poolBst": cfg.get("poolBst", "any"),
        "poolRoles": _ensure_list(cfg.get("poolRoles")),
        "poolTypeCount": cfg.get("poolTypeCount", ""),
        "poolAbility": cfg.get("poolAbility", ""),
        "poolMove": cfg.get("poolMove", ""),
        "poolTags": _ensure_list(cfg.get("poolTags")),
        "poolEggGroups": _ensure_list(cfg.get("poolEggGroups")),
        "poolColors": _ensure_list(cfg.get("poolColors")),
        "poolGenerations": _ensure_list(cfg.get("poolGenerations")),
        "poolWeight": cfg.get("poolWeight", "any"),
        "poolHeight": cfg.get("poolHeight", "any"),
        "poolLimit": cfg.get("poolLimit", 50),
        "useSmogonSets": cfg.get("useSmogonSets", True),
        "smogonFormat": cfg.get("smogonFormat", "gen9ou"),
        "customSets": cfg.get("customSets", {}),
        "pokemon1": cfg.get("pokemon1", ""),
        "pokemon2": cfg.get("pokemon2", ""),
        "simulationStrategy": cfg.get("simulationStrategy", "full"),
        "sampleFraction": cfg.get("sampleFraction", 0.2),
    })


def _write_script_config(flat_config):
    """Write flat config to config.json for scripts (does not use save_config)."""
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(flat_config, f, indent=2)
