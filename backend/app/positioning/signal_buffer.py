# ==============================================================================
# File: app/positioning/signal_buffer.py
# Description: Thread-Safe In-Memory Signal Ring Buffer for BLE RSSI & IMU Data.
# Purpose: Replaces slow, blocking SQLite database writes with ultra-fast RAM
#          sliding buffers (<0.1ms ingestion) for mobile gateway telemetry.
# ==============================================================================

import time
import threading
import numpy as np
from collections import defaultdict, deque
from typing import Dict, List, Optional, Tuple

from app.core.config import Config


class SignalRingBuffer:
    """
    High-speed, thread-safe memory buffer managing incoming RSSI and IMU data
    from distributed Android gateway phones.
    """

    def __init__(self, capacity: int = 20, max_age_seconds: float = None):
        self.capacity = capacity
        self.max_age_seconds = (
            max_age_seconds if max_age_seconds is not None else Config.RSSI_MAX_AGE_SECONDS
        )
        self.lock = threading.Lock()

        # { gateway_id: deque([ (timestamp, rssi, accel_tuple), ... ], maxlen=capacity) }
        self._buffers: Dict[str, deque] = defaultdict(lambda: deque(maxlen=self.capacity))
        
        # Latest raw IMU reading from forklift: (timestamp, ax, ay, az, magnitude)
        self._latest_imu: Optional[Tuple[float, float, float, float, float]] = None

    def add_reading(
        self,
        gateway_id: str,
        rssi: float,
        accel: Optional[Tuple[float, float, float]] = None,
        timestamp: Optional[float] = None,
    ):
        """
        Appends a new gateway observation in RAM.
        
        Args:
            gateway_id: Gateway identifier (e.g. 'phone_1')
            rssi: Signal strength in dBm (-100 to -30)
            accel: Optional 3-axis accelerometer tuple (ax, ay, az) in g
            timestamp: Epoch timestamp in seconds (defaults to time.time())
        """
        now = timestamp or time.time()

        with self.lock:
            self._buffers[gateway_id].append((now, rssi, accel))
            if accel is not None:
                ax, ay, az = accel
                mag = float(np.sqrt(ax * ax + ay * ay + az * az))
                self._latest_imu = (now, ax, ay, az, mag)

    def get_latest_imu(
        self, max_age: float = 1.0
    ) -> Optional[Tuple[float, float, float, float]]:
        """
        Returns freshest IMU readings: (ax, ay, az, magnitude) if within max_age.
        """
        with self.lock:
            if self._latest_imu is None:
                return None
            ts, ax, ay, az, mag = self._latest_imu
            if time.time() - ts <= max_age:
                return (ax, ay, az, mag)
            return None

    def get_active_gateway_signals(self) -> Dict[str, float]:
        """
        Extracts smoothed, filtered RSSI values for all gateways with recent data.
        Applies a fast 3-point median filter to reject multipath spikes without phase lag.
        
        Returns:
            Dictionary mapping { gateway_id: filtered_rssi_dBm }
        """
        now = time.time()
        active_signals: Dict[str, float] = {}

        with self.lock:
            for gateway_id, ring in self._buffers.items():
                # Filter out stale samples older than max_age_seconds
                valid_rssis = [
                    rssi for (ts, rssi, _) in ring if (now - ts) <= self.max_age_seconds
                ]

                if not valid_rssis:
                    continue

                count = len(valid_rssis)
                if count == 1:
                    active_signals[gateway_id] = float(valid_rssis[0])
                elif count == 2:
                    active_signals[gateway_id] = float(np.mean(valid_rssis))
                else:
                    # 3+ samples: Take median of the freshest 3-5 samples
                    recent = valid_rssis[-5:]
                    active_signals[gateway_id] = float(np.median(recent))

        return active_signals

    def clear(self):
        """Clears all buffered gateway signals."""
        with self.lock:
            self._buffers.clear()
            self._latest_imu = None


# Global signal buffer instance
signal_buffer = SignalRingBuffer()
