from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta
import os

from app.models import Forklift, ForkliftLocation

forklift_bp = Blueprint('forklift', __name__)


@forklift_bp.route('/', methods=['GET'])
def get_all_forklifts():
    """Get all forklifts"""
    try:
        forklifts = list(Forklift.select())
        return jsonify({
            'count': len(forklifts),
            'forklifts': [f.to_dict() for f in forklifts]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@forklift_bp.route('/<forklift_id>', methods=['GET'])
def get_forklift(forklift_id):
    """Get specific forklift details"""
    try:
        forklift = Forklift.get_or_none(Forklift.forklift_id == forklift_id)
        if forklift:
            return jsonify(forklift.to_dict()), 200
        return jsonify({'message': 'Forklift not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@forklift_bp.route('/<forklift_id>/location/current', methods=['GET'])
def get_current_location(forklift_id):
    """Get latest location of forklift"""
    try:
        location = ForkliftLocation.select().where(
            ForkliftLocation.forklift_id == forklift_id
        ).order_by(ForkliftLocation.timestamp.desc()).first()
        if location:
            return jsonify(location.to_dict()), 200
        return jsonify({'message': 'No location data available'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@forklift_bp.route('/<forklift_id>/location/track', methods=['GET'])
def get_location_track(forklift_id):
    """Get location tracking history (path taken)"""
    try:
        hours = int(request.args.get('hours', 8))
        start_time = datetime.utcnow() - timedelta(hours=hours)
        
        locations = list(ForkliftLocation.select().where(
            (ForkliftLocation.forklift_id == forklift_id) &
            (ForkliftLocation.timestamp >= start_time)
        ).order_by(ForkliftLocation.timestamp.asc()))
        
        return jsonify({
            'forklift_id': forklift_id,
            'count': len(locations),
            'track': [loc.to_dict() for loc in locations]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@forklift_bp.route('/<forklift_id>/status', methods=['PUT'])
def update_forklift_status(forklift_id):
    """Update forklift status (REST endpoint)"""
    try:
        data = request.get_json()
        
        forklift = Forklift.get_or_none(Forklift.forklift_id == forklift_id)
        if not forklift:
            forklift = Forklift.create(forklift_id=forklift_id)
        
        if 'status' in data:
            forklift.status = data['status']
        if 'battery_level' in data:
            forklift.battery_level = data['battery_level']
        if 'is_lifting' in data:
            forklift.is_lifting = data['is_lifting']
        if 'current_load' in data:
            forklift.current_load = data['current_load']
        
        forklift.last_seen = datetime.utcnow()
        forklift.save()
        
        return jsonify(forklift.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@forklift_bp.route('/<forklift_id>/location', methods=['POST'])
def add_location(forklift_id):
    """Add location data (REST endpoint for GPS)"""
    try:
        data = request.get_json()
        import json
        
        wifi_pos = data.get('wifi_position', {})
        location = ForkliftLocation.create(
            forklift_id=forklift_id,
            latitude=data.get('latitude'),
            longitude=data.get('longitude'),
            wifi_position=json.dumps(wifi_pos) if wifi_pos else None,
            altitude=data.get('altitude'),
            speed=data.get('speed'),
            heading=data.get('heading'),
            accuracy=data.get('accuracy')
        )
        
        return jsonify(location.to_dict()), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@forklift_bp.route('/ai/stats', methods=['GET'])
def get_ai_stats():
    """Get AI worker statistics"""
    try:
        from app.services.ai_worker import get_ai_worker
        worker = get_ai_worker()
        if worker:
            return jsonify(worker.get_stats()), 200
        else:
            return jsonify({
                'model_loaded': False,
                'running': False,
                'message': 'AI worker not initialized'
            }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@forklift_bp.route('/<forklift_id>/image', methods=['POST'])
def upload_image(forklift_id):
    """Upload image from ESP32-CAM for object detection"""
    import os
    from werkzeug.utils import secure_filename
    from flask import current_app
    
    try:
        # Check if image data is present
        if 'image' not in request.files and not request.data:
            return jsonify({'error': 'No image data provided'}), 400
        
        # Get client IP address (ESP32-CAM IP)
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        if ',' in client_ip:
            client_ip = client_ip.split(',')[0].strip()
        
        # Auto-register camera IP (for streaming)
        try:
            from app.routes.camera_routes import FORKLIFT_CAMERAS
            if forklift_id not in FORKLIFT_CAMERAS or FORKLIFT_CAMERAS[forklift_id] != client_ip:
                FORKLIFT_CAMERAS[forklift_id] = client_ip
                print(f"[ESP32-CAM] Auto-registered {forklift_id} camera at {client_ip}")
        except Exception as e:
            print(f"[ESP32-CAM] Could not auto-register camera: {e}")
        
        # Get or create forklift
        forklift = Forklift.get_or_none(Forklift.forklift_id == forklift_id)
        if not forklift:
            forklift = Forklift.create(forklift_id=forklift_id)
        
        forklift.last_seen = datetime.utcnow()
        forklift.save()
        
        # Create upload directory if it doesn't exist
        upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads/images')
        os.makedirs(upload_folder, exist_ok=True)
        
        # Generate filename with timestamp
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        filename = f"{forklift_id}_{timestamp}.jpg"
        filepath = os.path.join(upload_folder, filename)
        
        # Save image from form data or raw data
        if 'image' in request.files:
            file = request.files['image']
            file.save(filepath)
        else:
            # Save raw binary data (JPEG from ESP32-CAM)
            with open(filepath, 'wb') as f:
                f.write(request.data)
        
        file_size = os.path.getsize(filepath)
        
        # Queue image for async AI detection (non-blocking)
        ai_queued = False
        try:
            from app.services.ai_worker import get_ai_worker
            worker = get_ai_worker()
            if worker:
                ai_queued = worker.queue_image(filepath, forklift_id, {
                    'filename': filename,
                    'timestamp': timestamp,
                    'client_ip': client_ip
                })
        except Exception as e:
            print(f"[AI] Could not queue for detection: {e}")
        
        print(f"[ESP32-CAM] Image from {forklift_id} ({client_ip}): {filename} ({file_size} bytes) - AI: {'Queued' if ai_queued else 'Skipped'}")
        
        return jsonify({
            'status': 'success',
            'message': 'Image uploaded successfully',
            'forklift_id': forklift_id,
            'filename': filename,
            'size': file_size,
            'timestamp': timestamp,
            'camera_ip': client_ip,
            'stream_url': f'http://{client_ip}/stream',
            'ai_queued': ai_queued
        }), 201
        
    except Exception as e:
        print(f"[ESP32-CAM] Error uploading image: {e}")
        return jsonify({'error': str(e)}), 400
