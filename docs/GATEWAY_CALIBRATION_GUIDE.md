# Gateway Calibration Guide for RSSI Positioning System

## Critical Calibration Steps

### Step 1: TX_POWER Calibration (MUST DO!)

The TX_POWER parameter is the **single most important** calibration value. Current system assumes -55 dBm, but your Arduino Nano 33 IoT may differ.

**How to Calibrate:**

1. Place Arduino beacon exactly 1 meter from one Android phone
2. Ensure clear line-of-sight (no obstacles)
3. Open Android app and observe RSSI readings
4. Wait 10-15 seconds for values to stabilize
5. Record the **average RSSI** value (e.g., -48 dBm)
6. Update `backend/app/gateway_config.py`:
   ```python
   "TX_POWER": -48,  # Your measured value
   ```

**Why this matters:**
- 1 dB error = ~0.4m position error
- Current -55 dBm assumption could be off by 5-10 dB!
- This is the #1 cause of trilateration failures

### Step 2: Gateway Physical Positioning

**For 10m × 10m warehouse (OPTIMAL - 4 GATEWAYS):**

```
Gateway 3 (0, 10)  ───────────  Gateway 4 (10, 10)
      │                              │
      │                              │
      │                              │
      │         CENTER               │
      │         (5, 5)               │
      │                              │
      │                              │
      │                              │
Gateway 1 (0, 0)   ───────────  Gateway 2 (10, 0)
```

**Mounting Requirements:**
- Height: 2.0-2.5 meters (consistent across all gateways)
- Mount phones on tripods or wall mounts
- Ensure phones stay plugged in (won't die during operation)
- Orient phones vertically (portrait mode)
- Clear line-of-sight to center of warehouse

**Alternative Configurations:**

**3 Gateways (Triangle):**
```
        Gateway 3 (5, 10)
           /        \
          /          \
         /            \
        /              \
Gateway 1 (0, 0) ─── Gateway 2 (10, 0)
```

**6 Gateways (Maximum Accuracy):**
```
GW3 ───── GW5 ───── GW4
 │                   │
 │                   │
GW6      CENTER     GW7
 │                   │
 │                   │
GW1 ───── GW2 ───── GW8
```

### Step 3: Measure Gateway Coordinates

Use a measuring tape to measure exact positions:

1. Choose reference point (e.g., bottom-left corner = 0, 0)
2. Measure X (horizontal) distance from reference
3. Measure Y (vertical) distance from reference
4. Measure Z (height from ground)
5. Update `gateway_config.py`:

```python
GATEWAYS_4 = {
    "phone_1": {
        "name": "Gateway 1",
        "position": {"x": 0.0, "y": 0.0, "z": 2.5},  # MEASURED VALUES
        ...
    },
    ...
}
```

### Step 4: Path Loss Exponent Calibration (Optional, Advanced)

If positioning accuracy is still poor after TX_POWER calibration:

**Test for Line-of-Sight (LOS) Exponent:**
1. Place beacon at known distances: 1m, 2m, 4m, 8m
2. Ensure clear line-of-sight
3. Record average RSSI at each distance
4. Calculate path loss exponent:
   ```
   n = (RSSI_1m - RSSI_8m) / (10 * log10(8))
   ```
5. Typical values:
   - Free space: n = 2.0
   - Indoor LOS: n = 1.6-2.4
   - Indoor NLOS: n = 3.0-4.5

**Update `gateway_config.py`:**
```python
"PATH_LOSS_N_LOS": 2.2,  # Your calculated value
"PATH_LOSS_N_NLOS": 3.8,  # Measure through obstacles
```

### Step 5: Verify System Operation

**Test 1: Static Position Test**
1. Place beacon at known position (e.g., 5.0, 5.0)
2. Run system and observe calculated position
3. Calculate error: `sqrt((x_calc - x_actual)^2 + (y_calc - y_actual)^2)`
4. Target: < 1.0m error with 4+ gateways

**Test 2: Path Tracking Test**
1. Move beacon along straight line at constant speed
2. Observe frontend visualization
3. Check for:
   - Smooth trajectory (no jumps)
   - Reasonable velocity estimates
   - Low latency (< 1 second)

**Test 3: Dynamic Gateway Test**
1. Start with 4 gateways
2. Disable one gateway (set `is_active: False`)
3. System should automatically adapt
4. Position should still calculate (degraded accuracy OK)

### Step 6: Fine-Tuning

If accuracy issues persist:

**Increase RSSI Smoothing (reduces noise, increases lag):**
```python
"SMOOTHING_ALPHA": 0.05,  # Default 0.1, lower = more smoothing
"BUFFER_SIZE": 15,  # Default 10, higher = more filtering
```

**Adjust EKF Noise Parameters:**
```python
"PROCESS_NOISE": 0.3,  # Default 0.5, lower = trust model more
"MEASUREMENT_NOISE": 3.0,  # Default 4.0, lower = trust RSSI more
```

**LOS Threshold Tuning:**
```python
"LOS_THRESHOLD": -65,  # Default -70, adjust based on environment
```

## Expected Accuracy

| Gateways | Configuration | Expected Error | GDOP      |
|----------|---------------|----------------|-----------|
| 2        | Bilateration  | ±2-3m          | 5.0-10.0  |
| 3        | Trilateration | ±1-2m          | 2.0-4.0   |
| 4        | WLS (Square)  | ±0.5-1m        | 1.0-2.0   |
| 5        | WLS + Center  | ±0.4-0.8m      | 0.8-1.5   |
| 6        | WLS Full      | ±0.3-0.6m      | 0.6-1.2   |

## Troubleshooting

**Problem: Positions jumping around wildly**
- Solution 1: Calibrate TX_POWER correctly
- Solution 2: Increase RSSI smoothing (lower SMOOTHING_ALPHA)
- Solution 3: Check for RF interference (WiFi, other BLE devices)

**Problem: Positions not updating**
- Check gateway Android apps are running
- Verify gateways sending HTTP POST to correct URL
- Check backend logs: `tail -f logs/backend.log`
- Verify SSE stream: Open browser dev tools → Network tab

**Problem: Poor accuracy (error > 2m with 4 gateways)**
- Recalibrate TX_POWER (most common issue)
- Check gateway positions are measured accurately
- Verify gateways have line-of-sight to beacon
- Increase gateway count to 5-6

**Problem: High latency (positions delayed > 2 seconds)**
- Check positioning engine update interval (should be 0.5s)
- Verify frontend SSE reconnection (check for repeated connect/disconnect)
- Monitor backend CPU usage (should be < 20%)

## Maintenance

**Weekly:**
- Check gateway phones are charged/plugged in
- Verify all gateways reporting (check backend statistics endpoint)
- Review positioning accuracy with test beacon

**Monthly:**
- Recalibrate TX_POWER (beacon battery/temperature affects output)
- Clean gateway phone camera lenses (if using for other purposes)
- Update gateway positions if phones moved

## Next Steps

After basic system working:
1. **IMU Sensor Fusion**: Add accelerometer data for dead reckoning
2. **Database Persistence**: Store calculated positions for historical analysis
3. **Alert Zones**: Define restricted areas with automatic alerts
4. **Multi-Beacon Support**: Track multiple forklifts simultaneously
5. **Predictive Maintenance**: Use path patterns for collision prediction
