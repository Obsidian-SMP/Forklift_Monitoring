"""
Camera Routes for ESP32-CAM Integration
Handles camera stream endpoints per forklift
"""

from flask import Blueprint, jsonify, request, Response
import logging
import requests
from datetime import datetime

camera_bp = Blueprint('camera', __name__)
logger = logging.getLogger(__name__)

# Dictionary to store camera IPs for each forklift
# Format: {"forklift_1": "192.168.1.100", "forklift_2": "192.168.1.101"}
FORKLIFT_CAMERAS = {
    "forklift_1": None,
}

CAMERA_PORT = 80


def get_camera_url(forklift_id):
    """Get camera URL for a forklift"""
    if forklift_id not in FORKLIFT_CAMERAS or not FORKLIFT_CAMERAS[forklift_id]:
        return None
    return f"http://{FORKLIFT_CAMERAS[forklift_id]}:{CAMERA_PORT}"


@camera_bp.route('/forklifts', methods=['GET'])
def list_forklifts():
    """List all registered forklifts with camera status"""
    try:
        forklifts = []
        for forklift_id, ip in FORKLIFT_CAMERAS.items():
            # If camera has IP, mark as online (images are being sent)
            status = "online" if ip else "offline"
            
            forklifts.append({
                "id": forklift_id,
                "ip": ip,
                "status": status,
                "stream_url": f"/api/camera/{forklift_id}/stream" if ip else None
            })
        
        return jsonify({"forklifts": forklifts}), 200
    except Exception as e:
        logger.error(f"Error listing forklifts: {str(e)}")
        return jsonify({"error": str(e)}), 500


@camera_bp.route('/<forklift_id>/status', methods=['GET'])
def camera_status(forklift_id):
    """Get camera status for specific forklift"""
    try:
        camera_url = get_camera_url(forklift_id)
        
        if not camera_url:
            return jsonify({"status": "not_registered"}), 404
        
        response = requests.get(f"{camera_url}/status", timeout=5)
        if response.status_code == 200:
            cam_status = response.json()
            return jsonify({
                'status': 'online',
                'forklift_id': forklift_id,
                'camera': cam_status,
                'timestamp': datetime.utcnow().isoformat()
            }), 200
        else:
            return jsonify({'status': 'offline', 'forklift_id': forklift_id}), 503
    except Exception as e:
        logger.error(f"Error getting camera status for {forklift_id}: {str(e)}")
        return jsonify({'status': 'offline', 'error': str(e)}), 503


@camera_bp.route('/<forklift_id>/frame', methods=['GET'])
def get_frame(forklift_id):
    """Get current frame from forklift camera"""
    try:
        camera_url = get_camera_url(forklift_id)
        
        if not camera_url:
            return jsonify({'error': 'Camera not registered for this forklift'}), 404
        
        response = requests.get(f"{camera_url}/frame", timeout=5)
        if response.status_code == 200:
            return response.content, 200, {'Content-Type': 'image/jpeg'}
        else:
            return jsonify({'error': 'Failed to get frame'}), 503
    except Exception as e:
        logger.error(f"Error getting frame for {forklift_id}: {str(e)}")
        return jsonify({'error': str(e)}), 503


@camera_bp.route('/<forklift_id>/stream', methods=['GET'])
def stream(forklift_id):
    """Proxy MJPEG stream from ESP32-CAM"""
    try:
        camera_url = get_camera_url(forklift_id)
        
        if not camera_url:
            return jsonify({'error': 'Camera not registered for this forklift'}), 404
        
        def generate():
            """Stream frames from ESP32-CAM"""
            try:
                # Stream from ESP32-CAM root (where our stream is served)
                stream_response = requests.get(
                    f"{camera_url}/",
                    stream=True,
                    timeout=30
                )
                
                # Forward the stream
                for chunk in stream_response.iter_content(chunk_size=1024):
                    if chunk:
                        yield chunk
                        
            except Exception as e:
                logger.error(f"Stream error for {forklift_id}: {str(e)}")
        
        return Response(
            generate(),
            mimetype='multipart/x-mixed-replace; boundary=123456789000000000000987654321',
            headers={
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'
            }
        )
    except Exception as e:
        logger.error(f"Error streaming from {forklift_id}: {str(e)}")
        return jsonify({'error': str(e)}), 503


@camera_bp.route('/<forklift_id>/register', methods=['POST'])
def register_camera(forklift_id):
    """Register camera IP for a specific forklift"""
    try:
        data = request.get_json()
        
        if not data or 'ip' not in data:
            return jsonify({'error': 'Missing IP address'}), 400
        
        new_ip = data.get('ip')
        
        # Register the camera (can be None for prototyping/testing)
        FORKLIFT_CAMERAS[forklift_id] = new_ip
        
        if new_ip:
            camera_url = f"http://{new_ip}:{CAMERA_PORT}"
            logger.info(f"Camera registered for {forklift_id} at {camera_url}")
        else:
            logger.info(f"Forklift {forklift_id} created without camera (testing mode)")
        
        return jsonify({
            'message': f'Forklift {forklift_id} registered' if new_ip else f'Forklift {forklift_id} created (no camera)',
            'forklift_id': forklift_id,
            'ip': new_ip,
            'stream_url': f"/api/camera/{forklift_id}/stream" if new_ip else None
        }), 200
    except Exception as e:
        logger.error(f"Error registering forklift {forklift_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500


@camera_bp.route('/<forklift_id>/unregister', methods=['POST'])
def unregister_camera(forklift_id):
    """Unregister camera for a forklift"""
    try:
        if forklift_id in FORKLIFT_CAMERAS:
            FORKLIFT_CAMERAS[forklift_id] = None
            logger.info(f"Camera unregistered for {forklift_id}")
            return jsonify({'message': f'Camera unregistered for {forklift_id}'}), 200
        else:
            return jsonify({'error': f'Forklift {forklift_id} not found'}), 404
    except Exception as e:
        logger.error(f"Error unregistering camera for {forklift_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500


@camera_bp.route('/<forklift_id>/delete', methods=['DELETE'])
def delete_forklift(forklift_id):
    """Delete a forklift"""
    try:
        if forklift_id in FORKLIFT_CAMERAS:
            del FORKLIFT_CAMERAS[forklift_id]
            logger.info(f"Forklift {forklift_id} deleted")
            return jsonify({'message': f'Forklift {forklift_id} deleted'}), 200
        else:
            return jsonify({'error': f'Forklift {forklift_id} not found'}), 404
    except Exception as e:
        logger.error(f"Error deleting forklift {forklift_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500
