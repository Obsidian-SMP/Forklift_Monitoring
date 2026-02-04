"""
Weighted Least Squares (WLS) Trilateration
Supports 2-6+ gateways with dynamic adaptation
"""

import numpy as np
import math
from typing import List, Dict, Optional, Tuple


class WLSTrilateration:
    """
    Weighted Least Squares trilateration for BLE positioning
    Automatically adapts algorithm based on number of available gateways
    """
    
    def __init__(self, tx_power=-55, n_los=2.0, n_nlos=3.5, los_threshold=-70):
        """
        Initialize WLS trilateration
        
        Args:
            tx_power: Transmit power at 1 meter (calibrated for Arduino Nano 33 IoT)
            n_los: Path loss exponent for line-of-sight
            n_nlos: Path loss exponent for non-line-of-sight
            los_threshold: RSSI threshold for LOS detection (dBm)
        """
        self.tx_power = tx_power
        self.n_los = n_los
        self.n_nlos = n_nlos
        self.los_threshold = los_threshold
    
    def rssi_to_distance(self, rssi: float, adaptive: bool = True) -> float:
        """
        Convert RSSI to distance using log-distance path loss model
        
        Args:
            rssi: RSSI value in dBm
            adaptive: Use adaptive path loss exponent (LOS vs NLOS)
        
        Returns:
            Distance in meters
        """
        if rssi >= self.tx_power:
            return 0.5  # Very close
        
        # Adaptive path loss exponent
        if adaptive:
            n = self.n_los if rssi > self.los_threshold else self.n_nlos
        else:
            n = self.n_los
        
        # Calculate distance
        distance = 10 ** ((self.tx_power - rssi) / (10 * n))
        
        # Clamp to reasonable bounds
        return np.clip(distance, 0.1, 50.0)
    
    def calculate_position(
        self,
        gateway_positions: List[Tuple[float, float, float]],
        rssi_values: List[float]
    ) -> Optional[Dict]:
        """
        Calculate position using WLS trilateration
        
        Args:
            gateway_positions: List of (x, y, z) tuples for each gateway
            rssi_values: List of RSSI values corresponding to each gateway
        
        Returns:
            Dictionary with position, accuracy, method, or None if calculation fails
        """
        n_gateways = len(gateway_positions)
        
        if n_gateways != len(rssi_values):
            return None
        
        if n_gateways < 2:
            return None
        
        # Convert RSSI to distances
        distances = [self.rssi_to_distance(rssi) for rssi in rssi_values]
        
        # Choose method based on gateway count
        if n_gateways == 2:
            return self._bilateration(gateway_positions, distances, rssi_values)
        elif n_gateways == 3:
            return self._trilateration_3point(gateway_positions, distances, rssi_values)
        else:  # 4+ gateways
            return self._weighted_least_squares(gateway_positions, distances, rssi_values)
    
    def _bilateration(
        self,
        positions: List[Tuple[float, float, float]],
        distances: List[float],
        rssi_values: List[float]
    ) -> Dict:
        """
        2-gateway bilateration (less accurate, but works)
        Position estimated along line between gateways
        """
        p1, p2 = positions
        d1, d2 = distances
        
        # Distance between gateways
        gw_dist = math.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)
        
        # Calculate position ratio along line
        if d1 + d2 < gw_dist * 0.9:
            # Signals too weak - estimate closer to midpoint
            ratio = 0.5
        else:
            ratio = d1 / (d1 + d2) if (d1 + d2) > 0 else 0.5
        
        # Interpolate position
        x = p1[0] + ratio * (p2[0] - p1[0])
        y = p1[1] + ratio * (p2[1] - p1[1])
        
        # Low accuracy with only 2 gateways
        accuracy = max(d1, d2) * 0.5
        
        return {
            'x': float(x),
            'y': float(y),
            'z': 0.0,
            'accuracy': float(accuracy),
            'gateway_count': 2,
            'method': 'bilateration',
            'average_rssi': float(np.mean(rssi_values))
        }
    
    def _trilateration_3point(
        self,
        positions: List[Tuple[float, float, float]],
        distances: List[float],
        rssi_values: List[float]
    ) -> Optional[Dict]:
        """
        3-gateway geometric trilateration
        More accurate than bilateration
        """
        # Use WLS for 3 points too (more robust than geometric method)
        return self._weighted_least_squares(positions, distances, rssi_values)
    
    def _weighted_least_squares(
        self,
        positions: List[Tuple[float, float, float]],
        distances: List[float],
        rssi_values: List[float]
    ) -> Optional[Dict]:
        """
        Weighted Least Squares for 3+ gateways
        Optimal method with proper weighting
        """
        n = len(positions)
        
        # Convert to numpy arrays
        gw_positions = np.array(positions)
        dists = np.array(distances)
        
        # Calculate weights: inverse square of distance (stronger signal = higher weight)
        weights = 1.0 / (dists**2 + 0.1)
        weights = weights / np.sum(weights)  # Normalize
        
        # Initial guess: weighted centroid of gateways
        x0 = np.average(gw_positions[:, 0], weights=weights)
        y0 = np.average(gw_positions[:, 1], weights=weights)
        
        # Gauss-Newton iteration
        x, y = x0, y0
        converged = False
        
        for iteration in range(30):  # Max 30 iterations
            residuals = []
            jacobian_rows = []
            
            for i in range(n):
                gx, gy, gz = gw_positions[i]
                
                # Current distance estimate
                dx = x - gx
                dy = y - gy
                dist_calc = math.sqrt(dx**2 + dy**2) + 1e-6  # Avoid division by zero
                
                # Weighted residual: (calculated - measured) * weight
                residual = (dist_calc - dists[i]) * weights[i]
                residuals.append(residual)
                
                # Jacobian (partial derivatives)
                j_x = (dx / dist_calc) * weights[i]
                j_y = (dy / dist_calc) * weights[i]
                jacobian_rows.append([j_x, j_y])
            
            J = np.array(jacobian_rows)
            r = np.array(residuals)
            
            # Normal equations: (J^T * J) * delta = -J^T * r
            try:
                JtJ = J.T @ J
                Jtr = J.T @ r
                delta = np.linalg.solve(JtJ, -Jtr)
                
                # Update position with line search damping
                x += delta[0] * 0.7  # Damping factor for stability
                y += delta[1] * 0.7
                
                # Check convergence
                if np.linalg.norm(delta) < 0.01:
                    converged = True
                    break
                
            except np.linalg.LinAlgError:
                # Singular matrix, use current estimate
                break
        
        # Calculate final accuracy (RMSE of residuals)
        final_residuals = []
        for i in range(n):
            gx, gy, gz = gw_positions[i]
            dist_calc = math.sqrt((x - gx)**2 + (y - gy)**2)
            final_residuals.append(abs(dist_calc - dists[i]))
        
        rmse = math.sqrt(np.mean(np.array(final_residuals)**2))
        
        return {
            'x': float(x),
            'y': float(y),
            'z': 0.0,
            'accuracy': float(rmse),
            'gateway_count': n,
            'method': 'wls',
            'iterations': iteration + 1,
            'converged': converged,
            'average_rssi': float(np.mean(rssi_values))
        }
    
    def calculate_gdop(self, gateway_positions: List[Tuple[float, float, float]], test_position: Tuple[float, float]) -> float:
        """
        Calculate Geometric Dilution of Precision (GDOP) at a test position
        Lower GDOP = better accuracy
        
        Args:
            gateway_positions: List of (x, y, z) gateway positions
            test_position: (x, y) position to test
        
        Returns:
            GDOP value (2-5 = good, 5-10 = fair, >10 = poor)
        """
        n = len(gateway_positions)
        if n < 3:
            return 999.0  # Invalid
        
        tx, ty = test_position
        
        # Build geometry matrix
        G = []
        for gx, gy, gz in gateway_positions:
            dx = tx - gx
            dy = ty - gy
            dist = math.sqrt(dx**2 + dy**2) + 1e-6
            G.append([dx/dist, dy/dist])
        
        G = np.array(G)
        
        try:
            # GDOP = sqrt(trace((G^T * G)^-1))
            GtG_inv = np.linalg.inv(G.T @ G)
            gdop = math.sqrt(np.trace(GtG_inv))
            return float(gdop)
        except:
            return 999.0
