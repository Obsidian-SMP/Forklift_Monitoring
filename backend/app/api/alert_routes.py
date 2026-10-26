# ==============================================================================
# File: app/api/alert_routes.py
# Description: Safety Alarms & Incident Management Endpoints.
# Purpose: Provides retrieval and acknowledgement workflows for safety alerts,
#          geofence breaches, physical collision impacts, and environmental excursions.
# ==============================================================================

from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify

from app.core.logger import log_event
from app.core.database import db
from app.models.alert import SafetyAlert

IST = timezone(timedelta(hours=5, minutes=30))
alert_bp = Blueprint("alerts", __name__, url_prefix="/api/alerts")


@alert_bp.route("", methods=["GET"])
def get_alerts():
    """
    Returns safety alerts with optional unacknowledged filter.
    Query params:
      - unack_only: bool (default false)
      - limit: int (default 50, max 200)
    """
    unack_only = request.args.get("unack_only", "false").lower() == "true"
    limit = min(int(request.args.get("limit", 50)), 200)

    try:
        with db.connection_context():
            query = SafetyAlert.select().order_by(SafetyAlert.created_at.desc())
            if unack_only:
                query = query.where(SafetyAlert.is_acknowledged == False)

            alerts = [a.to_dict() for a in query.limit(limit)]

        return jsonify({"alerts": alerts, "count": len(alerts)}), 200

    except Exception as e:
        log_event("ERROR", f"Failed to retrieve alerts: {e}", "AlertAPI")
        return jsonify({"error": "Database error"}), 500


@alert_bp.route("/<alert_id>/ack", methods=["POST"])
def acknowledge_alert(alert_id: str):
    """Marks a safety alert as acknowledged by the operator."""
    try:
        with db.connection_context():
            alert = SafetyAlert.get_or_none(SafetyAlert.alert_id == alert_id)
            if not alert:
                return jsonify({"error": f"Alert '{alert_id}' not found"}), 404

            alert.is_acknowledged = True
            alert.acknowledged_at = datetime.now(IST)
            alert.save()

            alert_dict = alert.to_dict()

        log_event("INFO", f"Alert '{alert_id}' acknowledged by operator", "AlertAPI")

        socketio = alert_bp.socketio if hasattr(alert_bp, "socketio") else None
        if socketio:
            socketio.emit("alert_acknowledged", alert_dict)

        return jsonify({"alert": alert_dict}), 200

    except Exception as e:
        log_event("ERROR", f"Failed to acknowledge alert: {e}", "AlertAPI")
        return jsonify({"error": "Database error"}), 500
