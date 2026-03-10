"""
API routes
"""

import json
from pathlib import Path

from flask import Blueprint, jsonify, request, send_file

from src.auth import get_user_id_from_request, require_auth, require_admin
from src.config import get_config, save_config, DEX_DIR, DATA_DIR
from src.supabase_client import (
    get_user_config,
    save_user_config,
    create_simulation_run,
    save_simulation_results,
    list_user_simulations,
    get_simulation_results,
    get_simulation_results_admin,
    get_user_role,
    list_users_with_roles,
    list_all_simulations,
    get_database_stats,
    update_user_role,
)
from src.supabase_client import get_dex_data, get_dex_data_with_meta, get_supabase, DEX_DATA_TYPES
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
from src.battle_log_parser import compute_analytics

api_bp = Blueprint("api", __name__)


@api_bp.route("/auth/check")
def auth_check():
    """Diagnostic endpoint: check if auth is working (no auth required)."""
    from src.auth import get_user_id_from_request, _auth_configured
    auth_header = request.headers.get("Authorization")
    has_auth_header = bool(auth_header and auth_header.startswith("Bearer "))
    server_configured = _auth_configured()
    user_id = get_user_id_from_request()
    return jsonify({
        "has_auth_header": has_auth_header,
        "server_configured": server_configured,
        "auth_valid": user_id is not None,
        "hint": (
            "Add SUPABASE_URL and SUPABASE_ANON_KEY to backend .env" if not server_configured
            else "Sign in again and retry" if not has_auth_header
            else "Token invalid or expired" if not user_id
            else "Auth OK"
        ),
    })


