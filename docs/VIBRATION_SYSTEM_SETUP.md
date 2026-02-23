# Vibration Monitoring System Setup Guide

## 🎯 Overview

This guide explains how to set up the vibration monitoring system using:
- **Arduino Nano 33 IoT** with LSM6DS3 IMU sensor (accelerometer)
- **ESP32-CAM** (with broken camera) as WiFi gateway
- **Backend API** for data storage and processing
- **Frontend Dashboard** for real-time visualization

---

## 📦 Hardware Requirements

### 1. Arduino Nano 33 IoT
- Built-in LSM6DS3 6-axis IMU (accelerometer + gyroscope)
- Reads vibration data at 10 Hz
- Sends data via Serial UART to ESP32-CAM

### 2. ESP32-CAM Module
- Uses WiFi only (camera not used)
- Receives data from Arduino via UART
- Forwards data to backend via HTTP POST

### 3. Wiring Connections

```
Arduino Nano 33 IoT  →  ESP32-CAM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TX (Pin 1)           →  RX (GPIO 3)
GND                  →  GND
5V                   →  5V (optional - if powering ESP32 from Arduino)
```

**Note:** Do NOT connect ESP32-CAM TX to Arduino RX if you want to see Arduino debug output on Serial Monitor.

---

## 🔧 Software Setup

### Step 1: Upload Arduino Nano Code

**File:** `/backend/arduino_nano/vibration_sensor.ino`

1. Open Arduino IDE
2. Select **Board:** Arduino Nano 33 IoT
3. Select **Port:** (check Device Manager / ls /dev/ttyACM*)
4. Configure forklift ID:
   ```cpp
   #define FORKLIFT_ID "forklift-001"  // Change this for each forklift
   ```
5. Upload the sketch
6. Open Serial Monitor (115200 baud) to verify operation

**Expected Output:**
```
=======================================
  VIBRATION SENSOR - ARDUINO NANO
=======================================
Initializing IMU... OK
Forklift ID: forklift-001
Sample Rate: 10 Hz
Send Rate: 1 Hz
=======================================

Starting data collection...

{"fid":"forklift-001","x":0.023,"y":-0.012,"z":0.981,"mag":0.982,"bat":95}
{"fid":"forklift-001","x":0.025,"y":-0.010,"z":0.979,"mag":0.980,"bat":95}
```

### Step 2: Upload ESP32-CAM Code

**File:** `/backend/esp32cam/vibration_gateway.ino`

1. Open Arduino IDE
2. Install **ESP32 Board Support** (if not already installed)
   - File → Preferences → Additional Boards Manager URLs
   - Add: `https://dl.espressif.com/dl/package_esp32_index.json`
   - Tools → Board → Boards Manager → Search "ESP32" → Install
3. Install **ArduinoJson** library (Tools → Manage Libraries)
4. Select **Board:** AI Thinker ESP32-CAM
5. Select **Port:** (connect via FTDI programmer)
6. **⚠️ IMPORTANT:** Update WiFi credentials:
   ```cpp
   const char* WIFI_SSID = "YOUR_WIFI_SSID";        // UPDATE THIS
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"; // UPDATE THIS
   ```
7. Update backend URL if different:
   ```cpp
   const char* BACKEND_URL = "http://10.136.57.165:5000/api/forklift";
   ```
8. Upload the sketch

**Expected Output:**
```
===============================================
  ESP32-CAM VIBRATION DATA GATEWAY
===============================================
Connecting to WiFi: YourNetwork
.....
WiFi Connected!
IP Address: 192.168.1.150
Signal Strength: -45 dBm
Backend URL: http://10.136.57.165:5000/api/forklift
===============================================

Waiting for data from Arduino Nano...

Received: forklift-001 | Accel: (0.02, -0.01, 0.98) | Mag: 0.98g | Bat: 95%
```

### Step 3: Verify Backend API

The backend already has the necessary endpoints:

**POST** `/api/forklift/<forklift_id>/data`
- Receives vibration data from ESP32-CAM
- Stores in `vibration_data` table
- Calculates magnitude and detects anomalies (threshold: 5.0g)

**GET** `/api/forklift/<forklift_id>/vibration/current`
- Returns latest vibration reading

**GET** `/api/forklift/<forklift_id>/vibration/anomalies?hours=24`
- Returns anomalies from last N hours

**No backend changes required** ✓

### Step 4: View Data in Frontend

1. Navigate to **Forklifts** page in the web UI
2. Select your forklift from the dropdown
3. Scroll down to see the **Vibration Monitor** section

**Features:**
- Real-time vibration magnitude display
- Individual X, Y, Z axis readings
- Color-coded severity levels (Normal, Moderate, High, Critical)
- Recent anomalies list (last 24 hours)
- Auto-refresh every 2 seconds

---

## 📊 Data Flow

```
┌──────────────────┐
│  Arduino Nano    │  Reads IMU sensor @ 10Hz
│  LSM6DS3 IMU     │  Averages 10 samples
└────────┬─────────┘
         │ UART (115200 baud)
         │ JSON: {"fid":"...","x":0.02,"y":-0.01,"z":0.98,"mag":0.98,"bat":95}
         ↓
┌──────────────────┐
│  ESP32-CAM       │  Receives via Serial RX
│  WiFi Gateway    │  Parses JSON
└────────┬─────────┘
         │ HTTP POST
         │ /api/forklift/<id>/data
         ↓
┌──────────────────┐
│  Backend API     │  Stores in database
│  Flask Server    │  Detects anomalies (magnitude > 5.0g)
└────────┬─────────┘
         │ REST API
         │ GET /vibration/current
         ↓
┌──────────────────┐
│  Frontend UI     │  Displays real-time data
│  React Dashboard │  Shows anomalies & trends
└──────────────────┘
```

