# 🏭 Warehouse IoT & Forklift Management System (Revised Version)

> High-performance, clean-slate implementation designed for laptop deployment, integrating real-time BLE/IMU sensor fusion, YOLOv8 vision intelligence with ROI masking, $M/N-K$ load/unload state machines, interactive polygon danger zones, and in-dashboard live telemetry logging.

---

## 📌 Architecture & Design Highlights

- **Deployment Target**: Laptop (Multicore x86_64, 16GB RAM) serving as Central Edge Server & Processing Station.
- **Video & Vision Pipeline**: Single-pass MJPEG stream consumer on laptop RAM (`app/services/camera_stream.py`) + YOLOv8n object detector with **Region of Interest (ROI) Pallet Masking** (Paper 3) + **$M/N-K$ Sliding Window Load/Unload Decision State Machine** (Zhao et al., IEEE JIOT 2020) eliminating duplicate SKU storms.
- **Positioning Engine**: In-memory ring buffer for RSSI signals (`SignalRingBuffer`) + **Unified Incenter Trilateration** (Park & Lee, IEEE 2021) + **Fused EKF with IMU Zero-Velocity Update (ZUPT)** (Kereyev et al., IEEE 2021).
- **Safety & Geofencing**: Persisted arbitrary polygon danger zones evaluated via canonical Ray-Casting algorithm (`app/safety/geofence.py`) + LSM6DS3 IMU impact/collision detector (`app/safety/impact_detector.py`) triggering on shocks $>5.0g$.
- **Live Observability (Option A)**: In-Dashboard live log viewer & WebSocket event bus (`system_log`) paired with disk-rotating log files (`logs/system.log`), with zero blocking console `print()` spam.
- **Inventory Ledger**: Real-time stock counting, verified pickup $(x_{pick}, y_{pick})$ and drop-off $(x_{drop}, y_{drop})$ coordinates audit ledger (Paper 4 / Paper 5).

---

## 📋 Comprehensive Implementation Status & Deliverables

### ✅ Phase 0: Hardware Connections & Telemetry Architecture
- [x] Architectural design: ESP32-CAM single-direction stream consumer on laptop RAM buffer.
- [x] Zero-conflict BLE advertisement payload for Arduino Nano 33 IoT (beacon + IMU data encoding).
- [x] Multi-source network routing on port 5000 (Phone gateways, RPi DHT11, ESP32-CAM).
- [x] Decision: In-dashboard real-time log viewer (Option A) + background rotating file logging.
- [x] **Mobile Gateway Overhaul**:
  - Live Raw RSSI transmission at 10 Hz to laptop backend (eliminates 1.5–2.5s moving average trilateration phase lag).
  - Configurable on-phone smoothing switch (Raw vs Smoothed Moving Average).
  - High-contrast Material 3 Dark HUD with real-time dBm readout, color-coded signal strength meter, packet hit rate, and decoded 3-axis IMU acceleration.


---

### ✅ Phase 1: Backend Foundation & Clean Domain Models
- [x] Requirements specification (`backend/requirements.txt`) with modern, stable dependencies.
- [x] Central application configuration (`backend/app/core/config.py`) supporting environment overrides.
- [x] High-performance structured logging engine (`backend/app/core/logger.py`) with memory ring buffer & WebSocket broadcaster.
- [x] SQLite database setup (`backend/app/core/database.py`) with WAL mode, 64MB cache, and 10s busy timeout.
- [x] Domain Models (`backend/app/models/`):
  - [x] `WarehouseZone`: Polygon danger/loading/storage zones with database persistence.
  - [x] `Forklift`: Telemetry, operational status (`idle`, `carrying`, `maintenance`), battery gauge.
  - [x] `ForkliftTrack`: Periodic coordinate breadcrumbs for path replay.
  - [x] `InventoryItem`: SKU, category, current zone/shelf, quantity, status (`in_stock`, `in_transit`, `dispatched`).
  - [x] `InventoryTransaction`: Audit log tracking pickup coordinates, drop-off coordinates, forklift ID, and timestamps.
  - [x] `SafetyAlert`: Zone breach alarms, collision/impact alerts, temperature/humidity threshold violations.
  - [x] `SensorReading`: DHT11 environmental metrics.
  - [x] `GatewayNode` & `SystemSetting`: Phone BLE gateway positions and persistent settings.

