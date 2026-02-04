# Quick Start Guide - Path Tracking System Testing

## ⚡ Fast Start (5 Minutes)

### Step 1: Start Backend (30 seconds)

```bash
cd /home/rpi/warehouse_iot
python backend/run.py
```

**Expected Output:**
```
Positioning engine started
 * Running on http://0.0.0.0:5000
```

### Step 2: Start Frontend (30 seconds)

```bash
cd /home/rpi/warehouse_iot/frontend
npm run dev
```

**Expected Output:**
```
VITE ready in 500ms
Local: http://localhost:5173
```

### Step 3: Test SSE Stream (30 seconds)

Open new terminal:
```bash
curl -N http://10.136.57.165:5000/api/stream/positions
```

**Expected Output:** (should wait for position data)
```
data: {"x": 5.23, "y": 4.81, "accuracy": 0.75, "timestamp": "2024-01-01T10:30:00", ...}
```

### Step 4: Open Frontend (1 minute)

1. Open browser: `http://localhost:5173`
2. Navigate to "Path Tracking & Maps"
3. Look for connection indicator: **● Live Stream** (green)

---

## 🔧 Configure Gateways (Before First Run)

### Option 1: Use Default 4-Gateway Square

No changes needed! Default configuration:
- Gateway 1: (0, 0, 2.5) - Bottom-Left
- Gateway 2: (10, 0, 2.5) - Bottom-Right
- Gateway 3: (0, 10, 2.5) - Top-Left
- Gateway 4: (10, 10, 2.5) - Top-Right

### Option 2: Change Gateway Count

Edit `backend/app/gateway_config.py`:

**For 3 gateways (triangle):**
```python
GATEWAYS = GATEWAYS_3  # Line ~60
```

**For 5 gateways (square + center):**
```python
GATEWAYS = GATEWAYS_5
```

**For 6 gateways (full coverage):**
```python
GATEWAYS = GATEWAYS_6
```

### Option 3: Custom Gateway Positions

Edit `backend/app/gateway_config.py`:

```python
GATEWAYS_CUSTOM = {
    "phone_1": {
        "name": "Gateway 1",
        "position": {"x": 0.0, "y": 0.0, "z": 2.5},  # YOUR MEASURED VALUES
        "is_active": True,
    },
    # Add more gateways...
}

GATEWAYS = GATEWAYS_CUSTOM  # Activate custom config
```

---

## 📱 Configure Android Gateway Apps

### Update Backend URL

In each Android app:
1. Open Settings
2. Set Backend URL: `http://10.136.57.165:5000/api/rssi/receive`
3. Set Gateway ID: `phone_1`, `phone_2`, `phone_3`, `phone_4` (must match gateway_config.py)
4. Enable "Auto Send"

### Test Gateway Connection

From backend logs:
```bash
tail -f backend/logs/backend.log
```

Should see:
```
Received RSSI from phone_1: -65 dBm
Received RSSI from phone_2: -72 dBm
Received RSSI from phone_3: -68 dBm
Received RSSI from phone_4: -70 dBm
```

---

## ✅ Verify System Working

### Check 1: SSE Connection Active

Frontend should show:
```
Real-time forklift location and path history [● Live Stream]
```

If shows **● Connecting...**: Backend not running or SSE endpoint unreachable

### Check 2: Gateways Reporting

Frontend "Gateway Status" card should show:
```
Gateway Status (4)

Gateway 1               Gateway 2
Position: (0.0m, 0.0m)  Position: (10.0m, 0.0m)

Gateway 3               Gateway 4
Position: (0.0m, 10.0m) Position: (10.0m, 10.0m)
```

### Check 3: Position Calculation

After ~5 seconds of RSSI data:
- Frontend should show green dot on canvas
- "Current Position" card appears with coordinates
- Method shows one of:
  - **📊 4 Gateways (Optimized)** ← Best!
  - **📐 3 Gateways (Standard)** ← Good
  - **📍 2 Gateways (Limited)** ← Acceptable

### Check 4: Real-Time Updates

Watch the green dot:
- Should update every 500ms (2 Hz)
- Path history (red line) should grow
- No visible lag or stuttering

---

## 🐛 Troubleshooting

### Problem: Frontend shows "● Connecting..." forever

**Cause:** Backend not running or SSE endpoint blocked

**Fix:**
```bash
# Check backend running
ps aux | grep run.py

# Start backend if not running
cd /home/rpi/warehouse_iot
python backend/run.py

# Test SSE endpoint manually
curl -N http://10.136.57.165:5000/api/stream/positions
```

### Problem: No position data (no green dot)

**Cause:** Gateways not sending RSSI or too few gateways

**Fix:**
```bash
# Check backend logs
tail -f backend/logs/backend.log

# Should see:
# "Received RSSI from phone_X: -XX dBm"

# If not, check Android apps:
# 1. Backend URL correct?
# 2. Gateway ID matches gateway_config.py?
# 3. Auto-send enabled?
```

### Problem: Position wildly inaccurate (>3m error)

**Cause:** TX_POWER not calibrated

**Fix:**
1. Place beacon exactly 1 meter from one gateway
2. Observe RSSI in Android app (e.g., -48 dBm)
3. Update `backend/app/gateway_config.py`:
   ```python
   "TX_POWER": -48,  # Your measured value
   ```
