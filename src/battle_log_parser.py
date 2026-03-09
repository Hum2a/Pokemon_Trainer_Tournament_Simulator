"""
Parse Pokemon Showdown battle logs and compute analytics.
Used by matchup_battle_logs.json to produce stats for the frontend.
"""

from __future__ import annotations

import re
from collections import defaultdict
from pathlib import Path


def _get_side(pos: str) -> str:
    """Return 'p1' or 'p2' from position string like p1a: Turtwig."""
    return "p1" if "p1" in pos else "p2"


def _get_pokemon(pos: str) -> str:
    """Extract Pokemon name from position string."""
    m = re.search(r"(?:p1a|p2a):\s*([^|]+)", pos)
    return m.group(1).strip() if m else pos


def parse_single_log(log: str, matchup: str, winner: str) -> dict:
    """
    Parse one battle log and return stats.
    Returns dict with: turns, moves (by side), supereffective, resisted, crits,
    misses, statuses, boosts, heals, recoil, items_consumed.
    """
    lines = [l.strip() for l in log.split("\n") if l.strip() and l.strip().startswith("|")]
    stats = {
        "turns": 0,
        "winner": winner,
        "moves_p1": defaultdict(int),
        "moves_p2": defaultdict(int),
        "supereffective": 0,
        "resisted": 0,
        "crits": 0,
        "misses": 0,
        "statuses": defaultdict(int),
        "boosts": 0,
        "unboosts": 0,
        "heals": 0,
        "recoil": 0,
        "items_consumed": 0,
        "ko_move_p1": None,
        "ko_move_p2": None,
    }

    last_move_p1 = None
    last_move_p2 = None

    for line in lines:
        if not line.startswith("|"):
            continue
        parts = line[1:].split("|")
        cmd = parts[0] if parts else ""
        arg1 = parts[1] if len(parts) > 1 else ""
        arg2 = parts[2] if len(parts) > 2 else ""
        arg3 = parts[3] if len(parts) > 3 else ""

        if cmd == "turn":
            stats["turns"] = max(stats["turns"], int(arg1) if arg1.isdigit() else 0)
        elif cmd == "move":
            side = _get_side(arg1)
            move = arg2
            if move and not move.startswith("["):
                if side == "p1":
                    stats["moves_p1"][move] += 1
                    last_move_p1 = move
                else:
                    stats["moves_p2"][move] += 1
                    last_move_p2 = move
        elif cmd == "-supereffective":
            stats["supereffective"] += 1
        elif cmd == "-resisted":
            stats["resisted"] += 1
        elif cmd == "-crit":
            stats["crits"] += 1
        elif cmd == "-miss":
            stats["misses"] += 1
        elif cmd == "-status":
            stats["statuses"][arg2] = stats["statuses"].get(arg2, 0) + 1
        elif cmd == "-boost":
            stats["boosts"] += 1
        elif cmd == "-unboost":
            stats["unboosts"] += 1
        elif cmd == "-heal":
            stats["heals"] += 1
        elif cmd == "-enditem":
            stats["items_consumed"] += 1
        elif cmd == "-faint":
            if "p1a" in arg1:
                stats["ko_move_p2"] = last_move_p2
            else:
                stats["ko_move_p1"] = last_move_p1
        elif cmd == "-damage" and "[from] Recoil" in (arg3 or ""):
            stats["recoil"] += 1

    stats["moves_p1"] = dict(stats["moves_p1"])
    stats["moves_p2"] = dict(stats["moves_p2"])
    stats["statuses"] = dict(stats["statuses"])
    return stats


