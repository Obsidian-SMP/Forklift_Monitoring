"""Background service to read and save DHT sensor data every 60 seconds"""
import threading
import time
from datetime import datetime, timezone, timedelta
import logging

# IST timezone (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

logger = logging.getLogger(__name__)

class DHTBackgroundService:
    def __init__(self, app=None):
        self.app = app
        self.running = False
        self.thread = None
        self.interval = 60  # Read every 60 seconds
        
    def start(self):
        """Start the background service"""
        if self.running:
            logger.warning("DHT background service already running")
            return
            
        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()
        logger.info(f"DHT background service started (reading every {self.interval}s)")
        
    def stop(self):
        """Stop the background service"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        logger.info("DHT background service stopped")
        
    def _run(self):
        """Main background loop"""
        while self.running:
            try:
                self._read_and_save()
            except Exception as e:
                logger.error(f"Error in DHT background service: {e}")
            
            # Wait for next reading
            time.sleep(self.interval)
    
    def _read_and_save(self):
        """Read DHT sensor and save to database"""
        from app.services.dht_sensor import get_dht_reading
        from app.models import WarehouseSensor, db
        
        try:
            # Get reading from DHT sensor
            reading = get_dht_reading()
            
            if reading and reading.get('temperature') is not None and reading.get('humidity') is not None:
                # Save to database with IST datetime (timezone-naive for SQLite compatibility)
                # The datetime represents IST time but without explicit timezone info
                ist_now = datetime.now(IST).replace(tzinfo=None)
                
                with db.atomic():
                    sensor = WarehouseSensor.create(
                        temperature=reading['temperature'],
                        humidity=reading['humidity'],
                        sensor_id='dht11_gpio21',
                        timestamp=ist_now
                    )
                
                logger.info(f"DHT reading saved: {reading['temperature']}°C, {reading['humidity']}% RH")
                return sensor
            else:
                logger.warning("DHT sensor returned invalid reading")
                return None
                
        except Exception as e:
            logger.error(f"Failed to read/save DHT data: {e}")
            return None

# Global service instance
dht_service = None

def init_dht_background_service(app):
    """Initialize and start the DHT background service"""
    global dht_service
    
    if dht_service is None:
        dht_service = DHTBackgroundService(app)
        dht_service.start()
        return dht_service
    
    return dht_service

def get_dht_service():
    """Get the DHT background service instance"""
    return dht_service
