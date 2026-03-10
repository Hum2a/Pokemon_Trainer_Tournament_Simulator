"""
Supabase client for server-side config and simulation storage.
Uses REST API with requests (no supabase package required).
"""

import os
from typing import Any, Optional

import requests

_SUPABASE_URL = ""
_SUPABASE_KEY = ""


def _get_config():
    """Lazy-load Supabase config from env."""
    global _SUPABASE_URL, _SUPABASE_KEY
    if not _SUPABASE_URL:
        _SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
        _SUPABASE_KEY = (
            os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
        )
    return _SUPABASE_URL, _SUPABASE_KEY


def _headers():
    """Headers for Supabase REST API (service role bypasses RLS)."""
    url, key = _get_config()
    if not url or not key:
        return None
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def get_supabase():
    """Return True if Supabase is configured (for compatibility)."""
    url, key = _get_config()
    return bool(url and key)


ALLOWED_ROLES = ("user", "admin", "developer")


def get_user_role(user_id: str) -> str:
    """Get role for user from user_profiles. Returns 'user' if not found."""
    h = _headers()
    if not h:
        return "user"
    url, _ = _get_config()
    try:
        r = requests.get(
            f"{url}/rest/v1/user_profiles",
            params={"user_id": f"eq.{user_id}", "select": "role"},
            headers=h,
            timeout=10,
        )
        if r.status_code == 200:
            data = r.json()
            if data and len(data) > 0:
                role = data[0].get("role")
                if role in ALLOWED_ROLES:
                    return role
    except Exception:
        pass
    return "user"


def update_user_role(user_id: str, role: str) -> bool:
    """Update user role. Returns True on success."""
    if role not in ALLOWED_ROLES:
        return False
    h = _headers()
    if not h:
        return False
    url, _ = _get_config()
    try:
        from datetime import datetime, timezone
        r = requests.patch(
            f"{url}/rest/v1/user_profiles",
            params={"user_id": f"eq.{user_id}"},
            json={"role": role, "updated_at": datetime.now(timezone.utc).isoformat()},
            headers=h,
            timeout=10,
        )
        return r.status_code in (200, 204)
    except Exception:
        pass
    return False


def list_users_with_roles() -> list[dict]:
    """List all users with roles. Uses Auth Admin API + user_profiles. Returns list of {id, email, role}."""
    url, key = _get_config()
    if not url or not key:
        return []
    users: list[dict] = []
    try:
        # Fetch users from Auth Admin API (per_page for larger user bases)
        r = requests.get(
            f"{url}/auth/v1/admin/users",
            params={"per_page": 1000},
            headers={
                "Authorization": f"Bearer {key}",
                "apikey": key,
            },
            timeout=15,
        )
        if r.status_code != 200:
            return []
        auth_data = r.json()
        auth_users = auth_data.get("users") or []
        if not auth_users:
            return []

        # Fetch all profiles
        h = _headers()
        if not h:
            return []
        r2 = requests.get(
            f"{url}/rest/v1/user_profiles",
            params={"select": "user_id,role"},
            headers=h,
            timeout=10,
        )
        profiles = {p["user_id"]: p.get("role", "user") for p in (r2.json() or [])} if r2.status_code == 200 else {}

        for u in auth_users:
            uid = u.get("id")
            if uid:
                users.append({
                    "id": uid,
                    "email": u.get("email") or "",
                    "role": profiles.get(uid, "user"),
                })
    except Exception:
        pass
    return users


def get_user_config(user_id: str) -> Optional[dict]:
    """Load config for user from Supabase. Returns None if not found or disabled."""
    h = _headers()
    if not h:
        return None
    url, _ = _get_config()
    try:
        r = requests.get(
            f"{url}/rest/v1/user_configs",
            params={"user_id": f"eq.{user_id}", "select": "config"},
            headers=h,
            timeout=10,
        )
        if r.status_code == 200:
            data = r.json()
            if data and len(data) > 0:
                return data[0].get("config") or {}
    except Exception:
        pass
    return None


