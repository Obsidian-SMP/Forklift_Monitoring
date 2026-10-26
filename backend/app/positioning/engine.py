# ==============================================================================
# File: app/positioning/engine.py
# Description: Central Positioning Coordinator & Kinematics Engine.
# Purpose: Orchestrates SignalRingBuffer, Unified Incenter Trilateration, and
#          IMU-fused Extended Kalman Filtering. Broadcasts smooth coordinates
#          to frontend over WebSockets at 5 Hz and throttles DB writes to 1 Hz.
# ==============================================================================

import time
import math
import threading
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional, Tuple, Any

from app.core.config import Config
from app.core.logger import log_event
from app.positioning.signal_buffer import signal_buffer
from app.positioning.trilateration import UnifiedTrilaterationSolver
from app.positioning.ekf import FusedExtendedKalmanFilter
from app.safety.geofence import geofence_evaluator
from app.models.gateway import GatewayNode
from app.models.forklift import Forklift, ForkliftTrack

IST = timezone(timedelta(hours=5, minutes=30))


class PositioningEngine:
    """
    Background positioning daemon running at 5 Hz (every 200ms).
    """

    def __init__(self, interval_seconds: float = None):
        self.interval = (
            interval_seconds
            if interval_seconds is not None
            else Config.POSITIONING_INTERVAL_SECONDS
        )
        self.ekf = FusedExtendedKalmanFilter(dt=self.interval)
        self.solver = UnifiedTrilaterationSolver()

        self.running = False
        self.thread: Optional[threading.Thread] = None
        self.lock = threading.Lock()

        # Cache of gateway coordinates from DB: { gateway_id: { x, y, z, tx_power, path_loss_n } }
        self._gateway_cache: Dict[str, Dict[str, Any]] = {}
        self._last_gateway_cache_update = 0.0

        # Latest published state
        self._current_state: Dict[str, Any] = {
            "forklift_id": "forklift_1",
            "x": 0.0,
            "y": 0.0,
            "vx": 0.0,
            "vy": 0.0,
            "speed_mps": 0.0,
            "confidence": 0.0,
            "accuracy_meters": 0.0,
            "gateway_count": 0,
            "timestamp": None,
        }

        self._last_db_track_time = 0.0
        self.socketio_instance: Any = None

    def set_socketio(self, socketio):
        """Attaches WebSocket instance for broadcasting real-time position."""
        self.socketio_instance = socketio

    def start(self):
        """Starts background calculation loop."""
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        log_event("INFO", "POSITIONING", f"Positioning Engine started at {1.0/self.interval:.1f} Hz")

    def stop(self):
        """Stops background loop."""
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.5)
        log_event("INFO", "POSITIONING", "Positioning Engine stopped")

    def get_current_position(self, forklift_id: Optional[str] = None) -> Dict[str, Any]:
        """Thread-safe getter for current estimated coordinates."""
        with self.lock:
            state = self._current_state.copy()
            state["is_moving"] = state.get("speed_mps", 0.0) > 0.05
            state["last_updated"] = state.get("timestamp")
            state["status"] = self._current_state.get("status", "idle")
            state["loaded_sku"] = self._current_state.get("loaded_sku")
            return state

    def set_forklift_status(self, forklift_id: str, status: str, loaded_sku: str = None):
        """Updates operational status in memory."""
        with self.lock:
            self._current_state["status"] = status
            self._current_state["loaded_sku"] = loaded_sku

    def _refresh_gateway_cache_if_needed(self):
        """Refreshes gateway coordinates from database every 10 seconds."""
        now = time.time()
        if now - self._last_gateway_cache_update < 10.0:
            return

        try:
            nodes = GatewayNode.select().where(GatewayNode.is_active == True)
            new_cache = {}
            for node in nodes:
                new_cache[node.gateway_id] = {
                    "x": node.location_x,
                    "y": node.location_y,
                    "z": node.location_z,
                    "tx_power": node.calibrated_tx_power,
                    "path_loss_n": node.calibrated_path_loss_n,
                }
            self._gateway_cache = new_cache
            self._last_gateway_cache_update = now
        except Exception as exc:
            log_event("WARNING", "POSITIONING", f"Gateway cache refresh failed: {exc}")

    def _run_loop(self):
        """Core positioning loop ticking at 5 Hz."""
        while self.running:
            loop_start = time.time()
            try:
                self._refresh_gateway_cache_if_needed()
                self._compute_step()
            except Exception as exc:
                log_event("ERROR", "POSITIONING", f"Position calculation error: {exc}")

            elapsed = time.time() - loop_start
            sleep_time = max(0.01, self.interval - elapsed)
            time.sleep(sleep_time)

    def _compute_step(self):
        # 1. Fetch filtered RSSI from signal buffer
        active_signals = signal_buffer.get_active_gateway_signals()
        
        # 2. Check for IMU acceleration (Zero-Velocity Detection & Control Input)
        imu_data = signal_buffer.get_latest_imu(max_age=1.0)
        accel_control = None

        if imu_data is not None:
            ax, ay, az, mag = imu_data
            # Convert g to m/s^2 (assuming horizontal plane ax, ay)
            accel_mps2_x = ax * 9.80665
            accel_mps2_y = ay * 9.80665
            accel_control = (accel_mps2_x, accel_mps2_y)

            # ZUPT check: if total horizontal acceleration is negligible (< 0.15 m/s^2), force stationary
            if math.hypot(accel_mps2_x, accel_mps2_y) < 0.15:
                self.ekf.apply_zupt()

        # 3. Match active signals with known gateway coordinates
        gateways_data = []
        for gw_id, rssi in active_signals.items():
            if gw_id in self._gateway_cache:
                info = self._gateway_cache[gw_id]
                gateways_data.append(
                    {
                        "gateway_id": gw_id,
                        "x": info["x"],
                        "y": info["y"],
                        "rssi": rssi,
                        "tx_power": info.get("tx_power"),
                        "path_loss_n": info.get("path_loss_n"),
                    }
                )

        # 4. EKF Prediction Phase
        self.ekf.predict(dt=self.interval, accel_mps2=accel_control)

        # 5. Trilateration & Measurement Update (if >= 2 gateways available)
        accuracy = 3.0
        gw_count = len(gateways_data)

        if gw_count >= 2:
            trilat_res = self.solver.solve(gateways_data)
            if trilat_res is not None:
                tx, ty, accuracy = trilat_res
                # Update EKF with trilateration measurement
                self.ekf.update(tx, ty, accuracy_meters=accuracy)

        # 6. Extract smooth kinematic state
        state = self.ekf.get_state()
        now_dt = datetime.now(IST)

        result_payload = {
            "forklift_id": "forklift_1",
            "x": round(state["x"], 2),
            "y": round(state["y"], 2),
            "vx": round(state["vx"], 2),
            "vy": round(state["vy"], 2),
            "speed_mps": round(state["speed_mps"], 2),
            "confidence": round(state["confidence"], 1),
            "accuracy_meters": round(accuracy, 2),
            "gateway_count": gw_count,
            "timestamp": now_dt.isoformat(),
        }

        with self.lock:
            self._current_state = result_payload

        # 7. Broadcast smooth position over WebSockets
        if self.socketio_instance is not None:
            self.socketio_instance.emit("forklift_position", result_payload, namespace="/")

        # 7b. Real-Time Geofence Containment & Speed Limit Evaluation
        geofence_evaluator.evaluate_forklift(
            forklift_id="forklift_1",
            x=state["x"],
            y=state["y"],
            speed=state["speed_mps"],
            socketio=self.socketio_instance,
        )

        # 8. Throttled Database Trail Update (1 Hz to prevent SQLite locks)
        now_epoch = time.time()
        if now_epoch - self._last_db_track_time >= 1.0 and state["confidence"] > 20.0:
            self._last_db_track_time = now_epoch
            try:
                # Update main forklift state
                fk, _ = Forklift.get_or_create(forklift_id="forklift_1")
                fk.current_x = state["x"]
                fk.current_y = state["y"]
                fk.velocity_x = state["vx"]
                fk.velocity_y = state["vy"]
                fk.speed_mps = state["speed_mps"]
                fk.position_confidence = state["confidence"]
                fk.last_seen = now_dt
                fk.save()

                # Add breadcrumb trail
                ForkliftTrack.create(
                    forklift=fk,
                    x=state["x"],
                    y=state["y"],
                    speed_mps=state["speed_mps"],
                    confidence=state["confidence"],
                    timestamp=now_dt,
                )
            except Exception as exc:
                log_event("WARNING", "POSITIONING", f"Failed to persist track point: {exc}")


# Global positioning engine instance
positioning_engine = PositioningEngine()