def compute_analytics(logs_path: Path) -> dict:
    """
    Load matchup_battle_logs.json, parse all logs, and return analytics.
    """
    import json

    if not logs_path.exists():
        return {"error": "File not found"}

    with open(logs_path, encoding="utf-8") as f:
        raw = json.load(f)

    global_stats = {
        "totalBattles": 0,
        "totalMatchups": 0,
        "avgTurns": 0.0,
        "totalTurns": 0,
        "totalMoves": 0,
        "superEffective": 0,
        "resisted": 0,
        "crits": 0,
        "misses": 0,
        "statuses": defaultdict(int),
        "boosts": 0,
        "heals": 0,
        "recoil": 0,
        "itemsConsumed": 0,
        "turnDistribution": defaultdict(int),
    }

    by_matchup = {}
    by_pokemon = defaultdict(lambda: {
        "wins": 0,
        "losses": 0,
        "totalBattles": 0,
        "turnsWhenWin": [],
        "turnsWhenLoss": [],
        "moves": defaultdict(int),
        "koMoves": defaultdict(int),
        "superEffective": 0,
        "crits": 0,
        "misses": 0,
    })

    move_usage_global = defaultdict(int)
    status_global = defaultdict(int)

    for matchup_key, battles in raw.items():
        if not isinstance(battles, list):
            continue
        p1_name, p2_name = matchup_key.split(" vs ", 1) if " vs " in matchup_key else ("", "")
        matchup_stats = {
            "p1": p1_name,
            "p2": p2_name,
            "totalBattles": len(battles),
            "p1Wins": 0,
            "p2Wins": 0,
            "turns": [],
            "movesP1": defaultdict(int),
            "movesP2": defaultdict(int),
            "superEffective": 0,
            "resisted": 0,
            "crits": 0,
            "misses": 0,
            "statuses": defaultdict(int),
            "boosts": 0,
            "heals": 0,
            "recoil": 0,
        }

        for b in battles:
            winner = b.get("winner")
            log = b.get("log", "")
            parsed = parse_single_log(log, matchup_key, winner)

            global_stats["totalBattles"] += 1
            global_stats["totalTurns"] += parsed["turns"]
            global_stats["turnDistribution"][parsed["turns"]] += 1
            total_moves = sum(parsed["moves_p1"].values()) + sum(parsed["moves_p2"].values())
            global_stats["totalMoves"] += total_moves
            global_stats["superEffective"] += parsed["supereffective"]
            global_stats["resisted"] += parsed["resisted"]
            global_stats["crits"] += parsed["crits"]
            global_stats["misses"] += parsed["misses"]
            global_stats["boosts"] += parsed["boosts"]
            global_stats["heals"] += parsed["heals"]
            global_stats["recoil"] += parsed["recoil"]
            global_stats["itemsConsumed"] += parsed["items_consumed"]
            for s, c in parsed["statuses"].items():
                global_stats["statuses"][s] += c

            matchup_stats["turns"].append(parsed["turns"])
            matchup_stats["superEffective"] += parsed["supereffective"]
            matchup_stats["resisted"] += parsed["resisted"]
            matchup_stats["crits"] += parsed["crits"]
            matchup_stats["misses"] += parsed["misses"]
            matchup_stats["boosts"] += parsed["boosts"]
            matchup_stats["heals"] += parsed["heals"]
            matchup_stats["recoil"] += parsed["recoil"]
            for m, c in parsed["moves_p1"].items():
                matchup_stats["movesP1"][m] += c
                move_usage_global[m] += c
            for m, c in parsed["moves_p2"].items():
                matchup_stats["movesP2"][m] += c
                move_usage_global[m] += c
            for s, c in parsed["statuses"].items():
                matchup_stats["statuses"][s] += c
                status_global[s] += c

            if winner == "p1":
                matchup_stats["p1Wins"] += 1
                by_pokemon[p1_name]["wins"] += 1
                by_pokemon[p1_name]["turnsWhenWin"].append(parsed["turns"])
                by_pokemon[p2_name]["losses"] += 1
                by_pokemon[p2_name]["turnsWhenLoss"].append(parsed["turns"])
            elif winner == "p2":
                matchup_stats["p2Wins"] += 1
                by_pokemon[p2_name]["wins"] += 1
                by_pokemon[p2_name]["turnsWhenWin"].append(parsed["turns"])
                by_pokemon[p1_name]["losses"] += 1
                by_pokemon[p1_name]["turnsWhenLoss"].append(parsed["turns"])

            for m, c in parsed["moves_p1"].items():
                by_pokemon[p1_name]["moves"][m] += c
            for m, c in parsed["moves_p2"].items():
                by_pokemon[p2_name]["moves"][m] += c
            if parsed["ko_move_p1"]:
                by_pokemon[p2_name]["koMoves"][parsed["ko_move_p1"]] += 1
            if parsed["ko_move_p2"]:
                by_pokemon[p1_name]["koMoves"][parsed["ko_move_p2"]] += 1

            by_pokemon[p1_name]["totalBattles"] += 1
            by_pokemon[p2_name]["totalBattles"] += 1
            by_pokemon[p1_name]["superEffective"] += parsed["supereffective"]
            by_pokemon[p2_name]["superEffective"] += parsed["supereffective"]
            by_pokemon[p1_name]["crits"] += parsed["crits"]
            by_pokemon[p2_name]["crits"] += parsed["crits"]
            by_pokemon[p1_name]["misses"] += parsed["misses"]
            by_pokemon[p2_name]["misses"] += parsed["misses"]

        matchup_stats["movesP1"] = dict(matchup_stats["movesP1"])
        matchup_stats["movesP2"] = dict(matchup_stats["movesP2"])
        matchup_stats["statuses"] = dict(matchup_stats["statuses"])
        matchup_stats["avgTurns"] = (
            sum(matchup_stats["turns"]) / len(matchup_stats["turns"])
            if matchup_stats["turns"] else 0
        )
        by_matchup[matchup_key] = matchup_stats

    global_stats["totalMatchups"] = len(by_matchup)
    global_stats["avgTurns"] = (
        global_stats["totalTurns"] / global_stats["totalBattles"]
        if global_stats["totalBattles"] else 0
    )
    global_stats["statuses"] = dict(global_stats["statuses"])
    global_stats["turnDistribution"] = dict(global_stats["turnDistribution"])

    by_pokemon_serialized = {}
    for name, p in by_pokemon.items():
        tw = p["turnsWhenWin"]
        tl = p["turnsWhenLoss"]
        by_pokemon_serialized[name] = {
            "wins": p["wins"],
            "losses": p["losses"],
            "totalBattles": p["totalBattles"],
            "avgTurnsWhenWin": sum(tw) / len(tw) if tw else 0,
            "avgTurnsWhenLoss": sum(tl) / len(tl) if tl else 0,
            "moves": dict(p["moves"]),
            "koMoves": dict(p["koMoves"]),
            "superEffective": p["superEffective"],
            "crits": p["crits"],
            "misses": p["misses"],
        }

    top_moves = sorted(
        move_usage_global.items(),
        key=lambda x: -x[1]
    )[:20]

    return {
        "global": global_stats,
        "byMatchup": by_matchup,
        "byPokemon": by_pokemon_serialized,
        "topMoves": [{"move": m, "count": c} for m, c in top_moves],
        "topStatuses": [{"status": s, "count": c} for s, c in sorted(status_global.items(), key=lambda x: -x[1])[:10]],
    }
