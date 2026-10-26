# ==============================================================================
# File: app/api/zone_routes.py
# Description: Warehouse Geofence & Danger Zone Management Endpoints.
# Purpose: Provides full CRUD capabilities for arbitrary polygon danger zones,
#          loading docks, and storage aisles with database persistence and
#          real-time WebSocket broadcast updates to the canvas dashboard.
# ==============================================================================

from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify

from app.core.logger import log_event
from app.core.database import db
from app.models.zone import WarehouseZone

IST = timezone(timedelta(hours=5, minutes=30))
zone_bp = Blueprint("zones", __name__, url_prefix="/api/zones")


@zone_bp.route("", methods=["GET"])
def get_zones():
    """
    Returns all active warehouse zones with their polygon vertices
    and bounding box envelopes.
    """
    include_inactive = request.args.get("include_inactive", "false").lower() == "true"
    try:
        with db.connection_context():
            query = WarehouseZone.select()
            if not include_inactive:
                query = query.where(WarehouseZone.is_active == True)
            zones = [z.to_dict() for z in query]

        return jsonify({"zones": zones}), 200

    except Exception as e:
        log_event("ERROR", f"Failed to retrieve zones: {e}", "ZoneAPI")
        return jsonify({"error": "Database error"}), 500


@zone_bp.route("", methods=["POST"])
def create_zone():
    """
    Creates a new polygon danger or operational zone.
    Payload:
    {
        "zone_id": "zone_chem_danger_1",
        "name": "Chemical Hazard Vault",
        "zone_type": "danger",
        "color": "#ef4444",
        "points": [{"x": 2.0, "y": 3.0}, {"x": 5.0, "y": 3.0}, {"x": 5.0, "y": 6.0}, {"x": 2.0, "y": 6.0}],
        "notify_on_entry": true
    }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Missing JSON payload"}), 400

    zone_id = data.get("zone_id")
    name = data.get("name", zone_id)
    points = data.get("points", [])

    if not zone_id:
        return jsonify({"error": "zone_id is required"}), 400

    if not isinstance(points, list) or len(points) < 3:
        return jsonify({"error": "points must be an array with at least 3 vertices"}), 400

    try:
        with db.connection_context():
            existing = WarehouseZone.get_or_none(WarehouseZone.zone_id == zone_id)
            if existing:
                return jsonify({"error": f"Zone '{zone_id}' already exists"}), 409

            zone = WarehouseZone(
                zone_id=zone_id,
                name=name,
                zone_type=data.get("zone_type", "danger"),
                color=data.get("color", "#ef4444"),
                notify_on_entry=data.get("notify_on_entry", True),
                is_active=True,
            )
            zone.set_points(points)
            zone.save()

            zone_dict = zone.to_dict()

        log_event("INFO", f"Created zone '{zone_id}' ({name})", "ZoneAPI", data=zone_dict)

        # Broadcast real-time zone creation event to all connected browsers
        socketio = zone_bp.socketio if hasattr(zone_bp, "socketio") else None
        if socketio:
            socketio.emit("zone_created", zone_dict)

        return jsonify({"zone": zone_dict}), 201

    except Exception as e:
        log_event("ERROR", f"Failed to create zone: {e}", "ZoneAPI")
        return jsonify({"error": "Database error"}), 500


@zone_bp.route("/<zone_id>", methods=["PUT", "PATCH"])
def update_zone(zone_id: str):
    """Updates an existing zone's geometry, name, color, or active status."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Missing JSON payload"}), 400

    try:
        with db.connection_context():
            zone = WarehouseZone.get_or_none(WarehouseZone.zone_id == zone_id)
            if not zone:
                return jsonify({"error": f"Zone '{zone_id}' not found"}), 404

            if "name" in data:
                zone.name = data["name"]
            if "zone_type" in data:
                zone.zone_type = data["zone_type"]
            if "color" in data:
                zone.color = data["color"]
            if "notify_on_entry" in data:
                zone.notify_on_entry = bool(data["notify_on_entry"])
            if "is_active" in data:
                zone.is_active = bool(data["is_active"])
            if "points" in data and isinstance(data["points"], list) and len(data["points"]) >= 3:
                zone.set_points(data["points"])

            zone.updated_at = datetime.now(IST)
            zone.save()

            zone_dict = zone.to_dict()

        log_event("INFO", f"Updated zone '{zone_id}'", "ZoneAPI", data=zone_dict)

        socketio = zone_bp.socketio if hasattr(zone_bp, "socketio") else None
        if socketio:
            socketio.emit("zone_updated", zone_dict)

        return jsonify({"zone": zone_dict}), 200

    except Exception as e:
        log_event("ERROR", f"Failed to update zone: {e}", "ZoneAPI")
        return jsonify({"error": "Database error"}), 500


@zone_bp.route("/<zone_id>", methods=["DELETE"])
def delete_zone(zone_id: str):
    """Deletes or deactivates a warehouse zone."""
    hard_delete = request.args.get("hard", "false").lower() == "true"
    try:
        with db.connection_context():
            zone = WarehouseZone.get_or_none(WarehouseZone.zone_id == zone_id)
            if not zone:
                return jsonify({"error": f"Zone '{zone_id}' not found"}), 404

            if hard_delete:
                zone.delete_instance()
            else:
                zone.is_active = False
                zone.updated_at = datetime.now(IST)
                zone.save()

        log_event("INFO", f"Deleted zone '{zone_id}' (hard={hard_delete})", "ZoneAPI")

        socketio = zone_bp.socketio if hasattr(zone_bp, "socketio") else None
        if socketio:
            socketio.emit("zone_deleted", {"zone_id": zone_id, "hard": hard_delete})

        return jsonify({"status": "deleted", "zone_id": zone_id}), 200

    except Exception as e:
        log_event("ERROR", f"Failed to delete zone: {e}", "ZoneAPI")
        return jsonify({"error": "Database error"}), 500
