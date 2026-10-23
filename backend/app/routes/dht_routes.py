"""
DHT Sensor Routes
Endpoints for reading temperature and humidity from DHT sensor on GPIO pin 40
"""

from flask import Blueprint, jsonify
from app.models import WarehouseSensor
from app.services.dht_sensor import get_dht_reading, initialize_dht

dht_bp = Blueprint('dht', __name__)

# Initialize on first import
initialize_dht()

@dht_bp.route('/temperature', methods=['GET'])
def get_temperature():
    """Get current temperature from DHT sensor"""
    try:
        reading = get_dht_reading()
        if reading:
            return jsonify({
                'temperature': reading.get('temperature'),
                'unit': 'celsius',
                'timestamp': reading.get('timestamp'),
                'status': 'success'
            }), 200
        return jsonify({'error': 'Failed to read DHT sensor', 'status': 'error'}), 500
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 500

@dht_bp.route('/humidity', methods=['GET'])
def get_humidity():
    """Get current humidity from DHT sensor"""
    try:
        reading = get_dht_reading()
        if reading:
            return jsonify({
                'humidity': reading.get('humidity'),
                'unit': 'percent',
                'timestamp': reading.get('timestamp'),
                'status': 'success'
            }), 200
        return jsonify({'error': 'Failed to read DHT sensor', 'status': 'error'}), 500
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 500

@dht_bp.route('/reading', methods=['GET'])
def get_dht_data():
    """Get the latest temperature and humidity received by the backend."""
    try:
        sensor = WarehouseSensor.select().order_by(
            WarehouseSensor.timestamp.desc()
        ).first()
        if sensor:
            reading = sensor.to_dict()
            return jsonify({
                'temperature': reading['temperature'],
                'humidity': reading['humidity'],
                'timestamp': reading['timestamp'],
                'sensor_id': reading['sensor_id'],
                'status': 'success',
                'source': 'backend'
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
