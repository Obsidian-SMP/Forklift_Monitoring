# Arduino Nano 33 IoT + ESP32-CAM Connection Guide

## 🔌 Hardware Connections

### Required Components:
1. **Arduino Nano 33 IoT** (with BLE + IMU)
2. **ESP32-CAM Module** (with broken camera - camera not used)
3. **FTDI Programmer** (for uploading code to ESP32-CAM)
4. **Jumper Wires** (Female-to-Female recommended)
5. **Power Supply** (5V, 2A minimum)

---

## 📐 Wiring Diagram

```
┌─────────────────────────┐         ┌──────────────────────────┐
│  Arduino Nano 33 IoT    │         │      ESP32-CAM           │
│                         │         │                          │
│  TX (Pin D1)   ●────────┼─────────┼────● RX (GPIO 3)         │
│                         │         │                          │
│  GND          ●────────┼─────────┼────● GND                 │
│                         │         │                          │
│  5V           ●─────────┼─────────┼────● 5V                  │
│                (optional - if powering ESP32 from Arduino)   │
└─────────────────────────┘         └──────────────────────────┘
```

### Pin Connections Table:

| Arduino Nano 33 IoT | ESP32-CAM Pin Label | Actual Pin | Notes                           |
|---------------------|---------------------|------------|----------------------------------|
| **TX (D1)**         | **U0R**             | GPIO 3 (RX) | Serial data transmission      |
| **GND**             | **GND**             | GND        | Common ground (REQUIRED)        |
| **5V**              | **5V**              | 5V         | Optional - if powering ESP32    |

**Note:** The ESP32-CAM board labels:
- **U0R** = UART0 RX = GPIO 3 ← **Connect Arduino TX here**
- **U0T** = UART0 TX = GPIO 1 ← **Leave disconnected**

---

## ⚠️ IMPORTANT NOTES

### 1. **Voltage Levels**
- Arduino Nano 33 IoT operates at **3.3V logic**
- ESP32-CAM operates at **3.3V logic**
- ✅ Direct connection is SAFE (no level shifter needed)

### 2. **Power Considerations**

**Option A: Separate Power Supplies (RECOMMENDED)**
- Arduino Nano: USB power (5V, 500mA)
- ESP32-CAM: External 5V supply (1A minimum)
- Connect only GND and TX→RX

**Option B: Powered from Arduino**
- Only if Arduino is powered by external 5V/2A supply
- Arduino's onboard regulator may not handle ESP32-CAM current draw
- ⚠️ NOT recommended with USB power alone

**Option C: Battery-Powered (For Forklift Deployment)**

**🔋 ESP32-CAM Requires 5V, NOT 3.3V!**
- ESP32-CAM has onboard regulator (AMS1117-3.3V) that converts 5V → 3.3V
- Powering with 3.3V will cause brownouts and WiFi failures

**C1. Separate Batteries (Each device has own battery):**
```
Battery 1 (5V) → Arduino VIN
Battery 1 GND → Arduino GND ──┐
                              ├─ MUST connect grounds!
Battery 2 (5V) → ESP32-CAM 5V │
Battery 2 GND → ESP32-CAM GND ─┘

Arduino TX → ESP32-CAM U0R (RX)
```
**Total wires between devices: 2 (TX→U0R + GND→GND)**
- Ground connection is REQUIRED for UART signal reference
- Without common ground, Serial communication will fail

**C2. Single Shared Battery (RECOMMENDED - Simpler):**
```
5V Battery:
  5V+ ──┬→ Arduino VIN
        └→ ESP32-CAM 5V
  
  GND ──┬→ Arduino GND
        └→ ESP32-CAM GND

Arduino TX → ESP32-CAM U0R (RX)
```
**Total wires between devices: 1 (TX→U0R only)**
- Ground is automatically shared through battery
- Simpler wiring, fewer failure points

**Battery Requirements:**
- Voltage: **5V** (NOT 3.3V!)
- Current: ≥1.5A continuous (Arduino ~200mA + ESP32 ~500-800mA)
- Capacity: ≥2000mAh for 4-6 hours runtime
- Options: USB power bank, 4×AA with 5V regulator, LiPo with 5V boost

### 3. **Serial Communication**
- Baud Rate: **115200**
- Arduino TX (pin 1) sends JSON data to ESP32-CAM RX (GPIO 3)
- **DO NOT** connect Arduino RX to ESP32-CAM TX (one-way communication only)

---

## 🔧 Step-by-Step Setup

### Step 1: Upload Arduino Code

1. **Connect Arduino Nano to Computer**
   - Use USB cable
   
2. **Open Arduino IDE**

3. **Configure Arduino Nano 33 IoT:**
   - Board: **Arduino Nano 33 IoT**
   - Port: Select appropriate COM port or /dev/ttyACM*
   
4. **Update Configuration in Code:**
   ```cpp
   #define BEACON_NAME "Forklift-001"      // For BLE beacon
   #define FORKLIFT_ID "forklift-001"      // For vibration data
   ```

