# ==============================================================================
# File: backend/tests/test_phase0_telemetry.py
# Description: Phase 0 Hardware & Telemetry Ingestion End-to-End Validation.
# Purpose: Simulates Android APK gateway transmissions (raw RSSI + LSM6DS3 IMU),
#          Arduino Nano 33 IoT shock packets, and Raspberry Pi DHT11 environmental
#          readings against the laptop edge backend API.
# ==============================================================================

import os
import sys
import json
import time

# Ensure UTF-8 output on Windows terminal
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Ensure backend root is in module search path
BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from flask import Flask
from flask_socketio import SocketIO

from app.core.config import Config
from app.core.database import init_db, db
from app.api import register_blueprints
from app.positioning.signal_buffer import signal_buffer
from app.models.alert import SafetyAlert
from app.models.sensor import SensorReading


def run_phase0_tests():
    print("\n" + "=" * 70)
    print("  [PHASE 0] HARDWARE TELEMETRY & EDGE INTEGRATION TEST SUITE")
    print("=" * 70)


    # 1. Initialize DB and Flask Test Client
    init_db()
    app = Flask(__name__)
    app.config["TESTING"] = True
    socketio = SocketIO(app, cors_allowed_origins="*")
    register_blueprints(app, socketio)
    client = app.test_client()


    tests_passed = 0
    total_tests = 5

    # -------------------------------------------------------------------------
    # TEST 1: Android Gateway Ingestion (APK -> Laptop Backend)
    # -------------------------------------------------------------------------
    print("\n[TEST 1] Testing Android BLE Gateway Ingestion (4 Anchor Phones)...")
    anchors = [
        {"id": "phone_1", "rssi": -63.5, "ax": 0.02, "ay": 0.03, "az": 0.99, "mag": 0.99},
        {"id": "phone_2", "rssi": -68.0, "ax": 0.02, "ay": 0.03, "az": 0.99, "mag": 0.99},
        {"id": "phone_3", "rssi": -72.4, "ax": 0.02, "ay": 0.03, "az": 0.99, "mag": 0.99},
        {"id": "phone_4", "rssi": -75.1, "ax": 0.02, "ay": 0.03, "az": 0.99, "mag": 0.99},
    ]

    for anchor in anchors:
        payload = {
            "gateway_id": anchor["id"],
            "forklift_id": "forklift_1",
            "rssi": anchor["rssi"],
            "ax": anchor["ax"],
            "ay": anchor["ay"],
            "az": anchor["az"],
            "magnitude": anchor["mag"],
            "battery": 95,
            "timestamp": time.time(),
        }
        res = client.post("/api/telemetry/gateway", json=payload)
        assert res.status_code == 200, f"Expected 200 from gateway endpoint, got {res.status_code}"
        data = res.get_json()
        assert data.get("status") == "recorded"

    # Verify signal buffer contents in RAM
    latest_rssi = signal_buffer.get_active_gateway_signals()
    assert len(latest_rssi) == 4, f"Expected 4 active anchors in signal buffer, found {len(latest_rssi)}"
    print(f"  -> Captured RSSI from 4 anchors: {latest_rssi}")

    latest_imu = signal_buffer.get_latest_imu(max_age=2.0)
    assert latest_imu is not None, "Expected IMU acceleration recorded in signal buffer"
    ax_val, ay_val, az_val, mag_val = latest_imu
    print(f"  -> Latest IMU acceleration vector: ax={ax_val:.2f}g, ay={ay_val:.2f}g, az={az_val:.2f}g, |a|={mag_val:.2f}g")
    print("  [PASS] Android Gateway telemetry ingested into memory buffer without lag.")
    tests_passed += 1


    # -------------------------------------------------------------------------
    # TEST 2: High-G Collision Spike (Arduino Nano 33 IoT IMU Alert)
    # -------------------------------------------------------------------------
    print("\n[TEST 2] Testing Collision & Shock Detection (> 5.0g)...")
    shock_payload = {
        "gateway_id": "phone_1",
        "forklift_id": "forklift_1",
        "rssi": -61.0,
        "ax": 3.65,
        "ay": 4.10,
        "az": 2.80,
        "magnitude": 6.18,
        "battery": 94,
        "timestamp": time.time(),
    }
    res = client.post("/api/telemetry/gateway", json=shock_payload)
    assert res.status_code == 200

    # Query database for generated safety alert
    with db.connection_context():
        alert = SafetyAlert.select().where(
            (SafetyAlert.source == "forklift_1") &
            (SafetyAlert.alert_type == "impact_collision")
        ).order_by(SafetyAlert.id.desc()).first()

        assert alert is not None, "Expected impact_collision alert recorded in database"
        print(f"  -> Triggered Alert: {alert.message}")
        print(f"  -> Severity: {alert.severity} | Source: {alert.source}")
    print("  [PASS] Critical shock detected and persisted to safety audit log.")
    tests_passed += 1

    # -------------------------------------------------------------------------
    # TEST 3: Raspberry Pi DHT11 Normal Environmental Telemetry
    # -------------------------------------------------------------------------
    print("\n[TEST 3] Testing Raspberry Pi DHT11 Telemetry Ingestion...")
    dht_payload = {
        "sensor_id": "rpi_warehouse_main",
        "temperature": 23.4,
        "humidity": 52.8,
    }
    res = client.post("/api/telemetry/dht", json=dht_payload)
    assert res.status_code == 200
    res_data = res.get_json()
    assert res_data.get("status") == "recorded"
    assert res_data["reading"]["temperature"] == 23.4
    assert res_data["reading"]["humidity"] == 52.8

    # Verify DB persistence
    with db.connection_context():
        reading = SensorReading.select().where(
            SensorReading.sensor_id == "rpi_warehouse_main"
        ).order_by(SensorReading.id.desc()).first()
        assert reading is not None
        print(f"  -> Persisted Sensor Record: ID={reading.id}, Temp={reading.temperature_celsius}°C, Humidity={reading.humidity_percent}%")
    print("  [PASS] Ambient climate reading successfully stored in database.")
    tests_passed += 1

    # -------------------------------------------------------------------------
    # TEST 4: Raspberry Pi DHT11 Environmental Threshold Violation
    # -------------------------------------------------------------------------
    print("\n[TEST 4] Testing Temperature Excursion Alert (> 35.0°C)...")
    hot_payload = {
        "sensor_id": "rpi_warehouse_main",
        "temperature": 37.5,
        "humidity": 78.0,
    }
    res = client.post("/api/telemetry/dht", json=hot_payload)
    assert res.status_code == 200

    with db.connection_context():
        temp_alert = SafetyAlert.select().where(
            (SafetyAlert.source == "rpi_warehouse_main") &
            (SafetyAlert.alert_type == "temperature_alarm")
        ).order_by(SafetyAlert.id.desc()).first()
        assert temp_alert is not None, "Expected temperature_alarm alert generated"
        print(f"  -> Climate Alarm: {temp_alert.message} (Severity: {temp_alert.severity})")
    print("  [PASS] Environmental threshold excursion triggered warning alarm.")
    tests_passed += 1


    # -------------------------------------------------------------------------
    # TEST 5: Edge Case & Malformed Telemetry Handling
    # -------------------------------------------------------------------------
    print("\n[TEST 5] Testing Bad Request & Error Resilience...")
    # Missing gateway_id
    res1 = client.post("/api/telemetry/gateway", json={"rssi": -70})
    assert res1.status_code == 400

    # Non-numeric RSSI
    res2 = client.post("/api/telemetry/gateway", json={"gateway_id": "phone_1", "rssi": "not_a_number"})
    assert res2.status_code == 400

    # Missing temperature in DHT
    res3 = client.post("/api/telemetry/dht", json={"sensor_id": "rpi_1", "temperature": None, "humidity": 50})
    assert res3.status_code == 400

    print("  -> Checked 3 malformed requests; all rejected with clean 400 status codes.")
    print("  [PASS] Edge ingestion endpoints resist malformed or partial payloads.")
    tests_passed += 1

    print("\n" + "=" * 70)
    print(f"  ALL {tests_passed}/{total_tests} PHASE 0 TELEMETRY TESTS PASSED SUCCESSFULLY!")
    print("=" * 70 + "\n")



if __name__ == "__main__":
    run_phase0_tests()
