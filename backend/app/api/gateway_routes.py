# ==============================================================================
# File: app/api/gateway_routes.py
# Description: BLE Gateway Anchor Nodes & Calibration Endpoints.
# Purpose: Provides RESTful querying and configuration of fixed phone gateway
#          spatial coordinates (x, y, z) and RF calibration parameters
#          used by the Unified Incenter Trilateration positioning engine.
# ==============================================================================

from flask import Blueprint, request, jsonify

from app.core.logger import log_event
from app.core.database import db
from app.models.gateway import GatewayNode, SystemSetting

gateway_bp = Blueprint("gateways", __name__, url_prefix="/api/gateways")


@gateway_bp.route("", methods=["GET"])
def get_gateways():
    """Returns all configured gateway nodes and their coordinates."""
    try:
        with db.connection_context():
            nodes = list(GatewayNode.select())
            result = [n.to_dict() for n in nodes]
        return jsonify({"gateways": result}), 200
    except Exception as e:
        log_event("ERROR", f"Failed to retrieve gateways: {e}", "GatewayAPI")
        return jsonify({"error": "Database error"}), 500


@gateway_bp.route("", methods=["POST"])
def register_or_update_gateway():
    """
    Registers or updates a gateway's physical anchor coordinates.
    Payload:
    {
        "gateway_id": "phone_1",
        "name": "North Wall Anchor",
        "x": 2.0,
        "y": 8.0,
        "z": 2.5
    }
    """
    data = request.get_json(silent=True)
    if not data or not data.get("gateway_id"):
        return jsonify({"error": "gateway_id is required"}), 400

    gid = data["gateway_id"]
    try:
        with db.connection_context():
            node, created = GatewayNode.get_or_create(
                gateway_id=gid,
                defaults={
                    "name": data.get("name", gid),
                    "location_x": float(data.get("x", 0.0)),
                    "location_y": float(data.get("y", 0.0)),
                    "location_z": float(data.get("z", 2.5)),
                },
            )
            if not created:
                if "name" in data:
                    node.name = data["name"]
                if "x" in data:
                    node.location_x = float(data["x"])
                if "y" in data:
                    node.location_y = float(data["y"])
                if "z" in data:
                    node.location_z = float(data["z"])
                if "is_active" in data:
                    node.is_active = bool(data["is_active"])
                node.save()

            node_dict = node.to_dict()

        log_event("INFO", f"Configured gateway '{gid}' at ({node.location_x}, {node.location_y})", "GatewayAPI")
        return jsonify({"gateway": node_dict}), 200

    except Exception as e:
        log_event("ERROR", f"Failed to save gateway: {e}", "GatewayAPI")
        return jsonify({"error": "Database error"}), 500


@gateway_bp.route("/settings", methods=["GET"])
def get_settings():
    """Returns persistent system settings."""
    try:
        with db.connection_context():
            settings = list(SystemSetting.select())
            result = {s.key: s.get_setting(s.key) for s in settings}
        return jsonify({"settings": result}), 200
    except Exception as e:
        log_event("ERROR", f"Failed to retrieve settings: {e}", "GatewayAPI")
        return jsonify({"error": "Database error"}), 500


@gateway_bp.route("/settings/<key>", methods=["POST", "PUT"])
def set_setting(key: str):
    """Sets a persistent system setting."""
    data = request.get_json(silent=True)
    if data is None or "value" not in data:
        return jsonify({"error": "value field required"}), 400

    try:
        with db.connection_context():
            SystemSetting.set_setting(key, data["value"])
        log_event("INFO", f"Updated system setting '{key}'", "GatewayAPI")
        return jsonify({"status": "updated", "key": key, "value": data["value"]}), 200
    except Exception as e:
        log_event("ERROR", f"Failed to set setting: {e}", "GatewayAPI")
        return jsonify({"error": "Database error"}), 500
