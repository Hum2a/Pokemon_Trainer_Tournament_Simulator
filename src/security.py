"""
Security utilities: validation, path sanitization, input checks
"""

import re
from pathlib import Path

from src.config import DATA_DIR, ALLOWED_OUTPUT_FILES, ALLOWED_DEX_TYPES, MAX_FILE_SIZE_BYTES, MAX_PATH_LENGTH


def validate_config(config):
    """Validate config structure and values. Returns (valid, error_message)."""
    if not isinstance(config, dict):
        return False, "Config must be an object"

    trainer = config.get("trainer", {})
    if isinstance(trainer, dict):
        threads = trainer.get("noOfThreads")
        if threads is not None and (not isinstance(threads, int) or threads < 1 or threads > 64):
            return False, "Trainer threads must be 1-64"
        n = trainer.get("n")
        if n is not None and (not isinstance(n, int) or n < 0):
            return False, "Trainer battle cap must be non-negative"
        filename = trainer.get("filename")
        if filename and not _is_safe_input_path(filename):
            return False, "Invalid trainer filename"

    pokemon = config.get("pokemon", {})
    if isinstance(pokemon, dict):
        threads = pokemon.get("noOfThreads")
        if threads is not None and (not isinstance(threads, int) or threads < 1 or threads > 64):
            return False, "Pokemon threads must be 1-64"

    return True, None


def _is_safe_input_path(path):
    """Check path is under Inputs/ and has no traversal."""
    if not path or len(path) > MAX_PATH_LENGTH:
        return False
    path = path.strip().replace("\\", "/")
    if not path.startswith("Inputs/"):
        return False
    if ".." in path or path == "Inputs":
        return False
    if re.search(r"[<>\"|?*]", path):
        return False
    return True


def resolve_input_path(path):
    """
    Resolve path under Data/Inputs/. Returns Path or None if invalid.
    """
    if not _is_safe_input_path(path):
        return None
    full = (DATA_DIR / path.strip().replace("\\", "/")).resolve()
    data_dir = DATA_DIR.resolve()
    try:
        full.relative_to(data_dir)
    except ValueError:
        return None
    if not str(full).startswith(str(data_dir)):
        return None
    return full


def validate_output_filename(name):
    """Check filename is in allowed list."""
    return name in ALLOWED_OUTPUT_FILES


def validate_dex_type(data_type):
    """Check dex data type is allowed."""
    return data_type in ALLOWED_DEX_TYPES


def validate_file_content_size(content):
    """Check content size is within limits."""
    return isinstance(content, str) and len(content.encode("utf-8")) <= MAX_FILE_SIZE_BYTES
