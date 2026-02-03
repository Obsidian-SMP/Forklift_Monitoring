from app import create_app, socketio
from app.config import Config
import os
import sys
import threading
import time
import gc

# Optimize for Raspberry Pi
os.environ['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'  # Fallback for unsupported ops
os.environ['OMP_NUM_THREADS'] = '2'  # Limit OpenMP threads to reduce memory
os.environ['MKL_NUM_THREADS'] = '2'  # Limit MKL threads

# Download YOLO models if needed (for ESP32-CAM object detection)
def setup_models():
    """Download YOLO models for object detection"""
    try:
        from app.espcam import download_models
        models_dir = os.path.join(os.path.dirname(__file__), 'app')
        print("\n" + "="*60)
        print("ESP32-CAM Object Detection Setup (Optimized for Raspberry Pi)")
        print("="*60)
        download_models(models_dir)
        print("="*60 + "\n")
    except Exception as e:
        print(f"Warning: Could not download YOLO models: {e}")
        print("Object detection from ESP32-CAM may not work without models.\n")

# Cleanup old images every 2 minutes
def cleanup_old_images():
    """Delete images older than 2 minutes to save storage (except AI detected objects)"""
    while True:
        try:
            time.sleep(120)  # Wait 2 minutes
            upload_folder = Config.UPLOAD_FOLDER
            if os.path.exists(upload_folder):
                current_time = time.time()
                deleted_count = 0
                kept_count = 0
                for filename in os.listdir(upload_folder):
                    filepath = os.path.join(upload_folder, filename)
                    if os.path.isfile(filepath):
                        # Skip files with object names - these are AI detections (YOLO 80 classes)
                        # Check if filename starts with any object type followed by dash and number
                        # This matches patterns like: "dog-001_...", "cell phone-023_...", etc.
                        is_ai_detection = False
                        
                        # All YOLO class names from coco.names
                        yolo_classes = [
                            'person', 'bicycle', 'car', 'motorbike', 'aeroplane', 'bus', 'train', 'truck', 'boat',
                            'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
                            'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
                            'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
                            'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
                            'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
                            'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake',
                            'chair', 'sofa', 'pottedplant', 'bed', 'diningtable', 'toilet', 'tvmonitor', 'laptop',
                            'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
                            'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
                        ]
                        
                        # Check if filename starts with "classname-" pattern
                        for class_name in yolo_classes:
                            if filename.startswith(f"{class_name}-"):
                                is_ai_detection = True
                                kept_count += 1
                                break
                        
                        if is_ai_detection:
                            continue  # Don't delete AI detected objects
                        
                        # Delete regular camera frames older than 2 minutes (120 seconds)
                        if current_time - os.path.getmtime(filepath) > 120:
                            os.remove(filepath)
                            deleted_count += 1
                            
                if deleted_count > 0 or kept_count > 0:
                    print(f"[CLEANUP] Deleted {deleted_count} old camera frames (>2 min), kept {kept_count} AI detections")
        except Exception as e:
            print(f"[CLEANUP] Error: {e}")

# Save DHT readings to database every 60 seconds
def save_dht_readings():
    """Background thread to save DHT readings to database for historical data"""
    from app.services.dht_sensor import get_dht_reading
    from app.models import WarehouseSensor
    
    while True:
        try:
            time.sleep(60)  # Wait 1 minute
            
            reading = get_dht_reading()
            
            if reading and reading.get('status') in ['success', 'unavailable']:
                WarehouseSensor.create(
                    temperature=reading['temperature'],
                    humidity=reading['humidity'],
                    sensor_id='dht11_gpio21'
                )
                print(f"[DHT] Saved: {reading['temperature']}°C, {reading['humidity']}%")
                
        except Exception as e:
            print(f"[DHT] Save error: {e}")

app = create_app()

# Initialize AI worker
def init_ai():
    """Initialize AI detection worker"""
    try:
        from app.services.ai_worker import init_ai_worker
        worker = init_ai_worker(app)
        if worker and worker.model:
            print("[AI] Background AI detection worker initialized")
        else:
            print("[AI] AI detection disabled (YOLO not available)")
    except Exception as e:
        print(f"[AI] Could not initialize AI worker: {e}")

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🏭 WAREHOUSE IoT MONITORING SYSTEM (Raspberry Pi Optimized)")
    print("="*60)
    
    # Setup models
    setup_models()
    
    # Display configuration
    print(f"Server Address: http://{Config.HOST}:{Config.PORT}")
    print(f"MQTT Broker: {Config.MQTT_BROKER}:{Config.MQTT_PORT}")
    print(f"Database: {Config.DATABASE}")
    print(f"Upload Folder: {Config.UPLOAD_FOLDER}")
    print(f"YOLO Model: {Config.YOLO_MODEL}")
    print(f"AI Confidence: {Config.AI_CONFIDENCE}")
    print(f"AI Input Size: {Config.AI_INPUT_SIZE}x{Config.AI_INPUT_SIZE}")
    print("\n📡 Active Services:")
    print("  ✓ REST API (Flask)")
    print("  ✓ WebSocket (SocketIO)")
    print("  ✓ MQTT Client")
    print("  ✓ ESP32-CAM Image Upload")
    print("  ✓ AI Detection (optimized: every frame, 65% confidence, 416px)")
    print("  ✓ Image Cleanup (every 2 minutes)")
    print("  ✓ BLE/WiFi Position Tracking")
    print("  ✓ DHT11 Temperature/Humidity")
    print("  ✓ Vibration Monitoring")
    print("\n" + "="*60)
    print("🚀 Server Starting...")
    print("="*60 + "\n")
    
    # Initialize AI worker
    init_ai()
    
    # Start image cleanup thread
    cleanup_thread = threading.Thread(target=cleanup_old_images, daemon=True)
    cleanup_thread.start()
    print("[CLEANUP] Image cleanup task started (runs every 2 minutes)\n")
    
    # Start DHT database storage thread
    dht_thread = threading.Thread(target=save_dht_readings, daemon=True)
    dht_thread.start()
    print("[DHT] Database storage task started (saves every 60 seconds)\n")
    
    # Periodic garbage collection for RPi memory management
    def periodic_gc():
        while True:
            time.sleep(300)  # Every 5 minutes
            gc.collect()
    gc_thread = threading.Thread(target=periodic_gc, daemon=True)
    gc_thread.start()
    
    socketio.run(
        app,
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG,
        allow_unsafe_werkzeug=True
    )