5. **Upload the sketch** (`ble_beacon.ino`)

6. **Test (Optional):**
   - Open Serial Monitor (115200 baud)
   - You should see JSON data every second:
   ```json
   {"fid":"forklift-001","x":0.023,"y":-0.012,"z":0.981,"mag":0.982,"bat":95}
   ```

7. **Disconnect Serial Monitor** before wiring to ESP32-CAM

---

### Step 2: Upload ESP32-CAM Code

#### A. Wiring ESP32-CAM for Programming

ESP32-CAM doesn't have USB. Use FTDI programmer:

```
FTDI Programmer          ESP32-CAM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VCC (5V)        ────────● 5V
GND             ────────● GND
TX              ────────● RX (GPIO 3)
RX              ────────● TX (GPIO 1)

For Programming Mode:
- Connect GPIO 0 to GND (press and hold IO0 button)
- Press RESET button
- Release IO0 button
```

#### B. Configure and Upload

1. **Open Arduino IDE**

2. **Install ESP32 Board Support** (if not installed):
   - File → Preferences
   - Additional Boards Manager URLs: 
     ```
     https://dl.espressif.com/dl/package_esp32_index.json
     ```
   - Tools → Board → Boards Manager → Search "ESP32" → Install

3. **Install ArduinoJson Library:**
   - Tools → Manage Libraries → Search "ArduinoJson" → Install

4. **Select Board:**
   - Board: **AI Thinker ESP32-CAM**
   - Port: Select FTDI programmer port

5. **⚠️ UPDATE WiFi Credentials in Code:**
   ```cpp
   const char* WIFI_SSID = "YOUR_WIFI_SSID";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   ```

6. **Update Backend URL (if different):**
   ```cpp
   const char* BACKEND_URL = "http://10.136.57.165:5000/api/forklift";
   ```

7. **Put ESP32-CAM in Programming Mode:**
   - Connect GPIO 0 to GND
   - Press and release RESET button
   - Release GPIO 0

8. **Upload the sketch** (`vibration_gateway.ino`)

9. **Normal Operation Mode:**
   - Disconnect GPIO 0 from GND
   - Press RESET button
   - ESP32-CAM will start running

10. **Test:**
    - Keep FTDI connected for Serial Monitor
    - Baud Rate: 115200
    - Should see WiFi connection and "Waiting for data..."

---

### Step 3: Connect Arduino to ESP32-CAM

1. **Disconnect FTDI from ESP32-CAM**

2. **Make 3 wire connections:**
   ```
   Arduino TX (D1) --> ESP32-CAM RX (GPIO 3)
   Arduino GND     --> ESP32-CAM GND
   Arduino 5V      --> ESP32-CAM 5V (if using shared power)
   ```

3. **Power both devices:**
   - Arduino: USB or external 5V
   - ESP32-CAM: External 5V/1A supply

4. **Verify Operation:**
   - ESP32-CAM LED should blink on WiFi activity
   - Check backend logs for incoming POST requests

---

## 🧪 Testing & Verification

### Test 1: Check Serial Communication

**Option A: Monitor Arduino Output**
- Connect only Arduino to computer via USB
- Open Serial Monitor (115200 baud)
- Should see JSON data every second

**Option B: Monitor ESP32-CAM Output**
- Connect FTDI to ESP32-CAM (while connected to Arduino)
- Open Serial Monitor (115200 baud)
- Should see "Received: ..." messages

### Test 2: Verify Backend Reception

```bash
# SSH into Raspberry Pi
ssh rpi@10.136.57.165

# Check backend logs
cd /home/rpi/warehouse_iot/backend
python run.py
```

Look for:
```
POST /api/forklift/forklift-001/data
Status: 201
```

### Test 3: Check Database

```bash
sqlite3 /home/rpi/warehouse_iot/backend/warehouse.db

SELECT * FROM vibration_data 
ORDER BY timestamp DESC 
LIMIT 5;
```

Should show recent vibration entries.

### Test 4: Frontend Dashboard

1. Open browser: `http://10.136.57.165:8080`
2. Navigate to **Forklifts** page
3. Select forklift from dropdown
4. Scroll to **Vibration Monitor** section
5. Should see real-time data updating every 2 seconds

---

## 🔍 Troubleshooting

### Issue 1: No Data on Serial Monitor

**Symptoms:** Arduino Serial Monitor shows nothing

**Solutions:**
- Check baud rate is 115200
- Verify Arduino code uploaded successfully
- Press Arduino RESET button
- Check IMU initialization (LED patterns on boot)

### Issue 2: ESP32-CAM Not Receiving Data

**Symptoms:** ESP32 shows "Waiting for data..." but never receives

**Solutions:**
- ✅ Check TX→RX connection (Arduino TX to ESP32 RX)
- ✅ Verify common GND connection
- ✅ Ensure baud rate matches (115200 on both)
- ✅ Check if Arduino is sending (connect to Serial Monitor first)
- ❌ DON'T use both USB Serial Monitor and ESP32 at same time