---

## 🔍 Troubleshooting

### Arduino Not Sending Data

1. **Check Serial Monitor** (115200 baud)
   - Should see JSON output every second
2. **IMU Initialization Failed**
   - Error: "FAILED! Cannot start IMU sensor"
   - Solution: Reset Arduino or check if LSM6DS3 library is installed
3. **No output on Serial**
   - Ensure correct board selected (Arduino Nano 33 IoT)
   - Check USB cable and port

### ESP32-CAM Not Connecting to WiFi

1. **Check WiFi credentials**
   - Verify SSID and password are correct
   - Check if network is 2.4GHz (ESP32 doesn't support 5GHz)
2. **LED not blinking**
   - Power issue - ensure 5V supply is stable (min 500mA)
3. **Serial Monitor shows connection timeout**
   - Move ESP32 closer to router
   - Check if network is accessible

### No Data in Frontend

1. **Check backend logs**
   ```bash
   cd /home/rpi/warehouse_iot/backend
   python run.py
   ```
   - Look for POST requests to `/api/forklift/<id>/data`
2. **Verify database**
   ```bash
   sqlite3 warehouse.db "SELECT * FROM vibration_data ORDER BY timestamp DESC LIMIT 5;"
   ```
3. **Check API response**
   ```bash
   curl http://10.136.57.165:5000/api/forklift/forklift-001/vibration/current
   ```
4. **Frontend console errors**
   - Open browser DevTools (F12) → Console
   - Check for CORS or network errors

### Data Looks Wrong

1. **Calibration Issue**
   - Z-axis should read ~1.0g when stationary (gravity)
   - X and Y should be near 0.0g
2. **High vibration when stationary**
   - Mount Arduino firmly to forklift
   - Reduce mechanical noise
3. **Anomalies trigger too often**
   - Adjust threshold in backend code: `magnitude > 5.0`
   - Edit: `/backend/app/routes/forklift_routes.py`

---

## 📈 Vibration Severity Levels

| Level      | Magnitude | Description                           | Action Required |
|------------|-----------|---------------------------------------|-----------------|
| **Normal** | < 1.5g    | Smooth operation, minimal vibration   | None            |
| **Moderate** | 1.5-3.0g | Typical warehouse movement           | Monitor         |
| **High**   | 3.0-5.0g  | Rough handling or uneven terrain      | Investigate     |
| **Critical** | > 5.0g  | Potential damage or unsafe operation  | Immediate action |

---

## 🔋 Battery Monitor (Optional)

The Arduino code includes basic battery monitoring via analog pin A0.

**Setup:**
1. Connect voltage divider to A0:
   ```
   Battery+ ──[10kΩ]──┬──[10kΩ]── GND
                       │
                       └── A0
   ```
2. This provides battery percentage (0-100%)
3. Sent to backend with vibration data

**Note:** Without hardware connection, battery reading will be unreliable.

---

## 🚀 Production Deployment

### Power Options

1. **USB Power Bank** (recommended for testing)
   - 5V, 2A minimum
   - Powers both Arduino and ESP32-CAM

2. **Forklift 12V Battery**
   - Use 12V → 5V buck converter
   - Minimum 2A output capacity

3. **Separate Power Supplies**
   - Arduino: USB (5V, 500mA)
   - ESP32-CAM: 5V external (1A)

### Mounting

- Use vibration-damping mounts if possible
- Secure cables to prevent disconnection
- Protect from dust and moisture

### Multiple Forklifts

1. **Update Arduino code** for each forklift:
   ```cpp
   #define FORKLIFT_ID "forklift-002"  // Change for each unit
   ```
2. **Flash unique codes** to each Arduino/ESP32 pair
3. **Label hardware** clearly with forklift ID
4. Frontend automatically shows correct data based on selected forklift

---

## 📚 Files Modified/Created

### New Files Created:
1. `/backend/arduino_nano/vibration_sensor.ino` - Arduino Nano vibration sensor code
2. `/backend/esp32cam/vibration_gateway.ino` - ESP32-CAM WiFi gateway code
3. `/frontend/src/components/VibrationMonitor.tsx` - React vibration display component

### Modified Files:
1. `/frontend/src/pages/ForkliftMonitor.tsx` - Added VibrationMonitor component

### Existing Files (No changes needed):
- Backend routes already support vibration data ✓
- Database models already include `VibrationData` table ✓

---

## 🎓 Testing Checklist

- [ ] Arduino compiles and uploads successfully
- [ ] ESP32-CAM connects to WiFi
- [ ] Serial Monitor shows JSON data from Arduino
- [ ] ESP32-CAM receives data from Arduino
- [ ] Backend receives POST requests (check logs)
- [ ] Database contains vibration_data entries
- [ ] Frontend displays vibration monitor
- [ ] Real-time updates work (< 2 second delay)
- [ ] Anomalies trigger and display correctly
- [ ] Multiple forklifts can be monitored independently

---

## 🆘 Support

If you encounter issues:
1. Check all wiring connections
2. Verify WiFi credentials in ESP32-CAM code
3. Check backend logs for errors
4. Ensure frontend is running (`npm run dev`)
5. Test API endpoints with curl/Postman

**System is now ready for vibration monitoring!** 🎉
