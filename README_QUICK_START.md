# 🏭 Warehouse IoT System - Quick Reference

## 🚀 Start Everything

```bash
cd /home/rpi/warehouse_iot
./start_all_improved.sh
```

This will:
1. ✅ Download YOLO models for ESP32-CAM object detection
2. ✅ Start backend server on port 5000
3. ✅ Start frontend dashboard on port 5173
4. ✅ Show system status and configuration info

## 🛑 Stop Everything

```bash
cd /home/rpi/warehouse_iot
./stop_services.sh
```

## 📊 Check Status

```bash
# Backend health
curl http://localhost:5000/api/health

# Frontend
curl http://localhost:5173

# View logs
tail -f logs/backend.log
tail -f logs/frontend.log
```

## 🔌 ESP32-CAM Setup

### Arduino Code Location
- **File:** `esp32_cam_forklift.ino` (in project root)
- **Setup Guide:** `ESP32_CAM_SETUP.md`

### Quick Configuration
Edit these lines in `esp32_cam_forklift.ino`:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";
const char* RPI_IP = "192.168.1.100";  // Your Raspberry Pi IP
const char* FORKLIFT_ID = "forklift_1";
```

### Upload Endpoint
ESP32-CAM automatically sends images to:
```
POST http://[RPI_IP]:5000/api/forklift/[forklift_id]/image
```

## 📁 Project Structure

```
warehouse_iot/
├── backend/                    # Flask backend
│   ├── app/
│   │   ├── routes/            # API endpoints
│   │   │   └── forklift_routes.py  # ESP32-CAM endpoint here
│   │   ├── services/          # MQTT, detection
│   │   ├── models/            # Database
│   │   └── espcam.py          # YOLO model downloader
│   ├── run.py                 # Main entry (updated)
│   └── requirements.txt
├── frontend/                   # React dashboard
│   └── src/
├── esp32_cam_forklift.ino     # ESP32-CAM code (NEW)
├── start_all_improved.sh      # Startup script (NEW)
├── stop_services.sh           # Stop script (NEW)
├── ESP32_CAM_SETUP.md         # Hardware setup guide (NEW)
└── COMPLETE_SYSTEM_STARTUP.md # Full documentation (NEW)
```

## 🎯 Key Changes Made

### 1. Backend (run.py)
- ✅ Auto-downloads YOLO models at startup
- ✅ Enhanced startup messages
- ✅ Shows all active services

### 2. Image Upload Endpoint (forklift_routes.py)
- ✅ New endpoint: `POST /api/forklift/<id>/image`
- ✅ Accepts raw JPEG data from ESP32-CAM
- ✅ Saves images to `uploads/images/`
- ✅ Updates forklift last_seen timestamp
- ✅ Returns success/error status

### 3. Model Downloader (espcam.py)
- ✅ Fixed duplicate code
- ✅ Made reusable function
- ✅ Checks if files exist before downloading
- ✅ Better error handling

### 4. ESP32-CAM Code (esp32_cam_forklift.ino)
- ✅ Complete production-ready code
- ✅ Auto-capture every 30 seconds
- ✅ Manual trigger via button
- ✅ LED status indicators
- ✅ WiFi reconnection logic
- ✅ HTTP POST to backend
- ✅ Detailed serial debug output

## 🧪 Testing

### Test Image Upload
```bash
# Test with curl (if you have a test image)
curl -X POST http://localhost:5000/api/forklift/test_1/image \
  -H "Content-Type: image/jpeg" \
  --data-binary @test.jpg
```

### Test Sensor Data
```bash
curl -X POST http://localhost:5000/api/forklift/test_1/data \
  -H "Content-Type: application/json" \
  -d '{
    "battery_level": 85,
    "vibration_x": 0.5,
    "vibration_y": 0.3,
    "vibration_z": 0.2
  }'
```

### Check Uploaded Images
```bash
ls -lh backend/uploads/images/
```

## 🔧 Troubleshooting

### Backend won't start
```bash
# Check Python version
python3 --version  # Should be 3.8+

# Install dependencies
cd backend
pip install -r requirements.txt
```

### Frontend won't start
```bash
# Check Node version
node --version  # Should be 16+

# Install dependencies
cd frontend
npm install
```

### ESP32-CAM not uploading
1. Check Serial Monitor (115200 baud)
2. Verify WiFi connection
3. Ping Raspberry Pi
4. Check backend logs: `tail -f logs/backend.log`

### Port already in use
```bash
# Kill process on port
sudo lsof -i :5000  # or :5173
kill -9 <PID>
```

## 📱 Access Points

Once started:
- **Backend API:** http://localhost:5000
- **Frontend Dashboard:** http://localhost:5173
- **API Health:** http://localhost:5000/api/health

From other devices on network:
- Replace `localhost` with your Raspberry Pi IP
- Example: http://192.168.1.100:5173

## 🎓 Next Steps

1. ✅ Flash ESP32-CAM with code
2. ✅ Configure WiFi and IP
3. ✅ Upload to ESP32-CAM
4. ✅ Start backend & frontend
5. ✅ Open dashboard
6. ✅ Watch images arrive!

## 📚 Documentation

- **Full System Guide:** `COMPLETE_SYSTEM_STARTUP.md`
- **ESP32-CAM Setup:** `ESP32_CAM_SETUP.md`
- **API Endpoints:** Check backend routes in `app/routes/`

## 💡 Tips

- Backend automatically downloads YOLO models on first run
- ESP32-CAM reconnects WiFi automatically
- Images saved with timestamp: `forklift_1_20260202_143052.jpg`
- Database created automatically on first run
- All services run in background

---

**Everything is configured and ready to run!** 🎉

Just execute: `./start_all_improved.sh`
