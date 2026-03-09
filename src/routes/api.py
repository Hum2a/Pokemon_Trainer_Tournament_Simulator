"""
API routes
"""

import json
from pathlib import Path

from flask import Blueprint, jsonify, request, send_file

from src.config import get_config, save_config, DEX_DIR, DATA_DIR
from src.security import (
    validate_config,
    resolve_input_path,
    validate_output_filename,
    validate_dex_type,
    validate_file_content_size,
)
from src.services import (
    run_script,
    run_script_background,
    get_task_status,
    terminate_task,
    write_trainer_config,
    write_pokemon_config,
    write_parse_config,
    write_matchup_config,
)

api_bp = Blueprint("api", __name__)


@api_bp.route("/config", methods=["GET"])
def get_config_route():
    return jsonify(get_config())


@api_bp.route("/config", methods=["POST"])
def save_config_route():
    config = request.get_json(silent=True)
    if not config:
        return jsonify({"error": "Invalid config"}), 400
    valid, err = validate_config(config)
    if not valid:
        return jsonify({"error": err}), 400
    save_config(config)
    return jsonify({"ok": True})


@api_bp.route("/build-trainer", methods=["POST"])
def build_trainer():
    config = get_config()
    runs = config.get("trainer", {}).get("run_n_times", 100)
    args = [
        "--input", "Inputs/GymLeaderTeams.json",
        "--output", "Inputs/tournament_battles.json",
        "--runs", str(runs),
    ]
    ok, out = run_script("BuildBattles.py", args)
    return jsonify({"ok": ok, "output": out})


@api_bp.route("/build-pokemon", methods=["POST"])
def build_pokemon():
    ok, out = run_script("BuildBattles_pokemon-vs-leaders_Gen1.py")
    return jsonify({"ok": ok, "output": out})


@api_bp.route("/run-trainer", methods=["POST"])
def run_trainer():
    write_trainer_config()
    run_script_background("runSimulations.py")
    return jsonify({"ok": True, "message": "Trainer simulations started"})


@api_bp.route("/run-pokemon", methods=["POST"])
def run_pokemon():
    write_pokemon_config()
    run_script_background("runPokemonSimulations.py")
    return jsonify({"ok": True, "message": "Pokemon simulations started"})


@api_bp.route("/run-matchups", methods=["POST"])
def run_matchups():
    write_matchup_config()
    run_script_background("runMatchupSimulations.py")
    return jsonify({"ok": True, "message": "Matchup simulations started"})


@api_bp.route("/parse-png", methods=["POST"])
def parse_png():
    write_parse_config()
    ok, out = run_script("parseOutput.py")
    return jsonify({"ok": ok, "output": out})


@api_bp.route("/parse-csv", methods=["POST"])
def parse_csv():
    write_parse_config()
    ok, out = run_script("parseOutput_CSV.py")
    return jsonify({"ok": ok, "output": out})


@api_bp.route("/status")
def status():
    return jsonify(get_task_status())


@api_bp.route("/terminate-task", methods=["POST"])
def terminate_task_route():
    if terminate_task():
        return jsonify({"ok": True, "message": "Task terminated"})
    return jsonify({"ok": False, "message": "No task running"}), 400


@api_bp.route("/outputs")
def outputs_list():
    files = []
    for name in [
        "output.txt",
        "battle_matrix_plot.png",
        "trainer_stats.csv",
        "battle_matrix.csv",
        "matchup_results.json",
        "matchup_matrix.csv",
    ]:
        p = DATA_DIR / name
        if p.exists():
            files.append({"name": name, "size": p.stat().st_size})
    return jsonify(files)


@api_bp.route("/outputs/<filename>")
def output_file(filename):
    if not validate_output_filename(filename):
        return jsonify({"error": "Not allowed"}), 403
    path = DATA_DIR / filename
    if not path.exists():
        return jsonify({"error": "File not found"}), 404
    return send_file(path, as_attachment=True, download_name=filename)


@api_bp.route("/files/read", methods=["POST"])
def file_read():
    data = request.get_json(silent=True) or {}
    path = data.get("path", "").strip()
    if not path:
        return jsonify({"error": "Path required"}), 400
    full_path = resolve_input_path(path)
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
    except OSError as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route("/files/write", methods=["POST"])
def file_write():
    data = request.get_json(silent=True) or {}
    path = data.get("path", "").strip()
    content = data.get("content", "")
    if not path:
        return jsonify({"error": "Path required"}), 400
    full_path = resolve_input_path(path)
    if full_path is None:
        return jsonify({"error": "Path must be under Inputs/"}), 403
    if not validate_file_content_size(content):
        return jsonify({"error": "Content too large"}), 400
    try:
        full_path.parent.mkdir(parents=True, exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        return jsonify({"ok": True, "path": path})
    except OSError as e:
        return jsonify({"error": str(e)}), 500


SMOGON_SETS_URL = "https://data.pkmn.cc/sets"
TIER_PRIORITY = ("ou", "uu", "ru", "nu", "pu", "zu")


def _flatten_gen9_tiers(data):
    """Flatten gen9.json tier structure to match gen9ou format: {species: {setName: set}}."""
    result = {}
    for species, tiers in data.items():
        if not isinstance(tiers, dict):
            continue
        merged = {}
        for tier in TIER_PRIORITY:
            tier_sets = tiers.get(tier)
            if not isinstance(tier_sets, dict):
                continue
            for set_name, set_data in tier_sets.items():
                if set_name not in merged:
                    merged[set_name] = set_data
        if not merged:
            for tier, tier_sets in tiers.items():
                if tier in TIER_PRIORITY or not isinstance(tier_sets, dict):
                    continue
                for set_name, set_data in tier_sets.items():
                    if set_name not in merged:
                        merged[set_name] = set_data
        if merged:
            result[species] = merged
    return result


@api_bp.route("/smogon/sets/<format_id>")
def smogon_sets(format_id):
    """Proxy Smogon sets. format_id: gen9ou, gen9uu, gen9, etc."""
    import urllib.request
    allowed = {"gen9ou", "gen9uu", "gen9ru", "gen9nu", "gen9pu", "gen9zu", "gen9"}
    fmt = format_id.lower()
    if fmt not in allowed:
        return jsonify({"error": "Invalid format"}), 400
    try:
        url = f"{SMOGON_SETS_URL}/{fmt}.json"
        req = urllib.request.Request(url, headers={"User-Agent": "PokemonSimulator/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
        if fmt == "gen9":
            data = _flatten_gen9_tiers(data)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@api_bp.route("/dex/<data_type>")
def dex(data_type):
    if not validate_dex_type(data_type):
        return jsonify({"error": "Invalid type"}), 400
    path = DEX_DIR / f"{data_type}.json"
    if not path.exists():
        return jsonify({
            "error": "Dex data not found. Run Data/UsefulDatasets/fetch_dex_data.py first."
        }), 404
    with open(path, encoding="utf-8") as f:
        return jsonify(json.load(f))
