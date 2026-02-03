from flask import Blueprint, request, jsonify
from app.models.warehouse import WarehouseMap
import logging

warehouse_bp = Blueprint('warehouse', __name__, url_prefix='/warehouse')
logger = logging.getLogger(__name__)


@warehouse_bp.route('/map', methods=['GET'])
def get_warehouse_map():
    """Get the current warehouse map"""
    try:
        map_data = WarehouseMap.get_current_map()
        
        if not map_data:
            return jsonify({'error': 'No map uploaded'}), 404
        
        return jsonify({
            'id': map_data.id,
            'image_data': map_data.image_data,
            'width': map_data.width,
            'height': map_data.height,
            'created_at': map_data.created_at.isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Error retrieving warehouse map: {str(e)}")
        return jsonify({'error': str(e)}), 500


@warehouse_bp.route('/map', methods=['POST'])
def upload_warehouse_map():
    """Upload new warehouse map (replaces old one)"""
    try:
        data = request.get_json()
        
        if not data or 'image_data' not in data:
            return jsonify({'error': 'Missing image_data'}), 400
        
        image_data = data.get('image_data')
        width = data.get('width', '100')
        height = data.get('height', '100')
        
        # Validate image data is base64
        if not isinstance(image_data, str) or not image_data.startswith('data:image'):
            return jsonify({'error': 'Invalid image data format'}), 400
        
        # Save new map (automatically deletes old one)
        map_obj = WarehouseMap.save_new_map(image_data, width, height)
        
        logger.info(f"Warehouse map uploaded successfully (ID: {map_obj.id})")
        
        return jsonify({
            'message': 'Warehouse map uploaded successfully',
            'id': map_obj.id,
            'created_at': map_obj.created_at.isoformat()
        }), 201
    except Exception as e:
        logger.error(f"Error uploading warehouse map: {str(e)}")
        return jsonify({'error': str(e)}), 500


@warehouse_bp.route('/map', methods=['DELETE'])
def delete_warehouse_map():
    """Delete the current warehouse map"""
    try:
        map_data = WarehouseMap.get_current_map()
        
        if not map_data:
            return jsonify({'error': 'No map to delete'}), 404
        
        map_id = map_data.id
        WarehouseMap.delete_by_id(map_id)
        
        logger.info(f"Warehouse map deleted (ID: {map_id})")
        
        return jsonify({'message': 'Warehouse map deleted successfully'}), 200
    except Exception as e:
        logger.error(f"Error deleting warehouse map: {str(e)}")
        return jsonify({'error': str(e)}), 500
