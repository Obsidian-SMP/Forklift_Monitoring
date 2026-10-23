#!/usr/bin/env python3
"""Read a DHT11 sensor on Raspberry Pi GPIO 21 and stream readings to Flask."""

import argparse
import signal
import sys
import time
from datetime import datetime, timezone, timedelta

import requests

try:
    import board
    import adafruit_dht
except ImportError as exc:
    raise SystemExit(
        "Missing Raspberry Pi DHT dependencies. Install "
        "adafruit-blinka, adafruit-circuitpython-dht, and requests."
    ) from exc


IST = timezone(timedelta(hours=5, minutes=30))
DEFAULT_INTERVAL_SECONDS = 3.0
SENSOR_ID = "dht11_gpio21"


def read_sensor(sensor):
    """Read one physical DHT11 sample, returning None if it is invalid."""
    try:
        temperature = sensor.temperature
        humidity = sensor.humidity
    except RuntimeError as exc:
        print(f"DHT read failed; no reading sent: {exc}", file=sys.stderr)
        return None
    except Exception as exc:
        print(f"DHT hardware error; no reading sent: {exc}", file=sys.stderr)
        return None

    if temperature is None or humidity is None:
        print("DHT returned an empty reading; no reading sent", file=sys.stderr)
        return None

    return {
        "temperature": float(temperature),
        "humidity": float(humidity),
        "sensor_id": SENSOR_ID,
        "timestamp": datetime.now(IST).isoformat(),
    }


def stream_readings(backend_url, interval_seconds):
    """Continuously read the sensor and POST successful samples to Flask."""
    sensor = adafruit_dht.DHT11(board.D21)
    stop_requested = False

    def request_stop(signum, frame):
        nonlocal stop_requested
        stop_requested = True

    signal.signal(signal.SIGINT, request_stop)
    signal.signal(signal.SIGTERM, request_stop)

    try:
        print(f"Streaming {SENSOR_ID} readings to {backend_url}")
        while not stop_requested:
            reading = read_sensor(sensor)
            if reading is not None:
                try:
                    response = requests.post(
                        backend_url,
                        json=reading,
                        timeout=5,
                    )
                    response.raise_for_status()
                    print(
                        f"Sent {reading['temperature']:.1f}°C, "
                        f"{reading['humidity']:.1f}% RH"
                    )
                except requests.RequestException as exc:
                    print(
                        f"Backend upload failed; reading not persisted: {exc}",
                        file=sys.stderr,
                    )

            stop_requested = stop_requested or _sleep_with_stop(
                interval_seconds,
                lambda: stop_requested,
            )
    finally:
        sensor.exit()
        print("DHT stream stopped")


def _sleep_with_stop(seconds, is_stopped):
    """Sleep in short intervals so SIGINT/SIGTERM can stop promptly."""
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if is_stopped():
            return True
        time.sleep(min(0.25, deadline - time.monotonic()))
    return is_stopped()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--backend-url",
        required=True,
        help="Full ingestion URL, e.g. http://10.70.196.238:5000/api/sensors/environment",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=DEFAULT_INTERVAL_SECONDS,
        help=f"Seconds between readings (default: {DEFAULT_INTERVAL_SECONDS})",
    )
    args = parser.parse_args()

    if args.interval <= 0:
        parser.error("--interval must be greater than zero")

    stream_readings(args.backend_url, args.interval)


if __name__ == "__main__":
    main()