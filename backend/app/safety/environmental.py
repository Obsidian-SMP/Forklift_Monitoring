# ==============================================================================
# File: app/safety/environmental.py
# Description: Warehouse Environmental Threshold & Excursion Monitor.
# Purpose: Validates ambient temperature and relative humidity metrics pushed
#          from the Raspberry Pi DHT11 sensor daemon against warehouse safety
#          envelopes (heat stress, cold damage, condensation thresholds).
# ==============================================================================

import time
import uuid
from typing import Dict, List, Optional, Any

from app.core.config import Config
from app.core.logger import log_event
from app.core.database import db
from app.models.alert import SafetyAlert


class EnvironmentalMonitor:
    """
    Monitors ambient temperature and humidity against predefined warehouse safety bounds.
    Generates rate-limited safety alerts when excursions occur.
    """

    def __init__(self):
        # Cooldown map: (sensor_id, excursion_type) -> last_alert_timestamp
        self._last_alert_time: Dict[tuple, float] = {}
        self.cooldown_seconds = 60.0  # Alert at most once per minute per excursion type

    def evaluate_reading(
        self,
        sensor_id: str,
        temperature: float,
        humidity: float,
        socketio=None,
    ) -> List[Dict[str, Any]]:
        """
        Validates temperature and humidity against configured safe operating ranges.

        :param sensor_id: Identifier of the environmental sensor node
        :param temperature: Celsius value
        :param humidity: Relative humidity percentage
        :param socketio: Optional Flask-SocketIO instance
        :return: List of alert dicts generated
        """
        now = time.time()
        alerts = []

        # 1. Temperature Excursion Check
        if temperature < Config.TEMP_MIN_CELSIUS or temperature > Config.TEMP_MAX_CELSIUS:
            excursion_type = "temp_low" if temperature < Config.TEMP_MIN_CELSIUS else "temp_high"
            cooldown_key = (sensor_id, excursion_type)
            last_alert = self._last_alert_time.get(cooldown_key, 0.0)

            if now - last_alert >= self.cooldown_seconds:
                self._last_alert_time[cooldown_key] = now
                limit = Config.TEMP_MIN_CELSIUS if excursion_type == "temp_low" else Config.TEMP_MAX_CELSIUS
                direction = "below minimum" if excursion_type == "temp_low" else "above maximum"

                message = (
                    f"🌡️ TEMPERATURE EXCURSION on {sensor_id}: {temperature:.1f}°C is "
                    f"{direction} safe threshold ({limit:.1f}°C)"
                )

                alert = self._create_alert(
                    alert_type="temperature_alarm",
                    severity="warning" if 10.0 <= temperature <= 38.0 else "critical",
                    source=sensor_id,
                    message=message,
                    metadata={
                        "sensor_id": sensor_id,
                        "temperature_c": round(temperature, 2),
                        "temp_min_c": Config.TEMP_MIN_CELSIUS,
                        "temp_max_c": Config.TEMP_MAX_CELSIUS,
                        "humidity_percent": round(humidity, 2),
                    },
                    socketio=socketio,
                )
                if alert:
                    alerts.append(alert)

        # 2. Humidity Excursion Check
        if humidity < Config.HUMIDITY_MIN_PERCENT or humidity > Config.HUMIDITY_MAX_PERCENT:
            excursion_type = "humidity_low" if humidity < Config.HUMIDITY_MIN_PERCENT else "humidity_high"
            cooldown_key = (sensor_id, excursion_type)
            last_alert = self._last_alert_time.get(cooldown_key, 0.0)

            if now - last_alert >= self.cooldown_seconds:
                self._last_alert_time[cooldown_key] = now
                limit = Config.HUMIDITY_MIN_PERCENT if excursion_type == "humidity_low" else Config.HUMIDITY_MAX_PERCENT
                direction = "below minimum" if excursion_type == "humidity_low" else "above maximum"

                message = (
                    f"💧 HUMIDITY EXCURSION on {sensor_id}: {humidity:.1f}% is "
                    f"{direction} safe threshold ({limit:.1f}%)"
                )

                alert = self._create_alert(
                    alert_type="humidity_alarm",
                    severity="warning",
                    source=sensor_id,
                    message=message,
                    metadata={
                        "sensor_id": sensor_id,
                        "humidity_percent": round(humidity, 2),
                        "humidity_min_percent": Config.HUMIDITY_MIN_PERCENT,
                        "humidity_max_percent": Config.HUMIDITY_MAX_PERCENT,
                        "temperature_c": round(temperature, 2),
                    },
                    socketio=socketio,
                )
                if alert:
                    alerts.append(alert)

        return alerts

    def _create_alert(
        self,
        alert_type: str,
        severity: str,
        source: str,
        message: str,
        metadata: Dict[str, Any],
        socketio=None,
    ) -> Optional[Dict[str, Any]]:
        """Persists safety alert and emits via WebSocket."""
        alert_id = f"ALT-ENV-{int(time.time())}-{uuid.uuid4().hex[:6]}"
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
                "EnvironmentalMonitor",
                data=alert_dict,
            )

            if socketio:
                socketio.emit("safety_alert", alert_dict)

            return alert_dict

        except Exception as e:
            log_event("ERROR", f"Failed to record environmental alert: {e}", "EnvironmentalMonitor")
            return None


# Global singleton environmental monitor
environmental_monitor = EnvironmentalMonitor()
