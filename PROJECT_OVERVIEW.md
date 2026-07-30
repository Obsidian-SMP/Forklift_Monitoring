# 🏭 Forklift Monitoring System — In-Depth Project Overview

> A comprehensive technical walkthrough of every layer of the system: hardware, firmware, backend, frontend, protocols, and data flow.

---

## Table of Contents

1. [What the System Does](#1-what-the-system-does)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Hardware Components](#3-hardware-components)
4. [Firmware (Embedded Code)](#4-firmware-embedded-code)
5. [Communication Protocols](#5-communication-protocols)
6. [Backend — Flask API Server](#6-backend--flask-api-server)
7. [Backend — Database Layer](#7-backend--database-layer)
8. [Backend — Services & Background Workers](#8-backend--services--background-workers)
9. [Backend — REST API Endpoints](#9-backend--rest-api-endpoints)
10. [Backend — Real-Time Layer (WebSocket / SSE)](#10-backend--real-time-layer-websocket--sse)
11. [Frontend — React Web Application](#11-frontend--react-web-application)
12. [Frontend — Pages & Components](#12-frontend--pages--components)
13. [Positioning Pipeline — RSSI → Position](#13-positioning-pipeline--rssi--position)
14. [AI Object-Detection Pipeline](#14-ai-object-detection-pipeline)
15. [Alert & Notification System](#15-alert--notification-system)
16. [End-to-End Data Flows](#16-end-to-end-data-flows)
17. [Configuration & Environment Variables](#17-configuration--environment-variables)
18. [Key Design Decisions & Trade-offs](#18-key-design-decisions--trade-offs)

---

## 1. What the System Does

The Forklift Monitoring System is a **full-stack IoT solution** for smart warehouse management deployed on a **Raspberry Pi 4**. It simultaneously:

| Capability | Technology Used |
|---|---|
| Track forklift position in real-time | BLE RSSI + WLS trilateration + Extended Kalman Filter |
| Stream live camera video from forklifts | ESP32-CAM → MJPEG over HTTP |
| Detect and catalog warehouse objects via AI | YOLOv8n custom model |
| Monitor warehouse temperature & humidity | DHT11 on RPi GPIO |
| Detect excessive forklift vibration | Arduino Nano 33 IoT IMU |
| Deliver real-time UI updates | WebSocket (Socket.io) |
| Send SMS / WhatsApp / Email alerts | Twilio + SMTP |

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        HARDWARE LAYER                                │
│                                                                      │
│  [Arduino Nano 33 IoT]        [ESP32-CAM]       [DHT11 on RPi GPIO] │
│  - BLE beacon advertising     - MJPEG stream    - Temperature       │
│  - IMU vibration data         - Image upload    - Humidity          │
│           │                        │                    │           │
│  [Android Phones x3-6]             │                    │           │
│  - BLE scanning (RSSI)             │                    │           │
│           │                        │                    │           │
└───────────┼────────────────────────┼────────────────────┼───────────┘
            │ HTTP POST /api/rssi    │ HTTP POST          │ GPIO read
            │                        │ /api/forklift/1/image           
            ▼                        ▼                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                 RASPBERRY PI 4 — BACKEND (Flask :5000)               │
│                                                                      │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │
│  │  REST API        │  │  SocketIO Server │  │  MQTT Client       │  │
│  │  (10 Blueprints) │  │  (real-time push)│  │  (paho-mqtt)       │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬─────────┘  │
│           │                     │                        │           │
│  ┌────────▼────────────────────▼────────────────────────▼─────────┐  │
│  │                     Business Logic Services                      │  │
│  │  PositioningEngine  AIDetectionWorker  DHTBackgroundService      │  │
│  │  AlertsService      NotificationService  MQTTService             │  │
│  └────────────────────────────┬────────────────────────────────────┘  │
│                               │                                      │
│  ┌────────────────────────────▼────────────────────────────────────┐  │
│  │            SQLite Database (WAL mode, Peewee ORM)                │  │
│  │  forklifts · forklift_locations · ble_rssi_data                  │  │
│  │  wifi_gateways · forklift_position_trilateration                 │  │
│  │  warehouse_sensor · vibration_data · inventory                   │  │
│  │  detected_objects · inventory_transactions · warehouse_entry     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                               │
                     WebSocket + REST
                               │
┌──────────────────────────────────────────────────────────────────────┐
│             WEB FRONTEND — React + TypeScript (:5173)                 │
│                                                                      │
│  Overview · WarehouseEnvironment · ForkliftMonitor                   │
│  PathTracking · InventoryManagement · RSSIMonitoring                 │
│  Alerts · WarehouseLayout                                            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Hardware Components

### Raspberry Pi 4 (Central Hub)
- Runs the Flask backend server
- Connects to DHT11 sensor via **GPIO pin 40 (BCM 21)**
- Acts as MQTT broker (or connects to external one on port 1883)
- Hosts both backend (port 5000) and serves the frontend (port 5173)

### ESP32-CAM (AI-Thinker with OV3660)
- Mounted on each forklift
- Captures JPEG frames every **1 second**
- POSTs raw JPEG bytes to `POST /api/forklift/{id}/image` over WiFi (HTTP)
- Simultaneously serves a live **MJPEG stream** on port 80 at `GET /`
- Uses built-in LED (GPIO 4) as a flash indicator
- Configured with: WiFi SSID/password, Raspberry Pi IP, Forklift ID

### Arduino Nano 33 IoT
- Mounted on each forklift
- **Dual role**: BLE beacon + vibration sensor
- Uses built-in **LSM6DS3 IMU** to measure 3-axis acceleration
- Advertises a custom BLE service (`UUID 19B10000-...`) named `"Forklift_1"` so mobile phones can detect it
- Sends averaged vibration readings (X, Y, Z, magnitude) to the ESP32-CAM via **Serial UART** (TX pin 1 → ESP32 GPIO 3) at 115200 baud
- Battery level (simulated) exposed as a BLE characteristic

### Android Smartphones (BLE Gateways, 3–6 units)
- Installed with a custom **Kotlin Android app** (`backend/BLE_script/ble_apk.kt`)
- Run as foreground services scanning for BLE advertisements from Arduino
- On each scan result: extract the **RSSI value** and POST it to `POST /api/rssi` via Retrofit/OkHttp
- Positioned at fixed, known locations around the warehouse (corners / midpoints)
- The gateway ID (e.g. `phone_1`, `phone_2`) maps to a physical position configured in `gateway_config.py`

### DHT11 Temperature & Humidity Sensor
- Connected directly to the Raspberry Pi GPIO
- Read by the backend every **60 seconds** using `adafruit-circuitpython-dht`
- Data saved to the `warehouse_sensor` table and broadcast via WebSocket

---

## 4. Firmware (Embedded Code)

### `esp32_cam_forklift.ino` (ESP32-CAM)
| Feature | Detail |
|---|---|
| Camera init | `esp_camera_init()` with PSRAM-aware config, OV3660 sensor |
| Frame format | JPEG, VGA (640×480) with quality 15 (optimised for speed) |
| WiFi | `WiFi.begin(ssid, password)` with `WiFi.setSleep(false)` |
| Image upload | `HTTPClient.POST()` of raw JPEG bytes every 1 second to `http://{RPI_IP}:5000/api/forklift/{FORKLIFT_ID}/image` |
| MJPEG server | Custom ESP-IDF `httpd` server on port 80, handler at `/`, multipart boundary `123456789000000000000987654321` |
| Headers sent | `Content-Type: image/jpeg`, `X-Forklift-ID: forklift_1` |

### `backend/arduino_nano/ble_beacon.ino` (Arduino Nano 33 IoT)
| Feature | Detail |
|---|---|
| BLE service UUID | `19B10000-E8F2-537E-4F6C-D104768A1214` |
| BLE name | `"Forklift_1"` (used by gateway phones to filter scans) |
| IMU sampling | `IMU.begin()` reads `AccX, AccY, AccZ` at ~100 Hz loop |
| Averaging | 50 samples averaged before broadcasting |
| Serial output | JSON string `{"forklift_id":"forklift_1","accel_x":…,"accel_y":…,"accel_z":…,"magnitude":…}` at 115200 baud |
| BLE update | Every 500 ms; also updates BLE characteristics for vibration X/Y/Z |

### `backend/esp32cam/vibration_gateway.ino` (ESP32-CAM as Serial bridge)
- Receives vibration JSON from Arduino Nano via Serial RX (GPIO 3)
- Forwards the data to the Raspberry Pi backend via HTTP POST over WiFi

### `backend/BLE_script/ble_apk.kt` (Android app)
| Class | Responsibility |
|---|---|
| `BLEScanService` | Foreground Android Service; uses `BluetoothLeScanner` with `ScanFilter` on device name `"Forklift_1"` |
| `ApiService` (Retrofit) | `POST /api/rssi` with body `{gateway_id, rssi}` |
| `MainActivity` | Configures gateway ID, backend URL, starts/stops `BLEScanService` |
- Scans continuously; on each `ScanResult` fires a coroutine to POST the RSSI
- Reports back `position.x`, `position.y`, `confidence` from the API response

---

## 5. Communication Protocols

| Protocol | Direction | Purpose |
|---|---|---|
| **HTTP/1.1 (REST)** | ESP32-CAM → RPi | POST image JPEG bytes |
| **HTTP/1.1 (REST)** | Android → RPi | POST RSSI reading |
| **HTTP/1.1 (REST)** | Frontend ↔ RPi | All API calls (fetch-based) |
| **MJPEG over HTTP** | ESP32-CAM → Browser (proxied via RPi) | Live video stream |
| **MQTT (pub/sub)** | Arduino/sensors → RPi | Forklift telemetry, GPS, vibration, environment |
| **BLE Advertising** | Arduino → Android phones | RSSI beacon signal |
| **Serial UART (115200)** | Arduino Nano → ESP32-CAM | Vibration data forwarding |
| **WebSocket (Socket.io)** | RPi → Browser | Real-time push updates |
| **GPIO** | DHT11 → RPi | Temperature/humidity readings |

### MQTT Topic Structure
```
warehouse/environment/data          ← DHT sensor readings
warehouse/forklift/{id}/data        ← General forklift status
warehouse/forklift/{id}/gps         ← GPS/WiFi positioning
warehouse/forklift/{id}/vibration   ← Accelerometer data
warehouse/forklift/{id}/image       ← Base64 encoded camera frames
```

### WebSocket Events (Socket.io)
```
warehouse_sensor    ← DHT temperature/humidity update
forklift_location   ← Position update from MQTT GPS
forklift_status     ← Forklift status change
vibration_alert     ← Excessive vibration detected
new_detection       ← AI detected a new object
```

---

## 6. Backend — Flask API Server

**Entry point**: `backend/run.py`  
**Framework**: Flask 3.0 + Flask-SocketIO 5.3.5 (threading async mode)  
**Port**: 5000

### Application Factory (`backend/app/__init__.py`)
`create_app()` performs these steps in order:
1. Apply CORS (`flask-cors`, origin `*`)
2. Initialize SocketIO (threading mode for Python 3.13+ compatibility)
3. Initialize SQLite DB via `init_db()`
4. Create `uploads/images/` directory
5. Register 10 Flask Blueprints (see §9)
6. Start the **Positioning Engine** background thread
7. Start the **MQTT Service** and connect to broker
8. Start a **RSSI cleanup** background thread (every 5 minutes)

### Background Threads started in `run.py`
| Thread | Interval | Purpose |
|---|---|---|
| `init_ai()` | On startup | Load YOLOv8n model, start AI worker thread |
| `init_dht_background_service()` | Every 60 s | Read DHT11, save to DB |
| `cleanup_old_images()` | Every 120 s | Delete stale camera frames |
| `periodic_gc()` | Every 300 s | `gc.collect()` for RPi memory management |
| `rssi_cleanup_loop()` | Every 300 s | Delete old RSSI DB records |

### Performance Optimisations for Raspberry Pi
- `OMP_NUM_THREADS=2`, `MKL_NUM_THREADS=2` to limit CPU thread usage
- SQLite WAL mode + 64 MB cache + 10 s busy timeout
- TanStack Query on frontend configured with 30 s stale time, no retries, no refetch on window focus
- AI input image size: 416×416 (YOLOv8n-nano)
- Uploaded images compressed to 75% JPEG quality before serving

---

## 7. Backend — Database Layer

**ORM**: Peewee 3.17  
**Database**: SQLite (WAL mode) — `warehouse_iot.db`

### Tables

| Table | Model Class | Description |
|---|---|---|
| `forklifts` | `Forklift` | Forklift metadata: ID, status, battery, last_seen, is_lifting |
| `forklift_locations` | `ForkliftLocation` | GPS/WiFi position history (lat, lon, wifi_position JSON) |
| `vibration_data` | `VibrationData` | IMU readings: accel_x/y/z, magnitude, is_anomaly |
| `warehouse_sensor` | `WarehouseSensor` | DHT11 temperature & humidity readings |
| `wifi_gateways` | `WiFiGateway` | BLE gateway configs: ID, name, x/y/z position |
| `ble_rssi_data` | `BLERSSIData` | Raw RSSI readings from gateway phones |
| `forklift_position_trilateration` | `ForkliftPositionTrilateration` | Calculated positions + velocity + confidence |
| `inventory` | `Inventory` | Warehouse stock items: quantity, zone, shelf, status |
| `inventory_transactions` | `InventoryTransaction` | Pickup/dropoff/dispatch records with images |
| `detected_objects` | `DetectedObject` | AI-detected objects: type, confidence, photo_url, position |
| `warehouse_entry` | `WarehouseEntry` | Forklift entry/exit boundary events |
| `warehouse_map` | `WarehouseMap` | Warehouse layout configuration |

---

## 8. Backend — Services & Background Workers

### `PositioningEngine` (`services/positioning_engine.py`)
A background thread running at **2 Hz (every 0.5 s)** that:
1. Queries `RSSIProcessor` for smoothed RSSI from all active gateways
2. Looks up gateway XYZ coordinates from the database (cached every 10 s)
3. Calls **WLS Trilateration** to calculate raw X/Y from distances
4. Passes result through the **Extended Kalman Filter** for smoothing and velocity estimation
5. Saves the result to `forklift_position_trilateration` table

### `RSSIProcessor` (`services/rssi_processor.py`)
- Maintains a rolling buffer of the last 10 RSSI samples per gateway
- Applies **Exponential Moving Average (EMA)** smoothing (`α = 0.25`)
- Discards samples older than 10 seconds
- Converts RSSI to estimated distance using the path-loss model:
  ```
  distance = 10^((TX_POWER - RSSI) / (10 × n))
  ```
  where `TX_POWER = -64 dBm`, `n_LOS = 1.71`, `n_NLOS = 3.5`

### `WLSTrilateration` (`services/trilateration_wls.py`)
- **Weighted Least Squares** trilateration: gateways closer to the forklift (stronger RSSI) get higher weight
- Supports 2–6 gateways; degrades gracefully to bilateration with 2 gateways
- Returns `{x, y, accuracy, gateway_count, method}`

### `ExtendedKalmanFilter` (`services/ekf_filter.py`)
- State vector: `[px, py, vx, vy]` (position + velocity)
- **Constant velocity model** for prediction step
- Measurement model: direct position observation `H = [[1,0,0,0],[0,1,0,0,0,0]]`
- Process noise `Q`: 0.3 (tuned for forklift motion)
- Measurement noise `R`: 9.0 (models ~3 m RSSI error std dev)
- Outputs: smoothed X/Y position + velocity vector + speed + confidence score

### `AIDetectionWorker` (`services/ai_worker.py`)
- Loads a **custom YOLOv8n model** (`yolo_models/my_model.pt`) trained on 5 classes:
  `black_box, blue_box, bottle, ponds, red_box`
- Runs in a **separate daemon thread** with a `Queue(maxsize=10)`
- In `latest` mode: drops old frames, only processes the newest (prevents queue backup)
- On detection: draws bounding boxes with OpenCV, saves annotated JPEG to `uploads/images/`
- Creates a `DetectedObject` DB record with object ID (e.g. `red_box-001`), type, confidence, photo URL

### `MQTTService` (`services/mqtt_service.py`)
- Paho-MQTT client with unique client ID per PID to avoid Flask reloader conflicts
- Subscribes to all topics on connect
- Routes incoming messages by topic to handlers:
  - `environment/data` → `WarehouseSensor.create()` + WebSocket broadcast
  - `forklift/*/gps` → `ForkliftLocation.create()` + WebSocket broadcast
  - `forklift/*/vibration` → `VibrationData.create()`, anomaly check, conditional alert broadcast
  - `forklift/*/image` → decode Base64, save JPEG (AI processing disabled in this code path)
  - `forklift/*/data` → `Forklift.save()` + WebSocket broadcast

### `DHTBackgroundService` (`services/dht_background_service.py`)
- Reads DHT11 every 60 seconds via `adafruit-circuitpython-dht` on GPIO 21
- Saves to `WarehouseSensor` table with IST timestamp

### `AlertService` (`services/alert_service.py`)
- Threshold checks: temperature (15–30 °C), humidity (30–70 %RH), vibration magnitude (>5.0)
- Called synchronously in MQTT message handlers

### `AlertsService` (`services/alerts_service.py`)
- Generates structured alert objects by querying recent DB events:
  - Detected objects (last 1 hour)
  - Warehouse entry/exit events (last 2 hours)
  - Low-stock / out-of-stock inventory
  - Forklift zone alerts

### `NotificationService` (`services/notification_service.py`)
- **Twilio** for SMS and WhatsApp (via REST API)
- **SMTP** for HTML email (Gmail/other)
- Priority routing: info/low → email only; medium → WhatsApp + email; high → SMS + WhatsApp + email

---

## 9. Backend — REST API Endpoints

Base URL: `http://{RPi_IP}:5000`

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Simple health check |
| GET | `/api/health` | API health check |

### RSSI & Positioning (`/api/rssi`)
| Method | Path | Description |
|---|---|---|
| POST | `/api/rssi` | Submit RSSI reading from gateway phone |
| GET | `/api/rssi/setup` | Initialize gateways from `gateway_config.py` |
| GET | `/api/rssi/gateways` | List all configured gateways |
| GET | `/api/rssi/gateways/{id}` | Get specific gateway |
| PUT | `/api/rssi/gateways/{id}` | Update gateway position (drag on map) |
| GET | `/api/rssi/history` | Recent RSSI readings |
| GET | `/api/rssi/position/latest` | Latest trilaterated position (from EKF) |
| GET | `/api/rssi/position/history` | Position history for path tracking |

### Camera & Forklifts
| Method | Path | Description |
|---|---|---|
| GET | `/api/camera/forklifts` | List forklifts with camera status |
| POST | `/api/camera/{id}/register` | Register ESP32-CAM IP for forklift |
| GET | `/api/camera/{id}/stream` | Proxy MJPEG stream from ESP32-CAM |
| GET | `/api/camera/{id}/latest` | Latest uploaded image (compressed) |
| GET | `/api/camera/{id}/frame` | Single frame from ESP32-CAM |
| GET | `/api/forklift/` | List all forklifts |
| GET | `/api/forklift/{id}` | Forklift details |
| POST | `/api/forklift/{id}/image` | **Receive JPEG from ESP32-CAM** (triggers AI) |
| GET | `/api/forklift/{id}/location/current` | Latest GPS/WiFi location |
| GET | `/api/forklift/{id}/location/track` | Location history |
| GET | `/api/forklift/{id}/vibration/current` | Latest vibration reading |

### Sensors
| Method | Path | Description |
|---|---|---|
| GET | `/api/dht/reading` | Current temperature & humidity |
| GET | `/api/dht/temperature` | Temperature only |
| GET | `/api/dht/humidity` | Humidity only |
| GET | `/api/sensors/environment/history` | Historical sensor data |

### Inventory
| Method | Path | Description |
|---|---|---|
| GET | `/api/inventory` | List all inventory items |
| POST | `/api/inventory` | Add item |
| GET | `/api/inventory/detected` | AI-detected objects |
| PUT | `/api/inventory/{id}` | Update item |
| DELETE | `/api/inventory/{id}` | Delete item |
| POST | `/api/inventory/detected/{id}/flag-mismatch` | Flag location mismatch |

### Alerts & Notifications
| Method | Path | Description |
|---|---|---|
| GET | `/api/alerts` | All current alerts (filterable) |
| GET | `/api/alerts/settings` | Alert configuration |
| PUT | `/api/alerts/settings` | Update alert thresholds/channels |
| POST | `/api/alerts/send-notification` | Trigger manual notification |
| POST | `/api/alerts/test-notification` | Test a notification channel |

### Warehouse
| Method | Path | Description |
|---|---|---|
| GET | `/api/warehouse/layout` | Warehouse map configuration |
| POST | `/api/warehouse/layout` | Update layout |

### Analytics
| Method | Path | Description |
|---|---|---|
| GET | `/api/analytics/summary` | System-wide statistics |
| GET | `/api/analytics/forklifts` | Per-forklift analytics |

### Streaming (SSE)
| Method | Path | Description |
|---|---|---|
| GET | `/api/stream/events` | Server-Sent Events stream for real-time sensor data |

### Static Files
| Method | Path | Description |
|---|---|---|
| GET | `/uploads/images/{filename}` | Serve uploaded & annotated images |

---

## 10. Backend — Real-Time Layer (WebSocket / SSE)

### Socket.io (Primary real-time channel)
- Server: Flask-SocketIO on `/` namespace
- Transport: WebSocket with polling fallback
- The `broadcast_update(socketio, event, data)` utility function emits to all connected clients
- Events emitted:
  - `warehouse_sensor` — temperature/humidity update (every 60 s or on MQTT message)
  - `forklift_location` — position update from MQTT GPS data
  - `forklift_status` — forklift status change
  - `vibration_alert` — when IMU magnitude exceeds threshold
  - `new_detection` — AI detection result

### Server-Sent Events (Streaming fallback)
- `GET /api/stream/events` — text/event-stream endpoint
- Useful for browsers/clients that prefer SSE over WebSocket

---

## 11. Frontend — React Web Application

**Framework**: React 18.3 + TypeScript 5  
**Build tool**: Vite 5  
**Dev server port**: 5173  
**Key libraries**:

| Library | Purpose |
|---|---|
| React Router DOM 6 | Client-side routing |
| TanStack Query 5 | Async data fetching & caching |
| Socket.io-client 4.8 | WebSocket connection to backend |
| Recharts 2.15 | Charts for sensor history |
| Shadcn/ui + Radix UI | Accessible UI component primitives |
| Tailwind CSS 3 | Utility-first styling |
| Lucide React | Icons |

### API Layer
Two API service files exist:
- `src/api.ts` — simple `fetch`-based wrapper with console logging (used by some pages)
- `src/services/api.ts` — cleaner version used by the main pages; handles 404 gracefully for position endpoints

Both read `VITE_API_URL` from the environment (default: `http://10.136.57.165:5000/api`).

### Routes (`App.tsx`)
```
/              → Overview.tsx          (navigation home)
/environment   → WarehouseEnvironment  (DHT sensor charts)
/forklifts     → ForkliftMonitor       (camera feeds + vibration)
/inventory     → InventoryManagement   (AI-detected objects)
/tracking      → PathTracking          (canvas-based position map)
/rssi          → RSSIMonitoring        (gateway RSSI strength)
/alerts        → RealAlerts            (alert list + notification settings)
/warehouse     → WarehouseLayoutReal   (warehouse floor plan)
*              → NotFound
```

---

## 12. Frontend — Pages & Components

### `Overview.tsx`
- Navigation hub with gradient cards linking to each sub-page
- Shows the system name and a brief description

### `WarehouseEnvironment.tsx`
- Fetches `GET /api/dht/reading` on load and polls periodically
- Displays current temperature and humidity with Recharts line charts for history
- Uses Socket.io to receive `warehouse_sensor` events for live updates

### `ForkliftMonitor.tsx`
- Lists forklifts from `GET /api/camera/forklifts`
- Shows live camera feeds via `<img src="/api/camera/{id}/latest">` with auto-refresh
- `VibrationMonitor` component shows accelerometer data

### `PathTracking.tsx`
- Renders a `<canvas>` element as the warehouse floor plan
- Fetches gateways (`GET /api/rssi/gateways`) and draws them as coloured circles
- Polls `GET /api/rssi/position/latest` every second for current position
- Polls `GET /api/rssi/position/history` to draw the path trail
- Allows user to configure warehouse dimensions and draw zone boundaries
- Can overlay a warehouse background image

### `InventoryManagement.tsx`
- Queries `GET /api/inventory/detected` for AI-detected objects
- Shows annotated images with bounding boxes, object type, confidence scores
- Allows flagging location mismatches
- Supports manual inventory CRUD (`POST/PUT/DELETE /api/inventory`)

### `RSSIMonitoring.tsx`
- Displays current RSSI from each gateway in real-time
- Shows signal quality bars and gateway positions
- Allows updating gateway metadata via `PUT /api/rssi/gateways/{id}`

### `RealAlerts.tsx` / `AlertsEvents.tsx`
- Fetches `GET /api/alerts` (with optional severity/type filters)
- Displays alert list with severity badges
- Settings panel for configuring notification channels (email, SMS, WhatsApp)
- `PUT /api/alerts/settings` to save; `POST /api/alerts/test-notification` to test

### `WarehouseLayoutReal.tsx`
- SVG-based interactive warehouse floor plan
- Overlays forklift positions (live), gateway positions, and inventory zones

### Component Library
Located in `src/components/`:
- `layout/DashboardLayout.tsx` — main shell with sidebar navigation
- `dashboard/` — reusable dashboard widgets
- `DHTSensorWidget.tsx` — compact temperature/humidity card
- `VibrationMonitor.tsx` — real-time accelerometer graph
- `ui/` — Shadcn/Radix primitives (Button, Card, Dialog, etc.)

---

## 13. Positioning Pipeline — RSSI → Position

```
Android Phone (BLE scan)
    │
    │  HTTP POST /api/rssi
    │  { "gateway_id": "phone_1", "rssi": -65 }
    ▼
rssi_routes.py::receive_rssi()
    │
    ├─ Save to BLERSSIData table
    └─ engine.add_rssi_sample(gateway_id, rssi, timestamp)
                │
                ▼
        RSSIProcessor.add_sample()
        [Rolling buffer, 10 samples/gateway]
                │
                ▼  (background thread, every 0.5 s)
        PositioningEngine._positioning_loop()
                │
                ├─ Step 1: RSSIProcessor.get_all_filtered_rssi()
                │          [EMA-smoothed RSSI, drop samples >10 s old]
                │
                ├─ Step 2: RSSI → Distance
                │          distance = 10^((TX_POWER - rssi) / (10 × n))
                │
                ├─ Step 3: WLSTrilateration.calculate_position()
                │          [Weighted Least Squares: w = 1/distance²]
                │          [Returns raw x, y in meters]
                │
                ├─ Step 4: ExtendedKalmanFilter.predict() + .update()
                │          [Kalman-smoothed position + velocity estimate]
                │
                └─ Step 5: Save to ForkliftPositionTrilateration table
                           Broadcast via WebSocket to frontend
```

**Positioning accuracy**: Typically ±1–3 m in line-of-sight conditions with 4 gateways.

---

## 14. AI Object-Detection Pipeline

```
ESP32-CAM (every 1 second)
    │
    │  HTTP POST /api/forklift/{id}/image
    │  [Raw JPEG bytes, Content-Type: image/jpeg]
    ▼
forklift_routes.py::upload_image()
    │
    ├─ Save JPEG to uploads/images/{forklift_id}_{timestamp}.jpg
    └─ ai_worker.queue_image(filepath, forklift_id)
                │
                ▼  (background thread, processes queue)
        AIDetectionWorker._process_image()
                │
                ├─ YOLO(filepath, conf=0.65, iou=0.45, imgsz=416)
                │  [Custom model: black_box, blue_box, bottle, ponds, red_box]
                │
                ├─ For each detected object:
                │   ├─ Generate object_id: "{class_name}-{n:03d}"
                │   ├─ Draw bounding box + label with OpenCV
                │   ├─ Save annotated JPEG to uploads/images/{object_id}_{ts}.jpg
                │   └─ DetectedObject.create(...) in database
                │
                └─ Broadcast 'new_detection' via WebSocket
```

**Custom model classes**: `black_box`, `blue_box`, `bottle`, `ponds`, `red_box`  
**Model file**: `backend/yolo_models/my_model.pt` (YOLOv8n architecture)  
**Image cleanup**: Original frames older than 2 minutes are deleted; AI-annotated images are kept permanently.

---

## 15. Alert & Notification System

### Alert Sources
1. **Environmental alerts** — DHT11 readings outside configured thresholds (15–30 °C, 30–70 %RH)
2. **Vibration alerts** — IMU magnitude exceeds 5.0 g (configurable)
3. **Inventory alerts** — Low stock (< threshold), out of stock
4. **Detection alerts** — New AI object detection, low confidence detection
5. **Location mismatch alerts** — User-flagged inventory location errors
6. **Warehouse event alerts** — Forklift entry/exit boundary crossings

### Notification Channels (via `NotificationService`)
| Channel | Provider | Trigger Level |
|---|---|---|
| In-app (WebSocket) | Socket.io | All alerts |
| Email | SMTP (Gmail) | Low+ severity |
| WhatsApp | Twilio API | Medium+ severity |
| SMS | Twilio API | High/Critical severity |

### Alert Settings API
Configurable at runtime via `PUT /api/alerts/settings`:
- Per-type enable/disable
- Notification channel on/off
- Email/SMS recipient lists
- Low-stock threshold

---

## 16. End-to-End Data Flows

### Flow 1: Forklift Position Update (every 0.5 s)
```
Arduino Nano (BLE advertising)
  → Android phone BLE scan
  → POST /api/rssi {gateway_id, rssi}
  → RSSIProcessor (buffer + EMA)
  → WLS Trilateration (RSSI → meters → XY)
  → Extended Kalman Filter (smooth + velocity)
  → DB write (ForkliftPositionTrilateration)
  → WebSocket emit 'forklift_location'
  → PathTracking.tsx canvas update
```

### Flow 2: Camera Image & AI Detection (every 1 s)
```
ESP32-CAM (JPEG capture every 1 s)
  → POST /api/forklift/{id}/image [raw JPEG]
  → Save to uploads/images/
  → ai_worker.queue_image()
  → YOLO inference (background thread)
  → Annotated image saved
  → DetectedObject DB record
  → WebSocket emit 'new_detection'
  → InventoryManagement.tsx refresh
```

### Flow 3: Environmental Monitoring (every 60 s)
```
DHT11 on GPIO 21
  → DHTBackgroundService reads temperature + humidity
  → WarehouseSensor DB record
  → WebSocket emit 'warehouse_sensor'
  → WarehouseEnvironment.tsx chart update
  → AlertService threshold check
  → (if alert) NotificationService.send_email/sms/whatsapp()
```

### Flow 4: Vibration Monitoring
```
Arduino Nano LSM6DS3 IMU
  → Serial UART (115200 baud) to ESP32-CAM GPIO 3
  → ESP32-CAM WiFi → POST to backend (via MQTT or HTTP)
  → VibrationData DB record
  → Magnitude > threshold → WebSocket 'vibration_alert'
  → VibrationMonitor.tsx live graph
```

---

## 17. Configuration & Environment Variables

### `backend/.env`
```ini
# Flask server
HOST=0.0.0.0
PORT=5000
DEBUG=False
SECRET_KEY=dev-secret-key

# Database
DATABASE=warehouse_iot.db

# MQTT Broker
MQTT_BROKER=localhost
MQTT_PORT=1883
MQTT_USERNAME=
MQTT_PASSWORD=

# YOLO Model
YOLO_MODEL=my_model.pt
AI_CONFIDENCE=0.65
AI_INPUT_SIZE=416
AI_IOU_THRESHOLD=0.45
AI_PROCESS_EVERY_N=1
AI_QUEUE_PRIORITY=latest
IMAGE_COMPRESSION_QUALITY=75

# Alert Thresholds
TEMP_MIN=15
TEMP_MAX=30
HUMIDITY_MIN=30
HUMIDITY_MAX=70
VIBRATION_THRESHOLD=5.0

# Twilio (SMS/WhatsApp)
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_PHONE_FROM=+14155238886
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# SMTP (Email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=yourmail@gmail.com
SMTP_PASSWORD=app_password
```

### `frontend/.env`
```ini
VITE_API_URL=http://10.136.57.165:5000/api
```

### `backend/app/gateway_config.py`
- `GATEWAYS` — dictionary of gateway IDs to their XYZ positions (meters)
- `RSSI_CONFIG` — TX_POWER, path-loss exponents, EMA alpha, buffer size
- `TRILATERATION_CONFIG` — minimum gateways, update interval, EKF noise params
- `WAREHOUSE_DIMENSIONS` — physical warehouse size (default 10 m × 10 m × 3 m)

---

## 18. Key Design Decisions & Trade-offs

| Decision | Reasoning |
|---|---|
| **SQLite over PostgreSQL** | Simplicity on RPi; WAL mode handles concurrent reads/writes |
| **YOLOv8n (nano) over larger models** | Fits within RPi 4 RAM; 416×416 input keeps inference <1 s |
| **Background AI worker thread** | Non-blocking; ESP32-CAM upload receives instant 200 OK |
| **EKF over raw trilateration** | Smooths noisy RSSI, adds velocity estimation for better UX |
| **Android phones as BLE gateways** | Avoids dedicated hardware; phones are easily repositioned |
| **MQTT for forklift telemetry** | Pub/sub decouples producers (Arduino/ESP32) from backend |
| **HTTP for image upload** | Simpler than MQTT for binary payloads; reliable ACK |
| **Socket.io over raw WebSocket** | Auto-reconnect, room support, polling fallback |
| **Twilio for notifications** | Single SDK for SMS + WhatsApp; no own messaging infra needed |
| **React Query with 30 s stale time** | Reduces API load on RPi; still fresh enough for monitoring |
| **Image cleanup every 2 min** | Prevents disk exhaustion on SD card; AI detections preserved |

---

*Last updated: 2026-03-11 — Generated from full codebase analysis*
