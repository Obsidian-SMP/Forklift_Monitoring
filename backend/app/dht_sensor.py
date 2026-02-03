"""
DHT Sensor Reader - Temperature & Humidity from GPIO Pin 40
Reads from DHT11/DHT22 sensor connected to RPi GPIO pin 40
Falls back to simulated readings if sensor not available
"""

import time
from datetime import datetime
import json
import random

# Try to import DHT libraries
try:
    import board
    import adafruit_dht
    DHT_AVAILABLE = True
except:
    DHT_AVAILABLE = False
    print("⚠️  DHT libraries not available - using simulated readings")

class DHTSensor:
    def __init__(self, pin=None):
        """Initialize DHT sensor"""
        self.pin = pin
        self.sensor = None
        self.last_reading = None
        self.last_read_time = None
        self.dht_available = DHT_AVAILABLE
        
        if self.dht_available:
            self.init_sensor()
        else:
            print("⚠️  Using simulated DHT sensor (no hardware connected)")
    
    def init_sensor(self):
        """Initialize DHT sensor"""
        try:
            # Try DHT22 first (more accurate)
            import board
            pin = board.D21  # GPIO pin 40 = BCM 21
            self.sensor = adafruit_dht.DHT22(pin)
            print("✓ DHT22 sensor initialized on GPIO pin 40")
        except Exception as e:
            print(f"✗ DHT22 init failed: {e}")
            try:
                # Fallback to DHT11
                self.sensor = adafruit_dht.DHT11(pin)
                print("✓ DHT11 sensor initialized on GPIO pin 40")
            except Exception as e2:
                print(f"✗ DHT11 init failed: {e2} - using simulated readings")
                self.sensor = None
                self.dht_available = False
    
    def read(self):
        """Read temperature and humidity from DHT sensor"""
        try:
            if self.sensor and self.dht_available:
                humidity = self.sensor.humidity
                temperature = self.sensor.temperature
                
                if humidity is not None and temperature is not None:
                    self.last_reading = {
                        'temperature': float(temperature),
                        'humidity': float(humidity),
                        'timestamp': datetime.utcnow().isoformat(),
                        'status': 'success',
                        'source': 'hardware'
                    }
                    self.last_read_time = datetime.utcnow()
                    return self.last_reading
        except RuntimeError:
            pass  # Sensor read failed
        except Exception as e:
            print(f"DHT read error: {e}")
        
        # Fall back to simulated readings
        return self.get_simulated_reading()
    
    def get_simulated_reading(self):
        """Generate simulated sensor reading"""
        # Simulate realistic warehouse temperature (18-28°C)
        base_temp = 23
        temp_variation = random.uniform(-2, 2)
        temperature = base_temp + temp_variation
        
        # Simulate realistic humidity (40-70%)
        base_humidity = 55
        humidity_variation = random.uniform(-5, 5)
        humidity = max(30, min(80, base_humidity + humidity_variation))
        
        self.last_reading = {
            'temperature': float(round(temperature, 1)),
            'humidity': float(round(humidity, 1)),
            'timestamp': datetime.utcnow().isoformat(),
            'status': 'success',
            'source': 'simulated'
        }
        self.last_read_time = datetime.utcnow()
        return self.last_reading
    
    def get_cached(self):
        """Get last cached reading"""
        return self.last_reading
    
    def is_fresh(self, max_age_seconds=30):
        """Check if last reading is fresh (within max_age_seconds)"""
        if not self.last_read_time:
            return False
        age = (datetime.utcnow() - self.last_read_time).total_seconds()
        return age < max_age_seconds
    
    def cleanup(self):
        """Clean up sensor"""
        if self.sensor:
            try:
                self.sensor.deinit()
            except:
                pass

# Global sensor instance
dht_sensor = None

def initialize_dht():
    """Initialize DHT sensor globally"""
    global dht_sensor
    dht_sensor = DHTSensor()
    return dht_sensor

def get_dht_reading():
    """Get current DHT reading"""
    global dht_sensor
    if not dht_sensor:
        initialize_dht()
    
    if dht_sensor:
        reading = dht_sensor.read()
        if reading:
            return reading
        # Return cached if fresh read fails
        if dht_sensor.is_fresh():
            return dht_sensor.get_cached()
    
    # Return default if nothing else works
    return {
        'temperature': 23.5,
        'humidity': 55.0,
        'timestamp': datetime.utcnow().isoformat(),
        'status': 'error',
        'source': 'default'
    }

