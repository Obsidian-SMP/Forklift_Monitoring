# ==============================================================================
# File: edge_firmware/rpi_sensor/dht_daemon.py
# Description: Raspberry Pi DHT11 Environmental Telemetry Daemon.
# Purpose: Lightweight client daemon running on Raspberry Pi. Reads ambient
#          temperature and humidity from GPIO, formats structured JSON, and
#          pushes telemetry to the laptop central backend at 0.2 Hz (every 5s).
# ==============================================================================

import time
import argparse
import random
import requests
import sys

# Optional import: adafruit_dht on Raspberry Pi
try:
    import board
    import adafruit_dht
    HAS_HARDWARE_DHT = True
except ImportError:
    HAS_HARDWARE_DHT = False


def run_daemon(laptop_ip: str, port: int, pin: int, interval: float, simulate: bool):
    """
    Main loop reading DHT11 and transmitting to laptop backend.
    """
    backend_url = f"http://{laptop_ip}:{port}/api/telemetry/dht"
    print("=" * 60)
    print("  Warehouse Environmental Telemetry Daemon (RPi)")
    print(f"  Target Laptop Backend : {backend_url}")
    print(f"  GPIO Pin              : GPIO {pin}")
    print(f"  Transmission Interval : {interval} seconds")
    print(f"  Simulation Mode       : {simulate or not HAS_HARDWARE_DHT}")
    print("=" * 60)

    dht_device = None
    if not simulate and HAS_HARDWARE_DHT:
        try:
            # Map common pins
            pin_attr = getattr(board, f"D{pin}", board.D4)
            dht_device = adafruit_dht.DHT11(pin_attr)
            print(f"[INIT] Initialized hardware DHT11 sensor on pin D{pin}")
        except Exception as e:
            print(f"[WARN] Failed to initialize hardware DHT11: {e}. Falling back to simulation.")
            dht_device = None

    consecutive_failures = 0

    while True:
        temperature = None
        humidity = None

        if dht_device is not None:
            try:
                temperature = dht_device.temperature
                humidity = dht_device.humidity
                consecutive_failures = 0
            except RuntimeError as e:
                # DHT sensors frequently drop frames; this is normal
                consecutive_failures += 1
                if consecutive_failures > 5:
                    print(f"[WARN] DHT11 read transient failure: {e}")
                time.sleep(2.0)
                continue
            except Exception as e:
                print(f"[ERROR] DHT11 fatal hardware error: {e}")
                time.sleep(2.0)
                continue
        else:
            # Simulation mode: Realistic indoor warehouse ambient metrics
            temperature = round(23.5 + random.uniform(-1.5, 2.0), 1)
            humidity = round(52.0 + random.uniform(-3.0, 4.0), 1)

        if temperature is not None and humidity is not None:
            payload = {
                "sensor_id": "rpi_warehouse_main",
                "temperature": float(temperature),
                "humidity": float(humidity),
                "timestamp": time.time(),
            }

            try:
                resp = requests.post(backend_url, json=payload, timeout=3.0)
                if resp.status_code == 200:
                    print(f"[{time.strftime('%X')}] TX OK -> Temp: {temperature:.1f}°C, Humidity: {humidity:.1f}%")
                else:
                    print(f"[{time.strftime('%X')}] HTTP {resp.status_code}: {resp.text}")
            except requests.exceptions.RequestException as e:
                print(f"[{time.strftime('%X')}] TX Failed (Laptop offline?): {e}")

        time.sleep(interval)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Raspberry Pi DHT11 Telemetry Daemon")
    parser.add_argument("--laptop-ip", type=str, default="192.168.1.50", help="IP address of the laptop backend")
    parser.add_argument("--port", type=int, default=5000, help="Backend port (default: 5000)")
    parser.add_argument("--pin", type=int, default=4, help="Raspberry Pi GPIO Pin (default: 4)")
    parser.add_argument("--interval", type=float, default=5.0, help="Transmission interval in seconds")
    parser.add_argument("--simulate", action="store_true", help="Force synthetic simulation data")

    args = parser.parse_args()
    try:
        run_daemon(args.laptop_ip, args.port, args.pin, args.interval, args.simulate)
    except KeyboardInterrupt:
        print("\nDaemon terminated by user.")
        sys.exit(0)