@api_bp.route("/auth/me")
@require_auth
def auth_me():
    """Return current user id and role. Requires auth."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    role = get_user_role(user_id)
    return jsonify({"user_id": user_id, "role": role})


@api_bp.route("/admin/users")
@require_admin
def admin_list_users():
    """List all users with roles. Admin/developer only."""
    users = list_users_with_roles()
    return jsonify(users)


@api_bp.route("/admin/users/<user_id>/role", methods=["PATCH"])
@require_admin
def admin_update_role(user_id):
    """Update user role. Admin/developer only."""
    data = request.get_json(silent=True) or {}
    role = data.get("role", "").strip().lower()
    if role not in ("user", "admin", "developer"):
        return jsonify({"error": "Invalid role"}), 400
    if update_user_role(user_id, role):
        return jsonify({"ok": True, "role": role})
    return jsonify({"error": "Failed to update role"}), 500


@api_bp.route("/admin/health")
@require_admin
def admin_health():
    """Check health of all integrations and APIs. Admin/developer only."""
    import urllib.request
    import time

    results = []

    # 1. Backend status
    try:
        start = time.perf_counter()
        get_task_status()
        elapsed = (time.perf_counter() - start) * 1000
        results.append({
            "name": "Backend status",
            "status": "ok",
            "message": "Task status available",
            "ms": round(elapsed, 1),
        })
    except Exception as e:
        results.append({
            "name": "Backend status",
            "status": "error",
            "message": str(e),
        })

    # 2. Auth check
    try:
        user_id = get_user_id_from_request()
        results.append({
            "name": "Auth (Supabase JWT)",
            "status": "ok" if user_id else "warn",
            "message": "Authenticated" if user_id else "No user or token invalid",
        })
    except Exception as e:
        results.append({
            "name": "Auth (Supabase JWT)",
            "status": "error",
            "message": str(e),
        })

    # 3. Supabase REST (user_profiles)
    try:
        users = list_users_with_roles()
        results.append({
            "name": "Supabase (user_profiles)",
            "status": "ok" if users is not None else "warn",
            "message": f"{len(users)} users" if users else "Not configured or empty",
        })
    except Exception as e:
        results.append({
            "name": "Supabase (user_profiles)",
            "status": "error",
            "message": str(e),
        })

    # 4. Dex data (local)
    try:
        from src.config import DEX_DIR
        species_path = DEX_DIR / "species.json"
        exists = species_path.exists()
        results.append({
            "name": "Dex data (local)",
            "status": "ok" if exists else "warn",
            "message": "species.json found" if exists else "Run fetch_dex_data.py",
        })
    except Exception as e:
        results.append({
            "name": "Dex data (local)",
            "status": "error",
            "message": str(e),
        })

    # 5. Smogon / data.pkmn.cc
    try:
        start = time.perf_counter()
        req = urllib.request.Request(
            "https://data.pkmn.cc/sets/index.json",
            headers={"User-Agent": "PokemonSimulator/1.0"},
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode())
        elapsed = (time.perf_counter() - start) * 1000
        count = len(data) if isinstance(data, dict) else 0
        results.append({
            "name": "Smogon sets (data.pkmn.cc)",
            "status": "ok",
            "message": f"{count} formats",
            "ms": round(elapsed, 1),
        })
    except Exception as e:
        results.append({
            "name": "Smogon sets (data.pkmn.cc)",
            "status": "error",
            "message": str(e),
        })

    # 6. Pokemon Showdown CDN (sprites)
    try:
        start = time.perf_counter()
        req = urllib.request.Request(
            "https://play.pokemonshowdown.com/sprites/dex/pikachu.png",
            headers={"User-Agent": "PokemonSimulator/1.0"},
        )
        with urllib.request.urlopen(req, timeout=8) as r:
            r.read()
        elapsed = (time.perf_counter() - start) * 1000
        results.append({
            "name": "Showdown CDN (sprites)",
            "status": "ok",
            "message": "Sprite reachable",
            "ms": round(elapsed, 1),
        })
    except Exception as e:
        results.append({
            "name": "Showdown CDN (sprites)",
            "status": "error",
            "message": str(e),
        })

    # 7. PokéAPI
    try:
        start = time.perf_counter()
        req = urllib.request.Request(
            "https://pokeapi.co/api/v2/pokemon/pikachu",
            headers={"Accept": "application/json", "User-Agent": "PokemonSimulator/1.0"},
        )
        with urllib.request.urlopen(req, timeout=8) as r:
            data = json.loads(r.read().decode())
        elapsed = (time.perf_counter() - start) * 1000
        name = data.get("name", "?")
        results.append({
            "name": "PokéAPI",
            "status": "ok",
            "message": f"OK ({name})",
            "ms": round(elapsed, 1),
        })
    except Exception as e:
        results.append({
            "name": "PokéAPI",
            "status": "error",
            "message": str(e),
        })

    # 8. Config file
    try:
        from src.config import CONFIG_PATH
        exists = CONFIG_PATH.exists()
        results.append({
            "name": "Config file",
            "status": "ok" if exists else "warn",
            "message": "config.json found" if exists else "Missing",
        })
    except Exception as e:
        results.append({
            "name": "Config file",
            "status": "error",
            "message": str(e),
        })

    return jsonify({"checks": results})


@api_bp.route("/admin/simulations")
@require_admin
def admin_list_simulations():
    """List all simulation runs across users. Admin/developer only."""
    runs = list_all_simulations(limit=100)
    users = {u["id"]: u["email"] for u in list_users_with_roles()}
    for r in runs:
        r["user_email"] = users.get(r.get("user_id", ""), "(unknown)")
    return jsonify(runs)


@api_bp.route("/admin/simulations/<run_id>")
@require_admin
def admin_simulation_detail(run_id):
    """Get a simulation's results (any user). Admin/developer only."""
    results = get_simulation_results_admin(run_id)
    if not results:
        return jsonify({"error": "Simulation not found"}), 404
    return jsonify(results)


@api_bp.route("/admin/database-stats")
@require_admin
def admin_database_stats():
    """Get database table row counts. Admin/developer only."""
    return jsonify(get_database_stats())


@api_bp.route("/admin/dex-status")
@require_admin
def admin_dex_status():
    """Get dex data status: source (DB vs file), counts, updated_at. Admin/developer only."""
    result = {"source": "file", "types": {}, "configured": get_supabase()}
    for data_type in DEX_DATA_TYPES:
        entry = {"count": 0, "updated_at": None}
        # Try database first
        if get_supabase():
            row = get_dex_data_with_meta(data_type)
            if row:
                data = row.get("data")
                if data is not None:
                    entry["count"] = len(data) if isinstance(data, (list, dict)) else 0
                    entry["updated_at"] = row.get("updated_at")
                    result["source"] = "database"
        # Fallback: file
        if entry["count"] == 0:
            path = DEX_DIR / f"{data_type}.json"
            if path.exists():
                try:
                    with open(path, encoding="utf-8") as f:
                        data = json.load(f)
                    entry["count"] = len(data) if isinstance(data, (list, dict)) else 0
                    if result["source"] != "database":
                        result["source"] = "file"
                except (json.JSONDecodeError, OSError):
                    pass
        result["types"][data_type] = entry
    return jsonify(result)


