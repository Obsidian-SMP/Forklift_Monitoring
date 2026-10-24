# Gateway Configuration for BLE/Bluetooth RSSI Trilateration
# Supports 3-6 gateways with dynamic adaptation
# System automatically adjusts positioning algorithm based on available gateways

# RECOMMENDED CONFIGURATIONS:

# === 3 GATEWAYS (Triangle) - MINIMUM, GOOD ===
# Position phones in triangle for basic coverage
GATEWAYS_3 = {
    "phone_1": {
        "name": "Gateway 1",
        "position": {"x": 0.0, "y": 0.0, "z": 2.5},
        "is_active": True,
        "description": "Bottom-Left corner"
    },
    "phone_2": {
        "name": "Gateway 2", 
        "position": {"x": 10.0, "y": 0.0, "z": 2.5},
        "is_active": True,
        "description": "Bottom-Right corner"
    },
    "phone_3": {
        "name": "Gateway 3",
        "position": {"x": 5.0, "y": 10.0, "z": 2.5},
        "is_active": True,
        "description": "Top center"
    }
}

# === 4 GATEWAYS (Square) - OPTIMAL, RECOMMENDED ===
# Position phones at corners for excellent coverage
GATEWAYS_4 = {
    "phone_1": {
        "name": "Gateway 1",
        "position": {"x": 0.0, "y": 0.0, "z": 2.5},
        "is_active": True,
        "description": "Bottom-Left corner"
    },
    "phone_2": {
        "name": "Gateway 2", 
        "position": {"x": 10.0, "y": 0.0, "z": 2.5},
        "is_active": True,
        "description": "Bottom-Right corner"
    },
    "phone_3": {
        "name": "Gateway 3",
        "position": {"x": 0.0, "y": 10.0, "z": 2.5},
        "is_active": True,
        "description": "Top-Left corner"
    },
    "phone_4": {
        "name": "Gateway 4",
        "position": {"x": 10.0, "y": 10.0, "z": 2.5},
        "is_active": True,
        "description": "Top-Right corner"
    }
}

# === 5 GATEWAYS (Square + Center) - EXCELLENT ===
GATEWAYS_5 = {
    **GATEWAYS_4,
    "phone_5": {
        "name": "Gateway 5",
        "position": {"x": 5.0, "y": 5.0, "z": 2.5},
        "is_active": True,
        "description": "Center point"
    }
}

# === 6 GATEWAYS (Full Coverage) - MAXIMUM ACCURACY ===
GATEWAYS_6 = {
    **GATEWAYS_4,
    "phone_5": {
        "name": "Gateway 5",
        "position": {"x": 0.0, "y": 5.0, "z": 2.5},
        "is_active": True,
        "description": "Left midpoint"
    },
    "phone_6": {
        "name": "Gateway 6",
        "position": {"x": 10.0, "y": 5.0, "z": 2.5},
        "is_active": True,
        "description": "Right midpoint"
    }
}

# === ACTIVE CONFIGURATION ===
# Change this to GATEWAYS_3, GATEWAYS_4, GATEWAYS_5, or GATEWAYS_6
GATEWAYS = GATEWAYS_4  # Default: 4 gateways (optimal)

# Per-gateway calibration overrides (gateway_id -> {'tx_power': float, 'path_loss_n': float})
# Gateways not listed here will fall back to baseline RSSI_CONFIG
GATEWAY_CALIBRATION = {
    # e.g.:
    # "phone_1": {"tx_power": -64.0, "path_loss_n": 1.71},
    # "phone_2": {"tx_power": -62.5, "path_loss_n": 1.80},
}

# RSSI to Distance Conversion Parameters
# IMPORTANT: Calibrate TX_POWER for your specific Arduino Nano 33 IoT beacon!
# See calibration guide in PATH_TRACKING_RSSI_CRITICAL_ANALYSIS.md
RSSI_CONFIG = {
    "TX_POWER": -64.0,  # Baseline calibrated on 2026-02-06
    "PATH_LOSS_N_LOS": 1.71,  # Baseline Line-of-sight path loss exponent
    "PATH_LOSS_N_NLOS": 3.5,  # Non-line-of-sight (through obstacles)
    "LOS_THRESHOLD": -70,  # RSSI threshold for LOS detection (dBm)
    "SMOOTHING_ALPHA": 0.40,  # Light EMA smoothing factor (higher = more responsive for raw values)
    "BUFFER_SIZE": 10,  # Number of RSSI samples to keep per gateway
    "MAX_AGE_SECONDS": 2.0,  # Maximum age of RSSI samples to consider (reduced from 10s to 2s to remove movement lag)
    "MIN_SAMPLES": 3,  # Minimum samples required per gateway (reduced from 3 to 1 for fast response)
    "MIN_RSSI": -95,  # Minimum RSSI value (weaker signals ignored)
    "MAX_RSSI": -30,  # Maximum RSSI value (very close)
}

# Trilateration/Positioning Parameters
TRILATERATION_CONFIG = {
    "MIN_GATEWAYS": 2,  # Minimum gateways needed (2=bilateration, 3+=trilateration)
    "UPDATE_INTERVAL": 0.5,  # Position calculation interval (seconds) - 2 Hz
    "MAX_POSITION_ERROR": 10.0,  # Maximum acceptable error in meters
    "PROCESS_NOISE": 0.3,  # EKF process noise (reduced for smoother motion)
    "MEASUREMENT_NOISE": 9.0,  # EKF measurement noise (increased to reduce trust in noisy RSSI)
}

# Warehouse dimensions
WAREHOUSE_DIMENSIONS = {
    "width_x": 10.0,  # Total width in X direction (meters)
    "length_y": 10.0,  # Total length in Y direction (meters)
    "height_z": 3.0,  # Ceiling height (meters)
}


def get_gateway_params(gateway_id: str) -> dict:
    """
    Get calibration parameters for a specific gateway,
    falling back to global RSSI_CONFIG baseline if not customized.
    """
    params = {
        "tx_power": RSSI_CONFIG["TX_POWER"],
        "n_los": RSSI_CONFIG["PATH_LOSS_N_LOS"],
        "n_nlos": RSSI_CONFIG["PATH_LOSS_N_NLOS"],
        "los_threshold": RSSI_CONFIG["LOS_THRESHOLD"],
    }

    # Check per-gateway calibration override
    if gateway_id in GATEWAY_CALIBRATION:
        gw_cal = GATEWAY_CALIBRATION[gateway_id]
        if "tx_power" in gw_cal and gw_cal["tx_power"] is not None:
            params["tx_power"] = float(gw_cal["tx_power"])
        if "path_loss_n" in gw_cal and gw_cal["path_loss_n"] is not None:
            params["n_los"] = float(gw_cal["path_loss_n"])

    # Also check if declared in active GATEWAYS dict
    elif gateway_id in GATEWAYS:
        gw_info = GATEWAYS[gateway_id]
        if "tx_power" in gw_info and gw_info["tx_power"] is not None:
            params["tx_power"] = float(gw_info["tx_power"])
        if "path_loss_n" in gw_info and gw_info["path_loss_n"] is not None:
            params["n_los"] = float(gw_info["path_loss_n"])

    return params

