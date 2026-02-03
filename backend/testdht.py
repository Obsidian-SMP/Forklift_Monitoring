#!/usr/bin/env python3
"""
DHT11 Sensor Test Script
Tests if adafruit-circuitpython-dht library is working with GPIO pin 21
"""

import time
import sys

print("="*60)
print("DHT11 Sensor Test (GPIO Pin 21 / Physical Pin 40)")
print("="*60)
print()

# Test 1: Check if libraries are installed
print("Test 1: Checking library installation...")
try:
    import board
    print("✓ board library imported")
except ImportError as e:
    print(f"✗ board library not found: {e}")
    print("\nInstall with: sudo pip3 install adafruit-blinka")
    sys.exit(1)

try:
    import adafruit_dht
    print("✓ adafruit_dht library imported")
except ImportError as e:
    print(f"✗ adafruit_dht library not found: {e}")
    print("\nInstall with: sudo pip3 install adafruit-circuitpython-dht")
    sys.exit(1)

print()

# Test 2: Initialize DHT11 sensor
print("Test 2: Initializing DHT11 sensor on GPIO 21...")
try:
    dht_device = adafruit_dht.DHT11(board.D21)
    print("✓ DHT11 sensor initialized")
except Exception as e:
    print(f"✗ Failed to initialize sensor: {e}")
    sys.exit(1)

print()

# Test 3: Read sensor (try 5 times)
print("Test 3: Reading sensor data (5 attempts)...")
print("Note: DHT11 requires 2-3 seconds between reads\n")

success_count = 0
for i in range(5):
    try:
        print(f"Attempt {i+1}/5...", end=" ")
        
        temperature = dht_device.temperature
        humidity = dht_device.humidity
        
        if temperature is not None and humidity is not None:
            print(f"✓ Success!")
            print(f"   Temperature: {temperature}°C")
            print(f"   Humidity: {humidity}%")
            success_count += 1
        else:
            print("✗ Got None values")
        
    except RuntimeError as e:
        # DHT sensors can be finicky, RuntimeError is normal
        print(f"✗ RuntimeError: {e}")
    except Exception as e:
        print(f"✗ Error: {e}")
    
    # Wait 3 seconds between reads
    if i < 4:
        time.sleep(3)

print()
print("="*60)
print(f"Test Results: {success_count}/5 successful reads")

if success_count >= 3:
    print("✓ DHT11 sensor is working properly!")
    print("\nYou can now use this sensor in your application.")
elif success_count >= 1:
    print("⚠ DHT11 sensor partially working - check wiring")
    print("\nVerify:")
    print("  - VCC connected to 3.3V or 5V")
    print("  - GND connected to ground")
    print("  - DATA connected to GPIO 21 (Physical pin 40)")
    print("  - 10kΩ pull-up resistor between DATA and VCC (recommended)")
else:
    print("✗ DHT11 sensor not responding")
    print("\nTroubleshooting:")
    print("  1. Check wiring connections")
    print("  2. Verify sensor is DHT11 (not DHT22)")
    print("  3. Try different GPIO pin")
    print("  4. Check if sensor is damaged")

print("="*60)

# Cleanup
dht_device.exit()
