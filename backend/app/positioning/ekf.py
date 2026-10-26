# ==============================================================================
# File: app/positioning/ekf.py
# Description: Extended Kalman Filter with IMU Sensor Fusion (Kereyev et al., 2021).
# Purpose: Fuses noisy RSSI trilateration measurements with high-precision IMU
#          acceleration from the Arduino Nano 33 IoT. Implements Zero-Velocity
#          Updates (ZUPT) to completely prevent drift when the forklift stops.
# ==============================================================================

import time
import numpy as np
from typing import Dict, Optional, Tuple

from app.core.config import Config


class FusedExtendedKalmanFilter:
    """
    Kinematic EKF estimator tracking position and velocity:
    State vector: x = [pos_x, pos_y, vel_x, vel_y]^T
    Control input: u = [accel_x, accel_y]^T (m/s^2)
    """

    def __init__(
        self,
        dt: float = 0.2,
        process_noise: float = None,
        measurement_noise: float = None,
    ):
        self.dt = dt
        self.process_noise = (
            process_noise if process_noise is not None else Config.EKF_PROCESS_NOISE
        )
        self.measurement_noise = (
            measurement_noise
            if measurement_noise is not None
            else Config.EKF_MEASUREMENT_NOISE
        )

        # State vector [x, y, vx, vy]
        self.x = np.zeros(4, dtype=float)

        # State covariance matrix P
        self.P = np.eye(4, dtype=float) * 5.0

        # State transition matrix F
        self.F = np.array(
            [
                [1.0, 0.0, self.dt, 0.0],
                [0.0, 1.0, 0.0, self.dt],
                [0.0, 0.0, 1.0, 0.0],
                [0.0, 0.0, 0.0, 1.0],
            ],
            dtype=float,
        )

        # Control input matrix B (maps acceleration to position and velocity)
        dt2 = 0.5 * (self.dt ** 2)
        self.B = np.array(
            [
                [dt2, 0.0],
                [0.0, dt2],
                [self.dt, 0.0],
                [0.0, self.dt],
            ],
            dtype=float,
        )

        # Process noise covariance Q
        q_pos = self.process_noise * 0.1
        q_vel = self.process_noise * 1.0
        self.Q = np.diag([q_pos, q_pos, q_vel, q_vel])

        # Measurement matrix H (we measure x and y)
        self.H = np.array(
            [
                [1.0, 0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0, 0.0],
            ],
            dtype=float,
        )

        # Base measurement noise covariance R
        self.R = np.eye(2, dtype=float) * self.measurement_noise

        self.initialized = False
        self.last_update_time = time.time()

    def predict(
        self,
        dt: Optional[float] = None,
        accel_mps2: Optional[Tuple[float, float]] = None,
    ):
        """
        Prediction Phase (Paper 2, Eq. 10 & 15).
        Advances state vector using constant velocity model + optional IMU acceleration.
        """
        step_dt = dt or self.dt
        if abs(step_dt - self.dt) > 1e-4:
            self.dt = step_dt
            self.F[0, 2] = step_dt
            self.F[1, 3] = step_dt
            dt2 = 0.5 * (step_dt ** 2)
            self.B = np.array(
                [[dt2, 0.0], [0.0, dt2], [step_dt, 0.0], [0.0, step_dt]]
            )

        # Apply control input if IMU acceleration is available
        if accel_mps2 is not None:
            u = np.array([accel_mps2[0], accel_mps2[1]], dtype=float)
            self.x = self.F @ self.x + self.B @ u
        else:
            self.x = self.F @ self.x

        # Covariance prediction: P = F * P * F^T + Q
        self.P = self.F @ self.P @ self.F.T + self.Q

    def update(
        self,
        measured_x: float,
        measured_y: float,
        accuracy_meters: float = 2.0,
    ):
        """
        Correction / Measurement Update Phase (Paper 2, Eq. 13-14).
        """
        if not self.initialized:
            self.x[0] = measured_x
            self.x[1] = measured_y
            self.x[2] = 0.0
            self.x[3] = 0.0
            self.P = np.eye(4) * 2.0
            self.initialized = True
            self.last_update_time = time.time()
            return

        # Adaptive measurement noise: trust higher-accuracy trilateration more
        scale = max(0.5, min(3.0, accuracy_meters / 2.0))
        R_adaptive = self.R * scale

        # Innovation residual: y = z - H * x
        z = np.array([measured_x, measured_y], dtype=float)
        y = z - self.H @ self.x

        # Innovation covariance: S = H * P * H^T + R
        S = self.H @ self.P @ self.H.T + R_adaptive

        # Kalman gain: K = P * H^T * inv(S)
        try:
            K = self.P @ self.H.T @ np.linalg.inv(S)
        except np.linalg.LinAlgError:
            return  # Skip update on singular matrix

        # Update state and covariance
        self.x = self.x + K @ y
        I = np.eye(4)
        self.P = (I - K @ self.H) @ self.P
        self.last_update_time = time.time()

    def apply_zupt(self):
        """
        Zero-Velocity Update (ZUPT).
        Forces velocity to zero when vehicle is verified stopped, killing drift.
        """
        self.x[2] = 0.0
        self.x[3] = 0.0
        self.P[2, 2] = 0.05
        self.P[3, 3] = 0.05

    def get_state(self) -> Dict:
        """Returns clean kinematic state representation."""
        if not self.initialized:
            return {
                "x": 0.0,
                "y": 0.0,
                "vx": 0.0,
                "vy": 0.0,
                "speed_mps": 0.0,
                "confidence": 0.0,
            }

        vx = float(self.x[2])
        vy = float(self.x[3])
        speed = float(np.sqrt(vx * vx + vy * vy))

        # Position uncertainty from diagonal of covariance matrix
        pos_var = float(self.P[0, 0] + self.P[1, 1])
        uncertainty = float(np.sqrt(max(0.01, pos_var)))

        # Confidence percentage (0% to 100%)
        # 0m uncertainty = 100%, >= 5m uncertainty = 10%
        confidence = max(10.0, min(100.0, 100.0 * (1.0 - (uncertainty / 5.0))))

        return {
            "x": float(self.x[0]),
            "y": float(self.x[1]),
            "vx": vx,
            "vy": vy,
            "speed_mps": speed,
            "confidence": confidence,
        }

    def reset(self):
        """Resets filter state."""
        self.x = np.zeros(4, dtype=float)
        self.P = np.eye(4, dtype=float) * 5.0
        self.initialized = False
