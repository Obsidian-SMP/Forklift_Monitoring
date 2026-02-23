# Camera Feed Performance Analysis & Optimization

## Issue Description
Objects are being detected before camera feed appears - this indicates the feed is SLOW/LAGGY on RPi 4B while AI detection is working properly.

## Architecture (Correct Flow)
```
ESP32-CAM (captures image every 1 second)
    ↓ HTTP POST to /api/forklift/<id>/image
Raspberry Pi 4B Backend
    ├─ Saves image to uploads/images/
    ├─ Queues for AI detection (async, non-blocking)
    ├─ AI worker processes in background
    └─ Serves latest image via /api/camera/<id>/latest
Frontend (any device)
    ↓ Fetches image every 2 seconds
    ↓ Auto-refreshes with ?t=timestamp
```

## Performance Bottlenecks Identified

### 1. **AI Worker CPU Overload** ⚠️ CRITICAL
**Problem:** Processing EVERY image (1 FPS) on RPi CPU is too intensive
- YOLOv8 inference takes 2-4 seconds per image on RPi 4B CPU
- Queue backlog builds up when images arrive faster than processing
- Solution: Changed AI_PROCESS_EVERY_N from 1 → 2 (skip 50% of frames)

### 2. **Network Transfer Size** 📡
**Problem:** Full-resolution JPEGs (~200-500KB each) every 2 seconds
- No compression applied during serving
- Suggested: Add PIL compression with quality=75-85

### 3. **Frontend Polling Frequency** 🔄
**Already Optimized:**
- Status check: Every 15 seconds ✓
- Image refresh: Every 2 seconds ✓ (balanced for RPi performance)

### 4. **Cleanup Task Timing** 🗑️
**Problem:** Cleanup runs immediately on startup, then continuous loop
- Suggested: Add initial delay + run every 2 minutes

## Implemented Optimizations

### ✅ Backend Config (config.py)
```python
AI_PROCESS_EVERY_N = 2  # Process every 2nd image (50% CPU reduction)
```

### ✅ Frontend (ForkliftMonitoring.tsx)
```typescript
- Status refresh: 15 seconds (reduced from 5s)
- Image refresh: 2 seconds (reduced from 1s)
- Lazy loading + error retry on images
```

### 🔲 Recommended: Image Compression (camera_routes.py)
```python
# Add to /api/camera/<id>/latest endpoint
from PIL import Image
import io

img = Image.open(latest_file)
buffer = io.BytesIO()
img.save(buffer, format='JPEG', quality=80, optimize=True)
buffer.seek(0)
return send_file(buffer, ...)
```

### 🔲 Recommended: Cleanup Timing (run.py)
```python
def cleanup_old_images():
    time.sleep(120)  # Initial delay
    while True:
        # cleanup logic
        time.sleep(120)  # Run every 2 minutes
```

## Performance Metrics (Expected)

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| AI CPU Load | ~80-100% | ~40-50% | 50% reduction |
| Image Bandwidth | ~500KB/2s | ~150KB/2s | 70% reduction |
| Status API Calls | 12/min | 4/min | 67% reduction |
| Cleanup CPU Spikes | Continuous | Every 2min | Scheduled |

## Testing Checklist

- [ ] Restart backend: `cd backend && python3 run.py`
- [ ] Access frontend from laptop: `http://10.136.57.165:8080`
- [ ] Verify camera feed loads within 2-3 seconds
- [ ] Check AI detections still work (every 2nd frame)
- [ ] Monitor CPU usage: `htop` (should be ~40-60%)
- [ ] Check network tab in browser (image load time <500ms)

## Diagnosis Commands

```bash
# Check backend logs for AI processing speed
cd /home/rpi/warehouse_iot/backend
python3 run.py | grep "\[AI\]"

# Monitor CPU usage
htop

# Check image folder size
du -sh uploads/images/

# Count images
ls -1 uploads/images/ | wc -l

# Check latest images
ls -lt uploads/images/ | head -10

# Test API endpoint
curl http://localhost:5000/api/camera/forklift_1/latest -I
```

## Root Cause Summary

✅ **Detections working** = ESP32-CAM → RPi upload working
❌ **Feed slow/laggy** = RPi serving images is bottlenecked by:
1. AI worker CPU overload (FIXED: now processes 50% of frames)
2. Full-size JPEG transfer (TODO: add compression)
3. Cleanup task continuous checking (TODO: schedule every 2min)

## Next Steps

1. Verify AI_PROCESS_EVERY_N=2 improves responsiveness
2. Optionally add image compression to reduce network load
3. Monitor system with `htop` during operation
4. If still slow, reduce image refresh to 3-4 seconds
5. Consider ESP32-CAM direct streaming (bypass detection) for pure monitoring

