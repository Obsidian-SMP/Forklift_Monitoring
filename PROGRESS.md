# BLE RSSI Positioning & Calibration Optimization Progress

## Overview
This document tracks the enhancements to the Forklift Monitoring BLE RSSI positioning pipeline, per-gateway calibration, and algorithm accuracy optimizations.

---

## Task Checklist

- [x] **1. Create & Initialize Tracking Documentation**
  - [x] Create `PROGRESS.md` with complete implementation plan.

- [x] **2. Gateway Configuration & Per-Gateway Parameter Architecture** ([backend/app/gateway_config.py](file:///d:/sam/Projects/Major_Project/Forklift_Monitoring/backend/app/gateway_config.py))
  - [x] Added `GATEWAY_CALIBRATION` dictionary for per-gateway overrides (`tx_power`, `path_loss_n`).
  - [x] Implemented `get_gateway_params(gateway_id)` to resolve per-gateway calibration falling back to `RSSI_CONFIG` baseline.
  - [x] Updated baseline parameters: `MAX_AGE_SECONDS = 2.0`, `MIN_SAMPLES = 1`, `SMOOTHING_ALPHA = 0.40`.

- [x] **3. WLS Trilateration Engine Enhancements** ([backend/app/services/trilateration_wls.py](file:///d:/sam/Projects/Major_Project/Forklift_Monitoring/backend/app/services/trilateration_wls.py))
  - [x] Updated `rssi_to_distance()` to accept optional per-gateway `tx_power` and `n_los`.
  - [x] Updated `calculate_position()` to accept `gateway_params` list and convert each gateway's RSSI using its calibrated $TX\_POWER$.
  - [x] Retained all gateways in WLS optimization without premature residual rejection (as requested).

- [x] **4. RSSI Pre-Processing Streamlining for Raw Signals** ([backend/app/services/rssi_processor.py](file:///d:/sam/Projects/Major_Project/Forklift_Monitoring/backend/app/services/rssi_processor.py))
  - [x] Reduced default time window from 10.0s to 2.0s (`max_age_seconds=2.0`) to eliminate historical tracking lag.
  - [x] Reduced sample requirement from 3 to 1: single raw samples return immediately without blocking.
  - [x] Replaced heavy 5-tap median with responsive 3-tap median + light EMA, leaving kinematic trajectory filtering to the EKF.

- [x] **5. Unified Positioning Engine Synchronization & Bug Fixes** ([backend/app/services/positioning_engine.py](file:///d:/sam/Projects/Major_Project/Forklift_Monitoring/backend/app/services/positioning_engine.py))
  - [x] Removed hardcoded `tx_power=-58.0` in `get_positioning_engine()`; dynamically binds to `RSSI_CONFIG['TX_POWER']` (-64.0 dBm baseline).
  - [x] Updated `_update_gateway_cache()` to cache per-gateway `tx_power` and `n_los`.
  - [x] Passed per-gateway parameters into `WLSTrilateration.calculate_position(..., gateway_params=...)`.
  - [x] **Fixed SQLite database crash**: Aligned fields to match `ForkliftPositionTrilateration` schema (`accuracy`, `velocity_x`, `velocity_y`, `speed`, `average_rssi`).
  - [x] Connected `/api/rssi/position/calculate` route in `rssi_routes.py` to `get_positioning_engine()`.

- [x] **6. Calibration Script Modernization** ([backend/calibrate_gateways.py](file:///d:/sam/Projects/Major_Project/Forklift_Monitoring/backend/calibrate_gateways.py))
  - [x] Replaced hardcoded `/home/rpi/...` Linux paths with dynamic script-relative pathing (`GATEWAY_CONFIG_PATH`).
  - [x] Updated `update_gateway_config()` to save individual gateway calibrations into `GATEWAY_CALIBRATION` and average into `RSSI_CONFIG['TX_POWER']`.

- [x] **7. Verification & Testing**
  - [x] Tested per-gateway parameter resolution and fallback behavior.
  - [x] Validated WLS calculation with per-gateway parameters.
  - [x] Verified immediate raw 1-sample and 2-sample handling in `RSSIProcessor`.
  - [x] Verified positioning engine initialization and tx_power binding.
