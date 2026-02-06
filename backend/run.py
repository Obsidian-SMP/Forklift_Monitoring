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
    """Delete images older than 2 minutes to save storage (except AI detected objects and latest image per forklift)"""
    while True:
        try:
            time.sleep(120)  # Wait 2 minutes
            upload_folder = Config.UPLOAD_FOLDER
            if os.path.exists(upload_folder):
                current_time = time.time()
                deleted_count = 0
                kept_count = 0
                
                # Find latest image per forklift to preserve for camera feed
                forklift_latest = {}  # {forklift_id: (filepath, mtime)}
                for filename in os.listdir(upload_folder):
                    filepath = os.path.join(upload_folder, filename)
                    if os.path.isfile(filepath) and filename.endswith('.jpg'):
                        # Extract forklift_id from filename (format: forklift_1_20250205_123456.jpg)
                        if '_' in filename:
                            forklift_id = filename.split('_')[0] + '_' + filename.split('_')[1]
                            if forklift_id.startswith('forklift_'):
                                mtime = os.path.getmtime(filepath)
                                if forklift_id not in forklift_latest or mtime > forklift_latest[forklift_id][1]:
                                    forklift_latest[forklift_id] = (filepath, mtime)
                
                # Now process all files
                for filename in os.listdir(upload_folder):
                    filepath = os.path.join(upload_folder, filename)
                    if os.path.isfile(filepath):
                        # Skip files with object names - these are AI detections
                        is_ai_detection = False
                        
                        # Custom model classes (your trained model's classes)
                        custom_classes = [
                            'black_box', 'blue_box', 'bottle', 'ponds', 'red_box'
                        ]
                        
                        # Check if filename starts with "classname-" pattern
                        for class_name in custom_classes:
                            if filename.startswith(f"{class_name}-"):
                                is_ai_detection = True
                                kept_count += 1
                                break
                        
                        if is_ai_detection:
                            continue  # Don't delete AI detected objects
                        
                        # Check if this is the latest image for any forklift (preserve for camera feed)
                        is_latest = False
                        for forklift_id, (latest_filepath, _) in forklift_latest.items():
                            if filepath == latest_filepath:
                                is_latest = True
                                kept_count += 1
                                break
                        
                        if is_latest:
                            continue  # Don't delete latest image per forklift
                        
                        # Delete regular camera frames older than 2 minutes (120 seconds)
                        if current_time - os.path.getmtime(filepath) > 120:
                            os.remove(filepath)
                            deleted_count += 1
                            
                if deleted_count > 0 or kept_count > 0:
                    print(f"[CLEANUP] Deleted {deleted_count} old camera frames (>2 min), kept {kept_count} important images (AI detections + latest per forklift)")
        except Exception as e:
            print(f"[CLEANUP] Error: {e}")

app = create_app()

# Initialize AI worker
def init_ai():
    """Initialize AI detection worker with custom model"""
    try:
        from app.services.ai_worker import init_ai_worker
        worker = init_ai_worker(app)
        if worker and worker.model:
            print("[AI] Background AI detection worker initialized")
            print(f"    Model: {worker.model_type} ({len(worker.classes)} classes)")
        else:
            print("[AI] AI detection disabled (No YOLO model available)")
    except Exception as e:
        print(f"[AI] Could not initialize AI worker: {e}")
        import traceback
        traceback.print_exc()

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
    print(f"YOLO Model: {Config.YOLO_MODEL} (custom trained)")
    print(f"AI Confidence: {Config.AI_CONFIDENCE}")
    print(f"AI Input Size: {Config.AI_INPUT_SIZE}x{Config.AI_INPUT_SIZE}")
    print("\n📡 Active Services:")
    print("  ✓ REST API (Flask)")
    print("  ✓ WebSocket (SocketIO)")
    print("  ✓ MQTT Client")
    print("  ✓ ESP32-CAM Image Upload")
    print("  ✓ AI Object Detection (Custom YOLO model, optimized for RPi)")
    print("  ✓ Image Cleanup (every 2 minutes)")
    print("  ✓ BLE/WiFi Position Tracking")
    print("  ✓ DHT11 Temperature/Humidity")
    print("  ✓ Vibration Monitoring")
    print("\n" + "="*60)
    print("🚀 Server Starting...")
    print("="*60 + "\n")
    
    # Initialize AI worker
    init_ai()
    
    # Start DHT sensor background service
    try:
        from app.services.dht_background_service import init_dht_background_service
        init_dht_background_service(app)
        print("[DHT] DHT sensor background service started (reads every 60 seconds)\n")
    except Exception as e:
        print(f"[DHT] Warning: Could not start DHT background service: {e}\n")
    
    # Start image cleanup thread
    cleanup_thread = threading.Thread(target=cleanup_old_images, daemon=True)
    cleanup_thread.start()
    print("[CLEANUP] Image cleanup task started (runs every 2 minutes)\n")
    
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
