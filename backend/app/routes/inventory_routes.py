from flask import Blueprint, jsonify, request
from datetime import datetime
import json
import uuid
import os
import base64
import numpy as np
import cv2
from io import BytesIO
from PIL import Image
import math

from app.models import Inventory, InventoryTransaction, DetectedObject, WarehouseEntry

inventory_bp = Blueprint('inventory', __name__)


def get_gateways():
    """Fetch all gateways to check coverage"""
    try:
        # Try to import gateway routes to get gateway data
        from app.routes.gateway_routes import GATEWAYS
        return GATEWAYS
    except:
        return {}


def is_object_within_gateway_coverage(position_x, position_y, gateways, coverage_radius=150):
    """
    Check if object position is within gateway coverage
    
    Args:
        position_x: X coordinate
        position_y: Y coordinate
        gateways: Dictionary of gateways with locations
        coverage_radius: Maximum distance from gateway to be considered "covered"
    
    Returns:
        bool: True if within coverage, False if outside all gateways
    """
    if not position_x or not position_y:
        return True  # Assume covered if position unknown
    
    if not gateways:
        return True  # No gateways configured
    
    # Check distance to nearest gateway
    min_distance = float('inf')
    for gateway_id, gateway_data in gateways.items():
        if isinstance(gateway_data, dict) and 'location' in gateway_data:
            gw_x = gateway_data['location'].get('x', 0)
            gw_y = gateway_data['location'].get('y', 0)
            distance = math.sqrt((position_x - gw_x)**2 + (position_y - gw_y)**2)
            min_distance = min(min_distance, distance)
    
    return min_distance <= coverage_radius


def find_existing_object(position_x, position_y, confidence_score, position_threshold=50):
    """
    Find if this is an existing object or a new one
    
    Args:
        position_x: X coordinate
        position_y: Y coordinate
        confidence_score: Detection confidence
        position_threshold: Max distance (meters) to consider same object
    
    Returns:
        DetectedObject or None: Existing object if found, None if new
    """
    if not position_x or not position_y:
        return None
    
    # Get recent detected objects (last hour)
    from datetime import timedelta
    recent_time = datetime.utcnow() - timedelta(hours=1)
    
    recent_objects = DetectedObject.select().where(
        DetectedObject.detection_timestamp >= recent_time,
        DetectedObject.status.in_(['detected', 'placed'])  # Only active objects
    )
    
    for obj in recent_objects:
        if obj.position_x and obj.position_y:
            # Calculate distance between detected position and existing object
            distance = math.sqrt(
                (position_x - obj.position_x)**2 + 
                (position_y - obj.position_y)**2
            )
            
            # If within threshold, consider it the same object
            if distance <= position_threshold:
                return obj
    
    return None