4. Restart backend

### Problem: High latency (positions delayed >2 seconds)

**Cause:** Update interval too high or CPU overloaded

**Fix:**
```bash
# Check CPU usage
htop  # Should be <20% per core

# Check update interval
grep "UPDATE_INTERVAL" backend/app/gateway_config.py
# Should be: "UPDATE_INTERVAL": 0.5
```

---

## 📊 Validation Tests

### Test 1: Static Position (1 minute)

1. Place beacon at known position (e.g., 5.0m, 5.0m)
2. Wait 10 seconds for position to stabilize
3. Compare calculated vs. actual position

**Success Criteria:**
- Error < 1.0m with 4 gateways
- Error < 2.0m with 3 gateways

### Test 2: Moving Beacon (2 minutes)

1. Move beacon along straight line at ~0.5 m/s
2. Observe path visualization
3. Check velocity estimates

**Success Criteria:**
- Path is smooth (no jumps)
- Velocity ~0.5 m/s (±0.1)
- Red line follows actual path

### Test 3: Gateway Adaptation (2 minutes)

1. Start with 4 gateways → Method shows "Optimized"
2. Set one gateway `is_active: False` → Restart backend
3. Method should change to "Standard" (3 gateways)

**Success Criteria:**
- System continues working
- No crashes or errors
- Accuracy degrades gracefully

---

## 📈 Performance Monitoring

### Check Statistics Endpoint

```bash
curl http://10.136.57.165:5000/api/stream/statistics
```

**Expected Output:**
```json
{
  "total_calculations": 120,
  "successful_calculations": 115,
  "failed_calculations": 5,
  "success_rate": 95.8,
  "average_accuracy": 0.75,
  "gateway_count": 4,
  "update_interval": 0.5
}
```

**Good Metrics:**
- Success rate: >90%
- Average accuracy: <1.0m
- Gateway count: 4 (optimal)

### Monitor Backend Logs

```bash
tail -f backend/logs/backend.log | grep -E "Position|Error|Gateway"
```

**Healthy Output:**
```
Position calculated: (5.23, 4.81) ±0.75m [4 gateways]
Position calculated: (5.25, 4.83) ±0.73m [4 gateways]
Position calculated: (5.27, 4.85) ±0.71m [4 gateways]
```

**Unhealthy Output:**
```
Error: Not enough gateways (need 2+, got 1)
Error: WLS calculation failed (singular matrix)
Error: EKF update failed (invalid measurement)
```

---

## 🎯 Next Steps

### After Basic System Working:

1. **Calibrate TX_POWER** (10 minutes)
   - Follow [GATEWAY_CALIBRATION_GUIDE.md](GATEWAY_CALIBRATION_GUIDE.md)
   - Improves accuracy by 50-70%

2. **Optimize Gateway Positions** (30 minutes)
   - Measure exact coordinates with measuring tape
   - Update `gateway_config.py`
   - Verify line-of-sight to center of warehouse

3. **Add Zone Alerts** (5 minutes)
   - In frontend, click "+ Add Zone"
   - Draw restricted areas
   - Enable entry notifications

4. **Test with Multiple Beacons** (Phase 2)
   - Requires code changes (not yet implemented)
   - See [POSITIONING_SYSTEM_IMPLEMENTATION.md](POSITIONING_SYSTEM_IMPLEMENTATION.md) Section "Next Steps"

---

## 🆘 Quick Commands Reference

### Start Services
```bash
# Backend
python backend/run.py

# Frontend
cd frontend && npm run dev
```

### Stop Services
```bash
# Backend
pkill -f run.py

# Frontend
Ctrl+C in terminal
```

### Test Endpoints
```bash
# SSE stream (real-time positions)
curl -N http://10.136.57.165:5000/api/stream/positions

# Position history (JSON)
curl http://10.136.57.165:5000/api/stream/positions/history

# Statistics
curl http://10.136.57.165:5000/api/stream/statistics

# Latest position (REST API)
curl http://10.136.57.165:5000/api/rssi/position/latest
```

### Check Logs
```bash
# Backend logs
tail -f backend/logs/backend.log

# Gateway RSSI data
tail -f backend/logs/backend.log | grep "Received RSSI"

# Position calculations
tail -f backend/logs/backend.log | grep "Position"

# Errors only
tail -f backend/logs/backend.log | grep "Error"
```

### Restart Everything
```bash
# Stop all
pkill -f run.py
pkill -f "npm run dev"

# Start backend
cd /home/rpi/warehouse_iot
python backend/run.py &

# Start frontend
cd frontend
npm run dev &
```

---

## 📞 Support

For issues or questions:
1. Check [POSITIONING_SYSTEM_IMPLEMENTATION.md](POSITIONING_SYSTEM_IMPLEMENTATION.md) - Comprehensive troubleshooting
2. Check [GATEWAY_CALIBRATION_GUIDE.md](GATEWAY_CALIBRATION_GUIDE.md) - Calibration help
3. Review backend logs: `tail -f backend/logs/backend.log`
4. Test endpoints manually with `curl` commands above

---

**System Status:** ✅ Ready for Testing
**Expected Setup Time:** 5-10 minutes
**Expected Accuracy:** ±0.5-1m (4 gateways), ±1-2m (3 gateways)
**Update Rate:** 500ms (2 Hz real-time)
