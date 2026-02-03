# 📹 ESP32-CAM Live Streaming - Quick Setup

## What's New
The ESP32-CAM now provides:
- ✅ **Live MJPEG stream** on `http://[ESP32-IP]/stream`
- ✅ **Auto image capture** every 30 seconds (uploads to backend)
- ✅ **Status endpoint** on `http://[ESP32-IP]/status`
- ✅ **Auto-registration** with backend on first image upload

## How It Works

```
ESP32-CAM Device
    ├─ Port 80: Live Stream Server
    │   ├─ GET /stream  → MJPEG video feed (~15 FPS)
    │   └─ GET /status  → JSON status info
    │
    └─ Periodic Image Upload
        └─ POST to Raspberry Pi /api/forklift/{id}/image
            → Auto-registers camera IP
```

## Upload to ESP32-CAM

The updated code is already in `esp32_cam_forklift.ino`. Just:

1. **Re-upload the code** to your ESP32-CAM
2. **Open Serial Monitor** (115200 baud)
3. **Note the IP address** that appears

You'll see output like:
```
========================================
ESP32-CAM Forklift Monitoring System
========================================
Connecting to WiFi: YourWiFi ✓ Connected!
IP Address: 192.168.1.150
✓ Camera initialized successfully
✓ Camera server started on port 80
   Stream: http://192.168.1.150/stream
   Status: http://192.168.1.150/status

✓ System ready!
Forklift ID: forklift_1
Backend URL: http://10.136.57.165:5000
Stream URL: http://192.168.1.150/stream
```

## Access the Stream

### From Your Browser
```
http://192.168.1.150/stream
```
Replace with your ESP32-CAM's actual IP address.

### From Frontend Dashboard
The backend now auto-registers the camera IP when it receives the first image upload. The frontend can then access:
```
http://localhost:5000/api/camera/forklift_1/stream
```

## Test the Stream

```bash
# Test status endpoint
curl http://192.168.1.150/status

# Expected response:
{
  "forklift_id": "forklift_1",
  "ip": "192.168.1.150",
  "rssi": -45,
  "capture_count": 5,
  "framesize": 13,
  "quality": 10,
  "brightness": 0,
  "contrast": 0,
  "saturation": 0,
  "uptime": 300
}
```

## Frontend Integration

The frontend should fetch the forklift list and display streams:

```javascript
// Get forklift with camera info
fetch('http://localhost:5000/api/camera/forklifts')
  .then(r => r.json())
  .then(data => {
    data.forklifts.forEach(forklift => {
      if (forklift.stream_url) {
        // Display stream
        const img = document.createElement('img');
        img.src = `http://localhost:5000${forklift.stream_url}`;
      }
    });
  });
```

Or directly from ESP32-CAM:
```html
<img src="http://192.168.1.150/stream" alt="Forklift 1 Camera" />
```

## Performance Notes

- **Stream Frame Rate:** ~15 FPS (adjustable in code)
- **Image Upload:** Every 30 seconds (configurable)
- **Resolution:** 1600x1200 with PSRAM, 800x600 without
- **Bandwidth:** ~500-800 KB/s per stream viewer

## Troubleshooting

### Stream not working
1. Check ESP32-CAM IP is accessible: `ping [ESP32-IP]`
2. Test status endpoint: `curl http://[ESP32-IP]/status`
3. Check firewall allows port 80
4. Make sure only one viewer at a time initially

### Image upload works but no stream
- The stream server runs on the ESP32-CAM itself (port 80)
- Image uploads go to Raspberry Pi (port 5000)
- These are independent services

### Frontend shows old/no camera
1. Check backend logs: `tail -f logs/backend.log`
2. Manually register camera:
   ```bash
   curl -X POST http://localhost:5000/api/camera/forklift_1/register \
     -H "Content-Type: application/json" \
     -d '{"ip": "192.168.1.150"}'
   ```

## Multiple ESP32-CAMs

Each ESP32-CAM gets its own IP and serves its own stream:

```
Forklift 1: http://192.168.1.150/stream
Forklift 2: http://192.168.1.151/stream
Forklift 3: http://192.168.1.152/stream
```

Backend automatically tracks all of them when they upload images.

## Code Changes Summary

### Added to Arduino Code:
- `#include <WebServer.h>` and `#include "esp_http_server.h"`
- `stream_handler()` - Serves MJPEG stream
- `status_handler()` - Returns JSON status
- `startCameraServer()` - Starts HTTP server on port 80

### Enhanced Backend:
- Auto-registers camera IP when image is uploaded
- Returns stream URL in upload response
- Camera routes proxy streams from ESP32-CAMs

## Next Steps

1. **Re-upload code** to ESP32-CAM
2. **Note the stream URL** from Serial Monitor
3. **Open in browser** to test: `http://[ESP32-IP]/stream`
4. **Check backend** registers it: `curl http://localhost:5000/api/camera/forklifts`
5. **View in frontend** dashboard

🎥 **Live streaming is now active!**
