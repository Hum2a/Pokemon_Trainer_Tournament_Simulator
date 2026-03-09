"""
Pokemon Battle Simulator - Web UI
Entry point for the Flask application.
"""

from flask import Flask

from src.config import ROOT
from src.routes import register_blueprints


def create_app():
    app = Flask(
        __name__,
        static_folder=str(ROOT / "static"),
        template_folder=str(ROOT / "templates"),
    )
    app.config["JSON_SORT_KEYS"] = False
    app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024  # 12 MB max request

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
