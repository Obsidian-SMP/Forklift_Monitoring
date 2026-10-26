# ==============================================================================
# File: app/vision/load_state_machine.py
# Description: M/N-K Sliding Window Forklift Load & Dropoff State Machine (Paper 5).
# Purpose: Completely eliminates duplicate detection storms. Automatically verifies
#          when an item is loaded onto or unloaded from the forklift, updates the
#          inventory ledger with real pickup/dropoff coordinates, and syncs stock.
# ==============================================================================

import os
import cv2
import time
import uuid
import threading
import numpy as np
from collections import deque
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

from app.core.config import Config
from app.core.logger import log_event
from app.positioning.engine import positioning_engine
from app.services.camera_stream import camera_relay
from app.vision.yolo_worker import vision_detector
from app.models.forklift import Forklift
from app.models.inventory import InventoryItem, InventoryTransaction, DetectedPallet
from app.models.zone import WarehouseZone

IST = timezone(timedelta(hours=5, minutes=30))


class LoadUnloadStateMachine:
    """
    Implements Zhao et al. (IEEE JIOT 2020) M/N-K Sliding Window State Machine:
    1. If UNLOADED: Detected >= M times in recent N observation cycles -> Trigger LOAD.
    2. If LOADED: Undetected for K consecutive cycles -> Trigger UNLOAD.
    """

    def __init__(
        self,
        n_window: int = None,
        m_threshold: int = None,
        k_disappear: int = None,
    ):
        self.N = n_window or Config.LOAD_WINDOW_N
        self.M = m_threshold or Config.LOAD_THRESHOLD_M
        self.K = k_disappear or Config.UNLOAD_WINDOW_K

        # Sliding binary window for recent detections in the fork ROI: deque of 1 (seen) or 0 (miss)
        self.history_window = deque(maxlen=self.N)
        self.consecutive_misses = 0

        # Current forklift load state
        self.is_loaded = False
        self.current_loaded_sku: Optional[str] = None
        self.current_loaded_category: Optional[str] = None
        self.pickup_coords: Optional[Dict[str, float]] = None

        self.socketio_instance: Any = None
        self.lock = threading.Lock()

    def set_socketio(self, socketio):
        """Attaches WebSocket instance for broadcasting load/unload events."""
        self.socketio_instance = socketio

    def process_frame_detections(
        self,
        raw_bgr_image: np.ndarray,
        detections: list,
    ):
        """
        Evaluates detected items against the M/N-K sliding window state machine.
        """
        # Look for target objects detected specifically inside the fork ROI
        roi_detections = [d for d in detections if d.get("is_in_fork_roi", False)]

        with self.lock:
            if roi_detections:
                # Primary detected object in the fork ROI
                primary = roi_detections[0]
                category = primary["class_name"]
                conf = primary["confidence"]

                self.history_window.append(1)
                self.consecutive_misses = 0

                # -------------------------------------------------------------
                # EVALUATE LOAD TRANSITION (If previously UNLOADED)
                # -------------------------------------------------------------
                if not self.is_loaded:
                    # Check if observed >= M times in the last N frames
                    seen_count = sum(self.history_window)
                    if seen_count >= self.M and len(self.history_window) >= self.M:
                        self._handle_load_event(category, conf, raw_bgr_image, primary)

            else:
                self.history_window.append(0)
                self.consecutive_misses += 1

                # -------------------------------------------------------------
                # EVALUATE UNLOAD TRANSITION (If previously LOADED)
                # -------------------------------------------------------------
                if self.is_loaded:
                    # Check if disappeared for K consecutive observation cycles
                    if self.consecutive_misses >= self.K:
                        self._handle_unload_event(raw_bgr_image)

    def _handle_load_event(
        self,
        category: str,
        confidence: float,
        image_bgr: np.ndarray,
        detection_info: Dict[str, Any],
    ):
        """Executes load workflow: captures pickup coordinates, creates SKU, logs transaction."""
        self.is_loaded = True
        self.consecutive_misses = 0

        # 1. Capture real forklift coordinates at time of pickup
        pos = positioning_engine.get_current_position()
        pick_x = pos.get("x", 0.0)
        pick_y = pos.get("y", 0.0)
        self.pickup_coords = {"x": pick_x, "y": pick_y}

        # 2. Generate clean sequential SKU (e.g. red_box-001)
        existing_count = InventoryItem.select().where(InventoryItem.category == category).count()
        sku = f"{category}-{str(existing_count + 1).zfill(3)}"
        self.current_loaded_sku = sku
        self.current_loaded_category = category

        # 3. Save annotated evidence image
        os.makedirs(Config.INVENTORY_IMAGES_FOLDER, exist_ok=True)
        img_filename = f"{sku}_pickup_{int(time.time())}.jpg"
        img_path = os.path.join(Config.INVENTORY_IMAGES_FOLDER, img_filename)
        annotated = vision_detector.draw_annotations(image_bgr, [detection_info])
        cv2.imwrite(img_path, annotated)
        img_url = f"/uploads/inventory/{img_filename}"

        now_dt = datetime.now(IST)

        try:
            # 4. Create inventory item in 'in_transit' state
            item = InventoryItem.create(
                item_id=sku,
                item_name=f"{category.replace('_', ' ').title()}",
                category=category,
                quantity=1,
                status="in_transit",
                position_x=pick_x,
                position_y=pick_y,
                image_url=img_url,
                placed_at=now_dt,
            )

            # 5. Update forklift status to 'carrying'
            fk, _ = Forklift.get_or_create(forklift_id="forklift_1")
            fk.is_carrying = True
            fk.carrying_item_id = sku
            fk.status = "carrying"
            fk.save()

            # 6. Record audit transaction
            InventoryTransaction.create(
                transaction_id=str(uuid.uuid4())[:8],
                item=item,
                forklift_id="forklift_1",
                transaction_type="pickup",
                quantity=1,
                from_x=pick_x,
                from_y=pick_y,
                to_x=None,
                to_y=None,
                image_url=img_url,
                notes=f"Auto-loaded via M/N-K sliding window (confidence {confidence*100:.0f}%)",
                timestamp=now_dt,
            )

            # 7. Persist Vision Pallet Detection record
            DetectedPallet.create(
                detection_id=str(uuid.uuid4())[:8],
                object_type=category,
                forklift_id="forklift_1",
                forklift_x=pick_x,
                forklift_y=pick_y,
                confidence_score=confidence,
                bounding_box=str(detection_info["bbox"]),
                photo_url=img_url,
                status="loaded",
                detected_at=now_dt,
            )

            log_event(
                "INFO",
                "OPERATIONS",
                f"LOADED {sku} at ({pick_x}m, {pick_y}m) onto forklift_1",
                {"sku": sku, "x": pick_x, "y": pick_y},
            )

            # 8. Notify dashboard via WebSocket
            if self.socketio_instance is not None:
                self.socketio_instance.emit(
                    "inventory_loaded",
                    {
                        "sku": sku,
                        "category": category,
                        "pickup_coords": self.pickup_coords,
                        "image_url": img_url,
                    },
                    namespace="/",
                )

        except Exception as exc:
            log_event("ERROR", "OPERATIONS", f"Failed to record load event: {exc}")

    def _handle_unload_event(self, image_bgr: np.ndarray):
        """Executes unload workflow: captures dropoff coordinates, updates stock zone."""
        self.is_loaded = False
        sku = self.current_loaded_sku
        from_coords = self.pickup_coords or {"x": 0.0, "y": 0.0}

        # 1. Capture real dropoff coordinates
        pos = positioning_engine.get_current_position()
        drop_x = pos.get("x", 0.0)
        drop_y = pos.get("y", 0.0)

        # 2. Determine destination zone from database
        matched_zone_name = "Warehouse Floor"
        matched_zone_id = "general_floor"

        try:
            zones = list(WarehouseZone.select().where(WarehouseZone.is_active == True))
            for z in zones:
                # Simple bounding box check
                bb = z.to_dict()["bounding_box"]
                if bb["min_x"] <= drop_x <= bb["max_x"] and bb["min_y"] <= drop_y <= bb["max_y"]:
                    matched_zone_name = z.name
                    matched_zone_id = z.zone_id
                    break
        except Exception:
            pass

        now_dt = datetime.now(IST)

        try:
            # 3. Update inventory item to 'in_stock'
            if sku:
                item = InventoryItem.get_or_none(InventoryItem.item_id == sku)
                if item:
                    item.status = "in_stock"
                    item.position_x = drop_x
                    item.position_y = drop_y
                    item.zone = matched_zone_id
                    item.shelf = matched_zone_name
                    item.last_updated = now_dt
                    item.save()

                    # 4. Record dropoff transaction in audit ledger
                    InventoryTransaction.create(
                        transaction_id=str(uuid.uuid4())[:8],
                        item=item,
                        forklift_id="forklift_1",
                        transaction_type="dropoff",
                        quantity=1,
                        from_x=from_coords.get("x"),
                        from_y=from_coords.get("y"),
                        to_x=drop_x,
                        to_y=drop_y,
                        image_url=item.image_url,
                        notes=f"Placed in {matched_zone_name} via M/N-K sliding window",
                        timestamp=now_dt,
                    )

            # 5. Update forklift to 'idle'
            fk, _ = Forklift.get_or_create(forklift_id="forklift_1")
            fk.is_carrying = False
            fk.carrying_item_id = None
            fk.status = "idle"
            fk.save()

            log_event(
                "INFO",
                "OPERATIONS",
                f"UNLOADED {sku} at ({drop_x}m, {drop_y}m) into {matched_zone_name}",
                {"sku": sku, "x": drop_x, "y": drop_y, "zone": matched_zone_name},
            )

            # 6. Notify dashboard via WebSocket
            if self.socketio_instance is not None:
                self.socketio_instance.emit(
                    "inventory_unloaded",
                    {
                        "sku": sku,
                        "drop_coords": {"x": drop_x, "y": drop_y},
                        "zone": matched_zone_name,
                    },
                    namespace="/",
                )

        except Exception as exc:
            log_event("ERROR", "OPERATIONS", f"Failed to record unload event: {exc}")

        # Reset load state
        self.current_loaded_sku = None
        self.current_loaded_category = None
        self.pickup_coords = None


