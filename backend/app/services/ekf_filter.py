"""
Extended Kalman Filter for Position and Velocity Tracking
Smooths noisy trilateration measurements and estimates velocity
"""

import numpy as np
from datetime import datetime
from typing import Dict, Optional


class ExtendedKalmanFilter:
    """
    EKF for forklift tracking with position and velocity state
    State vector: [px, py, vx, vy]
    - px, py: Position (meters)
    - vx, vy: Velocity (m/s)
    """
    
    def __init__(self, dt=0.5, process_noise=0.5, measurement_noise=4.0):
        """
        Initialize Extended Kalman Filter
        
        Args:
            dt: Time step in seconds (default: 0.5s = 2 Hz)
            process_noise: Process noise level (forklift acceleration uncertainty)
            measurement_noise: Measurement noise (RSSI trilateration error ~2m std dev)
        """
        self.dt = dt
        
        # State vector: [px, py, vx, vy]
        self.x = np.zeros(4)
        
        # State covariance matrix (uncertainty)
        self.P = np.eye(4) * 10.0  # High initial uncertainty
        
        # Process noise covariance (Q)
        # Models uncertainty in forklift motion (acceleration, turns)
        q_pos = process_noise * 0.1  # Position noise
        q_vel = process_noise * 1.0  # Velocity noise (higher)
        
        self.Q = np.diag([q_pos, q_pos, q_vel, q_vel])
        
        # Measurement noise covariance (R)
        # Models RSSI trilateration error (~2m standard deviation)
        self.R = np.eye(2) * measurement_noise
        
        # Timestamp tracking
        self.last_update_time = None
        self.last_prediction_time = None
        
        # State flags
        self.initialized = False
        self.prediction_count = 0
        self.update_count = 0
    
    def predict(self, dt=None):
        """
        Prediction step: Estimate next state based on constant velocity model
        
        Args:
            dt: Time step (uses self.dt if not provided)
        """
        if dt is None:
            dt = self.dt
        
        # State transition matrix (constant velocity model)
        # x(k+1) = F * x(k)
        # Position: p_new = p_old + v * dt
        # Velocity: v_new = v_old (constant velocity assumption)
        F = np.array([
            [1, 0, dt, 0],   # px = px + vx*dt
            [0, 1, 0, dt],   # py = py + vy*dt
            [0, 0, 1, 0],    # vx = vx (constant)
            [0, 0, 0, 1]     # vy = vy (constant)
        ])
        
        # Predict state
        self.x = F @ self.x
        
        # Predict covariance: P = F*P*F^T + Q
        self.P = F @ self.P @ F.T + self.Q
        
        self.prediction_count += 1
        self.last_prediction_time = datetime.utcnow()
    
    def update(self, measured_x: float, measured_y: float, measurement_accuracy: float = 2.0):
        """
        Update step: Correct prediction with new measurement
        
        Args:
            measured_x: Measured X position from trilateration
            measured_y: Measured Y position from trilateration
            measurement_accuracy: Estimated accuracy of measurement (meters)
        """
        if not self.initialized:
            # First measurement: initialize state
            self.x[0] = measured_x
            self.x[1] = measured_y
            self.x[2] = 0.0  # Unknown velocity initially
            self.x[3] = 0.0
            self.initialized = True
            self.last_update_time = datetime.utcnow()
            self.update_count += 1
            return self.x
        
        # Measurement matrix (we only measure position, not velocity)
        # z = H * x
        H = np.array([
            [1, 0, 0, 0],  # Measure px
            [0, 1, 0, 0]   # Measure py
        ])
        
        # Adaptive measurement noise based on trilateration accuracy
        # Better accuracy = lower noise = trust measurement more
        R_adaptive = self.R * (measurement_accuracy / 2.0)
        
        # Innovation (measurement residual): y = z - H*x
        z = np.array([measured_x, measured_y])
        y = z - H @ self.x
        
        # Innovation covariance: S = H*P*H^T + R
        S = H @ self.P @ H.T + R_adaptive
        
        # Kalman gain: K = P*H^T*S^-1
        try:
            K = self.P @ H.T @ np.linalg.inv(S)
        except np.linalg.LinAlgError:
            # Singular matrix, skip update
            self.update_count += 1
            self.last_update_time = datetime.utcnow()
            return self.x
        
        # Update state: x = x + K*y
        self.x = self.x + K @ y
        
        # Update covariance: P = (I - K*H)*P
        I = np.eye(4)
        self.P = (I - K @ H) @ self.P
        
        self.update_count += 1
        self.last_update_time = datetime.utcnow()
        
        return self.x
    
    def get_state(self) -> Dict:
        """
        Get current state as dictionary
        
        Returns:
            Dictionary with position, velocity, speed, confidence
        """
        if not self.initialized:
            return None
        
        # Calculate speed magnitude
        speed = float(np.sqrt(self.x[2]**2 + self.x[3]**2))
        
        # Calculate position uncertainty (diagonal elements of P)
        pos_uncertainty = float(np.sqrt(self.P[0, 0] + self.P[1, 1]))
        
        # Calculate velocity uncertainty
        vel_uncertainty = float(np.sqrt(self.P[2, 2] + self.P[3, 3]))
        
        return {
            'px': float(self.x[0]),
            'py': float(self.x[1]),
            'vx': float(self.x[2]),
            'vy': float(self.x[3]),
            'speed': speed,
            'position_uncertainty': pos_uncertainty,
            'velocity_uncertainty': vel_uncertainty,
            'prediction_count': self.prediction_count,
            'update_count': self.update_count
        }
    
    def get_position(self) -> tuple:
        """Get current position (x, y)"""
        if not self.initialized:
            return None
        return (float(self.x[0]), float(self.x[1]))
    
    def get_velocity(self) -> tuple:
        """Get current velocity (vx, vy)"""
        if not self.initialized:
            return (0.0, 0.0)
        return (float(self.x[2]), float(self.x[3]))
    
    def reset(self):
        """Reset filter to uninitialized state"""
        self.x = np.zeros(4)
        self.P = np.eye(4) * 10.0
        self.initialized = False
        self.prediction_count = 0
        self.update_count = 0
        self.last_update_time = None
        self.last_prediction_time = None
    
    def is_initialized(self) -> bool:
        """Check if filter has been initialized with at least one measurement"""
        return self.initialized
    
    def get_confidence(self) -> float:
        """
        Get position confidence as percentage (0-100)
        Based on position uncertainty
        """
        if not self.initialized:
            return 0.0
        
        # Position uncertainty in meters
        uncertainty = float(np.sqrt(self.P[0, 0] + self.P[1, 1]))
        
        # Convert to confidence (0-100%)
        # 0m uncertainty = 100% confidence
        # 5m uncertainty = 0% confidence
        confidence = max(0.0, min(100.0, 100.0 * (1.0 - uncertainty / 5.0)))
        
        return confidence
