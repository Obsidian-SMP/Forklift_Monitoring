# Gateway Configuration for BLE/Bluetooth RSSI Trilateration
# These are the physical positions of each mobile phone (gateway) that receives RSSI signals
# Coordinates are in METERS relative to a reference point (e.g., warehouse corner)
# Z is typically the height of the phone (usually 2.0 meters for hand/chest height)

GATEWAYS = {
    "phone_1": {
        "name": "Gateway 1",
        "position": {"x": 0.0, "y": 0.0, "z": 1.5},
        "is_active": True,
        "description": "Bottom-Left corner"
    },
    "phone_2": {
        "name": "Gateway 2", 
        "position": {"x": 7.0, "y": 0.0, "z": 1.5},
        "is_active": True,
        "description": "Bottom-Right corner"
    },
    "phone_3": {
        "name": "Gateway 3",
        "position": {"x": 3.5, "y": 6.0, "z": 1.5},
        "is_active": True,
        "description": "Top center (forms triangle)"
    }
}

# RSSI to Distance Conversion Parameters
# These determine how accurate the distance calculation from RSSI is
RSSI_CONFIG = {
    "TX_POWER": -59,  # dBm at 1 meter (calibrated for your BLE beacon)
    "PATH_LOSS_EXPONENT": 2.0,  # 2.0 for small area, less obstacles
    "SMOOTHING_FACTOR": 0.5,  # Reduced smoothing for faster response
    "MIN_RSSI": -95,  # Minimum RSSI value (weaker signals ignored)
    "MAX_RSSI": -30,  # Maximum RSSI value (very close)
}

# Trilateration calculation parameters
TRILATERATION_CONFIG = {
    "MIN_GATEWAYS": 2,  # Minimum gateways needed (2 works, 3 is more accurate)
    "OUTLIER_THRESHOLD": 1.5,  # Standard deviations from mean (for filtering outliers)
    "MAX_POSITION_ERROR": 10.0,  # Maximum acceptable error in meters
    "SMOOTHING_ALPHA": 0.3,  # Kalman filter alpha for position smoothing (0.0-1.0)
}

# Warehouse dimensions
WAREHOUSE_DIMENSIONS = {
    "width_x": 10.0,  # Total width in X direction (meters)
    "length_y": 10.0,  # Total length in Y direction (meters)
    "height_z": 3.0,  # Ceiling height (meters)
}
