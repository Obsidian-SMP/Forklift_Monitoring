"""
Trilateration Service
Calculates forklift position from RSSI data received from multiple gateways
"""

import math
from datetime import datetime, timedelta
from app.models import BLERSSIData, WiFiGateway, ForkliftPositionTrilateration
from app.gateway_config import RSSI_CONFIG, TRILATERATION_CONFIG, GATEWAYS
import statistics


class TrilatationService:
    """Service for calculating forklift position from RSSI data"""
    
    # Kalman filter state storage (in-memory)
    # Structure: {forklift_id: {'x': float, 'y': float, 'vx': float, 'vy': float, 'timestamp': datetime}}
    _kalman_state = {}
    
    @staticmethod
    def rssi_to_distance(rssi_dbm):
        """
        Convert RSSI value (dBm) to distance in meters
        Using log-distance path loss model:
        distance = 10 ^ ((TX_POWER - RSSI) / (10 * N))
        
        Args:
            rssi_dbm: RSSI value in dBm (negative number)
        
        Returns:
            Distance in meters
        """
        tx_power = RSSI_CONFIG["TX_POWER"]
        n = RSSI_CONFIG["PATH_LOSS_EXPONENT"]
        
        # Avoid log of negative or zero
        if rssi_dbm >= tx_power:
            return 0.5  # Very close
        
        distance = 10 ** ((tx_power - rssi_dbm) / (10 * n))
        return max(0.1, distance)  # Minimum 0.1 meters
    
    @staticmethod
    def get_latest_rssi_per_gateway(forklift_id="forklift_001", seconds=10):
        """
        Get smoothed RSSI reading from each active gateway
        Uses last 3 readings with exponential smoothing for better accuracy
        
        Args:
            forklift_id: The beacon name to track
            seconds: How many seconds back to look for readings
        
        Returns:
            Dictionary with gateway_id as key, smoothed RSSI as value
        """
        cutoff_time = datetime.utcnow() - timedelta(seconds=seconds)
        
        # Get smoothed RSSI from each gateway
        gateway_rssi = {}
        
        for gateway in WiFiGateway.select().where(WiFiGateway.is_active == 'true'):
            # Get last 3 readings for smoothing (1-second window)
            recent_readings = list(BLERSSIData.select().where(
                (BLERSSIData.gateway_id == gateway.gateway_id) &
                (BLERSSIData.forklift_id == forklift_id) &
                (BLERSSIData.timestamp >= cutoff_time)
            ).order_by(BLERSSIData.timestamp.desc()).limit(3))
            
            if recent_readings:
                # Extract RSSI values
                rssi_values = [reading.rssi for reading in recent_readings]
                
                # Apply exponential smoothing
                smoothed_rssi = TrilatationService.apply_rssi_smoothing(rssi_values, gateway.gateway_id)
                
                if smoothed_rssi is not None:
                    gateway_rssi[gateway.gateway_id] = smoothed_rssi
        
        return gateway_rssi
    
    @staticmethod
    def apply_rssi_smoothing(rssi_readings, gateway_id):
        """
        Apply exponential smoothing to RSSI readings from a specific gateway
        
        Args:
            rssi_readings: List of recent RSSI values (newest first)
            gateway_id: Gateway identifier
        
        Returns:
            Smoothed RSSI value
        """
        if not rssi_readings:
            return None
        
        alpha = RSSI_CONFIG["SMOOTHING_FACTOR"]
        smoothed = rssi_readings[0]
        
        for rssi in rssi_readings[1:]:
            smoothed = alpha * rssi + (1 - alpha) * smoothed
        
        return smoothed
    
    @staticmethod
    def apply_kalman_filter(forklift_id, measured_x, measured_y, measured_z=0.0):
        """
        Apply Kalman filter to smooth position estimates
        Blends predicted position (from velocity) with measured position
        
        Args:
            forklift_id: Forklift identifier
            measured_x: Measured X position from trilateration
            measured_y: Measured Y position from trilateration
            measured_z: Measured Z position (height)
        
        Returns:
            Dictionary with filtered position {x, y, z, vx, vy}
        """
        current_time = datetime.utcnow()
        
        # Get previous state
        prev_state = TrilatationService._kalman_state.get(forklift_id)
        
        # First 2 readings: skip Kalman, just store raw measurement
        if prev_state is None:
            # Initialize state
            TrilatationService._kalman_state[forklift_id] = {
                'x': measured_x,
                'y': measured_y,
                'z': measured_z,
                'vx': 0.0,
                'vy': 0.0,
                'timestamp': current_time,
                'count': 1
            }
            return {'x': measured_x, 'y': measured_y, 'z': measured_z, 'vx': 0.0, 'vy': 0.0}
        
        # Second reading: calculate initial velocity, skip Kalman
        if prev_state.get('count', 0) < 2:
            dt = (current_time - prev_state['timestamp']).total_seconds()
            if dt > 0:
                vx = (measured_x - prev_state['x']) / dt
                vy = (measured_y - prev_state['y']) / dt
            else:
                vx = 0.0
                vy = 0.0
            
            TrilatationService._kalman_state[forklift_id] = {
                'x': measured_x,
                'y': measured_y,
                'z': measured_z,
                'vx': vx,
                'vy': vy,
                'timestamp': current_time,
                'count': 2
            }
            return {'x': measured_x, 'y': measured_y, 'z': measured_z, 'vx': vx, 'vy': vy}
        
        # Third+ reading: Apply Kalman filter
        dt = (current_time - prev_state['timestamp']).total_seconds()
        
        # Prediction step (where we expect the forklift to be)
        predicted_x = prev_state['x'] + prev_state['vx'] * dt
        predicted_y = prev_state['y'] + prev_state['vy'] * dt
        
        # Correction step (blend prediction with measurement)
        alpha = TRILATERATION_CONFIG["SMOOTHING_ALPHA"]  # 0.3 from config
        
        # Kalman filtered position
        filtered_x = alpha * measured_x + (1 - alpha) * predicted_x
        filtered_y = alpha * measured_y + (1 - alpha) * predicted_y
        filtered_z = measured_z  # Height doesn't change much
        
        # Update velocity estimate
        if dt > 0:
            vx = (filtered_x - prev_state['x']) / dt
            vy = (filtered_y - prev_state['y']) / dt
        else:
            vx = prev_state['vx']
            vy = prev_state['vy']
        
        # Store updated state
        TrilatationService._kalman_state[forklift_id] = {
            'x': filtered_x,
            'y': filtered_y,
            'z': filtered_z,
            'vx': vx,
            'vy': vy,
            'timestamp': current_time,
            'count': prev_state.get('count', 2) + 1
        }
        
        return {
            'x': filtered_x,
            'y': filtered_y,
            'z': filtered_z,
            'vx': vx,
            'vy': vy
        }
    
    @staticmethod
    def reject_rssi_outliers(gateway_rssi):
        """
        Remove RSSI outliers using median absolute deviation (MAD)
        Filters out gateways with abnormally weak/strong signals
        
        Args:
            gateway_rssi: Dictionary of {gateway_id: rssi_value}
        
        Returns:
            Filtered dictionary without outliers
        """
        if len(gateway_rssi) < 3:
            return gateway_rssi  # Need at least 3 for outlier detection
        
        rssi_values = list(gateway_rssi.values())
        median_rssi = statistics.median(rssi_values)
        
        # Calculate MAD (Median Absolute Deviation)
        deviations = [abs(r - median_rssi) for r in rssi_values]
        mad = statistics.median(deviations)
        
        if mad == 0:
            return gateway_rssi  # All values identical, no outliers
        
        # Filter: keep values within 2.5 MAD of median
        threshold = 2.5 * mad
        filtered = {}
        
        for gw_id, rssi in gateway_rssi.items():
            if abs(rssi - median_rssi) <= threshold:
                filtered[gw_id] = rssi
            else:
                print(f"⚠️ Outlier rejected: {gw_id} RSSI={rssi} (median={median_rssi:.1f})")
        
        # Ensure we keep at least 2 gateways
        if len(filtered) < 2:
            return gateway_rssi  # Don't reject if too few left
        
        return filtered
    
    @staticmethod
    def calculate_position(forklift_id="forklift_001", time_window_seconds=10):
        """
        Calculate forklift position using trilateration from multiple gateways
        Optimized for 4+ gateways using weighted least squares
        
        Args:
            forklift_id: The beacon name to track
            time_window_seconds: How recent RSSI data to use
        
        Returns:
            Dictionary with position (x, y, z) or None if calculation fails
        """
        # Get smoothed RSSI from each gateway
        gateway_rssi = TrilatationService.get_latest_rssi_per_gateway(
            forklift_id, 
            time_window_seconds
        )
        
        # Reject outliers for more accurate positioning
        gateway_rssi = TrilatationService.reject_rssi_outliers(gateway_rssi)
        
        min_gateways = TRILATERATION_CONFIG["MIN_GATEWAYS"]
        if len(gateway_rssi) < min_gateways:
            return None  # Not enough gateways
        
        # Get gateway positions
        gateways = {}
        distances = {}
        
        for gateway_id, rssi in gateway_rssi.items():
            try:
                gw = WiFiGateway.get(WiFiGateway.gateway_id == gateway_id)
                gateways[gateway_id] = {
                    'x': gw.location_x,
                    'y': gw.location_y,
                    'z': gw.location_z
                }
                
                # Convert RSSI to distance
                distance = TrilatationService.rssi_to_distance(rssi)
                distances[gateway_id] = distance
            except:
                continue
        
        if len(gateways) < min_gateways:
            return None
        
        # Choose positioning method based on gateway count
        if len(gateways) >= 4:
            # 4+ gateways: Use weighted least squares (uses ALL gateways)
            position = TrilatationService._multilaterate_weighted(gateways, distances, gateway_rssi)
            print(f"📍 Using {len(gateways)} gateways with weighted least squares")
        elif len(gateways) == 3:
            # Exactly 3 gateways: Use geometric trilateration
            position = TrilatationService._trilaterate_3d(gateways, distances)
            print(f"📍 Using 3-gateway geometric trilateration")
        elif len(gateways) == 2:
            # 2 gateways: Bilateration (less accurate)
            position = TrilatationService._bilaterate_2d(gateways, distances)
            print(f"📍 Using 2-gateway bilateration (limited accuracy)")
        else:
            position = None
        
        # Apply Kalman filter if we have a valid position
        if position:
            filtered = TrilatationService.apply_kalman_filter(
                forklift_id,
                position['x'],
                position['y'],
                position.get('z', 0.0)
            )
            
            # Update position with Kalman-filtered values
            position['x'] = filtered['x']
            position['y'] = filtered['y']
            position['z'] = filtered['z']
            
            # Add velocity info (useful for debugging/visualization)
            position['velocity_x'] = filtered['vx']
            position['velocity_y'] = filtered['vy']
            position['speed'] = math.sqrt(filtered['vx']**2 + filtered['vy']**2)
        
        return position
    
    @staticmethod
    def _bilaterate_2d(gateways, distances):
        """
        2D Bilateration with only 2 gateways (less accurate than trilateration)
        Places the forklift on the line between the two gateways based on RSSI distances
        
        Args:
            gateways: Dict of {gateway_id: {x, y, z}} (only 2 entries)
            distances: Dict of {gateway_id: distance_in_meters} (only 2 entries)
        
        Returns:
            {x, y, z, accuracy} or None
        """
        try:
            positions = list(gateways.values())
            dists = list(distances.values())
            
            if len(positions) != 2:
                return None
            
            p1 = positions[0]
            p2 = positions[1]
            d1 = dists[0]
            d2 = dists[1]
            
            # Calculate distance between gateways
            gateway_distance = math.sqrt((p2['x'] - p1['x'])**2 + (p2['y'] - p1['y'])**2)
            
            # If distances are inconsistent, use weighted average
            if d1 + d2 < gateway_distance:
                # Signals too weak - estimate closer to midpoint
                ratio = 0.5
            else:
                # Calculate position ratio along the line
                ratio = d1 / (d1 + d2)
            
            # Interpolate position between two gateways
            x = p1['x'] + ratio * (p2['x'] - p1['x'])
            y = p1['y'] + ratio * (p2['y'] - p1['y'])
            z = 0.0
            
            # Accuracy estimate (lower confidence with only 2 gateways)
            accuracy = max(d1, d2) * 0.5  # Rough estimate
            
            return {
                'x': x,
                'y': y,
                'z': z,
                'accuracy': accuracy,
                'gateway_count': 2,
                'average_rssi': (d1 + d2) / 2
            }
        except Exception as e:
            print(f"Bilateration error: {e}")
            return None
    
    @staticmethod
    def _multilaterate_weighted(gateways, distances, rssi_values):
        """
        Weighted Least Squares Multilateration for 4+ gateways
        Uses ALL available gateways with weights based on signal strength
        
        Args:
            gateways: Dict of {gateway_id: {x, y, z}}
            distances: Dict of {gateway_id: distance_in_meters}
            rssi_values: Dict of {gateway_id: rssi_dbm} for weighting
        
        Returns:
            {x, y, z, accuracy, gateway_count, average_rssi} or None
        """
        try:
            positions = list(gateways.values())
            dists = list(distances.values())
            gateway_ids = list(gateways.keys())
            
            if len(positions) < 4:
                return None
            
            # Calculate weights based on RSSI (stronger signal = higher weight)
            # Weight = 1 / (distance^2) approximates measurement uncertainty
            weights = []
            for gw_id in gateway_ids:
                rssi = rssi_values.get(gw_id, -80)
                # Convert RSSI to weight: stronger signal (closer to 0) = higher weight
                # RSSI=-50 (strong) → weight=30, RSSI=-80 (weak) → weight=0.1
                weight = max(0.1, (100 + rssi) / 30.0)  # Normalized to 0.1-3.0 range
                weights.append(weight)
            
            # Initial guess: centroid of all gateways
            x_init = sum(p['x'] for p in positions) / len(positions)
            y_init = sum(p['y'] for p in positions) / len(positions)
            z_init = 0.0  # Floor level
            
            # Iterative least squares (Gauss-Newton)
            x, y, z = x_init, y_init, z_init
            
            for iteration in range(10):  # Max 10 iterations
                # Calculate residuals and Jacobian
                residuals = []
                jacobian_x = []
                jacobian_y = []
                
                for i, pos in enumerate(positions):
                    # Current distance estimate
                    dx = x - pos['x']
                    dy = y - pos['y']
                    dz = z - pos['z']
                    dist_calc = math.sqrt(dx**2 + dy**2 + dz**2)
                    
                    if dist_calc < 0.01:  # Avoid division by zero
                        dist_calc = 0.01
                    
                    # Weighted residual
                    residual = (dist_calc - dists[i]) * weights[i]
                    residuals.append(residual)
                    
                    # Jacobian (partial derivatives)
                    jacobian_x.append(dx / dist_calc * weights[i])
                    jacobian_y.append(dy / dist_calc * weights[i])
                
                # Calculate updates using normal equations
                sum_jx2 = sum(jx**2 for jx in jacobian_x)
                sum_jy2 = sum(jy**2 for jy in jacobian_y)
                sum_jx_r = sum(jx * r for jx, r in zip(jacobian_x, residuals))
                sum_jy_r = sum(jy * r for jy, r in zip(jacobian_y, residuals))
                
                if sum_jx2 > 0.01:
                    delta_x = -sum_jx_r / sum_jx2
                else:
                    delta_x = 0
                
                if sum_jy2 > 0.01:
                    delta_y = -sum_jy_r / sum_jy2
                else:
                    delta_y = 0
                
                # Update position
                x += delta_x
                y += delta_y
                
                # Check convergence
                if abs(delta_x) < 0.01 and abs(delta_y) < 0.01:
                    break  # Converged
            
            # Calculate weighted accuracy (RMSE)
            errors = []
            for i, pos in enumerate(positions):
                calc_dist = math.sqrt((x - pos['x'])**2 + (y - pos['y'])**2 + (z - pos['z'])**2)
                error = abs(calc_dist - dists[i])
                errors.append(error)
            
            accuracy = math.sqrt(sum(e**2 for e in errors) / len(errors))
            
            return {
                'x': x,
                'y': y,
                'z': z,
                'accuracy': accuracy,
                'gateway_count': len(positions),
                'average_rssi': sum(dists) / len(dists),
                'method': 'weighted_least_squares'
            }
        except Exception as e:
            print(f"Weighted multilateration error: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    @staticmethod
    def _trilaterate_3d(gateways, distances):
        """
        3D Trilateration using geometric method for exactly 3 gateways
        
        Args:
            gateways: Dict of {gateway_id: {x, y, z}}
            distances: Dict of {gateway_id: distance_in_meters}
        
        Returns:
            {x, y, z, accuracy} or None
        """
        try:
            # Convert to lists for calculation
            positions = list(gateways.values())
            dists = list(distances.values())
            
            # Initial guess at center of gateways
            center_x = sum(p['x'] for p in positions) / len(positions)
            center_y = sum(p['y'] for p in positions) / len(positions)
            center_z = sum(p['z'] for p in positions) / len(positions)
            
            # Simplified trilateration: use first 3 gateways
            if len(positions) >= 3:
                p1 = positions[0]
                p2 = positions[1]
                p3 = positions[2]
                
                d1 = dists[0]
                d2 = dists[1]
                d3 = dists[2]
                
                # 2D trilateration (XY plane)
                x, y = TrilatationService._trilaterate_2d(
                    p1['x'], p1['y'], d1,
                    p2['x'], p2['y'], d2,
                    p3['x'], p3['y'], d3
                )
                
                # Z: use average height from gateways or 0 (floor)
                z = 0.0
                
                # Calculate accuracy (residual error)
                accuracy = TrilatationService._calculate_residual_error(
                    x, y, z, positions, dists
                )
                
                return {
                    'x': x,
                    'y': y,
                    'z': z,
                    'accuracy': accuracy,
                    'gateway_count': len(positions),
                    'average_rssi': sum(dists) / len(dists)
                }
        except Exception as e:
            print(f"Trilateration error: {e}")
            return None
        
        return None
    
    @staticmethod
    def _trilaterate_2d(x1, y1, d1, x2, y2, d2, x3, y3, d3):
        """
        2D Trilateration using three points and distances
        
        Returns:
            (x, y) position
        """
        try:
            # Distance between first two points
            d12 = math.sqrt((x2 - x1)**2 + (y2 - y1)**2)
            
            # Point A on line through P1-P2
            a = (d1**2 - d2**2 + d12**2) / (2 * d12)
            
            # Height from line P1-P2
            h = math.sqrt(max(0, d1**2 - a**2))
            
            # Point coordinates on P1-P2 line
            px = x1 + a * (x2 - x1) / d12
            py = y1 + a * (y2 - y1) / d12
            
            # Perpendicular vector
            px3 = px + h * (y2 - y1) / d12
            py3 = py - h * (x2 - x1) / d12
            
            # Check which side gives better match with third circle
            dist_to_p3_v1 = math.sqrt((px3 - x3)**2 + (py3 - y3)**2)
            
            px3_alt = px - h * (y2 - y1) / d12
            py3_alt = py + h * (x2 - x1) / d12
            dist_to_p3_v2 = math.sqrt((px3_alt - x3)**2 + (py3_alt - y3)**2)
            
            if dist_to_p3_v1 < dist_to_p3_v2:
                return px3, py3
            else:
                return px3_alt, py3_alt
        except:
            # Fallback: return center
            return (x1 + x2 + x3) / 3, (y1 + y2 + y3) / 3
    
    @staticmethod
    def _calculate_residual_error(x, y, z, positions, distances):
        """
        Calculate residual error for estimated position
        
        Returns:
            Error in meters
        """
        errors = []
        for i, pos in enumerate(positions):
            calc_distance = math.sqrt(
                (x - pos['x'])**2 + 
                (y - pos['y'])**2 + 
                (z - pos['z'])**2
            )
            error = abs(calc_distance - distances[i])
            errors.append(error)
        
        return sum(errors) / len(errors) if errors else 0
    
    @staticmethod
    def save_calculated_position(forklift_id, position_data):
        """
        Save calculated position to database
        
        Args:
            forklift_id: Forklift identifier
            position_data: Dictionary with x, y, z, accuracy, velocity, etc.
        """
        if not position_data:
            return None
        
        record = ForkliftPositionTrilateration.create(
            forklift_id=forklift_id,
            calculated_x=position_data.get('x', 0),
            calculated_y=position_data.get('y', 0),
            calculated_z=position_data.get('z', 0),
            accuracy=position_data.get('accuracy'),
            gateway_count=position_data.get('gateway_count', 0),
            average_rssi=position_data.get('average_rssi'),
            method=position_data.get('method', 'trilateration'),
            velocity_x=position_data.get('velocity_x', 0.0),
            velocity_y=position_data.get('velocity_y', 0.0),
            speed=position_data.get('speed', 0.0)
        )
        
        return record.to_dict()
