# ==============================================================================
# File: app/api/forklift_routes.py
# Description: Forklift Asset Management & Real-Time State Endpoints.
# Purpose: Provides RESTful querying and management of warehouse forklifts,
#          including real-time interpolated coordinates, operational status,
#          assigned operators, battery health, and historical breadcrumb paths.
# ==============================================================================

from flask import Blueprint, request, jsonify

from app.core.logger import log_event
from app.core.database import db
from app.models.forklift import Forklift, ForkliftTrack
from app.positioning.engine import positioning_engine

forklift_bp = Blueprint("forklifts", __name__, url_prefix="/api/forklifts")


@forklift_bp.route("", methods=["GET"])
def get_all_forklifts():
    """
    Returns all registered forklifts enriched with real-time positions
    from the in-memory positioning engine.
    """
    try:
        with db.connection_context():
            forklifts = list(Forklift.select())
            
        result = []
        for f in forklifts:
            data = f.to_dict()
            # Overlay instantaneous position from the positioning engine
            pos = positioning_engine.get_current_position(f.forklift_id)
            if pos:
                data["current_position"] = {
                    "x": pos["x"],
                    "y": pos["y"],
                    "speed_mps": pos["speed_mps"],
                    "is_moving": pos["is_moving"],
                    "status": pos["status"],
                    "loaded_sku": pos.get("loaded_sku"),
                    "last_updated": pos["last_updated"],
                }
            result.append(data)

        return jsonify({"forklifts": result}), 200

    except Exception as e:
        log_event("ERROR", f"Failed to list forklifts: {e}", "ForkliftAPI")
        return jsonify({"error": "Database query failed"}), 500


@forklift_bp.route("/<forklift_id>", methods=["GET"])
def get_forklift_details(forklift_id: str):
    """Returns single forklift record with live telemetry."""
    try:
        with db.connection_context():
            forklift = Forklift.get_or_none(Forklift.forklift_id == forklift_id)
            if not forklift:
                return jsonify({"error": f"Forklift '{forklift_id}' not found"}), 404

            data = forklift.to_dict()
            pos = positioning_engine.get_current_position(forklift_id)
            if pos:
                data["current_position"] = pos

        return jsonify({"forklift": data}), 200

    except Exception as e:
        log_event("ERROR", f"Failed to get forklift details: {e}", "ForkliftAPI")
        return jsonify({"error": "Internal error"}), 500


@forklift_bp.route("", methods=["POST"])
def register_forklift():
    """Registers a new forklift asset in the system."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Missing JSON payload"}), 400

    forklift_id = data.get("forklift_id")
    name = data.get("name", forklift_id)

    if not forklift_id:
        return jsonify({"error": "forklift_id is required"}), 400

    try:
        with db.connection_context():
            existing = Forklift.get_or_none(Forklift.forklift_id == forklift_id)
            if existing:
                return jsonify({"error": f"Forklift '{forklift_id}' already exists"}), 409

            battery = int(data.get("battery_level", data.get("battery_percentage", 100)))
            forklift = Forklift.create(
                forklift_id=forklift_id,
                name=name,
                battery_level=battery,
                status=data.get("status", "idle"),
            )
            return jsonify({"forklift": forklift.to_dict()}), 201

    except Exception as e:
        log_event("ERROR", f"Failed to create forklift: {e}", "ForkliftAPI")
        return jsonify({"error": "Database insert failed"}), 500


@forklift_bp.route("/<forklift_id>/status", methods=["PATCH"])
def update_forklift_status(forklift_id: str):
    """Updates forklift status (idle, loaded, maintenance, etc.)."""
    data = request.get_json(silent=True)
    if not data or "status" not in data:
        return jsonify({"error": "status field is required"}), 400

    new_status = data.get("status")

    try:
        with db.connection_context():
            forklift = Forklift.get_or_none(Forklift.forklift_id == forklift_id)
            if not forklift:
                return jsonify({"error": f"Forklift '{forklift_id}' not found"}), 404

            forklift.status = new_status
            if "loaded_sku" in data:
                forklift.carrying_item_id = data.get("loaded_sku")
                forklift.is_carrying = bool(data.get("loaded_sku"))
            forklift.save()

            # Also update in-memory positioning engine state
            positioning_engine.set_forklift_status(forklift_id, new_status, forklift.carrying_item_id)

        return jsonify({"forklift": forklift.to_dict()}), 200

    except Exception as e:
        log_event("ERROR", f"Failed to update forklift status: {e}", "ForkliftAPI")
        return jsonify({"error": "Database update failed"}), 500


@forklift_bp.route("/<forklift_id>/history", methods=["GET"])
def get_forklift_history(forklift_id: str):
    """
    Returns recent coordinates breadcrumbs for path reconstruction.
    Query param: ?limit=100 (default 100, max 500).
    """
    limit = min(int(request.args.get("limit", 100)), 500)

    try:
        with db.connection_context():
            forklift = Forklift.get_or_none(Forklift.forklift_id == forklift_id)
            if not forklift:
                return jsonify({"error": f"Forklift '{forklift_id}' not found"}), 404

            tracks = (
                ForkliftTrack.select()
                .where(ForkliftTrack.forklift == forklift)
                .order_by(ForkliftTrack.timestamp.desc())
                .limit(limit)
            )
            trail = [t.to_dict() for t in tracks]
            trail.reverse()  # Chronological order

        return jsonify({"forklift_id": forklift_id, "track_count": len(trail), "trail": trail}), 200

    except Exception as e:
        log_event("ERROR", f"Failed to fetch track history: {e}", "ForkliftAPI")
        return jsonify({"error": "Database query failed"}), 500
