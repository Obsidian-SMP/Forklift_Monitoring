# Test Files

This folder contains all testing scripts, validation tools, and benchmark utilities.

## Shell Scripts

- `test_camera_api.sh` - Test ESP32-CAM API endpoints
- `test_position_detection.sh` - Test BLE RSSI positioning system
- `test_realtime_dht.sh` - Test DHT11 temperature/humidity sensor
- `test_rssi_system.sh` - Test RSSI data collection
- `calibrate.sh` - Gateway calibration tool

## Python Scripts

- `benchmark_detection.py` - Benchmark AI object detection performance
- `validate_model.py` - Validate YOLO model
- `validate_dual_model.py` - Validate dual model setup
- `implement_phase1.py` - Phase 1 implementation script
- `testdht.py` - DHT sensor testing utility
- `test_esp32cam_endpoint.py` - Test ESP32-CAM endpoints

## Usage

Run scripts from the project root directory:
```bash
cd /home/rpi/warehouse_iot
./test/test_camera_api.sh
python3 test/benchmark_detection.py
```
