from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta

from app.models import WarehouseSensor

sensor_bp = Blueprint('sensor', __name__)


@sensor_bp.route('/environment/current', methods=['GET'])
def get_current_environment():
    """Get latest warehouse temperature and humidity"""
    try:
        sensor = WarehouseSensor.select().order_by(WarehouseSensor.timestamp.desc()).first()
        if sensor:
            return jsonify(sensor.to_dict()), 200
        return jsonify({'message': 'No sensor data available'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sensor_bp.route('/environment/history', methods=['GET'])
def get_environment_history():
    """Get historical warehouse sensor data"""
    try:
        # Get time range from query params
        hours = int(request.args.get('hours', 24))
        limit = int(request.args.get('limit', 1000))  # Add limit to prevent loading too much data
        start_time = datetime.utcnow() - timedelta(hours=hours)
        
        # Convert to list first to avoid multiple queries
        sensors = list(WarehouseSensor.select().where(
            WarehouseSensor.timestamp >= start_time
        ).order_by(WarehouseSensor.timestamp.desc()).limit(limit))
        
        return jsonify({
            'count': len(sensors),
            'data': [sensor.to_dict() for sensor in sensors]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sensor_bp.route('/environment/stats', methods=['GET'])
def get_environment_stats():
    """Get statistical summary of environment data"""
    try:
        hours = int(request.args.get('hours', 24))
        start_time = datetime.utcnow() - timedelta(hours=hours)
        
        sensors = list(WarehouseSensor.select().where(
            WarehouseSensor.timestamp >= start_time
        ))
        
        if len(sensors) == 0:
            return jsonify({'message': 'No data available'}), 404
        
        temps = [s.temperature for s in sensors]
        humids = [s.humidity for s in sensors]
        
        stats = {
            'temperature': {
                'current': sensors[0].temperature,
                'min': min(temps),
                'max': max(temps),
                'avg': sum(temps) / len(temps)
            },
            'humidity': {
                'current': sensors[0].humidity,
                'min': min(humids),
                'max': max(humids),
                'avg': sum(humids) / len(humids)
            },
            'period_hours': hours,
            'sample_count': len(temps)
        }
        
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sensor_bp.route('/environment/test-save', methods=['POST'])
def test_save_dht():
    """Test endpoint to manually save current DHT reading to database"""
    try:
        from app.services.dht_sensor import get_dht_reading
        
        reading = get_dht_reading()
        if reading:
            sensor = WarehouseSensor.create(
                temperature=reading['temperature'],
                humidity=reading['humidity'],
                sensor_id='dht11_gpio21'
            )
            return jsonify({
                'message': 'Successfully saved DHT reading',
                'reading': reading,
                'saved': sensor.to_dict()
            }), 201
        else:
            return jsonify({'error': 'Failed to read DHT sensor'}), 500
    except Exception as e:
        import traceback
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500


@sensor_bp.route('/environment', methods=['POST'])
def add_environment_data():
    """Manually add warehouse sensor data (REST endpoint for DHT11)"""
    try:
        data = request.get_json()
        
        sensor = WarehouseSensor.create(
            temperature=data['temperature'],
            humidity=data['humidity'],
            sensor_id=data.get('sensor_id', 'warehouse_main')
        )
        
        return jsonify(sensor.to_dict()), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400
