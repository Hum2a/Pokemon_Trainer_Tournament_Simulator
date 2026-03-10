"""
Supabase auth verification for Flask API.
Verifies tokens via Supabase /auth/v1/user (no JWT secret needed).
"""

import json
import os
import urllib.request
from functools import wraps
from typing import Optional

from flask import request, jsonify

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = (
    os.environ.get("SUPABASE_ANON_KEY")
    or os.environ.get("VITE_SUPABASE_ANON_KEY")
    or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
    or ""
)


def get_user_id_from_request() -> Optional[str]:
    """Verify token with Supabase Auth API, return user_id or None."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return None
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    try:
        req = urllib.request.Request(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_ANON_KEY,
            },
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode())
            return data.get("id")
    except Exception:
        return None


def _auth_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_ANON_KEY)


def require_auth(f):
    """Decorator: require valid token. Return 401 if missing or invalid."""

    @wraps(f)
    def wrapped(*args, **kwargs):
        if not _auth_configured():
            return (
                jsonify({
                    "error": (
                        "Server auth not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY "
                        "(or VITE_SUPABASE_ANON_KEY) to your backend .env (see AUTH_SETUP.md)."
                    ),
                }),
                503,
            )
        user_id = get_user_id_from_request()
        if not user_id:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)

    return wrapped


def optional_auth(f):
    """Decorator: attach user_id to kwargs if present. Don't require auth."""

    @wraps(f)
    def wrapped(*args, **kwargs):
        kwargs["user_id"] = get_user_id_from_request()
        return f(*args, **kwargs)

    return wrapped


def require_role(*allowed_roles: str):
    """Decorator: require auth and one of the allowed roles (e.g. 'admin', 'developer')."""

    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            if not _auth_configured():
                return (
                    jsonify({
                        "error": (
                            "Server auth not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY "
                            "to your backend .env (see AUTH_SETUP.md)."
                        ),
                    }),
                    503,
                )
            user_id = get_user_id_from_request()
            if not user_id:
                return jsonify({"error": "Authentication required"}), 401
            from src.supabase_client import get_user_role

            role = get_user_role(user_id)
            if role not in allowed_roles:
                return jsonify({"error": "Insufficient permissions"}), 403
            return f(*args, **kwargs)

        return wrapped

    return decorator


def require_admin(f):
    """Decorator: require admin or developer role for admin panel access."""
    return require_role("admin", "developer")(f)