---

### ✅ Phase 2: High-Speed Positioning Engine & Sensor Fusion
- [x] In-memory ring buffer (`backend/app/positioning/signal_buffer.py`) for thread-safe gateway RSSI & IMU ingestion.
- [x] Unified Incenter Trilateration (`backend/app/positioning/trilateration.py`) based on Park & Lee (IEEE 2021).
- [x] Extended Kalman Filter with IMU Fusion (`backend/app/positioning/ekf.py`) supporting Zero-Velocity Updates (ZUPT).
- [x] Background positioning coordinator (`backend/app/positioning/engine.py`) broadcasting smooth coordinates over WebSockets at 5 Hz and throttled DB breadcrumbs at 1 Hz.

---

### ✅ Phase 3: Camera Pipeline & Computer Vision State Machine
- [x] Non-blocking ESP32-CAM stream consumer (`backend/app/services/camera_stream.py`) with RAM frame buffer.
- [x] YOLOv8 Worker (`backend/app/vision/yolo_worker.py`) with Region of Interest (ROI) pallet masking (Paper 3).
- [x] $M/N-K$ Sliding Window Load/Unload State Machine (`backend/app/vision/load_state_machine.py`) based on Zhao et al. (IEEE JIOT 2020) eliminating duplicate detection storms.
- [x] Automated stock ledger updating on verified pick and drop events with exact coordinates.

---

### ✅ Phase 4: Safety Engine & Danger Zone Enforcement
- [x] Ray-Casting Point-in-Polygon Geofence Evaluator (`backend/app/safety/geofence.py`).
- [x] IMU Collision & Vibration Anomaly Detector (`backend/app/safety/impact_detector.py`) for shocks $>5.0g$.
- [x] Environmental excursion alarm checker (`backend/app/safety/environmental.py`) for temperature & humidity.
- [x] Safety package exports (`backend/app/safety/__init__.py`).

---

### ✅ Phase 5: REST API & WebSocket Real-Time Gateway
- [x] Telemetry ingestion endpoints (`backend/app/api/telemetry_routes.py`) for BLE gateways and DHT11.
- [x] Forklift asset endpoints (`backend/app/api/forklift_routes.py`) for live status and historical breadcrumb trails.
- [x] Geofence zone CRUD endpoints (`backend/app/api/zone_routes.py`) for arbitrary polygon zones.
- [x] Inventory & audit trail endpoints (`backend/app/api/inventory_routes.py`).
- [x] Camera relay endpoints (`backend/app/api/camera_routes.py`) for browser MJPEG streaming and snapshots.
- [x] In-Dashboard Live Log Viewer endpoints (`backend/app/api/log_routes.py`) with filtering and export.
- [x] Safety alert endpoints (`backend/app/api/alert_routes.py`) with acknowledgement workflow.
- [x] Gateway configuration endpoints (`backend/app/api/gateway_routes.py`).
- [x] Backend entrypoint (`backend/run.py`) with SocketIO server, default asset bootstrap, and graceful shutdown.

---

