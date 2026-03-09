"""
Route blueprints
"""

from flask import Blueprint

from src.routes.api import api_bp
from src.routes.pages import pages_bp

def register_blueprints(app):
    app.register_blueprint(pages_bp)
    app.register_blueprint(api_bp, url_prefix="/api")
