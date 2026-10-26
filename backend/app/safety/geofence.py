# ==============================================================================
# File: app/safety/geofence.py
# Description: High-Performance Ray-Casting Geofence & Danger Zone Evaluator.
# Purpose: Real-time point-in-polygon containment testing for warehouse forklifts
#          against arbitrary polygon boundaries. Detects danger zone incursions,
#          speed limit infractions, and broadcasts critical safety alerts.
# ==============================================================================

import time
import uuid
from typing import Dict, List, Tuple, Optional, Any

from app.core.config import Config
from app.core.logger import log_event
from app.core.database import db
from app.models.zone import WarehouseZone
from app.models.alert import SafetyAlert


class GeofenceEvaluator:
    """
    Evaluates 2D coordinates of forklifts against active warehouse zones.
    Uses bounding-box pre-filtering followed by Ray-Casting algorithm
    to achieve sub-millisecond containment testing.
    """

    def __init__(self):
        # Tracks current incursion state: (forklift_id, zone_id) -> timestamp of entry
        self._active_incursions: Dict[Tuple[str, str], float] = {}
        # Debounce dictionary for speed alerts: forklift_id -> last_alert_time
        self._speed_alert_cooldowns: Dict[str, float] = {}

    @staticmethod
    def is_point_in_polygon(x: float, y: float, polygon: List[Dict[str, float]]) -> bool:
        """
        Implements the Ray-Casting algorithm to determine if point (x, y)
        is inside an arbitrary 2D polygon.

        :param x: Target X coordinate in meters
        :param y: Target Y coordinate in meters
        :param polygon: List of dicts [{'x': x1, 'y': y1}, ...]
        :return: True if (x, y) is inside the polygon, False otherwise
        """
        n = len(polygon)
        if n < 3:
            return False

        inside = False
        j = n - 1
        for i in range(n):
            xi = float(polygon[i].get("x", 0.0))
            yi = float(polygon[i].get("y", 0.0))
            xj = float(polygon[j].get("x", 0.0))
            yj = float(polygon[j].get("y", 0.0))

            if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
                inside = not inside
            j = i

        return inside

    def evaluate_forklift(
        self,
        forklift_id: str,
        x: float,
        y: float,
        speed: float = 0.0,
        socketio=None,
    ) -> List[Dict[str, Any]]:
        """
        Evaluates a forklift's current state against all active warehouse zones
        and speed limits.

        :param forklift_id: Unique identifier of the forklift
        :param x: Current estimated X coordinate in meters
        :param y: Current estimated Y coordinate in meters
        :param speed: Instantaneous speed in m/s
        :param socketio: Optional Flask-SocketIO instance for real-time push
        :return: List of active alerts generated in this cycle
        """
        now = time.time()
        generated_alerts = []

        # 1. Speed Violation Check
        if speed > Config.MAX_SPEED_THRESHOLD_MPS:
            last_speed_alert = self._speed_alert_cooldowns.get(forklift_id, 0.0)
            if now - last_speed_alert > 5.0:  # 5-second cooldown
                self._speed_alert_cooldowns[forklift_id] = now
                alert = self._create_alert(
                    alert_type="speed_violation",
                    severity="warning",
                    source=forklift_id,
                    message=f"Forklift {forklift_id} exceeded speed limit: {speed:.1f} m/s (Limit: {Config.MAX_SPEED_THRESHOLD_MPS:.1f} m/s)",
                    metadata={
                        "forklift_id": forklift_id,
                        "speed_mps": round(speed, 2),
                        "speed_limit_mps": Config.MAX_SPEED_THRESHOLD_MPS,
                        "position": {"x": round(x, 2), "y": round(y, 2)},
                    },
                    socketio=socketio,
                )
                if alert:
                    generated_alerts.append(alert)

        # 2. Zone Containment Check
        try:
            with db.connection_context():
                active_zones = list(WarehouseZone.select().where(WarehouseZone.is_active == True))
        except Exception as e:
            log_event("ERROR", f"Failed to fetch active zones from database: {e}", "Geofence")
            return generated_alerts

        current_incursions_this_cycle = set()

        for zone in active_zones:
            points = zone.get_points()
            if len(points) < 3:
                continue

            # Bounding box fast pre-filter
            try:
                min_x = float(zone.min_x)
                max_x = float(zone.max_x)
                min_y = float(zone.min_y)
                max_y = float(zone.max_y)
            except (ValueError, TypeError):
                min_x, max_x, min_y, max_y = 0.0, 0.0, 0.0, 0.0

            if x < min_x or x > max_x or y < min_y or y > max_y:
                # Outside bounding box; skip ray casting
                continue

            # Accurate ray-casting test
            if self.is_point_in_polygon(x, y, points):
                incursion_key = (forklift_id, zone.zone_id)
                current_incursions_this_cycle.add(incursion_key)

                # Check if this is a newly entered incursion
                if incursion_key not in self._active_incursions:
                    self._active_incursions[incursion_key] = now

                    severity = "critical" if zone.zone_type == "danger" else "warning"
                    message = (
                        f"⚠️ GEOFENCE BREACH: Forklift {forklift_id} entered {zone.zone_type.upper()} "
                        f"zone '{zone.name}' (ID: {zone.zone_id}) at ({x:.2f}m, {y:.2f}m)"
                    )

                    alert = self._create_alert(
                        alert_type="danger_zone_breach",
                        severity=severity,
                        source=forklift_id,
                        message=message,
                        metadata={
                            "forklift_id": forklift_id,
                            "zone_id": zone.zone_id,
                            "zone_name": zone.name,
                            "zone_type": zone.zone_type,
                            "position": {"x": round(x, 2), "y": round(y, 2)},
                        },
                        socketio=socketio,
                    )
                    if alert:
                        generated_alerts.append(alert)

        # 3. Clean up departed incursions
        active_keys = list(self._active_incursions.keys())
        for incursion_key in active_keys:
            f_id, z_id = incursion_key
            if f_id == forklift_id and incursion_key not in current_incursions_this_cycle:
                # Forklift has safely exited the zone
                entry_time = self._active_incursions.pop(incursion_key, None)
                duration = round(now - entry_time, 1) if entry_time else 0.0
                log_event(
                    "INFO",
                    f"Forklift {forklift_id} exited zone '{z_id}' after {duration}s",
                    "Geofence",
                    data={"forklift_id": forklift_id, "zone_id": z_id, "duration_s": duration},
                )
                if socketio:
                    socketio.emit(
                        "zone_exit",
                        {
                            "forklift_id": forklift_id,
                            "zone_id": z_id,
                            "duration_seconds": duration,
                            "timestamp": time.time(),
                        },
                    )

        return generated_alerts

    def _create_alert(
        self,
        alert_type: str,
        severity: str,
        source: str,
        message: str,
        metadata: Dict[str, Any],
        socketio=None,
    ) -> Optional[Dict[str, Any]]:
        """Persists safety alert to SQLite and pushes it via WebSocket."""
        alert_id = f"ALT-{int(time.time())}-{uuid.uuid4().hex[:6]}"
        try:
            with db.connection_context():
                record = SafetyAlert.create(
                    alert_id=alert_id,
                    alert_type=alert_type,
                    severity=severity,
                    source=source,
                    message=message,
                )
                record.set_metadata(metadata)
                record.save()
                alert_dict = record.to_dict()

            log_event(
                "WARNING" if severity == "warning" else "ERROR",
                message,
                "SafetyEngine",
                data=alert_dict,
            )

            if socketio:
                socketio.emit("safety_alert", alert_dict)

            return alert_dict

        except Exception as e:
            log_event("ERROR", f"Failed to persist safety alert: {e}", "SafetyEngine")
            return None


# Global singleton geofence evaluator
geofence_evaluator = GeofenceEvaluator()
