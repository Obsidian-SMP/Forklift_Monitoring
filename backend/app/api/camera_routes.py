# ==============================================================================
# File: app/api/camera_routes.py
# Description: Camera Video Relay & Snapshot Streaming Endpoints.
# Purpose: Serves low-latency MJPEG video streams and raw JPEG frames directly
#          to browser dashboards from the in-memory camera relay buffer.
#          Decouples the ESP32-CAM hardware from multiple browser viewers.
# ==============================================================================

from flask import Blueprint, Response, request, jsonify

from app.core.logger import log_event
from app.services.camera_stream import camera_relay

camera_bp = Blueprint("camera", __name__, url_prefix="/api/camera")


@camera_bp.route("/stream", methods=["GET"])
def live_mjpeg_stream():
    """
    Streams live MJPEG video to web browsers.
    Multiple browser tabs can view this endpoint simultaneously without
    touching the ESP32-CAM's limited hardware socket capacity.
    """
    fps = min(max(float(request.args.get("fps", 10.0)), 1.0), 30.0)
    return Response(
        camera_relay.generate_mjpeg_stream(fps=fps),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@camera_bp.route("/snapshot", methods=["GET"])
def get_snapshot():
    """Returns the latest single JPEG frame from the camera buffer."""
    frame_bytes = camera_relay.get_latest_frame()
    if not frame_bytes:
        return jsonify({"error": "No camera frame available"}), 503

    return Response(frame_bytes, mimetype="image/jpeg")


@camera_bp.route("/frame", methods=["POST"])
def ingest_pushed_frame():
    """
    Alternative ingestion endpoint if ESP32-CAM is configured to push
    frames via HTTP POST instead of laptop pulling via GET.
    Accepts raw binary JPEG or multipart/form-data.
    """
    if "image" in request.files:
        file = request.files["image"]
        frame_bytes = file.read()
    else:
        frame_bytes = request.get_data()

    if not frame_bytes:
        return jsonify({"error": "Empty frame data"}), 400

    camera_relay.update_frame(frame_bytes)
    return jsonify({"status": "received", "size_bytes": len(frame_bytes)}), 200