def _load_config_for_user(user_id):
    """Load config: Supabase first if user, else file."""
    if user_id:
        cfg = get_user_config(user_id)
        if cfg:
            save_config(cfg)  # Write to file for scripts
            return cfg
    return get_config()


@api_bp.route("/config", methods=["GET"])
def get_config_route():
    user_id = get_user_id_from_request()
    config = _load_config_for_user(user_id)
    return jsonify(config)


@api_bp.route("/config", methods=["POST"])
def save_config_route():
    user_id = get_user_id_from_request()
    config = request.get_json(silent=True)
    if not config:
        return jsonify({"error": "Invalid config"}), 400
    valid, err = validate_config(config)
    if not valid:
        return jsonify({"error": err}), 400
    save_config(config)  # Always write to file for scripts
    if user_id:
        save_user_config(user_id, config)
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


@api_bp.route("/outputs/matchup-data")
def matchup_data():
    """Return matchup_results.json content for charts. 404 if not found."""
    path = DATA_DIR / "matchup_results.json"
    if not path.exists():
        return jsonify({"error": "File not found"}), 404
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return jsonify(data)
    except (json.JSONDecodeError, OSError) as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route("/outputs/matchup-battle-logs")
def matchup_battle_logs():
    """Return matchup_battle_logs.json content. 404 if not found."""
    path = DATA_DIR / "matchup_battle_logs.json"
    if not path.exists():
        return jsonify({"error": "File not found"}), 404
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return jsonify(data)
    except (json.JSONDecodeError, OSError) as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route("/outputs/matchup-battle-analytics")
def matchup_battle_analytics():
    """Return parsed analytics from matchup_battle_logs.json. 404 if not found."""
    path = DATA_DIR / "matchup_battle_logs.json"
    if not path.exists():
        return jsonify({"error": "File not found"}), 404
    try:
        data = compute_analytics(path)
        if "error" in data:
            return jsonify({"error": data["error"]}), 404
        return jsonify(data)
    except (json.JSONDecodeError, OSError) as e:
        return jsonify({"error": str(e)}), 500


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
        "matchup_battle_logs.json",
        "matchup_simulation_metadata.json",
    ]:
        p = DATA_DIR / name
        if p.exists():
            files.append({"name": name, "size": p.stat().st_size})
    return jsonify(files)


@api_bp.route("/outputs/<filename>", methods=["GET", "DELETE"])
def output_file(filename):
    if not validate_output_filename(filename):
        return jsonify({"error": "Not allowed"}), 403
    path = DATA_DIR / filename
    if not path.exists():
        return jsonify({"error": "File not found"}), 404
    if request.method == "DELETE":
        try:
            path.unlink()
            return jsonify({"ok": True, "message": f"Deleted {filename}"})
        except OSError as e:
            return jsonify({"error": str(e)}), 500
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


