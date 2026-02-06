"""
Background AI Detection Worker
Processes images asynchronously without blocking the main upload flow
Uses custom trained YOLO model: my_model.pt
"""
import threading
import queue
import time
import os
from datetime import datetime
import logging
import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Try to import ultralytics for YOLO
YOLO_AVAILABLE = False
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except Exception as e:
    logger.warning(f"Ultralytics not available: {e}")
    YOLO_AVAILABLE = False


class AIDetectionWorker:
    """Background worker for AI detection without blocking uploads"""
    
    def __init__(self, process_every_n=1, queue_priority='latest'):
        """
        Initialize AI worker with custom YOLO model optimized for Raspberry Pi
        
        Args:
            process_every_n: Process every Nth image (1 = process all images)
            queue_priority: 'latest' = drop old frames, 'all' = process all
        """
        self.model = None
        self.model_type = None
        self.process_every_n = process_every_n
        self.queue_priority = queue_priority
        self.image_queue = queue.Queue(maxsize=10)
        self.worker_thread = None
        self.running = False
        self.image_counters = {}
        self.classes = []
        
        # Load YOLO model
        self._load_yolo_model()
        
        logger.info(f"✓ AI Worker initialized with model: {self.model_type}")
    
    def _load_yolo_model(self):
        """Load custom YOLO model optimized for Raspberry Pi"""
        if not YOLO_AVAILABLE:
            logger.error("Ultralytics not installed. Cannot load YOLO model.")
            print("[AI] ERROR: Ultralytics not installed")
            self.model = None
            return
        
        try:
            from app.config import Config
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            yolo_dir = os.path.join(base_dir, 'yolo_models')
            os.makedirs(yolo_dir, exist_ok=True)
            
            # Load custom model
            model_name = Config.YOLO_MODEL
            model_path = os.path.join(yolo_dir, model_name)
            
            if os.path.exists(model_path):
                logger.info(f"Loading custom model: {model_name}...")
                print(f"[AI] Loading custom model: {model_name}...")
                self.model = YOLO(model_path)
                self.model_type = model_name
                self.classes = list(self.model.names.values())
                logger.info(f"✓ {model_name} loaded with {len(self.classes)} classes")
                print(f"[AI] ✓ {model_name} loaded with {len(self.classes)} classes: {', '.join(self.classes)}")
            else:
                logger.error(f"Model not found: {model_path}")
                print(f"[AI] ERROR: Model not found: {model_path}")
                print(f"[AI] Please ensure {model_name} is placed in {yolo_dir}/")
                self.model = None
                self.model_type = None
            
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            print(f"[AI] ERROR: Failed to load model: {e}")
            import traceback
            traceback.print_exc()
            self.model = None
    
    def start(self):
        """Start the background worker thread"""
        if not self.model:
            logger.warning("[AI] Worker not started - No YOLO model loaded")
            print("[AI] Worker not started - No YOLO model loaded")
            return
        
        logger.info("[AI] Starting worker thread...")
        print("[AI] Starting worker thread...")
        self.running = True
        self.worker_thread = threading.Thread(target=self._process_loop, daemon=True)
        self.worker_thread.start()
        logger.info("✓ AI detection worker thread started")
        print("✓ AI detection worker thread started")
        
        # Verify thread is actually running
        time.sleep(0.1)
        if self.worker_thread.is_alive():
            logger.info("✓ Worker thread confirmed alive")
            print("✓ Worker thread confirmed alive")
        else:
            logger.error("✗ Worker thread failed to start!")
            print("✗ Worker thread failed to start!")
    
    def stop(self):
        """Stop the background worker"""
        self.running = False
        if self.worker_thread:
            self.worker_thread.join(timeout=5)
        logger.info("AI detection worker stopped")
    
    def should_process(self, forklift_id):
        """Check if this image should be processed based on counter"""
        if forklift_id not in self.image_counters:
            self.image_counters[forklift_id] = 0
        
        self.image_counters[forklift_id] += 1
        return self.image_counters[forklift_id] % self.process_every_n == 0
    
    def queue_image(self, filepath, forklift_id, metadata=None):
        """
        Queue an image for AI processing with priority mode
        
        Args:
            filepath: Path to image file
            forklift_id: ID of forklift
            metadata: Optional metadata dict
        """
        if not self.model:
            return False
        
        # Only process every Nth image
        if not self.should_process(forklift_id):
            return False
        
        try:
            # Priority mode: clear old frames if 'latest' mode enabled
            if self.queue_priority == 'latest' and self.image_queue.qsize() > 2:
                # Drop old frames, only keep latest
                while self.image_queue.qsize() > 1:
                    try:
                        self.image_queue.get_nowait()
                    except queue.Empty:
                        break
            
            # Non-blocking put - if queue is full, skip this image
            self.image_queue.put_nowait({
                'filepath': filepath,
                'forklift_id': forklift_id,
                'metadata': metadata or {},
                'queued_at': datetime.utcnow()
            })
            return True
        except queue.Full:
            logger.warning(f"AI queue full - skipping image from {forklift_id}")
            return False
    
    def _process_loop(self):
        """Background processing loop"""
        logger.info("[AI] Detection processing loop started - waiting for images...")
        print("[AI] Detection processing loop started - waiting for images...")
        
        while self.running:
            try:
                # Wait up to 1 second for an image
                task = self.image_queue.get(timeout=1.0)
                logger.info(f"[AI] Got image from queue: {task.get('filepath')}")
                
                # Process the image
                self._process_image(task)
                
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"[AI] Error in processing loop: {e}")
                print(f"[AI] Error in processing loop: {e}")
                import traceback
                traceback.print_exc()
                time.sleep(1)
    
    def _process_image(self, task):
        """Process a single image with YOLO model"""
        filepath = task['filepath']
        forklift_id = task['forklift_id']
        
        try:
            # Check if file exists
            if not os.path.exists(filepath):
                logger.warning(f"Image file not found: {filepath}")
                return
            
            start_time = time.time()
            
            # Process with model
            detected_objects = self._process_model(filepath)
            
            processing_time = time.time() - start_time
            
            if detected_objects:
                logger.info(f"[AI] {forklift_id}: Detected {len(detected_objects)} objects in {processing_time:.2f}s")
                for obj in detected_objects:
                    logger.info(f"  - {obj['name']} ({obj['confidence']:.2%})")
                
                # Add to inventory automatically
                self._add_to_inventory(detected_objects, forklift_id, filepath)
            else:
                logger.debug(f"[AI] {forklift_id}: No objects detected ({processing_time:.2f}s)")
            
            # Store results
            task['metadata']['ai_results'] = {
                'detected_objects': detected_objects,
                'count': len(detected_objects),
                'processing_time': processing_time,
                'processed_at': datetime.utcnow().isoformat(),
                'model': self.model_type or 'none'
            }
            
        except Exception as e:
            logger.error(f"Error processing image {filepath}: {e}")
            import traceback
            traceback.print_exc()
    
    def _process_model(self, filepath):
        """Process image with YOLO model"""
        from app.config import Config
        
        if not self.model:
            return []
        
        try:
            results = self.model(
                filepath,
                conf=Config.AI_CONFIDENCE,
                iou=Config.AI_IOU_THRESHOLD,
                imgsz=Config.AI_INPUT_SIZE,
                verbose=False,
                half=False,
                device='cpu'
            )
            
            allowed_classes = Config.ALLOWED_CLASSES if hasattr(Config, 'ALLOWED_CLASSES') else []
            detections = []
            
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    x, y, w, h = int(x1), int(y1), int(x2 - x1), int(y2 - y1)
                    
                    class_id = int(box.cls[0])
                    confidence = float(box.conf[0])
                    class_name = self.classes[class_id]
                    
                    # Filter if class list is defined (empty list = detect all)
                    if not allowed_classes or class_id in allowed_classes:
                        detections.append({
                            'name': class_name,
                            'confidence': confidence,
                            'bbox': [x, y, w, h],
                            'class_id': class_id
                        })
            
            return detections
            
        except Exception as e:
            logger.error(f"Model processing error: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def _add_to_inventory(self, detected_objects, forklift_id, image_path):
        """Add detected objects to inventory with proper naming and annotated images"""
        try:
            from app.models import DetectedObject
            
            # Read original image once
            original_img = cv2.imread(image_path)
            if original_img is None:
                logger.error(f"Could not read image for annotation: {image_path}")
                return
            
            for obj in detected_objects:
                obj_name = obj['name']
                confidence = obj['confidence']
                bbox = obj['bbox']
                
                # Get count of this object type to generate sequential ID
                existing_count = DetectedObject.select().where(
                    DetectedObject.object_id.startswith(obj_name)
                ).count()
                
                # Generate object ID like "dog-001", "cell phone-002", etc.
                object_id = f"{obj_name}-{str(existing_count + 1).zfill(3)}"
                
                # Create a COPY of the original image for this specific object
                img = original_img.copy()
                
                # Draw bounding box on this copy
                x, y, w, h = bbox
                cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 0), 2)
                
                # Add label with object name and confidence
                label = f"{obj_name} {confidence:.0%}"
                label_y = y - 10 if y - 10 > 10 else y + h + 20
                cv2.putText(img, label, (x, label_y), cv2.FONT_HERSHEY_SIMPLEX, 
                           0.6, (0, 255, 0), 2)
                
                # Save annotated image with object ID
                timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
                annotated_filename = f"{object_id}_{timestamp}.jpg"
                annotated_path = os.path.join(os.path.dirname(image_path), annotated_filename)
                
                logger.info(f"[AI] Attempting to save: {annotated_path}")
                success = cv2.imwrite(annotated_path, img)
                
                if not success:
                    logger.error(f"[AI] cv2.imwrite failed for: {annotated_path}")
                    continue
                else:
                    logger.info(f"[AI] cv2.imwrite SUCCESS: {annotated_path}")
                
                # Verify file was created
                if not os.path.exists(annotated_path):
                    logger.error(f"[AI] File verification FAILED: {annotated_path}")
                    continue
                else:
                    file_size = os.path.getsize(annotated_path)
                    logger.info(f"[AI] File verified: {annotated_path} ({file_size} bytes)")
                
                # Format description
                bbox_area = bbox[2] * bbox[3]  # width * height
                notes = f"AI detected {obj_name} (confidence: {confidence:.0%}, area: {bbox_area}px)"
                
                # Save to database with object_type
                DetectedObject.create(
                    object_id=object_id,
                    object_type=obj_name,  # Set the object type (red_box, blue_box, black_box, etc.)
                    forklift_id=forklift_id,
                    photo_url=f"/uploads/images/{annotated_filename}",
                    position_x=0,
                    position_y=0,
                    position_z=0,
                    status='detected',
                    confidence_score=confidence,
                    notes=notes
                )
                
                logger.info(f"[AI] ✓ Added {object_id} to inventory (image: {annotated_filename})")
            
        except Exception as e:
            logger.error(f"Error adding to inventory: {e}")
            import traceback
            traceback.print_exc()
    
    def get_queue_size(self):
        """Get current queue size"""
        return self.image_queue.qsize()
    
    def get_stats(self):
        """Get worker statistics"""
        return {
            'model_loaded': self.model is not None,
            'running': self.running,
            'queue_size': self.get_queue_size(),
            'image_counters': self.image_counters.copy(),
            'process_every_n': self.process_every_n
        }


