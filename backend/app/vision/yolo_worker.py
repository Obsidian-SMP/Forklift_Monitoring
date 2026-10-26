# ==============================================================================
# File: app/vision/yolo_worker.py
# Description: YOLOv8 Computer Vision Worker with Region of Interest (ROI) Masking.
# Purpose: Detects pallets, boxes, and obstacles from video frames. Implements
#          Paper 3's ROI masking to prevent false detections from background racks.
# ==============================================================================

import os
import cv2
import numpy as np
from typing import List, Dict, Any, Optional

from app.core.config import Config
from app.core.logger import log_event

# Optional import of Ultralytics
try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False


class YoloVisionDetector:
    """
    Performs object detection using YOLOv8 with ROI spatial filtering.
    """

    def __init__(self, model_path: Optional[str] = None):
        self.model = None
        self.classes: List[str] = []
        self.model_name = "none"

        target_model = model_path or Config.YOLO_MODEL_PATH
        self._load_model(target_model)

    def _load_model(self, model_path: str):
        if not ULTRALYTICS_AVAILABLE:
            log_event("WARNING", "YOLO", "Ultralytics is not installed. Vision AI disabled.")
            return

        try:
            # Fallback path check: if specified path doesn't exist, check standard locations
            resolved_path = model_path
            if not os.path.exists(resolved_path):
                # Check for standard yolov8n.pt
                resolved_path = "yolov8n.pt"

            log_event("INFO", "YOLO", f"Loading YOLO model: {resolved_path}")
            self.model = YOLO(resolved_path)
            self.model_name = os.path.basename(resolved_path)
            self.classes = list(self.model.names.values())
            log_event("INFO", "YOLO", f"YOLO model loaded with {len(self.classes)} classes: {self.classes[:6]}")
        except Exception as exc:
            log_event("ERROR", "YOLO", f"Failed to load YOLO model: {exc}")
            self.model = None

    def detect(self, image_bgr: np.ndarray) -> List[Dict[str, Any]]:
        """
        Runs object detection and evaluates bounding boxes against the Pallet ROI.
        
        Args:
            image_bgr: OpenCV BGR image matrix
            
        Returns:
            List of detected item dictionaries with bounding box and ROI flag.
        """
        if self.model is None or image_bgr is None:
            return []

        h, w = image_bgr.shape[:2]
        
        # Calculate pixel coordinates of the Region of Interest (Paper 3)
        # ROI_PALLET_MASK = [ymin, xmin, ymax, xmax] as fractions
        roi_ymin, roi_xmin, roi_ymax, roi_xmax = Config.ROI_PALLET_MASK
        roi_px_ymin = int(roi_ymin * h)
        roi_px_xmin = int(roi_xmin * w)
        roi_px_ymax = int(roi_ymax * h)
        roi_px_xmax = int(roi_xmax * w)

        detections = []
        try:
            results = self.model.predict(
                source=image_bgr,
                conf=Config.AI_CONFIDENCE_THRESHOLD,
                iou=Config.AI_IOU_THRESHOLD,
                verbose=False,
                device="cpu",  # Laptop CPU or CUDA if available
            )

            for result in results:
                if not hasattr(result, "boxes") or result.boxes is None:
                    continue

                for box in result.boxes:
                    cls_id = int(box.cls[0].cpu().numpy())
                    conf = float(box.conf[0].cpu().numpy())
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                    class_name = self.classes[cls_id] if cls_id < len(self.classes) else f"class_{cls_id}"

                    # Calculate center point of detected bounding box
                    center_x = (x1 + x2) // 2
                    center_y = (y1 + y2) // 2

                    # Evaluate if detection is inside the active fork/load zone (ROI)
                    is_in_roi = (
                        roi_px_xmin <= center_x <= roi_px_xmax
                        and roi_px_ymin <= center_y <= roi_px_ymax
                    )

                    detections.append(
                        {
                            "class_name": class_name,
                            "confidence": round(conf, 2),
                            "bbox": [int(x1), int(y1), int(x2 - x1), int(y2 - y1)],
                            "center": (center_x, center_y),
                            "is_in_fork_roi": is_in_roi,
                        }
                    )

        except Exception as exc:
            log_event("ERROR", "YOLO", f"Inference execution error: {exc}")

        return detections

    @staticmethod
    def draw_annotations(
        image_bgr: np.ndarray,
        detections: List[Dict[str, Any]],
        show_roi: bool = True,
    ) -> np.ndarray:
        """
        Renders bounding boxes and ROI outline on an image copy for visual evidence.
        """
        annotated = image_bgr.copy()
        h, w = annotated.shape[:2]

        # Draw ROI boundary in translucent amber if requested
        if show_roi:
            roi_ymin, roi_xmin, roi_ymax, roi_xmax = Config.ROI_PALLET_MASK
            x1, y1 = int(roi_xmin * w), int(roi_ymin * h)
            x2, y2 = int(roi_xmax * w), int(roi_ymax * h)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (255, 165, 0), 1)
            cv2.putText(
                annotated,
                "FORK ACTIVE ROI",
                (x1 + 6, y1 + 18),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (255, 165, 0),
                1,
            )

        # Draw detected objects
        for det in detections:
            x, y, bw, bh = det["bbox"]
            color = (0, 255, 0) if det["is_in_fork_roi"] else (180, 180, 180)
            cv2.rectangle(annotated, (x, y), (x + bw, y + bh), color, 2)
            label = f"{det['class_name']} {det['confidence']*100:.0f}%"
            cv2.putText(
                annotated,
                label,
                (x, max(15, y - 6)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                color,
                2,
            )

        return annotated


# Global vision detector instance
vision_detector = YoloVisionDetector()
