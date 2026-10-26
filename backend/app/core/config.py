# ==============================================================================
# File: app/core/config.py
# Description: Central Configuration Module for Warehouse IoT Backend.
# Purpose: Manages all environmental settings, system thresholds, hardware
#          parameters, database configurations, and computer vision constants
#          in a unified, strongly-typed configuration structure.
# ==============================================================================

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from the backend directory if present
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")


class Config:
    """Central configuration class with sensible defaults for laptop deployment."""

    # -------------------------------------------------------------------------
    # Server & Networking
    # -------------------------------------------------------------------------
    SECRET_KEY = os.getenv("SECRET_KEY", "warehouse-iot-secret-key-laptop")
    DEBUG = os.getenv("DEBUG", "False").lower() in ("true", "1", "t")
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", 5000))
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

    # -------------------------------------------------------------------------
    # Database Settings
    # -------------------------------------------------------------------------
    DATABASE_PATH = os.getenv(
        "DATABASE_PATH", str(BASE_DIR / "warehouse_iot_revised.db")
    )

    # -------------------------------------------------------------------------
    # Storage & Uploads
    # -------------------------------------------------------------------------
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", str(BASE_DIR / "uploads"))
    INVENTORY_IMAGES_FOLDER = os.path.join(UPLOAD_FOLDER, "inventory")
    MAP_IMAGES_FOLDER = os.path.join(UPLOAD_FOLDER, "maps")

    # -------------------------------------------------------------------------
    # Positioning Engine & Signal Parameters
    # -------------------------------------------------------------------------
    # Baseline beacon transmit power at 1 meter distance (calibrated for Arduino Nano 33 IoT)
    BLE_TX_POWER_1M = float(os.getenv("BLE_TX_POWER_1M", -69.2))
    
    # Path loss exponent (indoor warehouse line-of-sight environment)
    BLE_PATH_LOSS_EXPONENT = float(os.getenv("BLE_PATH_LOSS_EXPONENT", 2.0))
    
    # Maximum age of gateway RSSI readings to consider active (seconds)
    RSSI_MAX_AGE_SECONDS = float(os.getenv("RSSI_MAX_AGE_SECONDS", 2.0))
    
    # Positioning engine calculation frequency (seconds, 0.2s = 5 Hz)
    POSITIONING_INTERVAL_SECONDS = float(os.getenv("POSITIONING_INTERVAL_SECONDS", 0.2))

    # Extended Kalman Filter parameters
    EKF_PROCESS_NOISE = float(os.getenv("EKF_PROCESS_NOISE", 0.25))
    EKF_MEASUREMENT_NOISE = float(os.getenv("EKF_MEASUREMENT_NOISE", 4.0))

    # Warehouse default dimensions (meters)
    WAREHOUSE_WIDTH_METERS = float(os.getenv("WAREHOUSE_WIDTH_METERS", 20.0))
    WAREHOUSE_LENGTH_METERS = float(os.getenv("WAREHOUSE_LENGTH_METERS", 20.0))

    # -------------------------------------------------------------------------
    # ESP32-CAM & Computer Vision
    # -------------------------------------------------------------------------
    # Optional stream URL if pulling directly from ESP32-CAM (Pattern B)
    ESP32_STREAM_URL = os.getenv("ESP32_STREAM_URL", "http://192.168.1.100:80/")
    
    # YOLO Model Configuration
    YOLO_MODEL_PATH = os.getenv(
        "YOLO_MODEL_PATH", str(BASE_DIR / "models" / "yolov8n.pt")
    )
    AI_CONFIDENCE_THRESHOLD = float(os.getenv("AI_CONFIDENCE_THRESHOLD", 0.60))
    AI_IOU_THRESHOLD = float(os.getenv("AI_IOU_THRESHOLD", 0.45))
    AI_INFERENCE_FPS = float(os.getenv("AI_INFERENCE_FPS", 5.0))

    # Region of Interest (ROI) pallet mask: [ymin, xmin, ymax, xmax] as fractions of image
    # E.g., [0.4, 0.1, 1.0, 0.9] evaluates lower 60% of frame where forks are located
    ROI_PALLET_MASK = [0.35, 0.05, 1.0, 0.95]

    # M/N-K Sliding Window State Machine for Load/Unload Detection (Zhao et al., IEEE JIOT 2020)
    # Target must be detected >= M times in N cycles to trigger LOAD
    LOAD_WINDOW_N = int(os.getenv("LOAD_WINDOW_N", 5))
    LOAD_THRESHOLD_M = int(os.getenv("LOAD_THRESHOLD_M", 3))
    # Target must disappear for K cycles to trigger UNLOAD
    UNLOAD_WINDOW_K = int(os.getenv("UNLOAD_WINDOW_K", 5))

    # -------------------------------------------------------------------------
    # Safety & Thresholds
    # -------------------------------------------------------------------------
    VIBRATION_IMPACT_THRESHOLD_G = float(os.getenv("VIBRATION_IMPACT_THRESHOLD_G", 5.0))
    MAX_SPEED_THRESHOLD_MPS = float(os.getenv("MAX_SPEED_THRESHOLD_MPS", 4.0))

    TEMP_MIN_CELSIUS = float(os.getenv("TEMP_MIN_CELSIUS", 15.0))
    TEMP_MAX_CELSIUS = float(os.getenv("TEMP_MAX_CELSIUS", 32.0))
    HUMIDITY_MIN_PERCENT = float(os.getenv("HUMIDITY_MIN_PERCENT", 25.0))
    HUMIDITY_MAX_PERCENT = float(os.getenv("HUMIDITY_MAX_PERCENT", 75.0))

    # -------------------------------------------------------------------------
    # Logging & Observability
    # -------------------------------------------------------------------------
    LOG_DIR = str(BASE_DIR / "logs")
    LOG_FILE_PATH = os.path.join(LOG_DIR, "system.log")
    LOG_MAX_BYTES = 10 * 1024 * 1024  # 10 MB per file
    LOG_BACKUP_COUNT = 3
    IN_MEMORY_LOG_LIMIT = int(os.getenv("IN_MEMORY_LOG_LIMIT", 1000))