# Global worker instance
ai_worker = None


def init_ai_worker(app):
    """Initialize the global AI worker"""
    global ai_worker
    
    print("[AI] Initializing AI worker (optimized for Raspberry Pi)...")
    process_every_n = app.config.get('AI_PROCESS_EVERY_N', 1)
    queue_priority = app.config.get('AI_QUEUE_PRIORITY', 'latest')
    
    ai_worker = AIDetectionWorker(
        process_every_n=process_every_n,
        queue_priority=queue_priority
    )
    
    if ai_worker.model:
        print(f"[AI] ✓ {ai_worker.model_type} model loaded successfully with {len(ai_worker.classes)} classes")
        print(f"[AI] ✓ Confidence threshold: {app.config.get('AI_CONFIDENCE', 0.65)}")
        print(f"[AI] ✓ Input size: {app.config.get('AI_INPUT_SIZE', 416)}x{app.config.get('AI_INPUT_SIZE', 416)}")
        print(f"[AI] ✓ Processing: every frame (queue mode: {queue_priority})")
        print(f"[AI] ✓ Image compression: {app.config.get('IMAGE_COMPRESSION_QUALITY', 75)}% quality")
        ai_worker.start()
    else:
        print("[AI] WARNING: YOLO model not loaded, AI detection disabled")
    
    return ai_worker


def get_ai_worker():
    """Get the global AI worker instance"""
    return ai_worker
