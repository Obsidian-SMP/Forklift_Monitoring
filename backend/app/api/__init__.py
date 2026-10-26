# ==============================================================================
# File: app/api/__init__.py
# Description: REST API Routing & Blueprint Registration Module.
# Purpose: Registers all modular REST API blueprints (Telemetry, Forklifts,
#          Zones, Inventory, Camera Relay, Observability Logs, Alerts, Gateways)
#          onto the Flask application and binds real-time SocketIO emitters.
# ==============================================================================

from flask import Flask
from flask_socketio import SocketIO

from app.api.telemetry_routes import telemetry_bp
from app.api.forklift_routes import forklift_bp
from app.api.zone_routes import zone_bp
from app.api.inventory_routes import inventory_bp
from app.api.camera_routes import camera_bp
from app.api.log_routes import log_bp
from app.api.alert_routes import alert_bp
from app.api.gateway_routes import gateway_bp


def register_blueprints(app: Flask, socketio: SocketIO = None) -> None:
    """
    Registers all API blueprints and attaches SocketIO for real-time broadcasts.
    """
    blueprints = [
        telemetry_bp,
        forklift_bp,
        zone_bp,
        inventory_bp,
        camera_bp,
        log_bp,
        alert_bp,
        gateway_bp,
    ]

    for bp in blueprints:
        if socketio:
            bp.socketio = socketio
        app.register_blueprint(bp)
