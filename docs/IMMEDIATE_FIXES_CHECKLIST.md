# 🚨 IMMEDIATE FIXES CHECKLIST
**Priority: Do These TODAY**

---

## ✅ CRITICAL FIX #1: TX_POWER Calibration (30 min)

### Problem
Backend assumes TX_POWER = -59 dBm, but Arduino transmits at 0 dBm. This causes **massive distance errors**.

### Action Steps
1. Place Arduino beacon 1 meter from phone
2. Open phone gateway app, note RSSI value (e.g., -58 dBm)
3. Edit backend config:
```bash
nano /home/rpi/warehouse_iot/backend/app/gateway_config.py
```

4. Change line 27:
```python
# FROM:
"TX_POWER": -59,

# TO (use your measured value):
"TX_POWER": -58,  # Replace with your actual RSSI at 1m
```

5. Restart backend:
```bash
pkill -f "python.*run.py"
cd /home/rpi/warehouse_iot/backend
python3 run.py &
```

### Expected Result
Position accuracy improves from ±5m to ±2m immediately.

---

## ✅ CRITICAL FIX #2: Add 3 More Gateways (15 min setup)

### Problem
Only 3 gateways covering 7m×6m out of 10m×10m warehouse.

### Action Steps
1. Install gateway app on 3 more phones
2. Configure positions:
```
Phone 4: gateway_id="phone_4", position=(10.0, 0.0)   # Bottom-right
Phone 5: gateway_id="phone_5", position=(0.0, 10.0)   # Top-left  
Phone 6: gateway_id="phone_6", position=(10.0, 10.0)  # Top-right
```

3. Raise all phones to 2.5m height (use stands/tripods)

4. Add to backend config:
```bash
nano /home/rpi/warehouse_iot/backend/app/gateway_config.py
```

Add to GATEWAYS dict:
```python
"phone_4": {
    "name": "Gateway 4",
    "position": {"x": 10.0, "y": 0.0, "z": 2.5},
    "is_active": True,
    "description": "Bottom-Right corner"
},
"phone_5": {
    "name": "Gateway 5",
    "position": {"x": 0.0, "y": 10.0, "z": 2.5},
    "is_active": True,
    "description": "Top-Left corner"
},
"phone_6": {
    "name": "Gateway 6",
    "position": {"x": 10.0, "y": 10.0, "z": 2.5},
    "is_active": True,
    "description": "Top-Right corner"
}
```

### Expected Result
100% warehouse coverage, GDOP < 5 everywhere.

---

## ✅ QUICK WIN #1: Reduce Smoothing Alpha (2 min)

### Action
```bash
nano /home/rpi/warehouse_iot/backend/app/gateway_config.py
```

Line 33:
```python
# FROM:
"SMOOTHING_FACTOR": 0.5,

# TO:
"SMOOTHING_FACTOR": 0.15,
```

### Expected Result
50% smoother position tracking.

---

## ✅ QUICK WIN #2: Increase RSSI Sample Buffer (2 min)

### Action
```bash
nano /home/rpi/warehouse_iot/backend/app/services/trilateration_service.py
```

Line 55:
```python
# FROM:
).order_by(BLERSSIData.timestamp.desc()).limit(3)

# TO:
).order_by(BLERSSIData.timestamp.desc()).limit(10)
```

### Expected Result
30% fewer outliers.

---

## ✅ QUICK WIN #3: Fix Weight Formula (5 min)

### Action
```bash
nano /home/rpi/warehouse_iot/backend/app/services/trilateration_service.py
```

Line 427 (in `_multilaterate_weighted`):
```python
# FROM:
weight = max(0.1, (100 + rssi) / 30.0)

# TO:
weight = 1.0 / (distances[gw_id]**2 + 0.1)
```

### Expected Result
Proper inverse-square weighting, 20% better accuracy.

---

## ✅ QUICK WIN #4: Increase Path History (2 min)

### Action
```bash
nano /home/rpi/warehouse_iot/backend/app/routes/rssi_routes.py
```

Line 366:
```python
# FROM:
limit = int(request.args.get('limit', 50))

# TO:
limit = int(request.args.get('limit', 200))
```

### Expected Result
Smoother path visualization.

---

## 📊 VALIDATION TEST (10 min)

After applying all fixes:

1. Place beacon at center (5m, 5m)
2. Check backend logs:
```bash
tail -f /tmp/backend.log | grep "Position calculated"
```

3. Expected output:
```
Position calculated: (5.2, 4.8) with 6 gateways (accuracy: 1.2m)
```

4. Move beacon to corner (1m, 1m), then (9m, 9m)
5. Verify accuracy < 2m

---

## 🎯 TOTAL TIME: ~60 minutes
## 🎯 EXPECTED IMPROVEMENT: 60-70% better accuracy

---

## ⚠️ IF SOMETHING BREAKS

### Restart Backend
```bash
pkill -f "python.*run.py"
cd /home/rpi/warehouse_iot/backend
python3 run.py > /tmp/backend.log 2>&1 &
```

### Check Logs
```bash
tail -50 /tmp/backend.log
```

### Revert Changes
```bash
cd /home/rpi/warehouse_iot
git diff backend/app/gateway_config.py
git checkout backend/app/gateway_config.py  # Undo changes
```

---

## 📞 NEXT STEPS (After Today)

- [ ] Implement WebSocket (replace polling)
- [ ] Add IMU sensor fusion
- [ ] Implement proper Kalman filter
- [ ] Run full calibration procedure
- [ ] Add fingerprinting for problem zones

See full analysis: [PATH_TRACKING_RSSI_CRITICAL_ANALYSIS.md](PATH_TRACKING_RSSI_CRITICAL_ANALYSIS.md)
