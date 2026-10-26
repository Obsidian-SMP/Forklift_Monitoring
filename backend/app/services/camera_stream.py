# ==============================================================================
# File: app/services/camera_stream.py
# Description: High-Performance In-Memory Camera Frame Relay & Stream Consumer.
# Purpose: Manages live MJPEG stream ingestion from the ESP32-CAM into laptop
#          RAM. Feeds the YOLOv8 vision pipeline and relays live video to multiple
#          browser viewers with zero lag and zero ESP32 socket starvation.
# ==============================================================================

import time
import threading
import requests
from typing import Optional, Generator

from app.core.config import Config
from app.core.logger import log_event


class CameraStreamRelay:
    """
    Manages non-blocking video ingestion and distribution.
    Maintains the newest raw JPEG in RAM so the ESP32-CAM only ever serves ONE client.
    """

    def __init__(self):
        self._latest_jpeg: Optional[bytes] = None
        self._last_frame_time: float = 0.0
        self._lock = threading.Lock()

        self.running = False
        self._consumer_thread: Optional[threading.Thread] = None
        self._stream_url: str = Config.ESP32_STREAM_URL

    def set_stream_url(self, url: str):
        """Updates target camera URL (e.g. when auto-discovered via HTTP)."""
        clean_url = url.strip()
        if not clean_url.endswith("/"):
            clean_url += "/"
        self._stream_url = clean_url
        log_event("INFO", "CAMERA", f"ESP32-CAM stream URL set to: {self._stream_url}")

    def update_frame(self, jpeg_bytes: bytes):
        """Receives and buffers a JPEG frame pushed from ESP32-CAM or consumer thread."""
        with self._lock:
            self._latest_jpeg = jpeg_bytes
            self._last_frame_time = time.time()

    def get_latest_frame(self) -> Optional[bytes]:
        """Returns the freshest in-memory JPEG frame."""
        with self._lock:
            return self._latest_jpeg

    def is_camera_online(self, max_timeout: float = 3.0) -> bool:
        """Checks if frames have been received within the timeout window."""
        with self._lock:
            if self._latest_jpeg is None:
                return False
            return (time.time() - self._last_frame_time) <= max_timeout

    def start_consumer(self):
        """Starts background stream puller if Pattern B (pull stream) is enabled."""
        if self.running:
            return
        self.running = True
        self._consumer_thread = threading.Thread(target=self._pull_mjpeg_loop, daemon=True)
        self._consumer_thread.start()
        log_event("INFO", "CAMERA", "Background camera stream consumer thread started")

    def stop_consumer(self):
        """Stops background puller."""
        self.running = False
        if self._consumer_thread:
            self._consumer_thread.join(timeout=1.5)
        log_event("INFO", "CAMERA", "Camera stream consumer stopped")

    def _pull_mjpeg_loop(self):
        """
        Continuously reads multipart MJPEG stream from ESP32-CAM port 80.
        Splits JPEG headers and updates memory buffer cleanly.
        """
        while self.running:
            try:
                log_event("INFO", "CAMERA", f"Connecting to ESP32 stream: {self._stream_url}")
                response = requests.get(self._stream_url, stream=True, timeout=10)
                if response.status_code != 200:
                    time.sleep(3.0)
                    continue

                bytes_buffer = b""
                for chunk in response.iter_content(chunk_size=16 * 1024):
                    if not self.running:
                        break
                    bytes_buffer += chunk

                    # Look for JPEG SOI (0xFF, 0xD8) and EOI (0xFF, 0xD9) markers
                    start = bytes_buffer.find(b"\xff\xd8")
                    end = bytes_buffer.find(b"\xff\xd9")

                    if start != -1 and end != -1 and end > start:
                        jpeg_data = bytes_buffer[start : end + 2]
                        bytes_buffer = bytes_buffer[end + 2 :]
                        self.update_frame(jpeg_data)

            except Exception as exc:
                log_event("WARNING", "CAMERA", f"Stream connection dropped: {exc}. Retrying...")
                time.sleep(3.0)

    def generate_browser_mjpeg(self) -> Generator[bytes, None, None]:
        """
        Serves an MJPEG video stream directly from laptop RAM to any browser client.
        Supports unlimited simultaneous viewers without overloading the ESP32.
        """
        boundary = b"--warehouse_frame_boundary\r\n"
        last_yielded_time = 0.0

        while True:
            frame = self.get_latest_frame()
            if frame is not None and self._last_frame_time != last_yielded_time:
                last_yielded_time = self._last_frame_time
                yield (
                    boundary
                    + b"Content-Type: image/jpeg\r\n"
                    + f"Content-Length: {len(frame)}\r\n\r\n".encode()
                    + frame
                    + b"\r\n"
                )
            time.sleep(0.04)  # ~25 FPS max output to conserve browser CPU


# Global camera stream relay instance
camera_relay = CameraStreamRelay()
