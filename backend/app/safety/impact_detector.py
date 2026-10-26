# ==============================================================================
# File: app/safety/impact_detector.py
# Description: Forklift Collision & Extreme Vibration Anomaly Detector.
# Purpose: Ingests 3-axis acceleration telemetry from the Arduino Nano 33 IoT
#          LSM6DS3 IMU, computes real-time vector magnitude, identifies severe
#          physical impacts (>5.0g) or potential rollovers, and raises emergency alerts.
# ==============================================================================

import time
import math
import uuid
from typing import Dict, Optional, Any

from app.core.config import Config
from app.core.logger import log_event
from app.core.database import db
from app.models.alert import SafetyAlert


class ImpactDetector:
    """
    Monitors 3-axis acceleration telemetry for structural impacts,
    pallet drops, collisions, or vehicle rollovers.
    """

    def __init__(self, threshold_g: float = Config.VIBRATION_IMPACT_THRESHOLD_G):
        self.threshold_g = threshold_g
        # Cooldown dictionary: forklift_id -> last_impact_alert_timestamp
        self._last_impact_time: Dict[str, float] = {}
        self.cooldown_seconds = 2.0  # Prevent duplicate alerts during shock ringdown

    def evaluate_acceleration(
        self,
        forklift_id: str,
        ax: float,
        ay: float,
        az: float,
        magnitude: Optional[float] = None,
        position: Optional[Dict[str, float]] = None,
        socketio=None,
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluates incoming IMU acceleration against impact thresholds.

        :param forklift_id: Unique identifier of the forklift
        :param ax: X-axis acceleration in g's
        :param ay: Y-axis acceleration in g's
        :param az: Z-axis acceleration in g's
        :param magnitude: Optional pre-computed magnitude |a| in g's
        :param position: Optional current (x, y) coordinates
        :param socketio: Optional Flask-SocketIO instance
        :return: Dict representation of SafetyAlert if triggered, else None
        """
        now = time.time()

        if magnitude is None:
            magnitude = math.sqrt(ax * ax + ay * ay + az * az)

        if magnitude < self.threshold_g:
            return None

        # Check cooldown to avoid flood
        last_alert = self._last_impact_time.get(forklift_id, 0.0)
        if now - last_alert < self.cooldown_seconds:
            return None

        self._last_impact_time[forklift_id] = now

        alert_id = f"ALT-IMP-{int(now)}-{uuid.uuid4().hex[:6]}"
        message = (
            f"💥 CRITICAL IMPACT DETECTED on Forklift {forklift_id}: "
            f"{magnitude:.2f}g (Threshold: {self.threshold_g:.1f}g) | "
            f"Ax={ax:.2f}g, Ay={ay:.2f}g, Az={az:.2f}g"
        )

        metadata = {
            "forklift_id": forklift_id,
            "acceleration_g": {
                "x": round(ax, 3),
                "y": round(ay, 3),
                "z": round(az, 3),
                "magnitude": round(magnitude, 3),
            },
            "threshold_g": self.threshold_g,
            "position": position or {},
        }

        try:
            with db.connection_context():
                record = SafetyAlert.create(
                    alert_id=alert_id,
                    alert_type="impact_collision",
                    severity="critical",
                    source=forklift_id,
                    message=message,
                )
                record.set_metadata(metadata)
                record.save()
                alert_dict = record.to_dict()

            log_event(
                "ERROR",
                message,
                "ImpactDetector",
                data=alert_dict,
            )

            if socketio:
                socketio.emit("safety_alert", alert_dict)

            return alert_dict

        except Exception as e:
            log_event("ERROR", f"Failed to record impact alert: {e}", "ImpactDetector")
            return None


# Global singleton impact detector
impact_detector = ImpactDetector()
