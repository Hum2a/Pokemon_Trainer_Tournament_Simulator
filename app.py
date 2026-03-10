"""
Pokemon Battle Simulator - Web UI
Entry point for the Flask application.
Serves the React SPA from frontend/dist when not in API-only mode.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root (directory containing app.py)
load_dotenv(Path(__file__).resolve().parent / ".env")

from flask import Flask
from flask_cors import CORS

from src.routes import register_blueprints


def create_app():
    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False
    app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024  # 12 MB max request

    # CORS for split deployment (frontend on different origin)
    cors_origins = os.environ.get("CORS_ORIGINS", "")
    if cors_origins:
        CORS(app, origins=[o.strip() for o in cors_origins.split(",")], supports_credentials=True)

    register_blueprints(app)
    register_security_headers(app)

    return app


def register_security_headers(app):
    """Add security headers to all responses."""

    @app.after_request
    def add_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
