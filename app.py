"""
Pokemon Battle Simulator - Web UI
Flask backend that exposes all simulator functions via API and serves the UI.
"""

import json
import os
import subprocess
import threading
from pathlib import Path

from flask import Flask, jsonify, request, send_file

app = Flask(__name__, static_folder="static", template_folder="templates")

# Paths
ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "Data"
CONFIG_PATH = DATA_DIR / "config.json"
DEX_DIR = DATA_DIR / "UsefulDatasets" / "dex-export"

# Task state
current_task = None
task_output = []
task_lock = threading.Lock()


def get_config():
    """Load config from Data/config.json"""
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH) as f:
                return json.load(f)
        except Exception:
            pass
    return default_config()


def default_config():
    return {
        "trainer": {
            "noOfThreads": 4,
            "setLevel": 50,
            "RandomiseTeams": False,
            "n": 100,
            "run_n_times": 100,
            "filename": "Inputs/GymLeaderPokemon.txt",
        },
        "pokemon": {
            "noOfThreads": 4,
            "n": 2000,
        },
        "parse": {
            "output_file": "output.txt",
        },
    }


def save_config(config):
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)


def run_script(script_name, args=None, capture=True):
    """Run a Python script from the Data directory. Returns (success, output)."""
    cmd = ["python", script_name]
    if args:
        cmd.extend(args)
    cwd = str(DATA_DIR)
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=capture,
            text=True,
            timeout=86400,  # 24h max
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
            cmd.extend(args)
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


# --- API Routes ---


@app.route("/")
def index():
    return send_file(ROOT / "templates" / "index.html")


@app.route("/api/config", methods=["GET"])
def api_get_config():
    return jsonify(get_config())


@app.route("/api/config", methods=["POST"])
def api_save_config():
    config = request.json
    if not config:
        return jsonify({"error": "Invalid config"}), 400
    save_config(config)
    return jsonify({"ok": True})


@app.route("/api/build-trainer", methods=["POST"])
def api_build_trainer():
    config = get_config()
    runs = config.get("trainer", {}).get("run_n_times", 100)
    args = [
        "--input", "Inputs/GymLeaderTeams.json",
        "--output", "Inputs/tournament_battles.json",
        "--runs", str(runs),
    ]
    ok, out = run_script("BuildBattles.py", args)
    return jsonify({"ok": ok, "output": out})


@app.route("/api/build-pokemon", methods=["POST"])
def api_build_pokemon():
    ok, out = run_script("BuildBattles_pokemon-vs-leaders_Gen1.py")
    return jsonify({"ok": ok, "output": out})


@app.route("/api/run-trainer", methods=["POST"])
def api_run_trainer():
    config = get_config()
    cfg = config.get("trainer", {})
    write_config = {
        "noOfThreads": cfg.get("noOfThreads", 4),
        "setLevel": cfg.get("setLevel", 50),
        "RandomiseTeams": cfg.get("RandomiseTeams", False),
        "n": cfg.get("n"),
        "filename": cfg.get("filename", "Inputs/GymLeaderPokemon.txt"),
    }
    with open(CONFIG_PATH, "w") as f:
        json.dump(write_config, f, indent=2)
    run_script_background("runSimulations.py")
    return jsonify({"ok": True, "message": "Trainer simulations started"})


@app.route("/api/run-pokemon", methods=["POST"])
def api_run_pokemon():
    config = get_config()
    cfg = config.get("pokemon", {})
    write_config = {
        "noOfThreads": cfg.get("noOfThreads", 4),
        "n": cfg.get("n", 2000),
    }
    with open(CONFIG_PATH, "w") as f:
        json.dump(write_config, f, indent=2)
    run_script_background("runPokemonSimulations.py")
    return jsonify({"ok": True, "message": "Pokemon simulations started"})


@app.route("/api/parse-png", methods=["POST"])
def api_parse_png():
    config = get_config()
    cfg = config.get("parse", {})
    write_config = {"output_file": cfg.get("output_file", "output.txt")}
    with open(CONFIG_PATH, "w") as f:
        json.dump(write_config, f, indent=2)
    ok, out = run_script("parseOutput.py")
    return jsonify({"ok": ok, "output": out})


@app.route("/api/parse-csv", methods=["POST"])
def api_parse_csv():
    config = get_config()
    cfg = config.get("parse", {})
    write_config = {"output_file": cfg.get("output_file", "output.txt")}
    with open(CONFIG_PATH, "w") as f:
        json.dump(write_config, f, indent=2)
    ok, out = run_script("parseOutput_CSV.py")
    return jsonify({"ok": ok, "output": out})


@app.route("/api/status")
def api_status():
    with task_lock:
        return jsonify({
            "running": current_task is not None,
            "task": current_task,
            "output": "".join(task_output[-500:]),  # last 500 lines
        })


@app.route("/api/outputs/<filename>")
def api_output(filename):
    allowed = {"output.txt", "battle_matrix_plot.png", "trainer_stats.csv", "battle_matrix.csv"}
    if filename not in allowed:
        return jsonify({"error": "Not allowed"}), 403
    path = DATA_DIR / filename
    if not path.exists():
        return jsonify({"error": "File not found"}), 404
    return send_file(path, as_attachment=True, download_name=filename)


def _resolve_input_path(path):
    """Resolve path under Data/Inputs/, return None if invalid."""
    path = path.strip().replace("\\", "/")
    if not path or path == "Inputs":
        return None
    if not path.startswith("Inputs/"):
        return None
    full = (DATA_DIR / path).resolve()
    data_dir = DATA_DIR.resolve()
    if not str(full).startswith(str(data_dir)):
        return None
    return full


@app.route("/api/files/read", methods=["POST"])
def api_file_read():
    """Read content of a file in Data/Inputs/"""
    data = request.json or {}
    path = data.get("path", "").strip()
    if not path:
        return jsonify({"error": "Path required"}), 400
    full_path = _resolve_input_path(path)
    if full_path is None:
        return jsonify({"error": "Path must be under Inputs/"}), 403
    if not full_path.exists():
        return jsonify({"error": "File not found"}), 404
    if full_path.is_dir():
        return jsonify({"error": "Cannot read directory"}), 400
    try:
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        return jsonify({"ok": True, "content": content, "path": path})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/files/write", methods=["POST"])
def api_file_write():
    """Write content to a file in Data/Inputs/"""
    data = request.json or {}
    path = data.get("path", "").strip()
    content = data.get("content", "")
    if not path:
        return jsonify({"error": "Path required"}), 400
    full_path = _resolve_input_path(path)
    if full_path is None:
        return jsonify({"error": "Path must be under Inputs/"}), 403
    try:
        full_path.parent.mkdir(parents=True, exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        return jsonify({"ok": True, "path": path})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/dex/<data_type>")
def api_dex(data_type):
    """Serve dex data: species, moves, abilities, items, learnsets, natures."""
    allowed = {"species", "moves", "abilities", "items", "learnsets", "natures"}
    if data_type not in allowed:
        return jsonify({"error": "Invalid type"}), 400
    path = DEX_DIR / f"{data_type}.json"
    if not path.exists():
        return jsonify({"error": "Dex data not found. Run Data/UsefulDatasets/fetch_dex_data.py first."}), 404
    with open(path, encoding="utf-8") as f:
        return jsonify(json.load(f))


@app.route("/api/outputs")
def api_outputs_list():
    files = []
    for name in ["output.txt", "battle_matrix_plot.png", "trainer_stats.csv", "battle_matrix.csv"]:
        p = DATA_DIR / name
        if p.exists():
            files.append({"name": name, "size": p.stat().st_size})
    return jsonify(files)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