@api_bp.route("/smogon/formats")
@require_auth
def smogon_formats():
    """Return list of available Smogon format IDs from data.pkmn.cc/sets/index.json."""
    import urllib.request
    try:
        url = f"{SMOGON_SETS_URL}/index.json"
        req = urllib.request.Request(url, headers={"User-Agent": "PokemonSimulator/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            index = json.loads(r.read().decode())
        # Format IDs are keys without .json, sorted by gen then tier
        formats = sorted(k.replace(".json", "") for k in index.keys())
        return jsonify(formats)
    except Exception as e:
        return jsonify({"error": str(e)}), 502


def _flatten_tier_format(data):
    """Flatten genX.json tier structure to match genXou format: {species: {setName: set}}."""
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


def _fetch_and_flatten_format(fmt):
    """Fetch a single format and return flattened {species: {setName: set}}."""
    import urllib.request
    import re
    url = f"{SMOGON_SETS_URL}/{fmt}.json"
    req = urllib.request.Request(url, headers={"User-Agent": "PokemonSimulator/1.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.loads(r.read().decode())
    if re.match(r"^gen\d+$", fmt):
        return _flatten_tier_format(data)
    return data


@api_bp.route("/smogon/sets/newest")
def smogon_sets_newest():
    """Return merged sets using the most recent format that has each Pokemon (gen9 first, then gen8, etc.)."""
    import urllib.request
    merged = {}
    for fmt in NEWEST_FORMAT_PRIORITY:
        try:
            data = _fetch_and_flatten_format(fmt)
            for species, sets in data.items():
                if species not in merged and isinstance(sets, dict) and sets:
                    set_names = list(sets.keys())
                    merged[species] = {set_names[0]: sets[set_names[0]]}
        except Exception:
            continue
    return jsonify(merged)


@api_bp.route("/smogon/sets/<format_id>")
def smogon_sets(format_id):
    """Proxy Smogon sets. format_id: any valid format from data.pkmn.cc (gen1ou, gen8uu, etc.), or 'newest'."""
    import urllib.request
    import re
    fmt = format_id.lower().strip()
    if fmt == "newest":
        return smogon_sets_newest()
    if not re.match(r"^gen\d+[a-z0-9]*$", fmt):
        return jsonify({"error": "Invalid format ID"}), 400
    try:
        url = f"{SMOGON_SETS_URL}/{fmt}.json"
        req = urllib.request.Request(url, headers={"User-Agent": "PokemonSimulator/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
        # Generation-level formats (gen9, gen8, etc.) have tier structure
        if re.match(r"^gen\d+$", fmt):
            data = _flatten_tier_format(data)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@api_bp.route("/simulations/save-current", methods=["POST"])
@require_auth
def save_current_simulation():
    """Save current matchup outputs to Supabase for the authenticated user."""
    try:
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({"error": "Authentication required"}), 401
        config = get_config()
        run_id = create_simulation_run(user_id, "matchup", config)
        if not run_id:
            return jsonify({"error": "Failed to create simulation record"}), 500
        matchup_results = None
        matchup_matrix_csv = None
        matchup_battle_logs = None
        pool = None
        pokemon_sets = None
        try:
            p = DATA_DIR / "matchup_results.json"
            if p.exists():
                with open(p, encoding="utf-8") as f:
                    matchup_results = json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
        try:
            p = DATA_DIR / "matchup_matrix.csv"
            if p.exists():
                matchup_matrix_csv = p.read_text(encoding="utf-8")
        except OSError:
            pass
        try:
            p = DATA_DIR / "matchup_battle_logs.json"
            if p.exists():
                with open(p, encoding="utf-8") as f:
                    matchup_battle_logs = json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
        try:
            p = DATA_DIR / "matchup_simulation_metadata.json"
            if p.exists():
                with open(p, encoding="utf-8") as f:
                    meta = json.load(f)
                pool = meta.get("pool")
                pokemon_sets = meta.get("pokemon_sets")
        except (json.JSONDecodeError, OSError):
            pass
        if save_simulation_results(
            user_id, run_id, matchup_results, matchup_matrix_csv, matchup_battle_logs,
            pool=pool, pokemon_sets=pokemon_sets,
        ):
            return jsonify({"ok": True, "run_id": run_id})
        return jsonify({"error": "Failed to save results"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route("/simulations")
@require_auth
def simulations_list():
    """List user's saved simulations."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    runs = list_user_simulations(user_id)
    return jsonify(runs)


@api_bp.route("/simulations/<run_id>")
@require_auth
def simulation_detail(run_id):
    """Get a single simulation's results."""
    user_id = get_user_id_from_request()
    if not user_id:
        return jsonify({"error": "Authentication required"}), 401
    results = get_simulation_results(user_id, run_id)
    if not results:
        return jsonify({"error": "Simulation not found"}), 404
    return jsonify(results)


@api_bp.route("/dex/<data_type>")
def dex(data_type):
    if not validate_dex_type(data_type):
        return jsonify({"error": "Invalid type"}), 400

    # Try database first (fallback to JSON files)
    if get_supabase():
        db_data = get_dex_data(data_type)
        if db_data is not None:
            return jsonify(db_data)

    # Fallback: read from local JSON files
    path = DEX_DIR / f"{data_type}.json"
    if not path.exists():
        return jsonify({
            "error": "Dex data not found. Run Data/UsefulDatasets/fetch_dex_data.py first."
        }), 404
    with open(path, encoding="utf-8") as f:
        return jsonify(json.load(f))
