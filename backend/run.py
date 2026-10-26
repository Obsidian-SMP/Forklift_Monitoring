# ==============================================================================
# File: run.py
# Description: Central Edge Server Entry Point & Service Coordinator.
# Purpose: Initializes Flask application, SocketIO real-time bus, SQLite WAL
#          database, and background daemons (Positioning Engine at 5 Hz, Vision
#          Worker at 5 FPS, and Camera Ingestion). Provides graceful shutdown.
# ==============================================================================

import os
import signal
import sys
from datetime import datetime, timezone, timedelta
from flask import Flask, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO

from app.core.config import Config
from app.core.database import init_db, db
from app.core.logger import system_logger, log_event
from app.api import register_blueprints

from app.positioning.engine import positioning_engine
from app.vision.load_state_machine import load_state_machine, vision_worker
from app.services.camera_stream import camera_relay

from app.models.forklift import Forklift
from app.models.gateway import GatewayNode, SystemSetting
from app.models.zone import WarehouseZone
from app.models.inventory import InventoryItem

IST = timezone(timedelta(hours=5, minutes=30))


def seed_database_defaults():
    """Populates default assets and layout geometry if tables are empty."""
    with db.connection_context():
        # 1. Default Forklift
        if Forklift.select().count() == 0:
            Forklift.create(
                forklift_id="forklift_1",
                name="Warehouse Forklift #1",
                model_type="Crown SC Series 48V",
                operator_name="Sam (Lead Driver)",
                battery_percentage=96.0,
                status="idle",
                current_x=2.5,
                current_y=2.5,
            )
            log_event("INFO", "Initialized default forklift asset 'forklift_1'", "Bootstrap")

        # 2. Default BLE Phone Gateways (Corner Anchors)
        if GatewayNode.select().count() == 0:
            default_gateways = [
                {"id": "phone_1", "name": "South-West Anchor", "x": 0.5, "y": 0.5, "z": 2.5},
                {"id": "phone_2", "name": "South-East Anchor", "x": 9.5, "y": 0.5, "z": 2.5},
                {"id": "phone_3", "name": "North-East Anchor", "x": 9.5, "y": 9.5, "z": 2.5},
                {"id": "phone_4", "name": "North-West Anchor", "x": 0.5, "y": 9.5, "z": 2.5},
            ]
            for gw in default_gateways:
                GatewayNode.create(
                    gateway_id=gw["id"],
                    name=gw["name"],
                    location_x=gw["x"],
                    location_y=gw["y"],
                    location_z=gw["z"],
                    is_active=True,
                )
            log_event("INFO", "Seeded 4 default BLE perimeter gateway anchors", "Bootstrap")

        # 3. Default Warehouse Geofence Zones
        if WarehouseZone.select().count() == 0:
            # Danger Zone 1: Battery Charging & Chemical Hazard
            danger_zone = WarehouseZone(
                zone_id="zone_danger_chem",
                name="High-Voltage & Chemical Vault",
                zone_type="danger",
                color="#ef4444",
                notify_on_entry=True,
                is_active=True,
            )
            danger_zone.set_points([
                {"x": 1.0, "y": 1.0},
                {"x": 3.5, "y": 1.0},
                {"x": 3.5, "y": 3.5},
                {"x": 1.0, "y": 3.5},
            ])
            danger_zone.save()

            # Loading Zone 1: Inbound Logistics Bay
            loading_zone = WarehouseZone(
                zone_id="zone_loading_dock",
                name="Inbound Loading Dock",
                zone_type="loading",
                color="#3b82f6",
                notify_on_entry=False,
                is_active=True,
            )
            loading_zone.set_points([
                {"x": 6.5, "y": 1.0},
                {"x": 9.0, "y": 1.0},
                {"x": 9.0, "y": 4.0},
                {"x": 6.5, "y": 4.0},
            ])
            loading_zone.save()

            # Storage Zone 1: High-Density Pallet Racking
            storage_zone = WarehouseZone(
                zone_id="zone_storage_racks",
                name="Central Racking Bay A",
                zone_type="storage",
                color="#10b981",
                notify_on_entry=False,
                is_active=True,
            )
            storage_zone.set_points([
                {"x": 1.5, "y": 5.5},
                {"x": 8.5, "y": 5.5},
                {"x": 8.5, "y": 8.5},
                {"x": 1.5, "y": 8.5},
            ])
            storage_zone.save()

            log_event("INFO", "Seeded 3 default warehouse zones (Danger, Loading, Storage)", "Bootstrap")

        # 4. Default Inventory Items
        if InventoryItem.select().count() == 0:
            default_items = [
                {
                    "sku": "SKU-PALLET-001",
                    "name": "Heavy Duty Industrial Pallet",
                    "category": "Pallet",
                    "quantity": 15,
                    "weight": 25.0,
                    "zone": "zone_storage_racks",
                    "shelf": "Rack-A1",
                    "status": "in_stock",
                },
                {
                    "sku": "SKU-CRATE-RED-001",
                    "name": "Automotive Transmission Crate",
                    "category": "Crate",
                    "quantity": 6,
                    "weight": 42.0,
                    "zone": "zone_storage_racks",
                    "shelf": "Rack-A2",
                    "status": "in_stock",
                },
                {
                    "sku": "SKU-ELEC-BOX-002",
                    "name": "Precision Sensor Assembly Kit",
                    "category": "Electronics",
                    "quantity": 18,
                    "weight": 8.5,
                    "zone": "zone_loading_dock",
                    "shelf": "Bay-Inbound",
                    "status": "in_stock",
                },
            ]
            for it in default_items:
                InventoryItem.create(
                    sku=it["sku"],
                    name=it["name"],
                    category=it["category"],
                    quantity=it["quantity"],
                    weight_kg=it["weight"],
                    current_zone=it["zone"],
                    current_shelf=it["shelf"],
                    status=it["status"],
                )
            log_event("INFO", "Seeded default inventory catalog", "Bootstrap")


