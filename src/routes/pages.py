"""
Page routes - serves React SPA when built
"""

from pathlib import Path

from flask import Blueprint, send_from_directory

from src.config import ROOT

pages_bp = Blueprint("pages", __name__)
DIST_DIR = ROOT / "frontend" / "dist"


def _serve_spa():
    if (DIST_DIR / "index.html").exists():
        return send_from_directory(DIST_DIR, "index.html")
    return (
        "Frontend not built. Run: cd frontend && npm run build",
        503,
        {"Content-Type": "text/plain"},
    )


@pages_bp.route("/")
def index():
    return _serve_spa()


@pages_bp.route("/assets/<path:filename>")
def assets(filename: str):
    assets_dir = DIST_DIR / "assets"
    if assets_dir.exists():
        return send_from_directory(assets_dir, filename)
    return ("Not found", 404)


@pages_bp.route("/<path:path>")
def spa_catchall(path: str):
    """Serve index.html for SPA client-side routes."""
    if path.startswith("api/"):
        return ("Not found", 404)
    return _serve_spa()
