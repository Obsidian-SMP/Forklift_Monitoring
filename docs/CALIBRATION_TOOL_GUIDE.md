# Gateway RSSI Calibration Guide

## Quick Start

Run the automated calibration script:

```bash
cd /home/rpi/warehouse_iot/backend
python3 calibrate_gateways.py
```

## What the Script Does

### 1. **Auto-Detection**
- Finds all active gateways sending RSSI data
- Shows which gateways are available for calibration
- Lets you choose to calibrate all or specific gateways

### 2. **TX_POWER Calibration** (Required)
For each gateway:
- Prompts you to place Arduino beacon exactly 1 meter away
- Collects RSSI samples for 15 seconds (20+ samples)
- Calculates average RSSI = **TX_POWER**
- Shows statistics (mean, std deviation, quality check)

### 3. **Path Loss Exponent** (Optional)
If you want maximum accuracy:
- Prompts for measurements at 2m, 4m, and 8m distances
- Calculates path loss exponent (n)
- Improves distance estimation accuracy

### 4. **Auto-Update Configuration**
- Updates `positioning_engine.py` with calibrated TX_POWER
- Updates `gateway_config.py` with all calibrated values
- Or shows you exactly where to update manually

---

## Usage Example

```bash
$ python3 calibrate_gateways.py

======================================================================
              Gateway RSSI Calibration Tool
======================================================================

This tool will help you calibrate your positioning system for accuracy.
You will need:
  • Arduino beacon (forklift_001) powered on
  • Mobile gateway(s) running and sending RSSI data
  • Measuring tape
  • ~5-10 minutes per gateway

✓ Backend connected
✓ Found 3 active gateway(s):
  1. phone_1 (Gateway phone_1)
  2. phone_2 (Gateway phone_2)
  3. Sam (Gateway Sam)

Which gateways do you want to calibrate?
  1. All gateways
  2. Select specific gateways

Choice (1 or 2): 1

======================================================================
              TX_POWER Calibration: phone_1
======================================================================

SETUP INSTRUCTIONS:
  1. Place Arduino beacon EXACTLY 1.0 meter from gateway 'phone_1'
  2. Ensure CLEAR LINE-OF-SIGHT (no obstacles)
  3. Keep beacon and phone STATIONARY
  4. Beacon should be at same height as phone

Press ENTER when ready to start measurement...

ℹ Collecting RSSI samples for 15 seconds...
ℹ Please wait while measurements stabilize...

Progress: [##################################################] 100% (45 samples)
✓ Collected 45 RSSI samples

RSSI Statistics at 1 meter:
  Average (TX_POWER):  -48.3 dBm
  Median:              -48.0 dBm
  Std Deviation:       1.85 dBm
  Range:               -52 to -45 dBm
  Sample Count:        45

✓ Low variation (1.85 dBm) - Good measurement!

======================================================================
          Path Loss Exponent Calibration: phone_1
======================================================================

This step helps improve distance accuracy.
You'll need to measure RSSI at different distances: 2m, 4m, 8m

Do you want to calibrate path loss exponent? (y/n): y

SETUP: Place beacon at 2.0 meters from gateway
  - Use measuring tape for accuracy
  - Maintain line-of-sight

Press ENTER when ready...

[... repeats for each distance ...]

Calculated Path Loss Exponent:
  n = 2.15
✓ Good value for indoor line-of-sight

[... repeats for other gateways ...]

======================================================================
                    Calibration Summary
======================================================================

Calibrated Values:

phone_1:
  TX_POWER: -48.3 dBm
  Path Loss (n): 2.15

phone_2:
  TX_POWER: -47.8 dBm
  Path Loss (n): 2.22

Sam:
  TX_POWER: -49.1 dBm

Recommended TX_POWER (average): -48.4 dBm

Do you want to update the configuration files automatically? (y/n): y

✓ Updated /home/rpi/warehouse_iot/backend/app/services/positioning_engine.py
✓ Updated /home/rpi/warehouse_iot/backend/app/gateway_config.py

⚠️  IMPORTANT: Restart the backend to apply changes!
ℹ Run: cd /home/rpi/warehouse_iot/backend && python run.py

✓ Calibration complete! 🎉
```

