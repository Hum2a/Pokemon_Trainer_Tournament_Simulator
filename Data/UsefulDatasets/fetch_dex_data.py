"""
Fetch Pokemon Showdown dex data from CDN for the team builder.
Run once: python fetch_dex_data.py
Outputs to dex-export/ in this directory.
Also syncs to Supabase dex_data table when configured (fallback + future-proofing).
"""
import json
import sys
import urllib.request
from pathlib import Path

CDN = "https://play.pokemonshowdown.com/data"
OUT = Path(__file__).parent / "dex-export"
OUT.mkdir(exist_ok=True)

# Add project root for imports and load .env
ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except ImportError:
    pass

REGIONS = [(1, "Kanto"), (152, "Johto"), (252, "Hoenn"), (387, "Sinnoh"),
           (494, "Unova"), (650, "Kalos"), (722, "Alola"), (810, "Galar"), (906, "Paldea")]

GEN_BOUNDS = [(1, 1), (152, 2), (252, 3), (387, 4), (494, 5), (650, 6), (722, 7), (810, 8), (906, 9)]

def _num_to_region(num):
    for start, name in reversed(REGIONS):
        if num >= start:
            return name
    return "Other"

def _num_to_generation(num):
    for start, gen in reversed(GEN_BOUNDS):
        if num >= start:
            return gen
    return 1

def _stats_to_role(stats):
    hp = stats.get("hp", 0) or 0
    atk = stats.get("atk", 0) or 0
    defe = stats.get("def", 0) or 0
    spa = stats.get("spa", 0) or 0
    spd = stats.get("spd", 0) or 0
    spe = stats.get("spe", 0) or 0
    if (defe + spd) >= 200 and spe < 90:
        return "Wall"
    if atk >= 100 and atk >= spa and spe >= 80:
        return "Physical Attacker"
    if spa >= 100 and spa >= atk and spe >= 80:
        return "Special Attacker"
    if (defe + spd) >= 150 and (atk + spa) >= 150:
        return "Mixed"
    return "Balanced"

