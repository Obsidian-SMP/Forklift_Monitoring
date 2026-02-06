import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Flask
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-me')
    DEBUG = os.getenv('FLASK_DEBUG', 'True') == 'True'
    
    # Server
    HOST = os.getenv('HOST', '0.0.0.0')
    PORT = int(os.getenv('PORT', 5000))
    
    # SQLite Database
    DATABASE = os.getenv('DATABASE', 'warehouse_iot.db')
    
    # MQTT
    MQTT_BROKER = os.getenv('MQTT_BROKER', 'localhost')
    MQTT_PORT = int(os.getenv('MQTT_PORT', 1883))
    MQTT_USERNAME = os.getenv('MQTT_USERNAME', '')
    MQTT_PASSWORD = os.getenv('MQTT_PASSWORD', '')
    MQTT_KEEPALIVE = int(os.getenv('MQTT_KEEPALIVE', 60))
    
    # MQTT Topics
    MQTT_TOPICS = {
        'forklift': os.getenv('MQTT_TOPIC_FORKLIFT', 'warehouse/forklift/+/data'),
        'warehouse': os.getenv('MQTT_TOPIC_WAREHOUSE', 'warehouse/environment/data'),
        'camera': os.getenv('MQTT_TOPIC_CAMERA', 'warehouse/forklift/+/image'),
        'gps': os.getenv('MQTT_TOPIC_GPS', 'warehouse/forklift/+/gps'),
        'vibration': os.getenv('MQTT_TOPIC_VIBRATION', 'warehouse/forklift/+/vibration')
    }
    
    # Image Processing
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads/images')
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))
    
    # YOLO Model Configuration
    YOLO_MODEL = os.getenv('YOLO_MODEL', 'my_model.pt')  # Custom trained model
    
    # AI Detection Settings - Optimized for Raspberry Pi
    AI_PROCESS_EVERY_N = int(os.getenv('AI_PROCESS_EVERY_N', 1))  # Process every image (set to 1 for real-time)
    AI_CONFIDENCE = float(os.getenv('AI_CONFIDENCE', 0.65))  # Confidence threshold
    AI_INPUT_SIZE = int(os.getenv('AI_INPUT_SIZE', 416))  # Input image size
    AI_IOU_THRESHOLD = float(os.getenv('AI_IOU_THRESHOLD', 0.45))  # NMS IOU threshold
    AI_QUEUE_PRIORITY = os.getenv('AI_QUEUE_PRIORITY', 'latest')  # 'latest' = drop old frames, 'all' = process all
    
    # Image Compression for faster transfer
    IMAGE_COMPRESSION_QUALITY = int(os.getenv('IMAGE_COMPRESSION_QUALITY', 75))  # 75% quality = ~70% size reduction
    
    # Class filtering - Empty list = detect all classes from custom model
    ALLOWED_CLASSES = []
    
    # Alert Thresholds
    TEMP_MIN = float(os.getenv('TEMP_MIN', 15))
    TEMP_MAX = float(os.getenv('TEMP_MAX', 30))
    HUMIDITY_MIN = float(os.getenv('HUMIDITY_MIN', 30))
    HUMIDITY_MAX = float(os.getenv('HUMIDITY_MAX', 70))
    VIBRATION_THRESHOLD = float(os.getenv('VIBRATION_THRESHOLD', 5.0))
    
    # Data Retention
    SENSOR_DATA_RETENTION = int(os.getenv('SENSOR_DATA_RETENTION', 7))
    GPS_DATA_RETENTION = int(os.getenv('GPS_DATA_RETENTION', 30))
