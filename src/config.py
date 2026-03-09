"""
Configuration loading and defaults
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "Data"
CONFIG_PATH = DATA_DIR / "config.json"
DEX_DIR = DATA_DIR / "UsefulDatasets" / "dex-export"

ALLOWED_OUTPUT_FILES = frozenset({
    "output.txt",
    "battle_matrix_plot.png",
    "trainer_stats.csv",
    "battle_matrix.csv",
    "matchup_matrix.csv",
    "matchup_matrix_plot.png",
    "matchup_results.json",
    "matchup_battle_logs.json",
})

ALLOWED_DEX_TYPES = frozenset({
    "species", "moves", "abilities", "items", "learnsets", "natures",
})

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_PATH_LENGTH = 256


def get_config():
    """Load config from Data/config.json. Normalizes flat (script) format to nested (UI) format."""
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, encoding="utf-8") as f:
                data = json.load(f)
            if "trainer" in data:
                m = data.get("matchups", {})
                if m and ("poolFilter" in m or "poolEvolutionStage" in m):
                    data = dict(data, matchups=_matchups_from_flat(m))
                return data
            return _flat_to_nested(data)
        except (json.JSONDecodeError, OSError):
            pass
    return default_config()


def _matchups_from_flat(flat):
    """Build matchups dict from flat config, supporting both old and new filter keys."""
    evo = flat.get("poolEvolutionStages")
    if evo is None and flat.get("poolEvolutionStage"):
        evo = [flat["poolEvolutionStage"]]
    types = flat.get("poolTypes")
    if types is None and flat.get("poolType"):
        types = [flat["poolType"]] if flat["poolType"] else []
    regions = flat.get("poolRegions")
    if regions is None and flat.get("poolRegion"):
        regions = [flat["poolRegion"]] if flat["poolRegion"] else []
    roles = flat.get("poolRoles")
    if roles is None and flat.get("poolRole"):
        roles = [flat["poolRole"]] if flat["poolRole"] else []
    tags = flat.get("poolTags")
    if tags is None and flat.get("poolTags"):
        tags = [flat["poolTags"]] if isinstance(flat["poolTags"], str) else (flat["poolTags"] or [])
    egg_groups = flat.get("poolEggGroups")
    if egg_groups is None and flat.get("poolEggGroup"):
        egg_groups = [flat["poolEggGroup"]] if flat["poolEggGroup"] else []
    colors = flat.get("poolColors")
    if colors is None and flat.get("poolColor"):
        colors = [flat["poolColor"]] if flat["poolColor"] else []
    gens = flat.get("poolGenerations")
    if gens is None and flat.get("poolGeneration"):
        gens = [str(flat["poolGeneration"])] if flat["poolGeneration"] else []
    return {
        "noOfThreads": flat.get("noOfThreads", 4),
        "setLevel": flat.get("setLevel", 100),
        "battlesPerMatchup": flat.get("battlesPerMatchup", 5),
        "mode": flat.get("mode", "head-to-head"),
        "poolEvolutionStages": evo if isinstance(evo, list) else ([evo] if evo else []),
        "poolTypes": types if isinstance(types, list) else ([types] if types else []),
        "poolCategory": flat.get("poolCategory", "all"),
        "poolCanMega": flat.get("poolCanMega", "all"),
        "poolRegions": regions if isinstance(regions, list) else ([regions] if regions else []),
        "poolBst": flat.get("poolBst", "any"),
        "poolRoles": roles if isinstance(roles, list) else ([roles] if roles else []),
        "poolTypeCount": flat.get("poolTypeCount", ""),
        "poolAbility": flat.get("poolAbility", ""),
        "poolMove": flat.get("poolMove", ""),
        "poolTags": tags if isinstance(tags, list) else ([tags] if tags else []),
        "poolEggGroups": egg_groups if isinstance(egg_groups, list) else ([egg_groups] if egg_groups else []),
        "poolColors": colors if isinstance(colors, list) else ([colors] if colors else []),
        "poolGenerations": gens if isinstance(gens, list) else ([str(g) for g in gens] if gens else []),
        "poolWeight": flat.get("poolWeight", "any"),
        "poolHeight": flat.get("poolHeight", "any"),
        "poolLimit": flat.get("poolLimit", 50),
        "useSmogonSets": flat.get("useSmogonSets", True),
        "smogonFormat": flat.get("smogonFormat", "gen9ou"),
        "customSets": flat.get("customSets") or {},
        "pokemon1": flat.get("pokemon1", ""),
        "pokemon2": flat.get("pokemon2", ""),
    }


def _flat_to_nested(flat):
    """Convert flat script config to nested UI config."""
    return {
        "trainer": {
            "noOfThreads": flat.get("noOfThreads", 4),
            "setLevel": flat.get("setLevel", 50),
            "RandomiseTeams": flat.get("RandomiseTeams", False),
            "n": flat.get("n"),
            "run_n_times": 100,
            "filename": flat.get("filename", "Inputs/GymLeaderPokemon.txt"),
        },
        "pokemon": {
            "noOfThreads": flat.get("noOfThreads", 4),
            "n": flat.get("n", 2000),
        },
        "parse": {"output_file": flat.get("output_file", "output.txt")},
        "matchups": _matchups_from_flat(flat),
    }


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
        "matchups": {
            "noOfThreads": 4,
            "setLevel": 100,
            "battlesPerMatchup": 5,
            "mode": "head-to-head",
            "poolEvolutionStages": [],
            "poolTypes": [],
            "poolCategory": "all",
            "poolCanMega": "all",
            "poolRegions": [],
            "poolBst": "any",
            "poolRoles": [],
            "poolTypeCount": "",
            "poolAbility": "",
            "poolMove": "",
            "poolTags": [],
            "poolEggGroups": [],
            "poolColors": [],
            "poolGenerations": [],
            "poolWeight": "any",
            "poolHeight": "any",
            "poolLimit": 50,
            "useSmogonSets": True,
            "smogonFormat": "gen9ou",
            "customSets": {},
            "pokemon1": "",
            "pokemon2": "",
        },
    }


def save_config(config):
    """Persist config to disk."""
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
