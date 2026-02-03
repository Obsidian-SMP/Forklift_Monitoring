import cv2
import numpy as np
import os
from datetime import datetime
import logging

# Try to import YOLO, but make it optional
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    logging.warning("YOLOv8 (ultralytics) not installed - image processing will be disabled")

logger = logging.getLogger(__name__)


class ImageProcessor:
    """Service for processing ESP32-CAM images and detecting/counting objects"""
    
    def __init__(self, model_path='yolov8n.pt'):
        """Initialize YOLO model for object detection"""
        if not YOLO_AVAILABLE:
            logger.warning("YOLOv8 not available - image processing disabled")
            self.model = None
            return
            
        try:
            self.model = YOLO(model_path)
            logger.info(f"YOLO model loaded: {model_path}")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            self.model = None
    
    def process_image(self, image_data, forklift_id):
        """
        Process image from ESP32-CAM
        
        Args:
            image_data: Binary image data
            forklift_id: ID of the forklift
            
        Returns:
            dict: Processing results including detected count and items
        """
        if not YOLO_AVAILABLE or not self.model:
            logger.warning("Image processing unavailable - YOLOv8 not installed")
            return {
                'detected_count': 0, 
                'detected_items': [], 
                'image_url': None,
                'error': 'YOLOv8 not installed'
            }
            
        try:
            # Convert bytes to numpy array
            nparr = np.frombuffer(image_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                logger.error("Failed to decode image")
                return {'detected_count': 0, 'detected_items': [], 'image_url': None}
            
            # Run YOLO detection
            results = self.model.predict(img, conf=0.5, verbose=False)
            
            # Parse results
            detected_items = []
            boxes = []
            
            for result in results:
                for box in result.boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    class_name = result.names[cls_id]
                    
                    # Filter for relevant objects (boxes, pallets, etc.)
                    # You can customize this based on your warehouse items
                    if class_name in ['box', 'package', 'suitcase', 'backpack', 'handbag']:
                        detected_items.append({
                            'class': class_name,
                            'confidence': conf
                        })
                        boxes.append(box.xyxy[0].cpu().numpy())
            
            # Draw bounding boxes
            annotated_img = img.copy()
            for box in boxes:
                x1, y1, x2, y2 = map(int, box)
                cv2.rectangle(annotated_img, (x1, y1), (x2, y2), (0, 255, 0), 2)
            
            # Save image
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            filename = f"{forklift_id}_{timestamp}.jpg"
            filepath = os.path.join('uploads', 'images', filename)
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            cv2.imwrite(filepath, annotated_img)
            
            detected_count = len(detected_items)
            
            logger.info(f"Image processed: {detected_count} items detected")
            
            return {
                'detected_count': detected_count,
                'detected_items': detected_items,
                'image_url': f'/uploads/images/{filename}'
            }
            
        except Exception as e:
            logger.error(f"Error processing image: {e}")
            return {'detected_count': 0, 'detected_items': [], 'image_url': None}
    
    def count_boxes(self, image_path):
        """
        Count boxes in a saved image file
        
        Args:
            image_path: Path to image file
            
        Returns:
            int: Number of detected boxes
        """
        try:
            img = cv2.imread(image_path)
            results = self.model.predict(img, conf=0.5, verbose=False)
            
            count = 0
            for result in results:
                for box in result.boxes:
                    cls_id = int(box.cls[0])
                    class_name = result.names[cls_id]
                    if class_name in ['box', 'package', 'suitcase', 'backpack']:
                        count += 1
            
            return count
            
        except Exception as e:
            logger.error(f"Error counting boxes: {e}")
            return 0