# Global state machine instance
load_state_machine = LoadUnloadStateMachine()


class VisionBackgroundWorker:
    """
    Dedicated worker thread running YOLOv8 detection and M/N-K state tracking
    without interfering with live MJPEG video delivery.
    """

    def __init__(self, fps: float = None):
        self.fps = fps or Config.AI_INFERENCE_FPS
        self.interval = 1.0 / max(1.0, self.fps)
        self.running = False
        self.thread: Optional[threading.Thread] = None

    def start(self):
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.thread.start()
        log_event("INFO", "VISION_WORKER", f"Vision worker started at {self.fps} FPS")

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.5)
        log_event("INFO", "VISION_WORKER", "Vision worker stopped")

    def _worker_loop(self):
        while self.running:
            start_time = time.time()
            try:
                jpeg_bytes = camera_relay.get_latest_frame()
                if jpeg_bytes is not None:
                    # Decode from memory
                    np_arr = np.frombuffer(jpeg_bytes, np.uint8)
                    frame_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

                    if frame_bgr is not None:
                        # 1. Run YOLO detection with ROI masking
                        detections = vision_detector.detect(frame_bgr)
                        
                        # 2. Feed into M/N-K Sliding Window State Machine
                        load_state_machine.process_frame_detections(frame_bgr, detections)

            except Exception as exc:
                log_event("ERROR", "VISION_WORKER", f"Worker frame iteration error: {exc}")

            elapsed = time.time() - start_time
            sleep_time = max(0.01, self.interval - elapsed)
            time.sleep(sleep_time)


# Global vision background worker instance
vision_worker = VisionBackgroundWorker()
