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
) -> bool:
    """Save simulation results. Returns True on success."""
    h = _headers()
    if not h:
        return False
    url, _ = _get_config()
    try:
        r = requests.post(
            f"{url}/rest/v1/simulation_results",
            json={
                "run_id": run_id,
                "user_id": user_id,
                "matchup_results": matchup_results,
                "matchup_matrix_csv": matchup_matrix_csv,
                "matchup_battle_logs": matchup_battle_logs,
            },
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


def get_simulation_results(user_id: str, run_id: str) -> Optional[dict]:
    """Get results for a simulation run. Returns dict or None."""
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
                "select": "*",
            },
            headers=h,
            timeout=10,
        )
        if r.status_code == 200 and r.json():
            rows = r.json()
            if rows:
                return rows[0]
    except Exception:
        pass
    return None
