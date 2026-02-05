"""
Unified Positioning Engine
Coordinates RSSI processing, trilateration, and Kalman filtering
"""

import threading
import time
from datetime import datetime
from typing import Dict, Optional, List
from collections import deque

from app.services.rssi_processor import RSSIProcessor
from app.services.trilateration_wls import WLSTrilateration
from app.services.ekf_filter import ExtendedKalmanFilter
from app.models import WiFiGateway


class PositioningEngine:
    """
    Main positioning engine that processes RSSI data and calculates positions
    Runs as background thread with configurable update rate
    """
    
    def __init__(self, update_interval=0.5, tx_power=-55):
        """
        Initialize positioning engine
        
        Args:
            update_interval: Time between position calculations (seconds)
            tx_power: Calibrated TX power for RSSI-to-distance conversion
        """
        self.update_interval = update_interval
        
        # Load config values
        from app.gateway_config import RSSI_CONFIG, TRILATERATION_CONFIG
        
        # Initialize components with config values
        self.rssi_processor = RSSIProcessor(
            buffer_size=RSSI_CONFIG.get('BUFFER_SIZE', 10),
            smoothing_alpha=RSSI_CONFIG.get('SMOOTHING_ALPHA', 0.25)
        )
        self.trilateration = WLSTrilateration(
            tx_power=tx_power,
            n_los=RSSI_CONFIG.get('PATH_LOSS_N_LOS', 2.0),
            n_nlos=RSSI_CONFIG.get('PATH_LOSS_N_NLOS', 3.5)
        )
        self.ekf = ExtendedKalmanFilter(
            dt=update_interval,
            process_noise=TRILATERATION_CONFIG.get('PROCESS_NOISE', 0.3),
            measurement_noise=TRILATERATION_CONFIG.get('MEASUREMENT_NOISE', 9.0)
        )
        
        # Storage for latest position
        self.latest_position = None
        self.position_history = deque(maxlen=200)
        
        # Gateway cache
        self.gateway_cache = {}
        self.last_gateway_update = None
        
        # Thread control
        self.running = False
        self.thread = None
        self.lock = threading.Lock()
        
        # Statistics
        self.stats = {
            'total_calculations': 0,
            'successful_calculations': 0,
            'failed_calculations': 0,
            'average_accuracy': 0.0,
            'last_calculation_time': None
        }
    
    def start(self):
        """Start background positioning thread"""
        if self.running:
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._positioning_loop, daemon=True)
        self.thread.start()
        print(f"✅ Positioning engine started (update interval: {self.update_interval}s)")
    
    def stop(self):
        """Stop background positioning thread"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=2.0)
        print("⏹️  Positioning engine stopped")
    
    def add_rssi_sample(self, gateway_id: str, rssi: float, timestamp=None):
        """
        Add new RSSI sample from gateway
        
        Args:
            gateway_id: Gateway identifier
            rssi: RSSI value in dBm
            timestamp: Sample timestamp (defaults to now)
        """
        self.rssi_processor.add_sample(gateway_id, rssi, timestamp)
    
    def get_latest_position(self) -> Optional[Dict]:
        """Get latest calculated position"""
        with self.lock:
            return self.latest_position.copy() if self.latest_position else None
    
    def get_position_history(self, limit=200) -> List[Dict]:
        """Get recent position history"""
        with self.lock:
            return list(self.position_history)[-limit:]
    
    def get_statistics(self) -> Dict:
        """Get engine statistics"""
        with self.lock:
            return self.stats.copy()
    
    def _update_gateway_cache(self):
        """Update gateway positions from database"""
        try:
            gateways = WiFiGateway.select().where(WiFiGateway.is_active == 'true')
            
            self.gateway_cache = {}
            for gw in gateways:
                self.gateway_cache[gw.gateway_id] = {
                    'name': gw.name,
                    'position': (gw.location_x, gw.location_y, gw.location_z),
                    'x': gw.location_x,
                    'y': gw.location_y,
                    'z': gw.location_z
                }
            
            self.last_gateway_update = datetime.utcnow()
            
        except Exception as e:
            print(f"❌ Failed to update gateway cache: {e}")
    
    def _positioning_loop(self):
        """Main positioning loop (runs in background thread)"""
        print("🔄 Positioning loop started")
        
        while self.running:
            try:
                start_time = time.time()
                
                # Update gateway cache every 10 seconds
                if (self.last_gateway_update is None or 
                    (datetime.utcnow() - self.last_gateway_update).total_seconds() > 10):
                    self._update_gateway_cache()
                
                # Calculate position
                position = self._calculate_position()
                
                # Update statistics
                with self.lock:
                    self.stats['total_calculations'] += 1
                    self.stats['last_calculation_time'] = datetime.utcnow()
                    
                    if position:
                        self.stats['successful_calculations'] += 1
                        self.latest_position = position
                        self.position_history.append(position)
                        
                        # Update average accuracy
                        if 'accuracy' in position:
                            total_successful = self.stats['successful_calculations']
                            prev_avg = self.stats['average_accuracy']
                            new_accuracy = position['accuracy']
                            self.stats['average_accuracy'] = (
                                (prev_avg * (total_successful - 1) + new_accuracy) / total_successful
                            )
                    else:
                        self.stats['failed_calculations'] += 1
                
                # Calculate sleep time to maintain update interval
                elapsed = time.time() - start_time
                sleep_time = max(0.0, self.update_interval - elapsed)
                time.sleep(sleep_time)
                
            except Exception as e:
                print(f"❌ Error in positioning loop: {e}")
                import traceback
                traceback.print_exc()
                time.sleep(1.0)  # Prevent rapid failure loop
    
    def _calculate_position(self) -> Optional[Dict]:
        """
        Calculate position using RSSI → WLS → EKF pipeline
        
        Returns:
            Position dictionary or None if calculation fails
        """
        try:
            # Step 1: Get filtered RSSI from all gateways
            filtered_rssi = self.rssi_processor.get_all_filtered_rssi(max_age_seconds=10)
            
            if len(filtered_rssi) < 2:
                # Not enough gateways
                return None
            
            # Step 2: Get gateway positions and prepare for trilateration
            gateway_positions = []
            rssi_values = []
            gateway_ids = []
            
            for gw_id, rssi in filtered_rssi.items():
                if gw_id in self.gateway_cache:
                    gw_info = self.gateway_cache[gw_id]
                    gateway_positions.append(gw_info['position'])
                    rssi_values.append(rssi)
                    gateway_ids.append(gw_id)
            
            if len(gateway_positions) < 2:
                return None
            
            # Step 3: WLS Trilateration
            trilateration_result = self.trilateration.calculate_position(
                gateway_positions, rssi_values
            )
            
            if not trilateration_result:
                return None
            
            # Step 4: Kalman Filter update
            measured_x = trilateration_result['x']
            measured_y = trilateration_result['y']
            measurement_accuracy = trilateration_result.get('accuracy', 2.0)
            
            # If EKF not initialized or long time since last update, just predict
            if self.ekf.is_initialized():
                # Predict forward (constant velocity)
                self.ekf.predict(dt=self.update_interval)
            
            # Update with measurement
            self.ekf.update(measured_x, measured_y, measurement_accuracy)
            
            # Get smoothed state
            ekf_state = self.ekf.get_state()
            
            if not ekf_state:
                # EKF not ready, use raw trilateration
                return {
                    **trilateration_result,
                    'x': measured_x,
                    'y': measured_y,
                    'vx': 0.0,
                    'vy': 0.0,
                    'speed': 0.0,
                    'confidence': 50.0,
                    'timestamp': datetime.utcnow().isoformat() + 'Z',
                    'gateway_ids': gateway_ids,
                    'forklift_id': 'forklift_001'
                }
            
            # Step 5: Build final position dictionary
            position = {
                'forklift_id': 'forklift_001',
                'x': ekf_state['px'],
                'y': ekf_state['py'],
                'z': 0.0,
                'vx': ekf_state['vx'],
                'vy': ekf_state['vy'],
                'speed': ekf_state['speed'],
                'accuracy': trilateration_result['accuracy'],
                'confidence': self.ekf.get_confidence(),
                'gateway_count': trilateration_result['gateway_count'],
                'method': trilateration_result['method'],
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'gateway_ids': gateway_ids,
                'rssi_values': {gw_id: rssi for gw_id, rssi in zip(gateway_ids, rssi_values)}
            }
            
            # Save to database for historical tracking
            try:
                from app.models import ForkliftPositionTrilateration
                ForkliftPositionTrilateration.create(
                    forklift_id=position['forklift_id'],
                    calculated_x=position['x'],
                    calculated_y=position['y'],
                    calculated_z=position.get('z', 0.0),
                    accuracy_meters=position['accuracy'],
                    gateway_count=position['gateway_count'],
                    method=position['method'],
                    confidence_score=position['confidence']
                )
            except Exception as db_err:
                # Don't fail position calculation if DB write fails
                print(f"⚠️ Failed to save position to DB: {db_err}")
            
            return position
            
        except Exception as e:
            print(f"❌ Position calculation error: {e}")
            import traceback
            traceback.print_exc()
            return None


# Global positioning engine instance
_positioning_engine = None


def get_positioning_engine() -> PositioningEngine:
    """Get global positioning engine instance"""
    global _positioning_engine
    if _positioning_engine is None:
        _positioning_engine = PositioningEngine(update_interval=0.5, tx_power=-58.0)
    return _positioning_engine


def start_positioning_engine():
    """Start the global positioning engine"""
    engine = get_positioning_engine()
    if not engine.running:
        engine.start()


def stop_positioning_engine():
    """Stop the global positioning engine"""
    engine = get_positioning_engine()
    if engine.running:
        engine.stop()
