"""
Supabase JWT verification for Flask API.
Extracts user_id from Authorization: Bearer <token>.
"""

import os
from functools import wraps
from typing import Optional

import jwt
from flask import request, jsonify

SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")


def get_user_id_from_request() -> Optional[str]:
    """Extract and verify JWT, return user_id (sub claim) or None."""
    if not SUPABASE_JWT_SECRET:
        return None
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            audience="authenticated",
            algorithms=["HS256"],
        )
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


def require_auth(f):
    """Decorator: require valid JWT. Return 401 if missing or invalid."""

    @wraps(f)
    def wrapped(*args, **kwargs):
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
