"""
Background services: script execution
"""

import subprocess
import threading
from pathlib import Path

import json

from src.config import DATA_DIR, CONFIG_PATH, get_config

current_task = None
task_output = []
task_lock = threading.Lock()


def run_script(script_name, args=None, capture=True):
    """Run a Python script from the Data directory. Returns (success, output)."""
    cmd = ["python", script_name]
    if args:
        cmd.extend(str(a) for a in args)
    cwd = str(DATA_DIR)
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=capture,
            text=True,
            timeout=86400,
        )
        out = (result.stdout or "") + (result.stderr or "")
        return result.returncode == 0, out
    except subprocess.TimeoutExpired:
        return False, "Task timed out"
    except Exception as e:
        return False, str(e)


def run_script_background(script_name, args=None):
    """Run script in background, appending output to task_output."""
    global current_task, task_output

    def run():
        global current_task, task_output
        with task_lock:
            task_output = []
            current_task = script_name

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
        for line in iter(proc.stdout.readline, ""):
            with task_lock:
                task_output.append(line)
        proc.wait()
        with task_lock:
            current_task = None

    t = threading.Thread(target=run, daemon=True)
    t.start()
    return True


def get_task_status():
    """Return current task status and output."""
    with task_lock:
        return {
            "running": current_task is not None,
            "task": current_task,
            "output": "".join(task_output[-500:]),
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


def write_matchup_config():
    """Write flat config for runMatchupSimulations.py."""
    config = get_config()
    cfg = config.get("matchups", {})
    _write_script_config({
        "noOfThreads": cfg.get("noOfThreads", 4),
        "setLevel": cfg.get("setLevel", 50),
        "battlesPerMatchup": cfg.get("battlesPerMatchup", 100),
        "mode": cfg.get("mode", "head-to-head"),
        "poolFilter": cfg.get("poolFilter", "all"),
        "poolType": cfg.get("poolType", ""),
        "poolLimit": cfg.get("poolLimit", 50),
        "pokemon1": cfg.get("pokemon1", ""),
        "pokemon2": cfg.get("pokemon2", ""),
    })


def _write_script_config(flat_config):
    """Write flat config to config.json for scripts (does not use save_config)."""
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(flat_config, f, indent=2)