def save_user_config(user_id: str, config: dict) -> bool:
    """Upsert config for user. Returns True on success."""
    h = _headers()
    if not h:
        return False
    h = dict(h, Prefer="resolution=merge-duplicates")
    url, _ = _get_config()
    try:
        r = requests.post(
            f"{url}/rest/v1/user_configs",
            json={"user_id": user_id, "config": config},
            headers=h,
            timeout=10,
        )
        return r.status_code in (200, 201, 204)
    except Exception:
        return False


def create_simulation_run(user_id: str, run_type: str, config_snapshot: Optional[dict] = None) -> Optional[str]:
    """Create a simulation run record. Returns run_id or None."""
    h = _headers()
    if not h:
        return None
    url, _ = _get_config()
    try:
        r = requests.post(
            f"{url}/rest/v1/simulation_runs",
            json={
                "user_id": user_id,
                "type": run_type,
                "config_snapshot": config_snapshot or {},
                "status": "running",
            },
            headers=h,
            timeout=10,
        )
        if r.status_code in (200, 201):
            data = r.json()
            if data and len(data) > 0:
                return data[0].get("id")
    except Exception:
        pass
    return None


def save_simulation_results(
    user_id: str,
    run_id: str,
    matchup_results: Optional[dict] = None,
    matchup_matrix_csv: Optional[str] = None,
    matchup_battle_logs: Optional[dict] = None,
    pool: Optional[list] = None,
    pokemon_sets: Optional[dict] = None,
) -> bool:
    """Save simulation results. Returns True on success."""
    h = _headers()
    if not h:
        return False
    url, _ = _get_config()
    try:
        payload: dict[str, Any] = {
            "run_id": run_id,
            "user_id": user_id,
            "matchup_results": matchup_results,
            "matchup_matrix_csv": matchup_matrix_csv,
            "matchup_battle_logs": matchup_battle_logs,
        }
        if pool is not None:
            payload["pool"] = pool
        if pokemon_sets is not None:
            payload["pokemon_sets"] = pokemon_sets
        r = requests.post(
            f"{url}/rest/v1/simulation_results",
            json=payload,
            headers=h,
            timeout=10,
        )
        if r.status_code not in (200, 201, 204):
            return False
        # Update run status
        requests.patch(
            f"{url}/rest/v1/simulation_runs",
            params={"id": f"eq.{run_id}"},
            json={"status": "completed"},
            headers=h,
            timeout=10,
        )
        return True
    except Exception:
        return False


def list_user_simulations(user_id: str, limit: int = 50) -> list[dict]:
    """List simulation runs for user. Returns list of {id, type, status, created_at}."""
    h = _headers()
    if not h:
        return []
    url, _ = _get_config()
    try:
        r = requests.get(
            f"{url}/rest/v1/simulation_runs",
            params={
                "user_id": f"eq.{user_id}",
                "select": "id,type,status,created_at",
                "order": "created_at.desc",
                "limit": str(limit),
            },
            headers=h,
            timeout=10,
        )
        if r.status_code == 200:
            return r.json() or []
    except Exception:
        pass
    return []


def list_all_simulations(limit: int = 100) -> list[dict]:
    """List all simulation runs across all users (admin). Returns list of {id, user_id, type, status, created_at}."""
    h = _headers()
    if not h:
        return []
    url, _ = _get_config()
    try:
        r = requests.get(
            f"{url}/rest/v1/simulation_runs",
            params={
                "select": "id,user_id,type,status,created_at",
                "order": "created_at.desc",
                "limit": str(limit),
            },
            headers=h,
            timeout=10,
        )
        if r.status_code == 200:
            return r.json() or []
    except Exception:
        pass
    return []


def get_database_stats() -> dict:
    """Get row counts for admin tables (admin). Uses Supabase REST."""
    h = _headers()
    if not h:
        return {"configured": False, "tables": {}}
    url, _ = _get_config()
    stats: dict = {"configured": True, "tables": {}}
    for table in ["user_profiles", "user_configs", "simulation_runs", "simulation_results", "dex_data"]:
        try:
            r = requests.get(
                f"{url}/rest/v1/{table}",
                params={"select": "id", "limit": "0"},
                headers={**h, "Prefer": "count=exact"},
                timeout=10,
            )
            count = r.headers.get("Content-Range", "").split("/")[-1]
            stats["tables"][table] = int(count) if count.isdigit() else 0
        except Exception:
            stats["tables"][table] = -1
    return stats


