# 📡 Edge Firmware & Hardware Setup Guide

> Comprehensive instructions for deploying the 4 edge nodes in the Warehouse IoT system.

---

## 1. 📷 ESP32-CAM (AI-Thinker) Video Streamer
- **File**: `esp32_cam/esp32_cam_streamer.ino`
- **Role**: Dedicated MJPEG video streaming server running on Port 80.
- **Key Enhancements**:
  - Removed secondary HTTP POST loops that previously starved the camera DMA buffer.
  - Set resolution to **SVGA (800x600)** in PSRAM with dual frame buffers for high YOLO detection accuracy.
  - Disabled Wi-Fi modem sleep (`WiFi.setSleep(false)`) to guarantee a smooth, low-latency video feed.
- **Setup**:
  1. Open `esp32_cam_streamer.ino` in Arduino IDE.
  2. Select Board: **AI Thinker ESP32-CAM**.
  3. Update `ssid` and `password` with your warehouse Wi-Fi network.
  4. Upload with a FTDI programmer (connect `GPIO 0` to `GND` during flashing).
  5. Open Serial Monitor at 115200 baud to note the assigned IP address (e.g., `http://192.168.1.100`).
  6. Set `ESP32_STREAM_URL=http://192.168.1.100:80/` in the laptop backend `.env` file.

---

## 2. 🧭 Arduino Nano 33 IoT (BLE Beacon + IMU Vibration)
- **File**: `arduino_nano/ble_beacon_imu.ino`
- **Role**: Forklift tracking beacon and real-time collision/vibration monitor.
- **Key Architectural Fix**:
  - **Solved the single-role dilemma**: Previously, acting as a BLE peripheral blocked IMU reads, and connection-oriented GATT led to frequent disconnection freezes.
  - **Solution**: Reads onboard LSM6DS3 3-axis accelerometer ($a_x, a_y, a_z$) every 100ms and encodes acceleration components and magnitude $|a|$ directly into the **BLE Manufacturer Advertising Data payload** (`Company ID: 0xFFFF`).
  - Scanning Android phone gateways receive both the **RSSI signal strength** and the **instantaneous acceleration** in a single scan packet without establishing a BLE connection!
- **Setup**:
  1. Open `ble_beacon_imu.ino` in Arduino IDE.
  2. Install libraries: `ArduinoBLE` and `Arduino_LSM6DS3`.
  3. Select Board: **Arduino NANO 33 IoT**.
  4. Flash firmware via USB.
  5. Mount securely on the forklift chassis.

---

## 3. 🌡️ Raspberry Pi 4 (DHT11 Ambient Telemetry)
- **File**: `rpi_sensor/dht_daemon.py`
- **Role**: Ambient temperature and humidity monitoring daemon.
- **Workflow**:
  - Reads DHT11 on GPIO 4 every 5 seconds.
  - Formats JSON payload and POSTs to `http://<LAPTOP_IP>:5000/api/telemetry/dht`.
- **Setup on Raspberry Pi**:
  ```bash
  # Install required libraries
  pip3 install requests adafruit-circuitpython-dht

  # Launch the daemon targeting the laptop's Wi-Fi IP
  python3 dht_daemon.py --laptop-ip 192.168.1.50 --port 5000 --pin 4
  ```

---

## 4. 📱 Android Phone BLE Gateways (Industrial HUD App)
- **Directory**: `android_gateway/`
- **Role**: Fixed warehouse anchors that continuously scan for the forklift's BLE beacon and forward RSSI + IMU acceleration to the laptop backend.
- **Key Enhancements Over Legacy App**:
  - **Material 3 Dark Slate Theme**: High-contrast industrial UI with dedicated signal HUD cards, progress bars, and status badges.
  - **Live Raw RSSI by Default**: Sends instantaneous raw RSSI upstream at 10 Hz directly into the laptop's EKF positioning engine, eliminating the 1.5–2.5s phase lag that previously caused position jumping.
  - **Configurable Smoothing Switch**: User can toggle between **Live Raw RSSI** and **Smoothed Moving Average** (window of 5) on the fly.
  - **Live IMU Acceleration Readout**: Real-time on-screen telemetry showing $a_x, a_y, a_z$ and total vector magnitude $|a|$ decoded from the Arduino advertising packet.
  - **Upstream Latency & HTTP Status Gauge**: Displays live round-trip latency in milliseconds and HTTP 200 OK / error badges.
  - **SDK 34 & Android 12–14 Compliant**: Declares explicit Bluetooth Scan permissions without the `neverForLocation` restriction so that indoor positioning beacons are discovered accurately.
- **How to Build & Deploy with Android Studio**:
  1. Open Android Studio.
  2. Select **Open** and choose the `Revised_Version/edge_firmware/android_gateway` directory.
  3. Wait for Gradle Sync to complete (uses Android Gradle Plugin 8.2.2 with Kotlin 1.9.22).
  4. Connect your phone via USB with USB Debugging enabled, or build an APK via **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
  5. Install and launch the **Warehouse Gateway** app.
- **Phone Setup in Warehouse**:
  1. Mount 3 or 4 phones at warehouse corners (e.g. $(0.5, 0.5)$, $(9.5, 0.5)$, $(9.5, 9.5)$, $(0.5, 9.5)$).
  2. Configure:
     - Anchor ID: `phone_1`, `phone_2`, `phone_3`, `phone_4`
     - Laptop IP: e.g. `192.168.1.50`, Port: `5000`
     - Target Beacon: `forklift_1`
     - Mode: `Live Raw RSSI`
  3. Tap **START GATEWAY SCANNER**.

