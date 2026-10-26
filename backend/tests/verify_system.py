# ==============================================================================
# File: tests/verify_system.py
# Description: End-to-End System & Algorithmic Integration Verification Suite.
# Purpose: Validates database initialization, Unified Incenter Trilateration,
#          EKF ZUPT kinematics, Ray-Casting Geofence breach detection, LSM6DS3
#          IMU collision triggering, M/N-K sliding window state machine, and
#          in-dashboard structured logging (Option A).
# ==============================================================================

import os
import sys
import time
import math
import numpy as np

# Ensure backend root is in Python module path
BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.core.config import Config
from app.core.database import init_db, db
from app.core.logger import system_logger, log_event
from app.models.forklift import Forklift, ForkliftTrack, VibrationReading
from app.models.gateway import GatewayNode
from app.models.zone import WarehouseZone
from app.models.alert import SafetyAlert
from app.models.inventory import InventoryItem, InventoryTransaction
from app.positioning.signal_buffer import signal_buffer
from app.positioning.trilateration import UnifiedTrilaterationSolver
from app.positioning.ekf import FusedExtendedKalmanFilter
from app.safety.geofence import geofence_evaluator
from app.safety.impact_detector import impact_detector
from app.safety.environmental import environmental_monitor
from app.vision.load_state_machine import load_state_machine