def get_simulation_results_admin(run_id: str) -> Optional[dict]:
    """Get results for any simulation run (admin). Returns dict or None."""
    h = _headers()
    if not h:
        return None
    url, _ = _get_config()
    try:
        r = requests.get(
            f"{url}/rest/v1/simulation_results",
            params={
                "run_id": f"eq.{run_id}",
                "select": "*,simulation_runs(config_snapshot)",
            },
            headers=h,
            timeout=10,
        )
        if r.status_code == 200 and r.json():
            rows = r.json()
            if rows:
                row = rows[0]
                run_data = row.pop("simulation_runs", None)
                if isinstance(run_data, dict) and run_data:
                    row["config_snapshot"] = run_data.get("config_snapshot")
                elif isinstance(run_data, list) and run_data:
                    row["config_snapshot"] = run_data[0].get("config_snapshot") if run_data[0] else None
                return row
    except Exception:
        pass
    return None


def get_simulation_results(user_id: str, run_id: str) -> Optional[dict]:
    """Get results for a simulation run. Returns dict or None.
    Includes config_snapshot from the run for filters/settings."""
    h = _headers()
    if not h:
        return None
    url, _ = _get_config()
    try:
        r = requests.get(
            f"{url}/rest/v1/simulation_results",
            params={
                "run_id": f"eq.{run_id}",
                "user_id": f"eq.{user_id}",
                "select": "*,simulation_runs(config_snapshot)",
            },
            headers=h,
            timeout=10,
        )
        if r.status_code == 200 and r.json():
            rows = r.json()
            if rows:
                row = rows[0]
                run_data = row.pop("simulation_runs", None)
                if isinstance(run_data, dict) and run_data:
                    row["config_snapshot"] = run_data.get("config_snapshot")
                elif isinstance(run_data, list) and run_data:
                    row["config_snapshot"] = run_data[0].get("config_snapshot") if run_data[0] else None
                return row
    except Exception:
        pass
    return None


# --- Dex data (pokedex reference, synced from fetch_dex_data.py) ---

DEX_DATA_TYPES = ("species", "moves", "abilities", "items", "learnsets", "natures")


def sync_dex_data(data_type: str, data: Any) -> bool:
    """Upsert dex data into Supabase. Returns True on success."""
    if data_type not in DEX_DATA_TYPES:
        return False
    h = _headers()
    if not h:
        return False
    url, _ = _get_config()
    try:
        from datetime import datetime, timezone
        payload = {
            "data_type": data_type,
            "data": data,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        r = requests.post(
            f"{url}/rest/v1/dex_data",
            json=payload,
            headers={**h, "Prefer": "resolution=merge-duplicates,on_conflict=data_type"},
            timeout=60,
        )
        return r.status_code in (200, 201, 204)
    except Exception:
        pass
    return False


def get_dex_data(data_type: str) -> Optional[Any]:
    """Get dex data from Supabase. Returns parsed data or None."""
    if data_type not in DEX_DATA_TYPES:
        return None
    h = _headers()
    if not h:
        return None
    url, _ = _get_config()
    try:
        r = requests.get(
            f"{url}/rest/v1/dex_data",
            params={"data_type": f"eq.{data_type}", "select": "data"},
            headers=h,
            timeout=15,
        )
        if r.status_code == 200:
            rows = r.json()
            if rows:
                return rows[0].get("data")
    except Exception:
        pass
    return None


def get_dex_data_with_meta(data_type: str) -> Optional[dict]:
    """Get dex data and updated_at from Supabase. Returns {data, updated_at} or None."""
    if data_type not in DEX_DATA_TYPES:
        return None
    h = _headers()
    if not h:
        return None
    url, _ = _get_config()
    try:
        r = requests.get(
            f"{url}/rest/v1/dex_data",
            params={"data_type": f"eq.{data_type}", "select": "data,updated_at"},
            headers=h,
            timeout=15,
        )
        if r.status_code == 200:
            rows = r.json()
            if rows:
                return rows[0]
    except Exception:
        pass
    return None
