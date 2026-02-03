# Complete System Startup Guide

## 🎯 Quick Start - Run Everything

### One Command Startup
```bash
cd /home/rpi/warehouse_iot
./start_all.sh
```

This starts:
1. Backend server (Flask + MQTT + WebSocket)
2. Frontend dashboard (React + Vite)
3. Automatic YOLO model download for ESP32-CAM
4. All monitoring services

## 📋 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Warehouse IoT System                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ESP32-CAM (Forklifts)                                       │
│    └─> Image Upload ───────────────┐                        │
│                                      │                        │
│  Arduino (Sensors)                   │                        │
│    └─> MQTT/HTTP ──────────────────┤                        │
│                                      │                        │
│  BLE Beacons (Position)              │                        │
│    └─> MQTT ───────────────────────┤                        │
│                                      ▼                        │
│                          ┌─────────────────┐                 │
│                          │  Backend Server │                 │
│                          │  (Raspberry Pi) │                 │
│                          │   Flask + MQTT  │                 │
│                          │   SQLite + AI   │                 │
│                          └────────┬────────┘                 │
│                                   │                           │
│                                   │ WebSocket                 │
│                                   ▼                           │
│                          ┌─────────────────┐                 │
│                          │  Frontend       │                 │
│                          │  React Dashboard│                 │
│                          │  Real-time UI   │                 │
│                          └─────────────────┘                 │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Detailed Startup Instructions

### 1. Backend Server

```bash
cd /home/rpi/warehouse_iot/backend
python run.py
```

**What it does:**
- ✅ Downloads YOLO models for object detection (if needed)
- ✅ Starts Flask REST API server (port 5000)
- ✅ Initializes MQTT client for sensor data
- ✅ Opens WebSocket for real-time updates
- ✅ Creates SQLite database tables
- ✅ Starts background cleanup threads

**Endpoints Available:**
- `http://localhost:5000/` - API status
- `http://localhost:5000/api/health` - Health check
- `http://localhost:5000/api/forklift/<id>/image` - ESP32-CAM upload
- `http://localhost:5000/api/sensors/*` - Sensor data
- `http://localhost:5000/api/warehouse/*` - Warehouse status

### 2. Frontend Dashboard

```bash
cd /home/rpi/warehouse_iot/frontend
npm run dev
```

**Access:** `http://localhost:5173`

**Features:**
- Real-time warehouse monitoring
- Forklift position tracking
- Temperature/humidity graphs
- Alert notifications
- Camera feeds from ESP32-CAM

### 3. ESP32-CAM Setup

1. **Configure WiFi and Backend IP:**
   ```cpp
   // In esp32_cam_forklift.ino
   const char* WIFI_SSID = "YOUR_WIFI";
   const char* WIFI_PASSWORD = "YOUR_PASSWORD";
   const char* RPI_IP = "192.168.1.100";  // Your Pi IP
   const char* FORKLIFT_ID = "forklift_1";
   ```

2. **Upload to ESP32-CAM**
   - See `ESP32_CAM_SETUP.md` for detailed instructions

3. **Verify Connection:**
   ```bash
   # Check if ESP32-CAM is sending data
   tail -f /home/rpi/warehouse_iot/backend/logs/esp32cam.log
   ```

## 🔧 Configuration Files

### Backend Configuration
**File:** `/home/rpi/warehouse_iot/backend/.env`

```env
# Server
HOST=0.0.0.0
PORT=5000
FLASK_DEBUG=True

# MQTT Broker
MQTT_BROKER=localhost
MQTT_PORT=1883

# Database
DATABASE=warehouse_iot.db

# Image Upload
UPLOAD_FOLDER=uploads/images
YOLO_MODEL=yolov8n.pt

# Alert Thresholds
TEMP_MIN=15
TEMP_MAX=30
HUMIDITY_MIN=30
HUMIDITY_MAX=70
VIBRATION_THRESHOLD=5.0
```

### Frontend Configuration
**File:** `/home/rpi/warehouse_iot/frontend/.env.local`

```env
VITE_API_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5000
```

## 📊 Service Status Checks

### Check Backend Status
```bash
curl http://localhost:5000/api/health
# Expected: {"status":"healthy","service":"Warehouse IoT API"}
```

