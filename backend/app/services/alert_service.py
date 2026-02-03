import logging

logger = logging.getLogger(__name__)


class AlertService:
    """Service for checking thresholds and generating alerts"""
    
    def __init__(self, config):
        self.temp_min = config['TEMP_MIN']
        self.temp_max = config['TEMP_MAX']
        self.humidity_min = config['HUMIDITY_MIN']
        self.humidity_max = config['HUMIDITY_MAX']
        self.vibration_threshold = config['VIBRATION_THRESHOLD']
    
    def check_environment_alerts(self, temperature, humidity):
        """Check temperature and humidity against thresholds"""
        alerts = []
        
        if temperature < self.temp_min:
            alerts.append({
                'type': 'warning',
                'message': f'Temperature below minimum: {temperature}°C (min: {self.temp_min}°C)',
                'severity': 'medium'
            })
        elif temperature > self.temp_max:
            alerts.append({
                'type': 'warning',
                'message': f'Temperature above maximum: {temperature}°C (max: {self.temp_max}°C)',
                'severity': 'high'
            })
        
        if humidity < self.humidity_min:
            alerts.append({
                'type': 'warning',
                'message': f'Humidity below minimum: {humidity}% (min: {self.humidity_min}%)',
                'severity': 'low'
            })
        elif humidity > self.humidity_max:
            alerts.append({
                'type': 'warning',
                'message': f'Humidity above maximum: {humidity}% (max: {self.humidity_max}%)',
                'severity': 'medium'
            })
        
        return alerts
    
    def check_vibration_anomaly(self, magnitude):
        """Check if vibration magnitude exceeds threshold"""
        if magnitude > self.vibration_threshold:
            logger.warning(f"Vibration anomaly detected: {magnitude:.2f} (threshold: {self.vibration_threshold})")
            return True
        return False
    
    def check_load_alert(self, forklift_id, detected_count, is_lifting):
        """Generate alert when forklift lifts/drops load"""
        if is_lifting and detected_count > 0:
            return {
                'type': 'info',
                'message': f'Forklift {forklift_id} lifting {detected_count} item(s)',
                'severity': 'info'
            }
        elif not is_lifting and detected_count == 0:
            return {
                'type': 'info',
                'message': f'Forklift {forklift_id} dropped load',
                'severity': 'info'
            }
        return None