---

## Tips for Best Results

### 1. **Stable Environment**
- Do calibration when warehouse is quiet (no forklifts moving)
- Minimize people movement near beacon/gateways
- Consistent results mean better accuracy

### 2. **Accurate Measurement**
- Use a real measuring tape, not estimation
- Measure from center of beacon to center of phone
- Keep height consistent (beacon and phone at same level)

### 3. **Clear Line-of-Sight**
- No obstacles between beacon and gateway
- No metal shelves, walls, or machinery blocking signal
- This is critical for accurate TX_POWER

### 4. **Multiple Runs**
- If std deviation is high (>3 dBm), repeat measurement
- Try different times of day if results vary
- Average multiple calibration runs for best results

---

## What Gets Updated

### File: `backend/app/services/positioning_engine.py`
**Line 276:**
```python
# Before:
_positioning_engine = PositioningEngine(update_interval=0.5, tx_power=-55)

# After:
_positioning_engine = PositioningEngine(update_interval=0.5, tx_power=-48.4)
```

### File: `backend/app/gateway_config.py`
**Lines 95-96:**
```python
# Before:
"TX_POWER": -55,  # dBm at 1 meter (MUST CALIBRATE)
"PATH_LOSS_N_LOS": 2.0,  # Line-of-sight path loss exponent

# After:
"TX_POWER": -48.4,  # Calibrated on 2026-02-04
"PATH_LOSS_N_LOS": 2.18,  # Calibrated
```

---

## After Calibration

### 1. **Restart Backend**
```bash
# Kill existing backend
pkill -f "python.*run.py"

# Start fresh
cd /home/rpi/warehouse_iot/backend
python run.py
```

### 2. **Test Position Accuracy**
```bash
# Place beacon at known position (e.g., center at 5.0, 5.0)
# Check calculated position:
curl http://localhost:5000/api/rssi/position/latest | python3 -m json.tool

# Calculate error
# Target: <1.5m with 3+ gateways, <1.0m with 4+ gateways
```

### 3. **Verify on Frontend**
- Open: http://localhost:8080/path-tracking
- Watch real-time position updates
- Move beacon and verify path follows correctly

---

## Troubleshooting

### "No active gateways found!"
- Make sure mobile app gateways are running
- Check backend logs: `tail -f /tmp/backend.log`
- Verify gateways are active: `curl http://localhost:5000/api/rssi/gateways`

### "Failed to collect enough samples"
- Ensure beacon is powered on and advertising
- Check beacon ID matches "forklift_001"
- Move beacon closer (RSSI might be too weak)
- Reduce interference (turn off other Bluetooth devices)

### "High variation detected"
- Environment too noisy (WiFi interference, people moving)
- Try calibrating at different time
- Ensure phone is on stable surface (not hand-held)
- Check beacon batteries (low power = unstable signal)

### "Cannot connect to backend"
- Ensure backend is running: `cd backend && python run.py`
- Check backend is on port 5000: `netstat -tlnp | grep 5000`

---

## Manual Update (If Auto-Update Fails)

If you chose not to auto-update or it failed:

1. Open `backend/app/services/positioning_engine.py`
2. Find line 276: `_positioning_engine = PositioningEngine(...)`
3. Change `tx_power=-55` to your calibrated value
4. Save and restart backend

Example:
```python
_positioning_engine = PositioningEngine(update_interval=0.5, tx_power=-48.4)
```

---

## Next Steps After Calibration

1. ✅ **Calibrate TX_POWER** (this script)
2. ✅ **Restart backend**
3. 📍 **Measure gateway positions** (use measuring tape)
4. 🔧 **Update gateway coordinates** in database
5. 🧪 **Test positioning accuracy**
6. 🎯 **Fine-tune if needed**

See main documentation for gateway position calibration.
