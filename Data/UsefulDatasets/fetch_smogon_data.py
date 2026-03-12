"""
Fetch Smogon sets from data.pkmn.cc and sync to Supabase smogon_sets table.
Run once or periodically: python fetch_smogon_data.py
Stores format index as format_id='index', each format as format_id=gen9ou, etc.
"""

import json
import re
import sys
import urllib.request
from pathlib import Path

SMOGON_SETS_URL = "https://data.pkmn.cc/sets"
TIER_PRIORITY = ("ou", "uu", "ru", "nu", "pu", "zu")

# Add project root for imports and load .env
ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except ImportError:
    pass


def _flatten_tier_format(data):
    """Flatten genX.json tier structure to {species: {setName: set}}."""
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


def _fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "PokemonSimulator/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def main():
    print("Fetching Smogon index...")
    index = _fetch_json(f"{SMOGON_SETS_URL}/index.json")
    formats = sorted(k.replace(".json", "") for k in index.keys())
    print(f"  {len(formats)} formats")

    try:
        from src.supabase_client import sync_smogon_sets, get_supabase
        if not get_supabase():
            print("Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
            return
    except Exception as e:
        print(f"Supabase not available: {e}")
        return

    # Store index as format_id='index' (list of format IDs)
    if sync_smogon_sets("index", formats):
        print("  Synced index to database")
    else:
        print("  Failed to sync index")

    synced = 0
    failed = []
    for fmt in formats:
        try:
            url = f"{SMOGON_SETS_URL}/{fmt}.json"
            data = _fetch_json(url)
            if re.match(r"^gen\d+$", fmt):
                data = _flatten_tier_format(data)
            if sync_smogon_sets(fmt, data):
                synced += 1
                species_count = len(data) if isinstance(data, dict) else 0
                print(f"  {fmt}: {species_count} species")
            else:
                failed.append(fmt)
        except Exception as e:
            failed.append(fmt)
            print(f"  {fmt}: failed ({e})")

    print(f"\nDone. Synced {synced}/{len(formats)} formats.")
    if failed:
        print(f"Failed: {', '.join(failed[:10])}{'...' if len(failed) > 10 else ''}")


if __name__ == "__main__":
    main()
