# 🏭 Warehouse IoT Monitoring System

> Real-time warehouse monitoring with AI-powered object detection, forklift tracking, and environmental sensors

A comprehensive IoT solution for warehouse management featuring real-time forklift positioning via BLE RSSI trilateration, AI-based inventory detection using custom YOLOv8 model, environmental monitoring, and vibration analysis.

![System Status](https://img.shields.io/badge/status-production--ready-success)
![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi%204-red)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 📋 Table of Contents

- [Features](#-features)
- [System Architecture](#-system-architecture)
- [Hardware Components](#-hardware-components)
- [Software Stack](#-software-stack)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [API Documentation](#-api-documentation)
- [Development](#-development)
- [Testing](#-testing)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

---

## ✨ Features

### 🎯 Core Capabilities

- **Real-time Forklift Positioning** - BLE RSSI trilateration with Extended Kalman Filter (EKF)
- **AI Object Detection** - Custom YOLOv8n model trained on 5 warehouse object classes
- **Live Camera Streaming** - MJPEG streams from ESP32-CAM modules on forklifts
- **Environmental Monitoring** - DHT11 temperature & humidity tracking
- **Vibration Analysis** - Accelerometer data from Arduino Nano 33 IoT
- **Automated Alerts** - SMS, WhatsApp, Email notifications via Twilio
- **Real-time Dashboard** - React + TypeScript web interface
- **Path Tracking** - Historical movement analysis and route optimization
- **Inventory Management** - AI-powered object placement tracking

### 🔧 Technical Features

- SQLite database with WAL mode for concurrent access
- WebSocket & Server-Sent Events (SSE) for real-time updates
- MQTT protocol for IoT sensor communication
- Background AI worker with non-blocking image processing
- Automatic image cleanup to conserve storage
- Multi-gateway BLE positioning (3-6 gateways supported)
- Weighted Least Squares (WLS) trilateration algorithm
- Mobile app for BLE gateway functionality

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    HARDWARE LAYER                           │
├─────────────────────────────────────────────────────────────┤
│ • ESP32-CAM (forklift cameras)                             │
│ • Arduino Nano 33 IoT (BLE beacon + vibration sensor)      │
│ • DHT11 Sensor (temperature/humidity on RPi GPIO 40)       │
│ • Mobile Phones (3-6 units as BLE RSSI gateways)          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              COMMUNICATION PROTOCOLS                        │
├─────────────────────────────────────────────────────────────┤
│ • HTTP/HTTPS (ESP32-CAM → Backend)                         │
│ • MQTT (Arduino → Backend)                                 │
│ • BLE Advertising (Arduino → Phones)                       │
│ • Serial UART (Arduino → ESP32)                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│          RASPBERRY PI 4 - BACKEND SERVER                    │
├─────────────────────────────────────────────────────────────┤
│ • Flask REST API (port 5000)                               │
│ • SQLite Database (WAL mode)                               │
│ • AI Worker (YOLOv8n background processing)                │
│ • Positioning Engine (RSSI → Position)                     │
│ • MQTT Client (sensor data ingestion)                      │
│ • WebSocket Server (real-time updates)                     │
│ • DHT Background Service (GPIO reading)                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              WEB FRONTEND (React + TS)                      │
├─────────────────────────────────────────────────────────────┤
│ • Dashboard Overview                                        │
│ • Live Camera Feeds                                         │
│ • Real-time Position Tracking                              │
│ • Environmental Monitoring Charts                           │
│ • Inventory Management                                      │
│ • Alert Management                                          │
│ • RSSI Gateway Configuration                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔌 Hardware Components

### Required Hardware

| Component | Quantity | Purpose |
|-----------|----------|---------|
| **Raspberry Pi 4** | 1 | Main server (backend + database) |
| **ESP32-CAM** | 1-5 | Forklift cameras for object detection |
| **Arduino Nano 33 IoT** | 1-5 | BLE beacon + vibration monitoring |
| **DHT11 Sensor** | 1 | Warehouse temperature/humidity |
| **Android Phones** | 3-6 | BLE RSSI gateways for positioning |
| **Power Supplies** | As needed | 5V for ESP32/Arduino |

### Wiring Diagrams

#### ESP32-CAM (Standalone Camera)
- **Power**: 5V + GND
- **WiFi**: Configured in firmware (`esp32_cam_forklift.ino`)
- No additional wiring needed

#### Arduino Nano 33 IoT
- **BLE**: Built-in (advertising beacon)
- **IMU**: Built-in LSM6DS3
- **Serial TX** (Pin 1) → ESP32-CAM RX (GPIO 3) for vibration data forwarding

#### DHT11 Sensor on Raspberry Pi
- **VCC** → Pin 1 (3.3V)
- **DATA** → Pin 40 (GPIO 21 / BCM 21)
- **GND** → Pin 6 (GND)

---

## 💻 Software Stack

### Backend (Python 3.11+)

```
Flask 3.0.0                   # Web framework
Flask-SocketIO 5.3.5          # WebSocket support
Peewee 3.17.0                 # ORM for SQLite
Ultralytics 8.1.20            # YOLOv8 for AI detection
OpenCV 4.9.0                  # Image processing
Paho-MQTT 1.6.1               # MQTT client
SciPy 1.11.4                  # Trilateration math
Adafruit CircuitPython DHT    # DHT11 sensor library
Twilio 9.0.0                  # SMS/WhatsApp notifications
```

### Frontend (Node.js 18+)

```
React 18.3.1                  # UI framework
TypeScript 5.x                # Type safety
Vite 5.x                      # Build tool
Shadcn/ui + Radix UI         # Component library
Tailwind CSS 3.x             # Styling
TanStack Query 5.x           # Data fetching
Recharts 2.15.4              # Data visualization
Socket.io-client 4.8.3       # Real-time updates
```

### IoT Firmware

```
Arduino IDE / PlatformIO     # Development environment
ArduinoBLE                   # BLE library (Arduino)
Arduino_LSM6DS3              # IMU library (Arduino)
ESP32 Camera Library         # Camera control (ESP32)
WiFi.h + HTTPClient.h        # Network (ESP32)
```

---

## 📁 Project Structure

```
warehouse_iot/
├── backend/                      # Flask backend server
│   ├── app/
│   │   ├── models/              # Database models (Peewee ORM)
│   │   ├── routes/              # API endpoints
│   │   ├── services/            # Business logic & background workers
│   │   ├── utils/               # Utility functions
│   │   ├── config.py            # Configuration
│   │   ├── espcam.py            # ESP32-CAM model downloader
│   │   └── gateway_config.py    # BLE gateway positions
│   ├── arduino_nano/            # Arduino firmware
│   │   ├── ble_beacon.ino       # BLE beacon + vibration monitor
│   │   └── vibration_sensor.ino # Standalone vibration monitor
│   ├── esp32cam/                # ESP32-CAM firmware
│   │   └── vibration_gateway.ino # Vibration data WiFi gateway
│   ├── BLE_script/              # Android BLE gateway app (Kotlin)
│   ├── yolo_models/             # YOLO model files
│   ├── run.py                   # Main server entry point
│   ├── requirements.txt         # Python dependencies
│   └── warehouse_iot.db         # SQLite database
│
├── frontend/                     # React TypeScript frontend
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   ├── pages/               # Page components (routes)
│   │   ├── services/            # API client
│   │   ├── types/               # TypeScript types
│   │   ├── App.tsx              # Root component
│   │   └── api.ts               # API service layer
│   ├── package.json             # Node dependencies
│   └── vite.config.ts           # Vite configuration
│
├── docs/                         # 📚 Documentation (44 files)
│   ├── PROJECT_TRACKER.md       # Main project tracker
│   ├── README.md                # Documentation index
│   └── [various implementation guides & checklists]
│
├── test/                         # 🧪 Testing utilities (12 files)
│   ├── test_*.sh                # Shell test scripts
│   ├── benchmark_detection.py   # AI performance testing
│   ├── validate_model.py        # Model validation
│   └── README.md                # Test documentation
│
├── logs/                         # Application logs
├── uploads/images/               # Uploaded camera images
├── my_model/                     # Custom YOLO model storage
│
├── esp32_cam_forklift.ino       # Main ESP32-CAM firmware
├── start_services.sh            # Start backend + frontend
├── stop_services.sh             # Stop all services
└── README.md                    # This file

```

---

## 🚀 Installation

### Prerequisites

- Raspberry Pi 4 (4GB+ RAM recommended)
- Raspbian OS / Ubuntu 22.04+ for ARM
- Python 3.11+
- Node.js 18+
- Git

### 1. Clone Repository

```bash
cd ~
git clone <repository-url> warehouse_iot
cd warehouse_iot
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install DHT sensor library (Raspberry Pi only)
sudo pip3 install adafruit-circuitpython-dht
sudo apt-get install libgpiod2

# Create database tables
python3 create_tables.py

# Download YOLO models (if using ESP32-CAM object detection)
python3 download_yolov8n.py
```

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Build production version (optional)
npm run build
```

### 4. Configure Environment Variables

```bash
# Backend configuration
cd backend
cp .env.example .env
nano .env

# Update these values:
# - MQTT_BROKER (if using external MQTT)
# - Database path
# - Alert thresholds
# - Twilio credentials (for SMS/WhatsApp)
```

### 5. Upload Firmware to Hardware

#### ESP32-CAM
1. Open `esp32_cam_forklift.ino` in Arduino IDE
2. Update WiFi credentials and RPi IP
3. Select "AI Thinker ESP32-CAM" board
4. Upload via FTDI programmer

#### Arduino Nano 33 IoT
1. Open `backend/arduino_nano/ble_beacon.ino`
2. Update beacon name and forklift ID
3. Select "Arduino Nano 33 IoT" board
4. Upload via USB

### 6. Install Mobile App (BLE Gateways)

1. Build Android APK from `backend/BLE_script/ble_apk.kt`
2. Install on 3-6 Android phones
3. Configure gateway IDs (phone_1, phone_2, etc.)
4. Position phones at corners of warehouse

---

## 🎮 Quick Start

### Start All Services

```bash
cd /home/rpi/warehouse_iot
./start_services.sh
```

This starts:
- Backend API on `http://localhost:5000`
- Frontend on `http://localhost:5173`

### Access Dashboard

Open browser and navigate to:
```
http://<raspberry-pi-ip>:5173
```

Default pages:
- **Overview**: System status and navigation
- **Warehouse Environment**: Temperature/humidity charts
- **Forklift Monitor**: Live camera feeds
- **Inventory Management**: AI-detected objects
- **Path Tracking**: Real-time position visualization
- **RSSI Monitor**: BLE gateway configuration
- **Alerts**: Notification management

### Stop Services

```bash
./stop_services.sh
```

---

## ⚙️ Configuration

### Backend Configuration (`backend/.env`)

```ini
# Server
HOST=0.0.0.0
PORT=5000
DEBUG=False

# Database
DATABASE=warehouse_iot.db

# MQTT
MQTT_BROKER=localhost
MQTT_PORT=1883

# AI Detection
YOLO_MODEL=my_model.pt
AI_CONFIDENCE=0.65
AI_INPUT_SIZE=416

# Alerts
TEMP_MIN=15
TEMP_MAX=30
HUMIDITY_MIN=30
HUMIDITY_MAX=70

# Notifications (Twilio)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### Gateway Configuration (`backend/app/gateway_config.py`)

Configure BLE gateway positions (3-6 phones):

```python
GATEWAYS = {
    "phone_1": {
        "name": "Gateway 1",
        "position": {"x": 0.0, "y": 0.0, "z": 2.5},
        "is_active": True
    },
    "phone_2": {
        "name": "Gateway 2",
        "position": {"x": 10.0, "y": 0.0, "z": 2.5},
        "is_active": True
    },
    # Add more gateways...
}
```

### Frontend Configuration (`frontend/.env`)

```ini
VITE_API_URL=http://10.136.57.165:5000/api
```

---

## 📡 API Documentation

### Base URL
```
http://<raspberry-pi-ip>:5000/api
```

### Key Endpoints

#### Health Check
```http
GET /health
GET /api/health
```

#### RSSI & Positioning
```http
POST   /api/rssi                    # Submit RSSI reading
GET    /api/rssi/gateways           # List all gateways
GET    /api/rssi/position/latest    # Get current position
GET    /api/rssi/history             # RSSI history
```

#### Camera & Inventory
```http
GET    /api/camera/forklifts         # List camera-equipped forklifts
GET    /api/camera/{id}/stream       # MJPEG stream
GET    /api/inventory                # List inventory items
GET    /api/inventory/detected       # AI-detected objects
```

#### Sensors
```http
GET    /api/dht/reading              # Current temp/humidity
GET    /api/sensors/environment/history  # Historical data
GET    /api/forklift/{id}/vibration  # Vibration data
```

#### Alerts
```http
GET    /api/alerts                   # List alerts
GET    /api/alerts/settings          # Alert configuration
POST   /api/alerts/send-notification # Trigger notification
```

### WebSocket Events

Connect to `http://<raspberry-pi-ip>:5000` using Socket.io:

```javascript
const socket = io('http://raspberry-pi-ip:5000');

socket.on('warehouse_sensor', (data) => {
  console.log('DHT Update:', data);
});

socket.on('forklift_location', (data) => {
  console.log('Position Update:', data);
});

socket.on('new_detection', (data) => {
  console.log('Object Detected:', data);
});
```

---

## 🛠️ Development

### Backend Development

```bash
cd backend
source venv/bin/activate

# Run in development mode
python3 run.py

# Run with auto-reload
FLASK_DEBUG=True python3 run.py
```

### Frontend Development

```bash
cd frontend

# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Database Management

```bash
cd backend

# Create tables
python3 create_tables.py

# Reset database (⚠️ deletes all data)
python3 reset_database.py

# Add test data
python3 populate_test_data.py
```

---

## 🧪 Testing

All test scripts are located in the `test/` directory.

### Run Tests

```bash
# Camera API test
./test/test_camera_api.sh

# RSSI positioning test
./test/test_rssi_system.sh

# DHT sensor test
./test/test_realtime_dht.sh

# Position detection test
./test/test_position_detection.sh

# AI detection benchmark
python3 test/benchmark_detection.py

# Model validation
python3 test/validate_model.py
```

See `test/README.md` for detailed documentation.

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Backend won't start
```bash
# Check if port 5000 is already in use
sudo lsof -i :5000

# Kill existing process
sudo kill -9 <PID>
```

#### 2. ESP32-CAM not uploading images
- Verify WiFi credentials in firmware
- Check Raspberry Pi IP address is correct
- Ensure backend is running on port 5000
- Check ESP32-CAM serial monitor for errors

#### 3. DHT sensor reading errors
```bash
# Verify GPIO permissions
sudo usermod -a -G gpio $USER

# Check DHT library installation
pip show adafruit-circuitpython-dht

# Test sensor directly
python3 test/testdht.py
```

#### 4. BLE positioning not working
- Ensure 3+ mobile gateways are running and sending RSSI
- Verify gateway positions in `backend/app/gateway_config.py`
- Check Arduino is advertising BLE beacon
- Monitor backend logs for RSSI data reception

#### 5. AI detection not working
```bash
# Check if YOLO model exists
ls backend/yolo_models/my_model.pt

# Verify ultralytics installation
pip show ultralytics

# Test detection manually
python3 test/validate_model.py
```

### Logs

```bash
# Backend logs
tail -f logs/backend.log

# Frontend logs
tail -f logs/frontend.log

# System logs
journalctl -u warehouse_iot -f
```

---

## 📊 Performance Optimization

### Raspberry Pi 4 Optimizations

The system is optimized for Raspberry Pi 4:

- **AI Processing**: YOLOv8n (lightweight model), 416x416 input size
- **Image Cleanup**: Automatic deletion of frames >2 minutes old
- **Memory Management**: Garbage collection every 5 minutes
- **Database**: SQLite WAL mode for concurrent access
- **Thread Limiting**: OMP_NUM_THREADS=2, MKL_NUM_THREADS=2
- **Image Compression**: 75% quality during upload

### Monitoring Resource Usage

```bash
# CPU and memory
htop

# GPU temperature
vcgencmd measure_temp

# Disk usage
df -h

# Service status
systemctl status warehouse_iot
```

---



## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👥 Authors

- **Monish L** - Core development and system architecture
- **Preran C V N** - Hardware integration and IoT implementation
- **Samuel Lazar** - Frontend development and UI/UX design


---

## 🙏 Acknowledgments

- **Ultralytics** - YOLOv8 object detection framework
- **Adafruit** - DHT sensor library
- **Shadcn/ui** - Beautiful UI components
- **Arduino & ESP32 Community** - IoT firmware support

---

## 📞 Support

For issues and questions:

- **Documentation**: See `docs/` folder for detailed guides
- **Bug Reports**: Open an issue on GitHub
- **Feature Requests**: Submit via GitHub issues

---

## 📅 Project Status

**Status**: Production Ready ✅  
**Last Updated**: February 23, 2026  
**Version**: 1.0.0

See `docs/PROJECT_TRACKER.md` for detailed development progress.

---

**Built with ❤️ for Smart Warehouse Management and forklifts**
