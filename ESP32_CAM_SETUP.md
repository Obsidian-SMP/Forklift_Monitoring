# ESP32-CAM Setup Guide

## Overview
This guide helps you set up the ESP32-CAM module for forklift load detection in the warehouse monitoring system.

## Hardware Requirements
- ESP32-CAM (AI-Thinker module)
- FTDI USB-to-Serial adapter (for programming)
- Optional: Push button on GPIO 13 for manual triggers
- Power supply: 5V 2A minimum

## Software Requirements
- Arduino IDE 1.8.19 or later
- ESP32 board support package
- Required Arduino libraries:
  - WiFi (built-in)
  - HTTPClient (built-in)
  - ArduinoJson (install via Library Manager)
  - esp_camera (included with ESP32 package)

## Installation Steps

### 1. Install Arduino IDE
Download from: https://www.arduino.cc/en/software

### 2. Install ESP32 Board Support
1. Open Arduino IDE
2. Go to **File > Preferences**
3. Add this URL to "Additional Board Manager URLs":
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Go to **Tools > Board > Boards Manager**
5. Search for "esp32" and install "ESP32 by Espressif Systems"

### 3. Install ArduinoJson Library
1. Go to **Sketch > Include Library > Manage Libraries**
2. Search for "ArduinoJson"
3. Install "ArduinoJson by Benoit Blanchon" (version 6.x)

### 4. Configure the Code
1. Open `esp32_cam_forklift.ino` in Arduino IDE
2. Update these settings (lines 22-31):
   ```cpp
   const char* WIFI_SSID = "YOUR_WIFI_SSID";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   const char* RPI_IP = "192.168.1.100";  // Your Raspberry Pi IP
   const char* FORKLIFT_ID = "forklift_1"; // Change per forklift
   ```

### 5. Upload to ESP32-CAM
1. Connect ESP32-CAM to FTDI adapter:
   - ESP32-CAM 5V → FTDI 5V
   - ESP32-CAM GND → FTDI GND
   - ESP32-CAM U0R → FTDI TX
   - ESP32-CAM U0T → FTDI RX
   - ESP32-CAM IO0 → GND (for programming mode)

2. In Arduino IDE:
   - Select **Tools > Board > ESP32 Arduino > AI Thinker ESP32-CAM**
   - Select **Tools > Port > [Your COM Port]**
   - Set **Tools > Upload Speed > 115200**

3. Click **Upload**

4. After upload completes:
   - Disconnect IO0 from GND
   - Press RESET button or reconnect power

### 6. Test the System
1. Open Serial Monitor (115200 baud)
2. You should see:
   ```
   ========================================
   ESP32-CAM Forklift Monitoring System
   ========================================
   Connecting to WiFi: YOUR_SSID... ✓ Connected!
   IP Address: 192.168.1.XXX
   Camera initialized successfully
   ✓ System ready!
   ```

## API Endpoint
The ESP32-CAM sends images to:
```
POST http://[RPI_IP]:5000/api/forklift/[forklift_id]/image
Content-Type: image/jpeg
```

## Configuration Options

### Auto-Capture Settings
```cpp
const unsigned long CAPTURE_INTERVAL = 30000;  // 30 seconds
const bool ENABLE_AUTO_CAPTURE = true;         // Enable/disable
```

### Button Trigger
```cpp
const bool ENABLE_BUTTON = true;  // Enable manual trigger
const int BUTTON_PIN = 13;        // GPIO pin for button
```

### Image Quality
Edit in `initCamera()` function:
```cpp
config.frame_size = FRAMESIZE_UXGA;  // Resolution
config.jpeg_quality = 10;             // Quality (lower = better)
```

Available frame sizes:
- `FRAMESIZE_UXGA` - 1600x1200 (best for detection)
- `FRAMESIZE_SVGA` - 800x600 (balanced)
- `FRAMESIZE_VGA` - 640x480 (faster)

## Troubleshooting

### Camera Fails to Initialize
- Check all pin connections
- Ensure proper power supply (5V 2A minimum)
- Try pressing RESET button

### WiFi Connection Issues
- Verify SSID and password
- Check 2.4GHz WiFi (ESP32 doesn't support 5GHz)
- Ensure router is in range

### Upload Errors
- Double-check GPIO0 is connected to GND during upload
- Try slower upload speed (115200)
- Disconnect ESP32-CAM from power before uploading

### Image Upload Fails
- Verify Raspberry Pi IP address
- Check that backend server is running
- Test connection: `curl http://[RPI_IP]:5000/health`

## Multiple Forklifts
For multiple ESP32-CAMs:
1. Flash each module with unique `FORKLIFT_ID`:
   - `forklift_1`
   - `forklift_2`
   - `forklift_3`
   - etc.
2. Each will upload to its own endpoint
3. Backend automatically tracks all forklifts

## Power Management
For battery-powered operation:
- Use deep sleep between captures
- Reduce capture frequency
- Lower image quality/resolution
- Add power management code (contact for examples)

## LED Indicators
- **Rapid blinking**: Error (camera init or WiFi failed)
- **Brief blink during capture**: Normal operation
- **3 quick blinks at startup**: System ready

## Support
For issues or questions, check:
- Serial Monitor output (115200 baud)
- Backend server logs
- Network connectivity
