"""
DHT Sensor Routes
Endpoints for reading temperature and humidity received from the DHT sensor.
"""

from flask import Blueprint, jsonify
from app.models import WarehouseSensor

dht_bp = Blueprint('dht', __name__)


def get_latest_received_reading():
    """Return the latest reading posted by the remote Raspberry Pi sensor."""
    sensor = WarehouseSensor.select().order_by(
        WarehouseSensor.timestamp.desc()
    ).first()
    if not sensor:
        return None

    reading = sensor.to_dict()
    return {
        'temperature': reading['temperature'],
        'humidity': reading['humidity'],
        'timestamp': reading['timestamp'],
        'status': 'success',
        'source': 'raspberry_pi',
        'sensor_id': reading['sensor_id'],
    }

@dht_bp.route('/temperature', methods=['GET'])
def get_temperature():
    """Get the latest temperature received from the DHT sensor."""
    try:
        reading = get_latest_received_reading()
        if reading:
            return jsonify({
                'temperature': reading.get('temperature'),
                'unit': 'celsius',
                'timestamp': reading.get('timestamp'),
                'status': 'success'
            }), 200
        return jsonify({'error': 'No DHT reading has been received', 'status': 'unavailable'}), 404
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 500

@dht_bp.route('/humidity', methods=['GET'])
def get_humidity():
    """Get the latest humidity received from the DHT sensor."""
    try:
        reading = get_latest_received_reading()
        if reading:
            return jsonify({
                'humidity': reading.get('humidity'),
                'unit': 'percent',
                'timestamp': reading.get('timestamp'),
                'status': 'success'
            }), 200
        return jsonify({'error': 'No DHT reading has been received', 'status': 'unavailable'}), 404
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 500

@dht_bp.route('/reading', methods=['GET'])
def get_dht_data():
    """Get the latest temperature and humidity received from the sensor."""
    try:
        reading = get_latest_received_reading()
        if reading:
            return jsonify({
                'temperature': reading.get('temperature'),
                'humidity': reading.get('humidity'),
                'timestamp': reading.get('timestamp'),
                'status': reading['status'],
                'source': reading['source'],
                'sensor_id': reading['sensor_id'],
            }), 200
        return jsonify({
            'temperature': None,
            'humidity': None,
            'timestamp': None,
            'status': 'unavailable',
            'source': 'none',
            'note': 'No DHT reading has been received by the backend'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 500
