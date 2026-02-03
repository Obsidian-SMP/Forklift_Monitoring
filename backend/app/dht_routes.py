"""
DHT Sensor Routes
Endpoints for reading temperature and humidity from DHT sensor on GPIO pin 40
"""

from flask import Blueprint, jsonify
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
    """Get current temperature and humidity from DHT sensor"""
    try:
        reading = get_dht_reading()
        if reading:
            return jsonify({
                'temperature': reading.get('temperature'),
                'humidity': reading.get('humidity'),
                'timestamp': reading.get('timestamp'),
                'status': 'success'
            }), 200
        return jsonify({'error': 'Failed to read DHT sensor', 'status': 'error'}), 500
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 500