### ✅ Phase 6: Edge Firmware (Arduino, ESP32, RPi, Android)
- [x] ESP32-CAM firmware (`edge_firmware/esp32_cam/esp32_cam_streamer.ino`): dedicated stream-only video server on port 80.
- [x] Arduino Nano 33 IoT firmware (`edge_firmware/arduino_nano/ble_beacon_imu.ino`): BLE beacon + IMU acceleration encoding in Manufacturer Data.
- [x] Raspberry Pi daemon (`edge_firmware/rpi_sensor/dht_daemon.py`): DHT11 reader pushing telemetry to laptop backend.
- [x] Android Gateway APK source code (`edge_firmware/android_gateway/`):
  - `MainActivity.kt`: Industrial dashboard with real-time RSSI HUD, signal strength meter, packet counters, hit rate, and decoded IMU telemetry.
  - `GatewayScannerService.kt`: Continuous low-latency BLE scanner decoding IMU manufacturer data and pushing 10 Hz telemetry to laptop backend.
  - `SettingsManager.kt`: Persistent SharedPreferences for Gateway Anchor ID, Laptop IP, Port, Beacon Filter, and Transmit Mode (Raw/Smoothed).
  - `res/layout/activity_main.xml`: Card-based Material 3 HUD layout.
  - `res/values/themes.xml`, `colors.xml`, `strings.xml`: Dark slate color tokens and Material 3 theme.
  - `build.gradle`, `settings.gradle`, `app/build.gradle`: Android Studio standard build system (compileSdk 34, minSdk 26).
  - `AndroidManifest.xml`: Permissions for BLE scan/connect without location suppression (`neverForLocation` omitted), and foreground service declarations.
- [x] Setup and flashing documentation (`edge_firmware/README.md`).

---

### ✅ Phase 7: Modern React Dashboard (Frontend)
- [x] React 18 + Vite + TypeScript + Tailwind CSS setup (`frontend/`).
- [x] Real-time WebSocket service layer (`frontend/src/services/socket.ts`).
- [x] REST API client (`frontend/src/services/api.ts`).
- [x] Interactive 2D Warehouse Canvas (`frontend/src/components/WarehouseCanvas.tsx`) with 60 FPS `lerp` smoothing, heading vectors, and click-to-draw polygon zone creation.
- [x] Interactive Polygon Danger Zone editor modal (`frontend/src/components/ZoneEditorModal.tsx`).
- [x] Live Camera Feed with visual ROI overlay (`frontend/src/components/LiveCameraFeed.tsx`).
- [x] Forklift Telemetry & Status card (`frontend/src/components/ForkliftTelemetryCard.tsx`).
- [x] IMU Vibration & Collision gauge (`frontend/src/components/VibrationGauge.tsx`).
- [x] Environmental Climate widget (`frontend/src/components/EnvironmentalWidget.tsx`).
- [x] Inventory Ledger & Geospatial Audit table (`frontend/src/components/InventoryLedger.tsx`).
- [x] **In-Dashboard Live Log Viewer & Filter terminal** (`frontend/src/components/LiveLogViewer.tsx`) fulfilling **Option A**.
- [x] Safety Alerts slide-over drawer (`frontend/src/components/SafetyAlertsDrawer.tsx`).
- [x] Responsive dark-mode dashboard shell (`frontend/src/App.tsx`).
- [x] Production build validation: Vite bundled cleanly in 5.12s with 0 errors.

---

### ✅ Phase 8: Verification & End-to-End Simulation
- [x] Automated system test suite (`backend/tests/verify_system.py`).
- [x] Verified **7/7 tests passing**:
  1. SQLite WAL mode database engine.
  2. Unified Incenter Trilateration ($<0.15\text{m}$ error).
  3. Fused EKF with Zero-Velocity Update (ZUPT).
  4. Ray-Casting Point-in-Polygon Geofence breach alarm.
  5. LSM6DS3 IMU collision shock detector ($>5.0g$).
  6. $M/N-K$ load/unload state transitions with inventory synchronization.
  7. In-Dashboard live log ring buffer streaming.

---

## 🚀 Quickstart Guide: Running Locally on Laptop

### 1. Launch Central Backend (Terminal 1)
```powershell
cd d:\sam\Projects\Major_Project\Project\Revised_Version\backend
python run.py
```
*Backend runs on `http://localhost:5000` with WebSocket server and background engines.*

### 2. Launch Modern React Dashboard (Terminal 2)
```powershell
cd d:\sam\Projects\Major_Project\Project\Revised_Version\frontend
npm run dev
```
*Dashboard opens at `http://localhost:3000` with live WebSocket connection.*

### 3. Run Automated System Test Suite
```powershell
cd d:\sam\Projects\Major_Project\Project\Revised_Version\backend
python tests/verify_system.py
```

---

*Last Updated*: 2026-10-24 | All architectural phases completed and verified.