def create_app():
    """Application factory for Flask and SocketIO."""
    app = Flask(__name__)
    app.config.from_object(Config)

    # Enable Cross-Origin Resource Sharing
    CORS(app, resources={r"/*": {"origins": "*"}})

    # Real-Time WebSocket Server
    socketio = SocketIO(
        app,
        cors_allowed_origins="*",
        async_mode="threading",
        ping_interval=10,
        ping_timeout=5,
    )

    # Initialize SQLite Database & Tables
    init_db()
    seed_database_defaults()

    # Bind WebSocket broadcaster to structured logging engine (Option A)
    system_logger.set_socketio(socketio)

    # Attach SocketIO to Background Engines
    positioning_engine.set_socketio(socketio)
    load_state_machine.set_socketio(socketio)

    # Register REST API Blueprints
    register_blueprints(app, socketio)

    # -------------------------------------------------------------------------
    # WebSocket Event Handlers
    # -------------------------------------------------------------------------
    @socketio.on("connect")
    def handle_connect():
        log_event("INFO", "Web client connected to live telemetry stream", "WebSocket")
        # Send initial snapshot of system state
        pos = positioning_engine.get_current_position()
        socketio.emit("forklift_position", pos)
        # Send recent 30 log lines
        logs = system_logger.get_memory_logs(limit=30)
        socketio.emit("log_snapshot", {"logs": logs})

    @socketio.on("disconnect")
    def handle_disconnect():
        log_event("INFO", "Web client disconnected", "WebSocket")

    @socketio.on("ping_server")
    def handle_ping(data=None):
        socketio.emit("pong_server", {"server_time": datetime.now(IST).isoformat()})

    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "healthy",
            "server_time": datetime.now(IST).isoformat(),
            "positioning_running": positioning_engine.running,
            "vision_running": vision_worker.running,
            "in_memory_logs": len(system_logger.get_memory_logs()),
        }), 200

    return app, socketio


app, socketio = create_app()


def shutdown_gracefully(signum, frame):
    """Cleanly stops background daemon threads before exit."""
    log_event("INFO", f"Received termination signal ({signum}), shutting down daemons...", "Shutdown")
    try:
        positioning_engine.stop()
        vision_worker.stop()
    except Exception as e:
        log_event("WARNING", f"Error during daemon shutdown: {e}", "Shutdown")
    sys.exit(0)


# Register signal handlers for clean terminal exit
signal.signal(signal.SIGINT, shutdown_gracefully)
signal.signal(signal.SIGTERM, shutdown_gracefully)


if __name__ == "__main__":
    log_event(
        "INFO",
        f"Starting Warehouse IoT Central Server on http://{Config.HOST}:{Config.PORT}",
        "Startup",
    )

    # Start Background Daemons
    positioning_engine.start()
    vision_worker.start()

    # Launch Flask-SocketIO Server
    try:
        socketio.run(
            app,
            host=Config.HOST,
            port=Config.PORT,
            debug=Config.DEBUG,
            use_reloader=False,
        )
    except (KeyboardInterrupt, SystemExit):
        shutdown_gracefully(signal.SIGINT, None)