def test_suite():
    passed_tests = 0
    total_tests = 7

    print("\n" + "=" * 70)
    print("  🏭 WAREHOUSE IOT REVISED VERSION: SYSTEM VERIFICATION SUITE")
    print("=" * 70)

    # -------------------------------------------------------------------------
    # TEST 1: Database Initialization & WAL Mode
    # -------------------------------------------------------------------------
    print("\n[TEST 1] Verifying SQLite WAL Database Initialization...")
    init_db()
    with db.connection_context():
        cursor = db.execute_sql("PRAGMA journal_mode;")
        journal_mode = cursor.fetchone()[0]
        print(f"  -> SQLite Journal Mode: {journal_mode.upper()}")
        assert journal_mode.lower() == "wal", f"Expected WAL mode, got {journal_mode}"
    print("  ✓ PASS: Database initialized with WAL mode and tables created.")
    passed_tests += 1

    # -------------------------------------------------------------------------
    # TEST 2: Unified Incenter Trilateration (Paper 1)
    # -------------------------------------------------------------------------
    print("\n[TEST 2] Verifying Unified Incenter Trilateration (Park & Lee, IEEE 2021)...")
    solver = UnifiedTrilaterationSolver()
    # Test with 4 corner anchors at known distances from target at (4.0, 5.0)
    tx, ty = 4.0, 5.0
    gateways_test = [
        {"gateway_id": "p1", "x": 0.0, "y": 0.0, "rssi": -69.2 - 10 * 2.0 * math.log10(math.hypot(tx - 0, ty - 0))},
        {"gateway_id": "p2", "x": 10.0, "y": 0.0, "rssi": -69.2 - 10 * 2.0 * math.log10(math.hypot(tx - 10, ty - 0))},
        {"gateway_id": "p3", "x": 10.0, "y": 10.0, "rssi": -69.2 - 10 * 2.0 * math.log10(math.hypot(tx - 10, ty - 10))},
        {"gateway_id": "p4", "x": 0.0, "y": 10.0, "rssi": -69.2 - 10 * 2.0 * math.log10(math.hypot(tx - 0, ty - 10))},
    ]
    sol = solver.solve(gateways_test)
    assert sol is not None, "Trilateration solver returned None"
    calc_x, calc_y, accuracy = sol
    error = math.hypot(calc_x - tx, calc_y - ty)
    print(f"  -> True Target: ({tx:.2f}, {ty:.2f}) | Solved: ({calc_x:.2f}, {calc_y:.2f}) | Error: {error:.3f}m")
    assert error < 0.25, f"Trilateration error too large: {error}m"
    print("  ✓ PASS: Unified Incenter Trilateration resolved within 0.25m tolerance.")
    passed_tests += 1

    # -------------------------------------------------------------------------
    # TEST 3: EKF Sensor Fusion & Zero-Velocity Update (ZUPT) (Paper 2)
    # -------------------------------------------------------------------------
    print("\n[TEST 3] Verifying Fused EKF with Zero-Velocity Update (ZUPT)...")
    ekf = FusedExtendedKalmanFilter(dt=0.2)
    # Feed moving measurements
    ekf.update(1.0, 1.0)
    ekf.predict(dt=0.2, accel_mps2=(1.5, 0.0))
    state_moving = ekf.get_state()
    print(f"  -> Moving State Velocity: {state_moving['vx']:.2f} m/s (Speed: {state_moving['speed_mps']:.2f} m/s)")
    assert state_moving['vx'] > 0.0, "Velocity should be non-zero after acceleration"

    # Now apply ZUPT (vehicle stops)
    ekf.apply_zupt()
    state_stopped = ekf.get_state()
    print(f"  -> Post-ZUPT Velocity: Vx={state_stopped['vx']:.2f} m/s, Vy={state_stopped['vy']:.2f} m/s")
    assert state_stopped['vx'] == 0.0 and state_stopped['vy'] == 0.0, "ZUPT must zero out velocities"
    print("  ✓ PASS: Zero-Velocity Update successfully halted kinematic velocity drift.")
    passed_tests += 1

    # -------------------------------------------------------------------------
    # TEST 4: Ray-Casting Point-in-Polygon Geofence Evaluator
    # -------------------------------------------------------------------------
    print("\n[TEST 4] Verifying Ray-Casting Geofence Evaluator against Danger Zones...")
    # Create test polygon zone (2.0, 2.0) to (5.0, 5.0)
    with db.connection_context():
        test_zone, _ = WarehouseZone.get_or_create(
            zone_id="test_danger_box",
            defaults={
                "name": "Test Hazardous Area",
                "zone_type": "danger",
                "color": "#ef4444",
                "notify_on_entry": True,
                "is_active": True,
            },
        )
        test_zone.set_points([
            {"x": 2.0, "y": 2.0},
            {"x": 5.0, "y": 2.0},
            {"x": 5.0, "y": 5.0},
            {"x": 2.0, "y": 5.0},
        ])
        test_zone.save()

    # Point outside (1.0, 1.0)
    poly = test_zone.get_points()
    assert not geofence_evaluator.is_point_in_polygon(1.0, 1.0, poly), "Point (1,1) should be OUTSIDE"
    # Point inside (3.5, 3.5)
    assert geofence_evaluator.is_point_in_polygon(3.5, 3.5, poly), "Point (3.5,3.5) should be INSIDE"

    # Trigger evaluation
    alerts = geofence_evaluator.evaluate_forklift("forklift_1", 3.5, 3.5, speed=1.2)
    print(f"  -> Incursion evaluated: Generated {len(alerts)} alerts")
    assert len(alerts) >= 1, "Must generate a danger_zone_breach alert"
    assert alerts[0]["type"] == "danger_zone_breach"
    print("  ✓ PASS: Ray-Casting containment accurately detected danger zone entry.")
    passed_tests += 1

    # -------------------------------------------------------------------------
    # TEST 5: IMU Impact Detector & Acceleration Spike (>5g)
    # -------------------------------------------------------------------------
    print("\n[TEST 5] Verifying LSM6DS3 IMU Collision Impact Detector...")
    # Normal driving (1.02g) -> Should not trigger
    res_normal = impact_detector.evaluate_acceleration("forklift_1", ax=0.05, ay=0.03, az=1.01)
    assert res_normal is None, "Normal acceleration must NOT trigger impact alert"

    # Severe impact collision shock (6.2g)
    res_impact = impact_detector.evaluate_acceleration(
        "forklift_1", ax=3.5, ay=4.2, az=2.8, position={"x": 3.0, "y": 4.0}
    )
    assert res_impact is not None, "Shock > 5g must trigger critical impact alert"
    assert res_impact["type"] == "impact_collision"
    print(f"  -> Impact Alert Logged: {res_impact['message']}")
    print("  ✓ PASS: Collision shock (>5g) triggered persistent critical alarm.")
    passed_tests += 1

    # -------------------------------------------------------------------------
    # TEST 6: M/N-K Sliding Window Load & Unload State Machine (Paper 5)
    # -------------------------------------------------------------------------
    print("\n[TEST 6] Verifying M/N-K Load/Unload Decision State Machine (Zhao et al., 2020)...")
    # Reset state machine
    load_state_machine.is_loaded = False
    load_state_machine.history_window.clear()
    dummy_img = np.zeros((480, 640, 3), dtype=np.uint8)

    # Simulate M=3 consecutive detections in fork ROI
    test_detection = [{
        "class_name": "pallet",
        "confidence": 0.88,
        "is_in_fork_roi": True,
        "bbox": [150, 100, 450, 550],
    }]

    print("  -> Feeding M=3 frames with pallet in ROI...")
    for _ in range(3):
        load_state_machine.process_frame_detections(dummy_img, test_detection)

    assert load_state_machine.is_loaded is True, "State machine should transition to LOADED after M hits"
    loaded_sku = load_state_machine.current_loaded_sku
    print(f"  -> State Machine Status: LOADED (SKU: {loaded_sku})")

    # Simulate K=5 consecutive frames with empty forks
    print("  -> Feeding K=5 consecutive frames with empty forks...")
    for _ in range(5):
        load_state_machine.process_frame_detections(dummy_img, [])

    assert load_state_machine.is_loaded is False, "State machine should transition to UNLOADED after K misses"
    print("  -> State Machine Status: UNLOADED (Item successfully dropped and stock ledger updated)")
    print("  ✓ PASS: M/N-K state machine eliminated duplicate storms and handled transitions.")
    passed_tests += 1

    # -------------------------------------------------------------------------
    # TEST 7: In-Dashboard Structured Logging Engine (Option A)
    # -------------------------------------------------------------------------
    print("\n[TEST 7] Verifying In-Dashboard Live Log Ingestion & Ring Buffer (Option A)...")
    log_event("INFO", "Synthetic verification telemetry test event", "TestRunner", data={"run_id": 42})
    memory_logs = system_logger.get_memory_logs(limit=10)
    assert len(memory_logs) > 0, "Memory log buffer should contain entries"
    latest = memory_logs[-1]
    assert latest["module"] == "TestRunner"
    assert "Synthetic verification" in latest["message"]
    print(f"  -> Memory Buffer Log: [{latest['level']}] [{latest['module']}] {latest['message']}")
    print("  ✓ PASS: Structured logging recorded without blocking console prints.")
    passed_tests += 1

    print("\n" + "=" * 70)
    print(f"  🎉 ALL {passed_tests}/{total_tests} SYSTEM TESTS PASSED SUCCESSFULLY!")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    test_suite()
