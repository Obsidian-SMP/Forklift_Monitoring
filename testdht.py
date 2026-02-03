#!/usr/bin/env python3
"""
Test DHT11 Sensor with Adafruit Library
Tests if the DHT11 sensor on GPIO 21 (Physical pin 40) is working
"""

import time

try:
    import board
    import adafruit_dht
    print("✓ DHT libraries imported successfully")
except ImportError as e:
    print(f"✗ Failed to import DHT libraries: {e}")
    print("\nInstall with:")
    print("  sudo pip3 install adafruit-circuitpython-dht")
    print("  sudo apt-get install libgpiod2")
    exit(1)

print("\n" + "="*60)
print("DHT11 Sensor Test - GPIO 21 (Physical Pin 40)")
print("="*60)

# Initialize DHT11
try:
    dht_device = adafruit_dht.DHT11(board.D21)
    print("✓ DHT11 initialized on GPIO 21")
except Exception as e:
    print(f"✗ Failed to initialize DHT11: {e}")
    exit(1)

print("\nReading sensor (this may take a few attempts)...\n")
print("⏱️  Timeout per reading: 5 seconds (will skip if sensor doesn't respond)\n")

# Try to read sensor 10 times with timeout
success_count = 0
import signal

def timeout_handler(signum, frame):
    raise TimeoutError("Sensor read timeout")

for i in range(10):
    try:
        # Set 5-second timeout for each reading attempt
        signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(5)
        
        temperature = dht_device.temperature
        humidity = dht_device.humidity
        
        signal.alarm(0)  # Cancel alarm
        
        if temperature is not None and humidity is not None:
            success_count += 1
            print(f"✓ Reading #{i+1}: Temperature: {temperature}°C, Humidity: {humidity}%")
        else:
            print(f"⚠ Reading #{i+1}: No data (sensor needs time between reads)")
            
    except TimeoutError:
        signal.alarm(0)
        print(f"⏱️  Reading #{i+1}: Timeout - sensor not responding")
    except RuntimeError as error:
        signal.alarm(0)
        # DHT sensors can be finicky, keep going
        print(f"⚠ Reading #{i+1}: {error.args[0]}")
    except Exception as error:
        signal.alarm(0)
        print(f"✗ Reading #{i+1}: Unexpected error - {error}")
    
    # Wait 2 seconds between readings (DHT11 requirement)
    if i < 9:  # Don't wait after last reading
        time.sleep(2)

print("\n" + "="*60)
print(f"Test Complete: {success_count}/10 successful readings")
if success_count > 5:
    print("✓ DHT11 sensor is working properly!")
elif success_count > 0:
    print("⚠ DHT11 sensor is working but unstable (check connections)")
else:
    print("✗ DHT11 sensor is NOT responding")
    print("\n🔧 Troubleshooting:")
    print("  1. Check wiring:")
    print("     - VCC (red) → Physical Pin 1 (3.3V)")
    print("     - GND (black) → Physical Pin 6 or 9 (GND)")
    print("     - DATA (yellow) → Physical Pin 40 (GPIO21/BCM21)")
    print("  2. Verify it's DHT11 (blue sensor), not DHT22")
    print("  3. Add 10kΩ pull-up resistor between DATA and VCC")
    print("  4. Try DHT22 if you have the wrong sensor:")
    print("     Edit line 33: adafruit_dht.DHT11 → adafruit_dht.DHT22")
    print("\n💡 Note: If sensor isn't connected, backend will use simulated data")
print("="*60)

# Cleanup
try:
    dht_device.exit()
except:
    pass
