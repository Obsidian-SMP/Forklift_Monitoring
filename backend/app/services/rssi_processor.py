"""
Enhanced RSSI Processing with Multi-Stage Filtering
Handles signal noise, outliers, and smoothing for accurate distance estimation
"""

import numpy as np
from collections import defaultdict, deque
from datetime import datetime, timedelta
import statistics


class RSSIProcessor:
    """
    Multi-stage RSSI filtering pipeline:
    1. Outlier removal (Median Absolute Deviation)
    2. Median filter (5-tap)
    3. Exponential moving average (EMA)
    """
    
    def __init__(self, buffer_size=10, smoothing_alpha=0.1):
        """
        Initialize RSSI processor
        
        Args:
            buffer_size: Number of samples to keep per gateway
            smoothing_alpha: EMA smoothing factor (0.0 = max smooth, 1.0 = no smooth)
        """
        self.buffer_size = buffer_size
        self.alpha = smoothing_alpha
        
        # Storage: {gateway_id: [(timestamp, rssi), ...]}
        self.rssi_buffers = defaultdict(lambda: deque(maxlen=buffer_size))
        
        # Per-gateway statistics
        self.gateway_stats = defaultdict(dict)
    
    def add_sample(self, gateway_id, rssi, timestamp=None):
        """
        Add new RSSI sample to buffer
        
        Args:
            gateway_id: Gateway identifier
            rssi: RSSI value in dBm (negative number)
            timestamp: Sample timestamp (defaults to now)
        """
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        self.rssi_buffers[gateway_id].append((timestamp, rssi))
    
    def get_filtered_rssi(self, gateway_id, max_age_seconds=10):
        """
        Get filtered RSSI value for a gateway
        
        Args:
            gateway_id: Gateway identifier
            max_age_seconds: Maximum age of samples to consider
        
        Returns:
            Filtered RSSI value or None if insufficient data
        """
        if gateway_id not in self.rssi_buffers:
            return None
        
        # Get recent samples
        cutoff_time = datetime.utcnow() - timedelta(seconds=max_age_seconds)
        recent_samples = [
            rssi for timestamp, rssi in self.rssi_buffers[gateway_id]
            if timestamp >= cutoff_time
        ]
        
        if len(recent_samples) < 3:
            return None
        
        # Stage 1: Outlier removal using MAD (Median Absolute Deviation)
        filtered = self._remove_outliers_mad(recent_samples)
        
        if len(filtered) < 3:
            # If too many outliers removed, use original samples
            filtered = recent_samples
        
        # Stage 2: Median filter (reduces spikes)
        if len(filtered) >= 5:
            median_filtered = self._median_filter(filtered, window=5)
        else:
            median_filtered = filtered
        
        # Stage 3: Exponential moving average
        smoothed = self._exponential_smooth(median_filtered)
        
        # Update statistics
        self.gateway_stats[gateway_id] = {
            'raw_mean': np.mean(recent_samples),
            'raw_std': np.std(recent_samples),
            'filtered_value': smoothed,
            'sample_count': len(recent_samples),
            'outliers_removed': len(recent_samples) - len(filtered)
        }
        
        return smoothed
    
    def _remove_outliers_mad(self, samples, threshold=2.5):
        """
        Remove outliers using Median Absolute Deviation
        
        Args:
            samples: List of RSSI values
            threshold: MAD threshold (2.5 = moderate, 3.0 = conservative)
        
        Returns:
            List of samples with outliers removed
        """
        if len(samples) < 3:
            return samples
        
        median = np.median(samples)
        mad = np.median(np.abs(samples - median))
        
        if mad == 0:
            return samples  # All values identical
        
        # Keep samples within threshold * MAD from median
        filtered = [
            s for s in samples
            if abs(s - median) <= threshold * mad
        ]
        
        return filtered if len(filtered) >= 2 else samples
    
    def _median_filter(self, samples, window=5):
        """
        Apply median filter to reduce spikes
        
        Args:
            samples: List of RSSI values
            window: Window size (odd number)
        
        Returns:
            Filtered samples
        """
        if len(samples) < window:
            return samples
        
        filtered = []
        half_window = window // 2
        
        for i in range(len(samples)):
            start = max(0, i - half_window)
            end = min(len(samples), i + half_window + 1)
            window_samples = samples[start:end]
            filtered.append(np.median(window_samples))
        
        return filtered
    
    def _exponential_smooth(self, samples):
        """
        Apply exponential moving average
        
        Args:
            samples: List of RSSI values
        
        Returns:
            Smoothed value (float)
        """
        if len(samples) == 0:
            return None
        
        smoothed = samples[0]
        for sample in samples[1:]:
            smoothed = self.alpha * sample + (1 - self.alpha) * smoothed
        
        return smoothed
    
    def get_gateway_stats(self, gateway_id):
        """Get statistics for a gateway"""
        return self.gateway_stats.get(gateway_id, {})
    
    def get_all_filtered_rssi(self, max_age_seconds=10):
        """
        Get filtered RSSI for all gateways
        
        Returns:
            Dictionary {gateway_id: filtered_rssi}
        """
        result = {}
        for gateway_id in self.rssi_buffers.keys():
            filtered = self.get_filtered_rssi(gateway_id, max_age_seconds)
            if filtered is not None:
                result[gateway_id] = filtered
        
        return result
    
    def cleanup_old_samples(self, max_age_seconds=60):
        """Remove very old samples to prevent memory bloat"""
        cutoff_time = datetime.utcnow() - timedelta(seconds=max_age_seconds)
        
        for gateway_id in list(self.rssi_buffers.keys()):
            # Remove old entries
            buffer = self.rssi_buffers[gateway_id]
            while buffer and buffer[0][0] < cutoff_time:
                buffer.popleft()
            
            # Remove empty buffers
            if len(buffer) == 0:
                del self.rssi_buffers[gateway_id]
