"""
Route blueprints
"""

import os

from src.routes.api import api_bp
from src.routes.pages import pages_bp


def register_blueprints(app):
    app.register_blueprint(api_bp, url_prefix="/api")
    # Skip SPA pages when API-only (split deployment)
    if not os.environ.get("API_ONLY"):
        app.register_blueprint(pages_bp)
