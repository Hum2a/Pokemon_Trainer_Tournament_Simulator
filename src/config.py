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
                return data
            return _flat_to_nested(data)
        except (json.JSONDecodeError, OSError):
            pass
    return default_config()


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
        "matchups": {
            "noOfThreads": flat.get("noOfThreads", 4),
            "setLevel": flat.get("setLevel", 50),
            "battlesPerMatchup": flat.get("battlesPerMatchup", 100),
            "mode": flat.get("mode", "head-to-head"),
            "poolFilter": flat.get("poolFilter", "all"),
            "poolType": flat.get("poolType", ""),
            "poolRegion": flat.get("poolRegion", ""),
            "poolEvolutionStage": flat.get("poolEvolutionStage", ""),
            "poolAbility": flat.get("poolAbility", ""),
            "poolMove": flat.get("poolMove", ""),
            "poolRole": flat.get("poolRole", ""),
            "poolBst": flat.get("poolBst", "any"),
            "poolTypeCount": flat.get("poolTypeCount", ""),
            "poolTags": flat.get("poolTags", ""),
            "poolEggGroup": flat.get("poolEggGroup", ""),
            "poolColor": flat.get("poolColor", ""),
            "poolGeneration": flat.get("poolGeneration", ""),
            "poolWeight": flat.get("poolWeight", "any"),
            "poolHeight": flat.get("poolHeight", "any"),
            "poolCanMega": flat.get("poolCanMega", "yes"),
            "poolLimit": flat.get("poolLimit", 50),
            "pokemon1": flat.get("pokemon1", ""),
            "pokemon2": flat.get("pokemon2", ""),
        },
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
            "setLevel": 50,
            "battlesPerMatchup": 100,
            "mode": "head-to-head",
            "poolFilter": "all",
            "poolType": "",
            "poolRegion": "",
            "poolEvolutionStage": "",
            "poolAbility": "",
            "poolMove": "",
            "poolRole": "",
            "poolBst": "any",
            "poolTypeCount": "",
            "poolTags": "",
            "poolEggGroup": "",
            "poolColor": "",
            "poolGeneration": "",
            "poolWeight": "any",
            "poolHeight": "any",
            "poolCanMega": "yes",
            "poolLimit": 50,
            "pokemon1": "",
            "pokemon2": "",
        },
    }


def save_config(config):
    """Persist config to disk."""
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
