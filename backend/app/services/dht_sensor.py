"""
DHT Sensor Reader - Temperature & Humidity from GPIO Pin 40 (BCM 21)
Using adafruit-circuitpython-dht library for reliable readings
"""

import time
from datetime import datetime, timezone, timedelta
import threading

# IST timezone (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

# Try to import DHT libraries
try:
    import board
    import adafruit_dht
    DHT_AVAILABLE = True
except ImportError as e:
    DHT_AVAILABLE = False
    print(f"⚠️  DHT library not available: {e}")
    print("Install: sudo pip3 install adafruit-circuitpython-dht")

# GPIO pin configuration
DHT_PIN = board.D21 if DHT_AVAILABLE else None  # GPIO pin 21 (Physical pin 40)

class DHTSensor:
    def __init__(self):
        """Initialize DHT sensor"""
        self.last_reading = None
        self.last_read_time = None
        self.lock = threading.Lock()
        self.sensor_available = False
        self.dht_device = None
        
        if DHT_AVAILABLE:
            try:
                self.dht_device = adafruit_dht.DHT11(DHT_PIN)
                self.sensor_available = True
                print("✓ DHT11 sensor initialized on GPIO 21 (Physical pin 40)")
            except Exception as e:
                print(f"✗ DHT sensor initialization error: {e}")
                self.sensor_available = False
        else:
            print("⚠️  DHT sensor not available - libraries not installed")
    
    def read_dht(self):
        """Read DHT sensor using adafruit library with timeout protection"""
        if not self.dht_device:
            return None
        
        try:
            # Use signal for timeout protection
            import signal
            
            def timeout_handler(signum, frame):
                raise TimeoutError("DHT read timeout")
            
            # Set 3-second timeout for the read operation
            signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(3)
            
            try:
                temperature = self.dht_device.temperature
                humidity = self.dht_device.humidity
                signal.alarm(0)  # Cancel alarm
                
                if temperature is not None and humidity is not None:
                    return {
                        'temperature': float(temperature),
                        'humidity': float(humidity),
                        'timestamp': datetime.now(IST).isoformat(),
                        'status': 'success',
                        'source': 'hardware'
                    }
            except TimeoutError:
                signal.alarm(0)
                return None
                
        except RuntimeError as e:
            # DHT sensors can occasionally fail with checksum errors - this is normal
            # Just return None and it will retry on next read
            return None
        except Exception as e:
            print(f"DHT read error: {e}")
            return None
    
    def get_simulated_reading(self):
        """Return simulated reading when hardware unavailable"""
        import random
        # Use last reading as base if available, otherwise use defaults
        base_temp = 26.0
        base_humidity = 43.0
        
        if self.last_reading and self.last_reading.get('temperature'):
            base_temp = self.last_reading['temperature']
            base_humidity = self.last_reading['humidity']
        
        return {
            'temperature': round(base_temp + random.uniform(-0.3, 0.3), 1),
            'humidity': round(base_humidity + random.uniform(-1, 1), 1),
            'timestamp': datetime.now(IST).isoformat(),
            'status': 'unavailable',
            'source': 'simulated'
        }
    
    def get_error_reading(self):
        """Return error status when sensor unavailable"""
        # Return simulated data instead of null values
        return self.get_simulated_reading()
    
    def read(self):
        """Read temperature and humidity from DHT sensor"""
        with self.lock:
            # If sensor is not available, return error
            if not self.sensor_available:
                result = self.get_error_reading()
                self.last_reading = result
                self.last_read_time = datetime.now(IST)
                return result
            
            # Try to read from hardware (may need multiple attempts)
            max_attempts = 2  # Reduced from 3 to speed up response
            for attempt in range(max_attempts):
                result = self.read_dht()
                
                if result is not None:
                    # Successful read
                    self.last_reading = result
                    self.last_read_time = datetime.now(IST)
                    return result
                
                # Wait before retry (DHT needs time between reads)
                if attempt < max_attempts - 1:
                    time.sleep(1)  # Reduced from 2 seconds to 1
            
            # All attempts failed - return last successful reading if available
            if self.last_reading and self.last_reading.get('status') == 'success':
                stale_reading = self.last_reading.copy()
                stale_reading['status'] = 'stale'
                stale_reading['note'] = 'Using last successful reading (sensor read failed)'
                return stale_reading
            
            # No previous reading - return simulated data with unavailable status
            result = self.get_simulated_reading()
            result['note'] = 'Failed to read DHT11 sensor - using simulated data'
            self.last_reading = result
            self.last_read_time = datetime.now(IST)
            return result

# Global instance
_dht_sensor = None

def initialize_dht():
    """Initialize DHT sensor"""
    global _dht_sensor
    _dht_sensor = DHTSensor()
    print("✓ DHT sensor initialized (GPIO pin 21)")

def get_dht_reading():
    """Get DHT sensor reading"""
    global _dht_sensor
    if _dht_sensor is None:
        initialize_dht()
    
    return _dht_sensor.read()

# Initialize on import
initialize_dht()


