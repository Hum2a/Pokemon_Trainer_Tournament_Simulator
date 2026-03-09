"""
Supabase client for server-side config and simulation storage.
Uses secret key (sb_secret_...) or legacy service_role key to bypass RLS.
"""

import os
from typing import Any, Optional

_supabase = None


def get_supabase():
    """Lazy-init Supabase client with secret key."""
    global _supabase
    if _supabase is None:
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if url and key:
            from supabase import create_client
            _supabase = create_client(url, key)
        else:
            _supabase = False  # Disabled
    return _supabase if _supabase else None


def get_user_config(user_id: str) -> Optional[dict]:
    """Load config for user from Supabase. Returns None if not found or disabled."""
    sb = get_supabase()
    if not sb:
        return None
    try:
        r = sb.table("user_configs").select("config").eq("user_id", user_id).execute()
        if r.data and len(r.data) > 0:
            return r.data[0].get("config") or {}
    except Exception:
        pass
    return None


def save_user_config(user_id: str, config: dict) -> bool:
    """Upsert config for user. Returns True on success."""
    sb = get_supabase()
    if not sb:
        return False
    try:
        sb.table("user_configs").upsert(
            {"user_id": user_id, "config": config},
            on_conflict="user_id",
        ).execute()
        return True
    except Exception:
        return False


def create_simulation_run(user_id: str, run_type: str, config_snapshot: Optional[dict] = None) -> Optional[str]:
    """Create a simulation run record. Returns run_id or None."""
    sb = get_supabase()
    if not sb:
        return None
    try:
        r = sb.table("simulation_runs").insert(
            {
                "user_id": user_id,
                "type": run_type,
                "config_snapshot": config_snapshot or {},
                "status": "running",
            }
        ).execute()
        if r.data and len(r.data) > 0:
            return r.data[0].get("id")
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
    sb = get_supabase()
    if not sb:
        return False
    try:
        sb.table("simulation_results").insert(
            {
                "run_id": run_id,
                "user_id": user_id,
                "matchup_results": matchup_results,
                "matchup_matrix_csv": matchup_matrix_csv,
                "matchup_battle_logs": matchup_battle_logs,
            }
        ).execute()
        sb.table("simulation_runs").update({"status": "completed"}).eq("id", run_id).execute()
        return True
    except Exception:
        return False


def list_user_simulations(user_id: str, limit: int = 50) -> list[dict]:
    """List simulation runs for user. Returns list of {id, type, status, created_at}."""
    sb = get_supabase()
    if not sb:
        return []
    try:
        r = (
            sb.table("simulation_runs")
            .select("id, type, status, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return r.data or []
    except Exception:
        return []


def get_simulation_results(user_id: str, run_id: str) -> Optional[dict]:
    """Get results for a simulation run. Returns dict or None."""
    sb = get_supabase()
    if not sb:
        return None
    try:
        r = (
            sb.table("simulation_results")
            .select("*")
            .eq("run_id", run_id)
            .eq("user_id", user_id)
            .execute()
        )
        if r.data and len(r.data) > 0:
            return r.data[0]
    except Exception:
        pass
    return None