@inventory_bp.route('/', methods=['GET'])
def get_all_inventory():
    """Get all inventory items"""
    try:
        status = request.args.get('status')
        zone = request.args.get('zone')
        
        query = Inventory.select()
        if status:
            query = query.where(Inventory.status == status)
        if zone:
            query = query.where(Inventory.zone == zone)
        
        items = list(query)
        
        return jsonify({
            'count': len(items),
            'items': [item.to_dict() for item in items]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/<item_id>', methods=['GET'])
def get_inventory_item(item_id):
    """Get specific inventory item"""
    try:
        item = Inventory.get_or_none(Inventory.item_id == item_id)
        if item:
            return jsonify(item.to_dict()), 200
        return jsonify({'message': 'Item not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/', methods=['POST'])
def create_inventory_item():
    """Create new inventory item"""
    try:
        data = request.get_json()
        import json
        
        pos = data.get('position', {})
        item = Inventory.create(
            item_id=data['item_id'],
            item_name=data['item_name'],
            category=data.get('category'),
            quantity=data.get('quantity', 0),
            unit=data.get('unit', 'boxes'),
            zone=data.get('zone'),
            shelf=data.get('shelf'),
            position=json.dumps(pos) if pos else None,
            description=data.get('description'),
            status=data.get('status', 'in_stock')
        )
        
        return jsonify(item.to_dict()), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@inventory_bp.route('/<item_id>', methods=['PUT'])
def update_inventory_item(item_id):
    """Update inventory item"""
    try:
        item = Inventory.get_or_none(Inventory.item_id == item_id)
        if not item:
            return jsonify({'message': 'Item not found'}), 404
        
        data = request.get_json()
        import json
        
        for key, value in data.items():
            if hasattr(item, key):
                if key == 'position' and value:
                    setattr(item, key, json.dumps(value))
                else:
                    setattr(item, key, value)
        
        item.last_updated = datetime.utcnow()
        item.save()
        
        return jsonify(item.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@inventory_bp.route('/<item_id>', methods=['DELETE'])
def delete_inventory_item(item_id):
    """Delete inventory item"""
    try:
        item = Inventory.get_or_none(Inventory.item_id == item_id)
        if not item:
            return jsonify({'message': 'Item not found'}), 404
        
        # Unlink all detected objects that reference this inventory item
        DetectedObject.update(inventory_item=None).where(
            DetectedObject.inventory_item == item
        ).execute()
        
        # Delete transactions that reference this item (optional - or keep for history)
        # InventoryTransaction.delete().where(InventoryTransaction.item == item).execute()
        
        item.delete_instance()
        return jsonify({'message': 'Item deleted successfully'}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/<item_id>/dispatch', methods=['POST'])
def dispatch_inventory_item(item_id):
    """Dispatch an inventory item"""
    try:
        item = Inventory.get_or_none(Inventory.item_id == item_id)
        if not item:
            return jsonify({'message': 'Item not found'}), 404
        
        # Update item status to dispatched
        item.status = 'dispatched'
        item.dispatched_at = datetime.utcnow()
        item.quantity = max(0, item.quantity - 1)
        item.save()
        
        # Also update the linked detected object if exists
        detected_obj = DetectedObject.get_or_none(DetectedObject.object_id == item_id)
        if detected_obj:
            detected_obj.status = 'dispatched'
            detected_obj.save()
        
        return jsonify({
            'message': 'Item dispatched successfully',
            'item': item.to_dict()
        }), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/transactions', methods=['GET'])
def get_transactions():
    """Get inventory transactions"""
    try:
        forklift_id = request.args.get('forklift_id')
        transaction_type = request.args.get('type')
        limit = int(request.args.get('limit', 100))
        
        query = InventoryTransaction.select()
        if forklift_id:
            query = query.where(InventoryTransaction.forklift_id == forklift_id)
        if transaction_type:
            query = query.where(InventoryTransaction.transaction_type == transaction_type)
        
        transactions = list(query.order_by(InventoryTransaction.timestamp.desc()).limit(limit))
        
        return jsonify({
            'count': len(transactions),
            'transactions': [t.to_dict() for t in transactions]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/transactions', methods=['POST'])
def create_transaction():
    """Create inventory transaction"""
    try:
        data = request.get_json()
        import json
        
        item = Inventory.get_or_none(Inventory.item_id == data['item_id'])
        if not item:
            return jsonify({'message': 'Item not found'}), 404
        
        from_loc = data.get('from_location', {})
        to_loc = data.get('to_location', {})
        
        transaction = InventoryTransaction.create(
            transaction_id=data['transaction_id'],
            item=item,
            forklift_id=data.get('forklift_id'),
            transaction_type=data['transaction_type'],
            quantity=data['quantity'],
            from_location=json.dumps(from_loc) if from_loc else None,
            to_location=json.dumps(to_loc) if to_loc else None,
            image_url=data.get('image_url'),
            detected_count=data.get('detected_count'),
            notes=data.get('notes')
        )
        
        # Update inventory quantity based on transaction type
        if data['transaction_type'] == 'pickup':
            item.quantity -= data['quantity']
        elif data['transaction_type'] == 'dropoff':
            item.quantity += data['quantity']
        elif data['transaction_type'] == 'dispatch':
            item.quantity -= data['quantity']
            item.status = 'dispatched'
        
        item.last_updated = datetime.utcnow()
        item.save()
        
        return jsonify(transaction.to_dict()), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ========== DETECTED OBJECTS ENDPOINTS ==========

@inventory_bp.route('/detected-objects', methods=['GET'])
def get_detected_objects():
    """Get all detected objects with optional filtering"""
    try:
        status = request.args.get('status')
        forklift_id = request.args.get('forklift_id')
        limit = int(request.args.get('limit', 100))
        
        query = DetectedObject.select()
        if status:
            query = query.where(DetectedObject.status == status)
        if forklift_id:
            query = query.where(DetectedObject.forklift_id == forklift_id)
        
        objects = list(query.order_by(DetectedObject.detection_timestamp.desc()).limit(limit))
        
        return jsonify({
            'count': len(objects),
            'objects': [obj.to_dict() for obj in objects]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/detected-objects/<object_id>', methods=['GET'])
def get_detected_object(object_id):
    """Get specific detected object"""
    try:
        obj = DetectedObject.get_or_none(DetectedObject.object_id == object_id)
        if obj:
            return jsonify(obj.to_dict()), 200
        return jsonify({'message': 'Object not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/detected-objects', methods=['POST'])
def create_detected_object():
    """Create a new detected object from camera"""
    try:
        data = request.get_json()
        
        # Generate object ID (object-001, object-002, etc.)
        object_count = DetectedObject.select().count()
        object_id = f"object-{str(object_count + 1).zfill(3)}"
        
        detected_obj = DetectedObject.create(
            object_id=object_id,
            object_type=data.get('object_type'),  # black_box, blue_box, red_box
            forklift_id=data.get('forklift_id'),
            camera_id=data.get('camera_id'),
            photo_url=data.get('photo_url'),
            position_x=data.get('position', {}).get('x'),
            position_y=data.get('position', {}).get('y'),
            position_z=data.get('position', {}).get('z'),
            status=data.get('status', 'detected'),
            confidence_score=data.get('confidence_score'),
            notes=data.get('notes')
        )
        
        return jsonify(detected_obj.to_dict()), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@inventory_bp.route('/detect-from-image', methods=['POST'])
def detect_from_image():
    """Detect objects from base64 image data and save detected object"""
    try:
        data = request.get_json()
        
        if not data.get('image'):
            return jsonify({'error': 'No image provided'}), 400
        
        forklift_id = data.get('forklift_id', 'forklift-001')
        
        # Decode base64 image
        image_data = base64.b64decode(data['image'])
        
        # Save the original image
        os.makedirs('uploads/images', exist_ok=True)
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        filename = f"{forklift_id}_{timestamp}.jpg"
        filepath = os.path.join('uploads', 'images', filename)
        
        with open(filepath, 'wb') as f:
            f.write(image_data)
        
        photo_url = f"/uploads/images/{filename}"
        
        # AI detection disabled - just save image without detection
        detected_items = []
        confidence_score = 0.85  # Default confidence
        
        # Get position data
        position_x = data.get('position', {}).get('x')
        position_y = data.get('position', {}).get('y')
        
        # Check if this is an existing object or a new one
        existing_obj = find_existing_object(position_x, position_y, confidence_score)
        
        if existing_obj:
            # Update existing object - same object detected again
            existing_obj.photo_url = photo_url
            existing_obj.position_x = position_x
            existing_obj.position_y = position_y
            existing_obj.position_z = data.get('position', {}).get('z')
            existing_obj.detection_timestamp = datetime.utcnow()
            existing_obj.confidence_score = confidence_score if confidence_score > 0 else existing_obj.confidence_score
            existing_obj.notes = f'Re-detected by camera on {forklift_id}'
            existing_obj.save()
            
            return jsonify({
                'object': existing_obj.to_dict(),
                'detected_items': detected_items,
                'photo_url': photo_url,
                'message': f'Updated existing object: {existing_obj.object_id}',
                'is_new': False,
                'action': 'update'
            }), 200
        else:
            # Check if position is within gateway coverage
            gateways = get_gateways()
            within_coverage = is_object_within_gateway_coverage(position_x, position_y, gateways)
            
            # Generate new object ID
            object_count = DetectedObject.select().count()
            object_id = f"object-{str(object_count + 1).zfill(3)}"
            
            # Create new detected object
            detected_obj = DetectedObject.create(
                object_id=object_id,
                forklift_id=forklift_id,
                photo_url=photo_url,
                position_x=position_x,
                position_y=position_y,
                position_z=data.get('position', {}).get('z'),
                status=data.get('status', 'detected'),
                confidence_score=confidence_score if confidence_score > 0 else None,
                notes=f'New object - {"Within" if within_coverage else "Outside"} gateway range'
            )
            
            return jsonify({
                'object': detected_obj.to_dict(),
                'detected_items': detected_items,
                'photo_url': photo_url,
                'message': f'New object detected: {detected_obj.object_id}',
                'is_new': True,
                'action': 'create',
                'within_gateway_coverage': within_coverage
            }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@inventory_bp.route('/test-detect', methods=['POST'])
def test_detect():
    """Test object detection endpoint - creates or updates detected object with sample image for testing"""
    try:
        import random
        
        data = request.get_json()
        forklift_id = data.get('forklift_id', 'forklift-001')
        position_x = data.get('position', {}).get('x', 0)
        position_y = data.get('position', {}).get('y', 0)
        
        # Randomly select a box type for testing
        box_types = ['red_box', 'blue_box', 'black_box']
        object_type = data.get('object_type', random.choice(box_types))
        
        # Check if this is an existing object or a new one
        existing_obj = find_existing_object(position_x, position_y, 0.95)
        
        # Generate a test image with cv2
        test_img = np.ones((480, 640, 3), dtype=np.uint8) * 150
        
        # Draw a colored box based on type
        if object_type == 'red_box':
            box_color = (50, 50, 200)  # BGR: red
        elif object_type == 'blue_box':
            box_color = (200, 50, 50)  # BGR: blue
        else:  # black_box
            box_color = (50, 50, 50)   # BGR: dark gray/black
        
        cv2.rectangle(test_img, (100, 100), (400, 300), box_color, -1)
        cv2.putText(test_img, f'{object_type.replace("_", " ").title()}', (150, 200), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        
        # Save test image
        os.makedirs('uploads/images', exist_ok=True)
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        filename = f"{forklift_id}_test_{timestamp}.jpg"
        filepath = os.path.join('uploads', 'images', filename)
        cv2.imwrite(filepath, test_img)
        
        photo_url = f"/uploads/images/{filename}"
        
        if existing_obj:
            # Update existing object - same object detected again
            existing_obj.object_type = object_type
            existing_obj.photo_url = photo_url
            existing_obj.position_x = position_x
            existing_obj.position_y = position_y
            existing_obj.position_z = data.get('position', {}).get('z', 0)
            existing_obj.detection_timestamp = datetime.utcnow()
            existing_obj.confidence_score = 0.95
            existing_obj.notes = f'Re-detected on {forklift_id}'
            existing_obj.save()
            
            return jsonify({
                'object': existing_obj.to_dict(),
                'photo_url': photo_url,
                'message': f'Updated existing object: {existing_obj.object_id}',
                'is_new': False,
                'action': 'update'
            }), 200
        else:
            # Check if position is within gateway coverage
            gateways = get_gateways()
            within_coverage = is_object_within_gateway_coverage(position_x, position_y, gateways)
            
            # Generate new object ID
            object_count = DetectedObject.select().count()
            object_id = f"object-{str(object_count + 1).zfill(3)}"
            
            # Create new detected object
            detected_obj = DetectedObject.create(
                object_id=object_id,
                object_type=object_type,
                forklift_id=forklift_id,
                photo_url=photo_url,
                position_x=position_x,
                position_y=position_y,
                position_z=data.get('position', {}).get('z', 0),
                status='detected',
                confidence_score=0.95,
                notes=f'New {object_type} detected on {forklift_id} - {"Within" if within_coverage else "Outside"} gateway coverage'
            )
            
            return jsonify({
                'object': detected_obj.to_dict(),
                'photo_url': photo_url,
                'message': f'New object detected: {detected_obj.object_id}',
                'is_new': True,
                'action': 'create',
                'within_gateway_coverage': within_coverage
            }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@inventory_bp.route('/detected-objects/<object_id>', methods=['PUT'])
def update_detected_object(object_id):
    """Update detected object (link to inventory, mark mismatch, etc.)"""
    try:
        obj = DetectedObject.get_or_none(DetectedObject.object_id == object_id)
        if not obj:
            return jsonify({'message': 'Object not found'}), 404
        
        data = request.get_json()
        old_status = obj.status
        
        # Update basic fields
        if 'status' in data:
            new_status = data['status']
            obj.status = new_status
            
            # Auto-create or update inventory item when status changes to 'placed'
            if new_status == 'placed' and old_status != 'placed':
                # Check if inventory item already exists for this object
                if not obj.inventory_item:
                    # Create new inventory item from detected object
                    try:
                        # Generate item name based on object type
                        object_type = obj.object_type if obj.object_type else 'unknown'
                        item_name = f"{object_type.replace('_', ' ').title()}"
                        category = object_type.replace('_box', '').title() if '_box' in object_type else 'General'
                        
                        # Create inventory item
                        inventory_item = Inventory.create(
                            item_id=obj.object_id,  # Use object_id as item_id
                            item_name=item_name,
                            category=category,
                            quantity=1,
                            unit='box',
                            zone='auto-detected',
                            status='in_stock',
                            image_url=obj.photo_url,
                            description=f'Auto-created from detection on {obj.forklift_id}',
                            placed_at=datetime.utcnow()
                        )
                        
                        # Link the inventory item to the detected object
                        obj.inventory_item = inventory_item
                        obj.notes = f'Placed in warehouse - Inventory item created: {inventory_item.item_id}'
                        
                    except Exception as inv_err:
                        print(f"Error creating inventory item: {inv_err}")
                        # Continue even if inventory creation fails
                else:
                    # Update existing inventory item status
                    obj.inventory_item.status = 'in_stock'
                    if not obj.inventory_item.placed_at:
                        obj.inventory_item.placed_at = datetime.utcnow()
                    obj.inventory_item.save()
            
            # Update inventory item when status changes to 'dispatched'
            elif new_status == 'dispatched' and obj.inventory_item:
                obj.inventory_item.status = 'dispatched'
                obj.inventory_item.quantity = max(0, obj.inventory_item.quantity - 1)
                obj.inventory_item.dispatched_at = datetime.utcnow()
                obj.inventory_item.save()
        
        if 'location_mismatch' in data:
            obj.location_mismatch = data['location_mismatch']
        if 'is_mismatch_flagged' in data:
            obj.is_mismatch_flagged = 'true' if data['is_mismatch_flagged'] else 'false'
        if 'notes' in data:
            obj.notes = data['notes']
        
        # Link to inventory item if provided
        if 'inventory_item_id' in data and data['inventory_item_id']:
            inventory = Inventory.get_or_none(Inventory.item_id == data['inventory_item_id'])
            if inventory:
                obj.inventory_item = inventory
        
        obj.save()
        return jsonify(obj.to_dict()), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 400


@inventory_bp.route('/detected-objects/<object_id>', methods=['DELETE'])
def delete_detected_object(object_id):
    """Delete detected object"""
    try:
        obj = DetectedObject.get_or_none(DetectedObject.object_id == object_id)
        if not obj:
            return jsonify({'message': 'Object not found'}), 404
        
        # Delete image file if it exists
        if obj.photo_url:
            try:
                from app.config import Config
                filename = obj.photo_url.split('/')[-1]
                filepath = os.path.join(Config.UPLOAD_FOLDER, filename)
                if os.path.exists(filepath):
                    os.remove(filepath)
            except Exception as img_err:
                print(f"Error deleting image: {img_err}")
        
        obj.delete_instance()
        return jsonify({'message': 'Object deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/detected-objects/delete-all', methods=['DELETE'])
def delete_all_detected_objects():
    """Delete all detected objects and their images"""
    try:
        from app.config import Config
        deleted_count = 0
        images_deleted = 0
        
        # Get all detected objects
        objects = DetectedObject.select()
        
        for obj in objects:
            # Delete image file if it exists
            if obj.photo_url:
                try:
                    filename = obj.photo_url.split('/')[-1]
                    filepath = os.path.join(Config.UPLOAD_FOLDER, filename)
                    if os.path.exists(filepath):
                        os.remove(filepath)
                        images_deleted += 1
                except Exception as img_err:
                    print(f"Error deleting image {obj.photo_url}: {img_err}")
            
            # Delete database entry
            obj.delete_instance()
            deleted_count += 1
        
        return jsonify({
            'message': f'Deleted {deleted_count} objects and {images_deleted} images',
            'objects_deleted': deleted_count,
            'images_deleted': images_deleted
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========== WAREHOUSE ENTRY/EXIT ENDPOINTS ==========

@inventory_bp.route('/warehouse-events', methods=['GET'])
def get_warehouse_events():
    """Get warehouse entry/exit events"""
    try:
        forklift_id = request.args.get('forklift_id')
        event_type = request.args.get('event_type')  # entry or exit
        limit = int(request.args.get('limit', 100))
        
        query = WarehouseEntry.select()
        if forklift_id:
            query = query.where(WarehouseEntry.forklift_id == forklift_id)
        if event_type:
            query = query.where(WarehouseEntry.event_type == event_type)
        
        events = list(query.order_by(WarehouseEntry.event_timestamp.desc()).limit(limit))
        
        return jsonify({
            'count': len(events),
            'events': [event.to_dict() for event in events]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/warehouse-events', methods=['POST'])
def create_warehouse_event():
    """Create warehouse entry/exit event"""
    try:
        data = request.get_json()
        
        event_id = f"event-{uuid.uuid4().hex[:8]}"
        object_ids = data.get('object_ids', [])
        
        event = WarehouseEntry.create(
            event_id=event_id,
            forklift_id=data['forklift_id'],
            event_type=data['event_type'],  # 'entry' or 'exit'
            position_x=data.get('position', {}).get('x', 0),
            position_y=data.get('position', {}).get('y', 0),
            object_count=len(object_ids),
            object_ids=json.dumps(object_ids) if object_ids else None
        )
        
        return jsonify(event.to_dict()), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@inventory_bp.route('/warehouse-stats', methods=['GET'])
def get_warehouse_stats():
    """Get warehouse inventory statistics with colored box tracking"""
    try:
        from datetime import datetime, timedelta
        
        # === WAREHOUSE ENTRY/EXIT STATISTICS ===
        entries = WarehouseEntry.select().where(WarehouseEntry.event_type == 'entry').count()
        exits = WarehouseEntry.select().where(WarehouseEntry.event_type == 'exit').count()
        net_objects = entries - exits
        
        # === DETECTION STATISTICS ===
        # Total detected objects
        total_detected = DetectedObject.select().count()
        
        # Count by color (all time)
        red_boxes_detected = DetectedObject.select().where(
            DetectedObject.object_type == 'red_box'
        ).count()
        
        blue_boxes_detected = DetectedObject.select().where(
            DetectedObject.object_type == 'blue_box'
        ).count()
        
        black_boxes_detected = DetectedObject.select().where(
            DetectedObject.object_type == 'black_box'
        ).count()
        
        # === WAREHOUSE STATISTICS (Current Stock) ===
        # Count boxes currently in warehouse (detected or placed status)
        warehouse_statuses = ['detected', 'placed']
        
        red_boxes_in_warehouse = DetectedObject.select().where(
            (DetectedObject.object_type == 'red_box') &
            (DetectedObject.status.in_(warehouse_statuses))
        ).count()
        
        blue_boxes_in_warehouse = DetectedObject.select().where(
            (DetectedObject.object_type == 'blue_box') &
            (DetectedObject.status.in_(warehouse_statuses))
        ).count()
        
        black_boxes_in_warehouse = DetectedObject.select().where(
            (DetectedObject.object_type == 'black_box') &
            (DetectedObject.status.in_(warehouse_statuses))
        ).count()
        
        # === INVENTORY ITEMS STATISTICS ===
        total_inventory_items = Inventory.select().count()
        
        # === MISMATCHES ===
        mismatches = DetectedObject.select().where(
            DetectedObject.is_mismatch_flagged == 'true'
        ).count()
        
        return jsonify({
            'warehouse_events': {
                'entries': entries,
                'exits': exits,
                'net_objects': net_objects
            },
            'detection_statistics': {
                'total_detected': total_detected,
                'red_boxes_detected': red_boxes_detected,
                'blue_boxes_detected': blue_boxes_detected,
                'black_boxes_detected': black_boxes_detected
            },
            'warehouse_statistics': {
                'red_boxes_in_warehouse': red_boxes_in_warehouse,
                'blue_boxes_in_warehouse': blue_boxes_in_warehouse,
                'black_boxes_in_warehouse': black_boxes_in_warehouse,
                'total_in_warehouse': red_boxes_in_warehouse + blue_boxes_in_warehouse + black_boxes_in_warehouse
            },
            'inventory': {
                'total_items': total_inventory_items,
                'mismatches': mismatches
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@inventory_bp.route('/general-statistics', methods=['GET'])
def get_general_statistics():
    """Get time-based statistics for boxes entering/exiting warehouse"""
    try:
        from datetime import datetime, timedelta
        
        # Get time period from query parameter (day, month, year)
        period = request.args.get('period', 'day')  # default to day
        
        # Calculate time range
        now = datetime.utcnow()
        if period == 'day':
            start_time = now - timedelta(days=1)
        elif period == 'month':
            start_time = now - timedelta(days=30)
        elif period == 'year':
            start_time = now - timedelta(days=365)
        else:
            start_time = now - timedelta(days=1)  # default to day
        
        # Helper function to count boxes by color and status in time period
        def count_boxes_by_color_status(box_color, status_list, start_time):
            return DetectedObject.select().where(
                (DetectedObject.object_type == box_color) &
                (DetectedObject.status.in_(status_list)) &
                (DetectedObject.detection_timestamp >= start_time)
            ).count()
        
        # Count entering boxes (detected, placed)
        entering_statuses = ['detected', 'placed']
        red_entering = count_boxes_by_color_status('red_box', entering_statuses, start_time)
        blue_entering = count_boxes_by_color_status('blue_box', entering_statuses, start_time)
        black_entering = count_boxes_by_color_status('black_box', entering_statuses, start_time)
        
        # Count exiting boxes (dispatched, picked_up)
        exiting_statuses = ['dispatched', 'picked_up']
        red_exiting = count_boxes_by_color_status('red_box', exiting_statuses, start_time)
        blue_exiting = count_boxes_by_color_status('blue_box', exiting_statuses, start_time)
        black_exiting = count_boxes_by_color_status('black_box', exiting_statuses, start_time)
        
        # Calculate totals
        total_entering = red_entering + blue_entering + black_entering
        total_exiting = red_exiting + blue_exiting + black_exiting
        total_movement = total_entering + total_exiting
        
        # Calculate averages and percentages
        if total_movement > 0:
            entering_percentage = round((total_entering / total_movement) * 100, 2)
            exiting_percentage = round((total_exiting / total_movement) * 100, 2)
        else:
            entering_percentage = 0
            exiting_percentage = 0
        
        # Calculate average per day/month/year based on period
        if period == 'day':
            avg_entering = total_entering  # already for 1 day
            avg_exiting = total_exiting
            period_label = "per day"
        elif period == 'month':
            avg_entering = round(total_entering / 30, 2)
            avg_exiting = round(total_exiting / 30, 2)
            period_label = "per month (30 days average)"
        elif period == 'year':
            avg_entering = round(total_entering / 365, 2)
            avg_exiting = round(total_exiting / 365, 2)
            period_label = "per year (365 days average)"
        else:
            avg_entering = total_entering
            avg_exiting = total_exiting
            period_label = "per day"
        
        return jsonify({
            'period': period,
            'period_label': period_label,
            'time_range': {
                'start': start_time.isoformat(),
                'end': now.isoformat()
            },
            'entering': {
                'red_boxes': red_entering,
                'blue_boxes': blue_entering,
                'black_boxes': black_entering,
                'total': total_entering
            },
            'exiting': {
                'red_boxes': red_exiting,
                'blue_boxes': blue_exiting,
                'black_boxes': black_exiting,
                'total': total_exiting
            },
            'statistics': {
                'total_movement': total_movement,
                'entering_percentage': entering_percentage,
                'exiting_percentage': exiting_percentage,
                'avg_entering': avg_entering,
                'avg_exiting': avg_exiting,
                'net_change': total_entering - total_exiting
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500