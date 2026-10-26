# ==============================================================================
# File: app/api/telemetry_routes.py
# Description: IoT Gateway & Environmental Telemetry Ingestion Endpoints.
# Purpose: High-speed ingestion for phone BLE gateway RSSI signals, Arduino IMU
#          vibration data, and Raspberry Pi DHT11 environmental readings.
#          Routes data directly to in-memory buffers to eliminate DB lock contention.
# ==============================================================================

import time
from flask import Blueprint, request, jsonify

from app.core.logger import log_event
from app.core.database import db
from app.positioning.signal_buffer import signal_buffer
from app.safety.impact_detector import impact_detector
from app.safety.environmental import environmental_monitor
from app.models.sensor import SensorReading
from app.models.forklift import VibrationReading

telemetry_bp = Blueprint("telemetry", __name__, url_prefix="/api/telemetry")


@telemetry_bp.route("/gateway", methods=["POST"])
def ingest_gateway_telemetry():
    """
    Receives BLE beacon RSSI and IMU acceleration packet from an Android phone gateway.
    Payload:
    {
        "gateway_id": "phone_1",
        "forklift_id": "forklift_1",
        "rssi": -65.2,
        "ax": 0.05,
        "ay": 0.02,
        "az": 0.98,
        "magnitude": 0.98,
        "battery": 88
    }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid or missing JSON payload"}), 400

    gateway_id = data.get("gateway_id")
    forklift_id = data.get("forklift_id", "forklift_1")
    rssi = data.get("rssi")

    if not gateway_id or rssi is None:
        return jsonify({"error": "gateway_id and rssi are required"}), 400

    try:
        rssi_float = float(rssi)
    except (ValueError, TypeError):
        return jsonify({"error": "rssi must be a valid float"}), 400

    # 1. Non-blocking ingestion into RAM ring buffer for trilateration
    signal_buffer.record_rssi(gateway_id, forklift_id, rssi_float)

    # 2. Check for embedded IMU acceleration telemetry
    ax = data.get("ax")
    ay = data.get("ay")
    az = data.get("az")
    magnitude = data.get("magnitude")

    if ax is not None and ay is not None and az is not None:
        try:
            ax_f, ay_f, az_f = float(ax), float(ay), float(az)
            mag_f = float(magnitude) if magnitude is not None else None
            signal_buffer.record_imu(forklift_id, ax_f, ay_f, az_f, mag_f)

            # Evaluate impact against safety thresholds
            socketio = telemetry_bp.socketio if hasattr(telemetry_bp, "socketio") else None
            impact_detector.evaluate_acceleration(
                forklift_id=forklift_id,
                ax=ax_f,
                ay=ay_f,
                az=az_f,
                magnitude=mag_f,
                socketio=socketio,
            )
        except (ValueError, TypeError) as e:
            log_event("WARNING", f"Malformed IMU data from gateway {gateway_id}: {e}", "TelemetryAPI")

    return jsonify({"status": "recorded", "gateway_id": gateway_id}), 200


@telemetry_bp.route("/dht", methods=["POST"])
def ingest_dht_telemetry():
    """
    Receives ambient temperature and humidity metrics from the Raspberry Pi daemon.
    Payload:
    {
        "sensor_id": "rpi_warehouse_1",
        "temperature": 24.5,
        "humidity": 55.2
    }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid or missing JSON payload"}), 400

    sensor_id = data.get("sensor_id", "rpi_sensor_1")
    temp = data.get("temperature")
    hum = data.get("humidity")

    if temp is None or hum is None:
        return jsonify({"error": "temperature and humidity are required"}), 400

    try:
        temp_f = float(temp)
        hum_f = float(hum)
    except (ValueError, TypeError):
        return jsonify({"error": "temperature and humidity must be numeric"}), 400

    # 1. Persist to database
    try:
        with db.connection_context():
            reading = SensorReading.create(
                sensor_id=sensor_id,
                sensor_type="DHT11",
                temperature=temp_f,
                humidity=hum_f,
            )
            reading_dict = reading.to_dict()
    except Exception as e:
        log_event("ERROR", f"Failed to persist DHT reading: {e}", "TelemetryAPI")
        return jsonify({"error": "Database error"}), 500

    # 2. Check safety thresholds & alert if out of bounds
    socketio = telemetry_bp.socketio if hasattr(telemetry_bp, "socketio") else None
    environmental_monitor.evaluate_reading(
        sensor_id=sensor_id,
        temperature=temp_f,
        humidity=hum_f,
        socketio=socketio,
    )

    # 3. Broadcast real-time environmental update to frontend
    if socketio:
        socketio.emit("sensor_telemetry", reading_dict)

    return jsonify({"status": "recorded", "reading": reading_dict}), 200