def fetch(name):
    url = f"{CDN}/{name}"
    req = urllib.request.Request(url, headers={"User-Agent": "PokemonSimulator/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())

def main():
    print("Fetching pokedex...")
    pokedex = fetch("pokedex.json")
    # Filter: no Gmax, no nonstandard
    species = []
    for sid, data in pokedex.items():
        if data.get("isNonstandard") or sid.endswith("gmax"):
            continue
        stats = data.get("baseStats", {})
        num = data.get("num", 0)
        prevo = data.get("prevo", "") or ""
        evos = data.get("evos", []) or []
        types_list = data.get("types", [])
        other_formes = data.get("otherFormes", []) or []
        tags_list = data.get("tags", []) or []
        # Evolution stage: base (no prevo), middle (has prevo + evos), final (has prevo, no evos)
        if not prevo:
            evolution_stage = "base"
        elif evos:
            evolution_stage = "middle"
        else:
            evolution_stage = "final"
        bst = sum(stats.values()) if stats else 0
        can_mega = any("mega" in (f or "").lower() for f in other_formes)
        species.append({
            "id": sid,
            "name": data.get("name", sid),
            "baseSpecies": data.get("baseSpecies", data.get("name", sid)),
            "num": num,
            "types": types_list,
            "baseStats": stats,
            "abilities": data.get("abilities", {}),
            "region": _num_to_region(num),
            "role": _stats_to_role(stats),
            "prevo": prevo,
            "evos": evos,
            "evolutionStage": evolution_stage,
            "bst": bst,
            "color": data.get("color", "Unknown"),
            "eggGroups": data.get("eggGroups", []),
            "weightkg": data.get("weightkg"),
            "heightm": data.get("heightm"),
            "tags": tags_list,
            "canMega": can_mega,
            "typeCount": len(types_list) if types_list else 1,
            "generation": _num_to_generation(num),
        })
    (OUT / "species.json").write_text(json.dumps(species), encoding="utf-8")
    print(f"  {len(species)} species")

    print("Fetching moves...")
    moves_raw = fetch("moves.json")
    moves = [{"id": k, "name": v.get("name", k), "type": v.get("type", "Normal"),
             "category": v.get("category", "Physical"), "basePower": v.get("basePower", 0),
             "pp": v.get("pp", 10)} for k, v in moves_raw.items() if not v.get("isNonstandard")]
    (OUT / "moves.json").write_text(json.dumps(moves), encoding="utf-8")
    print(f"  {len(moves)} moves")

    print("Fetching learnsets...")
    learnsets = fetch("learnsets.json")
    # Simplify: species id -> list of move ids
    simple = {k: list(v.get("learnset", {}).keys()) for k, v in learnsets.items()}
    (OUT / "learnsets.json").write_text(json.dumps(simple), encoding="utf-8")
    print(f"  {len(simple)} learnsets")

    # Abilities and items: parse from .js (export const X = {...})
    # Fallback: extract from pokedex abilities
    print("Extracting abilities from pokedex...")
    ab_set = set()
    for s in species:
        for ab in (s.get("abilities") or {}).values():
            if ab:
                ab_set.add(ab)
    abilities = [{"id": a.lower().replace(" ", "").replace("-", ""), "name": a} for a in sorted(ab_set)]
    (OUT / "abilities.json").write_text(json.dumps(abilities), encoding="utf-8")
    print(f"  {len(abilities)} abilities")

    # Items: fetch items.js and parse (format: id:{name:"Name",...})
    print("Fetching items...")
    import re
    try:
        req = urllib.request.Request(f"{CDN}/items.js", headers={"User-Agent": "PokemonSimulator/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            js = resp.read().decode()
        # Find BattleItems = { ... }
        start = js.find("BattleItems = {") + len("BattleItems = {")
        if start < 15:
            raise ValueError("BattleItems not found")
        # Extract each key:{...} - use regex for id:{ and then find name:
        items = []
        for m in re.finditer(r'([a-z0-9]+):\s*\{', js[start:]):
            block_start = start + m.end()
            block_end = js.find("},", block_start)
            if block_end == -1:
                block_end = len(js)
            block = js[block_start:block_end]
            name_m = re.search(r'name:\s*"([^"]+)"', block)
            if name_m and "isNonstandard" not in block[:block.find("name:")]:
                items.append({"id": m.group(1), "name": name_m.group(1)})
        if len(items) < 100:
            raise ValueError("Too few items parsed")
    except Exception as e:
        print(f"  Fallback: using common items. ({e})")
        items = [{"id": "leftovers", "name": "Leftovers"}, {"id": "lifeorb", "name": "Life Orb"},
                 {"id": "choiceband", "name": "Choice Band"}, {"id": "choicespecs", "name": "Choice Specs"},
                 {"id": "choicescarf", "name": "Choice Scarf"}, {"id": "assaultvest", "name": "Assault Vest"},
                 {"id": "focussash", "name": "Focus Sash"}, {"id": "heavydutyboots", "name": "Heavy-Duty Boots"},
                 {"id": "blacksludge", "name": "Black Sludge"}, {"id": "rockyhelmet", "name": "Rocky Helmet"},
                 {"id": "eviolite", "name": "Eviolite"}]
    (OUT / "items.json").write_text(json.dumps(items), encoding="utf-8")
    print(f"  {len(items)} items")

    natures = ["Hardy","Lonely","Brave","Adamant","Naughty","Bold","Docile","Relaxed","Impish","Lax",
               "Timid","Hasty","Serious","Jolly","Naive","Modest","Mild","Quiet","Bashful","Rash",
               "Calm","Gentle","Sassy","Careful","Quirky"]
    (OUT / "natures.json").write_text(json.dumps(natures), encoding="utf-8")

    # Sync to Supabase when configured (fallback + future-proofing for new generations)
    try:
        from src.supabase_client import sync_dex_data, get_supabase
        if get_supabase():
            for dtype, data in [
                ("species", species),
                ("moves", moves),
                ("abilities", abilities),
                ("items", items),
                ("learnsets", simple),
                ("natures", natures),
            ]:
                if sync_dex_data(dtype, data):
                    print(f"  Synced {dtype} to database")
                else:
                    print(f"  Skip sync {dtype} (not configured or failed)")
        else:
            print("  Supabase not configured, skipping DB sync")
    except Exception as e:
        print(f"  DB sync skipped: {e}")

    print("Done.")

if __name__ == "__main__":
    main()