### Issue 3: ESP32-CAM Won't Connect to WiFi

**Symptoms:** ESP32 stuck on "Connecting to WiFi..."

**Solutions:**
- Verify SSID and password are correct
- Ensure WiFi is 2.4GHz (ESP32 doesn't support 5GHz)
- Check WiFi signal strength (move closer to router)
- Verify power supply is adequate (5V/1A minimum)

### Issue 4: Backend Not Receiving Data

**Symptoms:** ESP32 connected but backend missing data

**Solutions:**
- Check backend URL in ESP32 code
- Verify backend is running (`python run.py`)
- Test API endpoint with curl:
  ```bash
  curl http://10.136.57.165:5000/api/forklift/forklift-001/vibration/current
  ```
- Check firewall rules on Raspberry Pi

### Issue 5: BLE Beacon Not Working

**Symptoms:** Position tracking stopped working

**Solutions:**
- Verify BLE gateways are running
- Check if Arduino is advertising:
  - Use phone app like "nRF Connect"
  - Look for "Forklift-001" beacon
- Ensure code uploaded correctly
- BLE and Serial run independently - both should work

---

## 📊 Data Flow Verification

```
1. Arduino Nano Reads IMU
   └─> Every 100ms
   └─> Updates BLE characteristics (for positioning)
   └─> Accumulates samples for averaging

2. Arduino Sends Serial Data
   └─> Every 1 second
   └─> JSON format to ESP32-CAM
   └─> {"fid":"forklift-001","x":0.02,"y":-0.01,"z":0.98,"mag":0.98,"bat":95}

3. ESP32-CAM Receives & Forwards
   └─> Parses JSON
   └─> HTTP POST to backend
   └─> /api/forklift/forklift-001/data

4. Backend Stores Data
   └─> Saves to vibration_data table
   └─> Detects anomalies (magnitude > 5.0g)
   └─> Available via REST API

5. Frontend Displays
   └─> Fetches via /vibration/current
   └─> Updates every 2 seconds
   └─> Shows on Forklift Monitor page
```

---

## 🔋 Power Consumption & Battery Life

### Typical Current Draw:
- **Arduino Nano 33 IoT:** 50-80 mA (with BLE active)
- **ESP32-CAM:** 170-250 mA (WiFi transmitting)
- **Total:** ~250-330 mA @ 5V

### Battery Options:

**Option 1: USB Power Bank**
- 10,000 mAh power bank
- Runtime: ~30-40 hours
- Good for testing and mobile applications

**Option 2: Forklift 12V Battery**
- Use 12V → 5V buck converter (3A rating)
- Virtually unlimited runtime
- Professional installation recommended

---

## 📝 Configuration Checklist

- [ ] Arduino Nano code uploaded successfully
- [ ] ESP32-CAM code uploaded successfully
- [ ] WiFi credentials updated in ESP32 code
- [ ] Backend URL configured correctly
- [ ] TX→RX wiring confirmed
- [ ] GND connection verified
- [ ] Power supplies adequate (5V/1A minimum)
- [ ] Serial Monitor shows JSON data from Arduino
- [ ] ESP32-CAM connects to WiFi
- [ ] Backend receives POST requests
- [ ] Database contains vibration_data entries
- [ ] Frontend displays vibration monitor
- [ ] BLE beacon still advertising (for positioning)

---

## 🎯 Success Indicators

✅ **Arduino Working:**
- Serial data shows JSON every second
- BLE beacon advertising (check with phone app)

✅ **ESP32-CAM Working:**
- LED blinks during WiFi activity
- Serial Monitor shows "Received: ..." messages
- HTTP success messages in Serial output

✅ **Backend Working:**
- Backend logs show POST requests
- Database has recent entries
- API returns current vibration data

✅ **Frontend Working:**
- Vibration Monitor section visible
- Real-time magnitude updates
- Anomalies list populates when threshold exceeded

---

## 🚀 Production Deployment

1. **Secure Mounting:**
   - Mount Arduino firmly on forklift frame
   - Use vibration-damping mounts if available
   - Protect from dust and moisture

2. **Cable Management:**
   - Use short wires (reduce noise)
   - Secure with zip ties
   - Strain relief at connectors

3. **Power:**
   - Use reliable 5V supply (buck converter from forklift battery)
   - Add capacitors for stability (100µF + 0.1µF near ESP32)

4. **Environmental:**
   - Consider IP65 enclosure for electronics
   - Adequate ventilation for ESP32 heat dissipation

5. **Multiple Forklifts:**
   - Update FORKLIFT_ID in each Arduino
   - Update BEACON_NAME for BLE positioning
   - Label hardware clearly

---

## 📞 Support

If issues persist:
1. Check all wiring connections with multimeter
2. Verify voltage levels (should be 3.3V on signal lines)
3. Test each component individually before integration
4. Check backend API with curl/Postman
5. Review Serial Monitor outputs for error messages

**System is now ready for dual-function operation:** 
- ✅ BLE Beacon for positioning
- ✅ Vibration monitoring via WiFi