### Check Frontend Status
```bash
curl http://localhost:5173
# Should return HTML
```

### Check MQTT Broker
```bash
mosquitto_sub -t "warehouse/#" -v
# Shows all warehouse MQTT messages
```

## 🐛 Troubleshooting

### Backend Won't Start

**Error:** Port 5000 already in use
```bash
# Find and kill process
sudo lsof -i :5000
kill -9 <PID>
```

**Error:** Module not found
```bash
cd backend
pip install -r requirements.txt
```

**Error:** SQLite database locked
```bash
rm warehouse_iot.db
python create_tables.py
```

### Frontend Won't Start

**Error:** EADDRINUSE :::5173
```bash
# Kill process on port 5173
sudo lsof -i :5173
kill -9 <PID>
```

**Error:** Module not found
```bash
cd frontend
npm install
```

### ESP32-CAM Issues

**Camera not sending images:**
1. Check Serial Monitor (115200 baud)
2. Verify WiFi connection
3. Ping Raspberry Pi from same network
4. Check backend logs for image uploads

**HTTP POST fails:**
```bash
# Test endpoint manually
curl -X POST http://localhost:5000/api/forklift/forklift_1/image \
  -H "Content-Type: image/jpeg" \
  --data-binary @test_image.jpg
```

## 📱 Monitoring & Logs

### Real-time Backend Logs
```bash
cd /home/rpi/warehouse_iot/backend
python run.py 2>&1 | tee logs/backend.log
```

### View Uploaded Images
```bash
ls -lh /home/rpi/warehouse_iot/backend/uploads/images/
```

### Database Queries
```bash
sqlite3 warehouse_iot.db
> SELECT * FROM forklift;
> SELECT * FROM detected_objects;
> .quit
```

## 🔄 Automatic Startup (Optional)

### Create Systemd Service

**Backend Service:** `/etc/systemd/system/warehouse-backend.service`
```ini
[Unit]
Description=Warehouse IoT Backend
After=network.target

[Service]
Type=simple
User=rpi
WorkingDirectory=/home/rpi/warehouse_iot/backend
ExecStart=/usr/bin/python3 run.py
Restart=always

[Install]
WantedBy=multi-user.target
```

**Enable:**
```bash
sudo systemctl enable warehouse-backend
sudo systemctl start warehouse-backend
sudo systemctl status warehouse-backend
```

## 🎛️ API Testing

### Test ESP32-CAM Image Upload
```bash
curl -X POST http://localhost:5000/api/forklift/forklift_1/image \
  -H "Content-Type: image/jpeg" \
  -H "X-Forklift-ID: forklift_1" \
  --data-binary @test.jpg
```

### Test Sensor Data
```bash
curl -X POST http://localhost:5000/api/forklift/forklift_1/data \
  -H "Content-Type: application/json" \
  -d '{
    "battery_level": 85,
    "vibration_x": 0.5,
    "vibration_y": 0.3,
    "vibration_z": 0.2
  }'
```

### Get Forklift Status
```bash
curl http://localhost:5000/api/forklift/forklift_1
```

## 📞 Support & Development

### Project Structure
```
warehouse_iot/
├── backend/              # Flask backend
│   ├── app/
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # MQTT, detection
│   │   ├── models/      # Database models
│   │   └── espcam.py    # Model downloader
│   └── run.py           # Main entry point
├── frontend/            # React dashboard
│   └── src/
├── esp32_cam_forklift.ino  # ESP32-CAM code
└── start_all.sh         # Startup script
```

### Common Development Tasks

**Add new ESP32-CAM:**
1. Flash with unique forklift_id
2. Backend automatically creates entry
3. Dashboard shows new forklift

**Test without hardware:**
- Backend runs standalone
- Frontend has mock data
- Use curl to simulate sensors

**Database reset:**
```bash
cd backend
rm warehouse_iot.db
python create_tables.py
python add_test_objects.py  # Optional test data
```

## ✅ System Ready Checklist

- [ ] Backend running on port 5000
- [ ] Frontend running on port 5173
- [ ] MQTT broker accessible
- [ ] ESP32-CAM connected to WiFi
- [ ] Images uploading successfully
- [ ] Dashboard shows real-time data
- [ ] Database creating entries
- [ ] Logs show no errors

🎉 **System fully operational!**
