"""
RSSI Routes for Mobile App Gateway Integration
Handles Bluetooth RSSI data from mobile phones and calculates forklift positions
"""

from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta
from app.models import BLERSSIData, WiFiGateway, ForkliftPositionTrilateration
from app.services.trilateration_service import TrilatationService
from app.gateway_config import GATEWAYS

rssi_bp = Blueprint('rssi', __name__)


@rssi_bp.route('/setup', methods=['GET'])
def setup_gateways():
    """
    Initialize gateways in database from gateway_config.py
    Call this once at startup to create gateway entries
    """
    try:
        created = []
        for gateway_id, gateway_info in GATEWAYS.items():
            gw, is_new = WiFiGateway.get_or_create(
                gateway_id=gateway_id,
                defaults={
                    'name': gateway_info['name'],
                    'location_x': gateway_info['position']['x'],
                    'location_y': gateway_info['position']['y'],
                    'location_z': gateway_info['position']['z'],
                    'is_active': 'true' if gateway_info['is_active'] else 'false'
                }
            )
            created.append(gw.to_dict())
        
        return jsonify({
            'status': 'success',
            'message': f'{len(created)} gateways initialized',
            'gateways': created
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@rssi_bp.route('', methods=['POST'])
def receive_rssi():
    """
    Receive RSSI data from mobile app gateway
    
    Expected JSON:
    {
        "gateway_id": "phone_1",
        "rssi": -65
    }
    
    Optional:
    {
        "gateway_id": "phone_2",
        "rssi": -55,
        "forklift_id": "forklift_001"  # Default if not provided
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        gateway_id = data.get('gateway_id')
        rssi = data.get('rssi')
        forklift_id = data.get('forklift_id', 'forklift_001')
        
        if not gateway_id or rssi is None:
            return jsonify({'error': 'Missing gateway_id or rssi'}), 400
        
        # Validate RSSI is in reasonable range
        if not isinstance(rssi, int) or rssi > 0 or rssi < -120:
            return jsonify({'error': 'RSSI must be between -120 and 0 dBm'}), 400
        
        # Store RSSI reading with retry logic for concurrent writes
        import time
        max_retries = 3
        retry_delay = 0.1  # 100ms
        
        for attempt in range(max_retries):
            try:
                ble_reading = BLERSSIData.create(
                    gateway_id=gateway_id,
                    forklift_id=forklift_id,
                    rssi=rssi,
                    timestamp=datetime.utcnow()
                )
                print(f"📡 RSSI received: {gateway_id} → {forklift_id}: {rssi} dBm")
                break  # Success, exit retry loop
            except Exception as db_error:
                if 'database is locked' in str(db_error) and attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                    continue
                else:
                    import traceback
                    print(f"❌ Database error storing RSSI after {attempt+1} attempts: {db_error}")
                    traceback.print_exc()
                    return jsonify({'error': f'Failed to store RSSI: {str(db_error)}'}), 500
        
        # Update gateway last_seen timestamp
        try:
            gateway, _ = WiFiGateway.get_or_create(
                gateway_id=gateway_id,
                defaults={
                    'name': f'Gateway {gateway_id}',
                    'location_x': 0.0,
                    'location_y': 0.0,
                    'location_z': 1.5,
                    'is_active': 'true'
                }
            )
            gateway.last_seen = datetime.utcnow()
            gateway.is_active = 'true'
            gateway.save()
        except Exception as gw_error:
            print(f"⚠️ Gateway update failed (non-critical): {gw_error}")
        
        # Try to calculate position with latest readings (non-critical, don't fail if error)
        try:
            position = TrilatationService.calculate_position(forklift_id)
            if position:
                gw_count = position.get('gateway_count', 0)
                accuracy = position.get('accuracy', 0)
                print(f"✅ Position calculated: ({position.get('x', 0):.2f}, {position.get('y', 0):.2f}) with {gw_count} gateways (accuracy: {accuracy:.2f}m)")
            else:
                # Get latest RSSI to see which gateways are active
                gateway_rssi = TrilatationService.get_latest_rssi_per_gateway(forklift_id, 10)
                print(f"⚠️ Not enough gateways for position calculation (have {len(gateway_rssi)}, need 2+): {list(gateway_rssi.keys())}")
        except Exception as tril_error:
            print(f"⚠️ Trilateration error (non-critical): {tril_error}")
            import traceback
            traceback.print_exc()
            position = None
        
        if position and position.get('accuracy', 999) < 10.0:  # Good accuracy
            try:
                saved_pos = TrilatationService.save_calculated_position(forklift_id, position)
                
                # Broadcast position update via WebSocket
                try:
                    from flask import current_app
                    socketio = current_app.extensions.get('socketio')
                    if socketio:
                        socketio.emit('position_update', saved_pos, namespace='/')
                        print(f"📡 WebSocket: Position update broadcasted")
                except Exception as ws_error:
                    print(f"⚠️ WebSocket broadcast failed: {ws_error}")
                    
            except Exception as save_pos_error:
                print(f"⚠️ Failed to save position: {save_pos_error}")
                saved_pos = None
                
            return jsonify({
                'status': 'success',
                'message': 'RSSI recorded and position calculated',
                'rssi_record': ble_reading.to_dict(),
                'position': saved_pos
            }), 201
        else:
            return jsonify({
                'status': 'success',
                'message': 'RSSI recorded (waiting for more data)',
                'rssi_record': ble_reading.to_dict(),
                'position': position
            }), 201
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500


@rssi_bp.route('/gateways', methods=['GET'])
def get_all_gateways():
    """Get all gateway configurations"""
    try:
        gateways = list(WiFiGateway.select())
        return jsonify({
            'count': len(gateways),
            'gateways': [g.to_dict() for g in gateways]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@rssi_bp.route('/gateways/<gateway_id>', methods=['GET'])
def get_gateway(gateway_id):
    """Get specific gateway details"""
    try:
        gateway = WiFiGateway.get(WiFiGateway.gateway_id == gateway_id)
        return jsonify(gateway.to_dict()), 200
    except:
        return jsonify({'message': 'Gateway not found'}), 404


@rssi_bp.route('/gateways/<gateway_id>', methods=['PUT'])
def update_gateway(gateway_id):
    """Update gateway configuration"""
    try:
        data = request.get_json()
        gateway = WiFiGateway.get(WiFiGateway.gateway_id == gateway_id)
        
        if 'name' in data:
            gateway.name = data['name']
        if 'location_x' in data:
            gateway.location_x = data['location_x']
        if 'location_y' in data:
            gateway.location_y = data['location_y']
        if 'location_z' in data:
            gateway.location_z = data['location_z']
        if 'is_active' in data:
            gateway.is_active = 'true' if data['is_active'] else 'false'
        
        gateway.save()
        return jsonify(gateway.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@rssi_bp.route('/gateways/<gateway_id>', methods=['DELETE'])
def delete_gateway(gateway_id):
    """Delete a gateway"""
    try:
        gateway = WiFiGateway.get(WiFiGateway.gateway_id == gateway_id)
        gateway_name = gateway.name
        gateway.delete_instance()
        return jsonify({
            'status': 'success',
            'message': f'Gateway "{gateway_name}" deleted successfully'
        }), 200
    except WiFiGateway.DoesNotExist:
        return jsonify({'error': 'Gateway not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@rssi_bp.route('/debug', methods=['GET'])
def debug_info():
    """Debug endpoint to see current system state"""
    try:
        # Get all gateways
        gateways = list(WiFiGateway.select())
        gateway_info = [{
            'gateway_id': g.gateway_id,
            'name': g.name,
            'position': {'x': g.location_x, 'y': g.location_y, 'z': g.location_z},
            'is_active': g.is_active,
            'last_seen': g.last_seen.isoformat() if g.last_seen else None
        } for g in gateways]
        
        # Get recent RSSI data (last 30 seconds)
        cutoff = datetime.utcnow() - timedelta(seconds=30)
        recent_rssi = list(BLERSSIData.select().where(
            BLERSSIData.timestamp >= cutoff
        ).order_by(BLERSSIData.timestamp.desc()))
        
        rssi_info = [{
            'gateway_id': r.gateway_id,
            'forklift_id': r.forklift_id,
            'rssi': r.rssi,
            'timestamp': r.timestamp.isoformat()
        } for r in recent_rssi]
        
        # Get latest position
        latest_position = ForkliftPositionTrilateration.select().order_by(
            ForkliftPositionTrilateration.timestamp.desc()
        ).first()
        
        position_info = None
        if latest_position:
            position_info = {
                'x': latest_position.calculated_x,
                'y': latest_position.calculated_y,
                'z': latest_position.calculated_z,
                'accuracy': latest_position.accuracy,
                'gateway_count': latest_position.gateway_count,
                'timestamp': latest_position.timestamp.isoformat()
            }
        
        return jsonify({
            'gateways': gateway_info,
            'recent_rssi_count': len(rssi_info),
            'recent_rssi': rssi_info,
            'latest_position': position_info,
            'system_time': datetime.utcnow().isoformat()
        }), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@rssi_bp.route('/history', methods=['GET'])
def get_rssi_history():
    """
    Get RSSI history for a forklift
    
    Query params:
    - forklift_id: (default: forklift_001)
    - hours: (default: 1) - how many hours back
    - limit: (default: 100) - max records
    """
    try:
        forklift_id = request.args.get('forklift_id', 'forklift_001')
        hours = int(request.args.get('hours', 1))
        limit = int(request.args.get('limit', 100))
        
        start_time = datetime.utcnow() - timedelta(hours=hours)
        
        readings = list(BLERSSIData.select().where(
            (BLERSSIData.forklift_id == forklift_id) &
            (BLERSSIData.timestamp >= start_time)
        ).order_by(BLERSSIData.timestamp.desc()).limit(limit))
        
        return jsonify({
            'forklift_id': forklift_id,
            'count': len(readings),
            'period_hours': hours,
            'readings': [r.to_dict() for r in readings]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@rssi_bp.route('/position/latest', methods=['GET'])
def get_latest_position():
    """
    Get latest calculated forklift position
    
    Query params:
    - forklift_id: (default: forklift_001)
    """
    try:
        forklift_id = request.args.get('forklift_id', 'forklift_001')
        
        position = ForkliftPositionTrilateration.select().where(
            ForkliftPositionTrilateration.forklift_id == forklift_id
        ).order_by(ForkliftPositionTrilateration.timestamp.desc()).first()
        
        if position:
            return jsonify(position.to_dict()), 200
        return jsonify({'message': 'No position data available'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@rssi_bp.route('/position/history', methods=['GET'])
def get_position_history():
    """
    Get calculated position history (path taken)
    
    Query params:
    - forklift_id: (default: forklift_001)
    - hours: (default: 1) - how many hours back
    - limit: (default: 50) - max records
    """
    try:
        forklift_id = request.args.get('forklift_id', 'forklift_001')
        hours = int(request.args.get('hours', 1))
        limit = int(request.args.get('limit', 50))
        
        start_time = datetime.utcnow() - timedelta(hours=hours)
        
        positions = list(ForkliftPositionTrilateration.select().where(
            (ForkliftPositionTrilateration.forklift_id == forklift_id) &
            (ForkliftPositionTrilateration.timestamp >= start_time)
        ).order_by(ForkliftPositionTrilateration.timestamp.asc()).limit(limit))
        
        return jsonify({
            'forklift_id': forklift_id,
            'count': len(positions),
            'period_hours': hours,
            'track': [p.to_dict() for p in positions]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@rssi_bp.route('/position/calculate', methods=['POST'])
def calculate_position_now():
    """
    Manually trigger position calculation
    
    JSON body:
    {
        "forklift_id": "forklift_001"
    }
    """
    try:
        data = request.get_json() or {}
        forklift_id = data.get('forklift_id', 'forklift_001')
        
        position = TrilatationService.calculate_position(forklift_id, time_window_seconds=10)
        
        if position:
            saved = TrilatationService.save_calculated_position(forklift_id, position)
            return jsonify({
                'status': 'success',
                'position': saved
            }), 200
        else:
            return jsonify({
                'status': 'insufficient_data',
                'message': 'Not enough gateway readings for trilateration'
            }), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@rssi_bp.route('/gateways/add', methods=['POST'])
def add_or_update_gateway():
    """
    Add a new gateway or update an existing gateway's position
    
    JSON body:
    {
        "name": "phone_1",              // Required: Gateway name (unique identifier)
        "location_x": 10.5,              // Required: X position in meters
        "location_y": 20.3,              // Required: Y position in meters
        "location_z": 1.2,               // Optional: Z position/height in meters (default: 0)
        "gateway_id": "phone_1"          // Optional: Use name as gateway_id if not provided
    }
    
    Response:
    - If name exists: Updates position and returns updated gateway
    - If name is new: Creates new gateway and returns it
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        name = data.get('name', '').strip()
        location_x = data.get('location_x')
        location_y = data.get('location_y')
        location_z = data.get('location_z', 0.0)
        
        # Validate inputs
        if not name:
            return jsonify({'error': 'Gateway name is required'}), 400
        if location_x is None or location_y is None:
            return jsonify({'error': 'location_x and location_y are required'}), 400
        
        try:
            location_x = float(location_x)
            location_y = float(location_y)
            location_z = float(location_z)
        except (ValueError, TypeError):
            return jsonify({'error': 'Coordinates must be numeric values'}), 400
        
        # Use name as gateway_id if not provided
        gateway_id = data.get('gateway_id', name)
        
        # Check if gateway with this name already exists
        try:
            existing = WiFiGateway.get(WiFiGateway.name == name)
            # Update existing gateway
            existing.gateway_id = gateway_id
            existing.location_x = location_x
            existing.location_y = location_y
            existing.location_z = location_z
            existing.is_active = True
            existing.save()
            
            return jsonify({
                'status': 'updated',
                'message': f'Gateway "{name}" position updated',
                'gateway': existing.to_dict()
            }), 200
            
        except WiFiGateway.DoesNotExist:
            # Create new gateway
            new_gateway = WiFiGateway.create(
                gateway_id=gateway_id,
                name=name,
                location_x=location_x,
                location_y=location_y,
                location_z=location_z,
                is_active=True,
                last_seen=datetime.utcnow()
            )
            
            return jsonify({
                'status': 'created',
                'message': f'Gateway "{name}" created successfully',
                'gateway': new_gateway.to_dict()
            }), 201
            
    except Exception as e:
        import traceback
        print(f"❌ Error adding/updating gateway: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Failed to add/update gateway: {str(e)}'}), 500


@rssi_bp.route('/gateways/list', methods=['GET'])
def list_all_gateways():
    """
    Get all gateways with their current status and positions
    """
    try:
        gateways = WiFiGateway.select()
        gateway_list = [gw.to_dict() for gw in gateways]
        
        return jsonify({
            'status': 'success',
            'count': len(gateway_list),
            'gateways': gateway_list
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
