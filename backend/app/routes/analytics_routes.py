from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta

from app.models import (
    WarehouseSensor, Forklift, ForkliftLocation, 
    VibrationData, Inventory, InventoryTransaction
)

analytics_bp = Blueprint('analytics', __name__)


@analytics_bp.route('/dashboard', methods=['GET'])
def get_dashboard_data():
    """Get comprehensive dashboard data"""
    try:
        # Current warehouse conditions
        latest_sensor = WarehouseSensor.select().order_by(WarehouseSensor.timestamp.desc()).first()
        
        # Forklift status
        forklifts = list(Forklift.select())
        forklift_summary = {
            'total': len(forklifts),
            'active': len([f for f in forklifts if f.status == 'active']),
            'idle': len([f for f in forklifts if f.status == 'idle']),
            'offline': len([f for f in forklifts if f.status == 'offline'])
        }
        
        # Inventory summary
        inventory_items = list(Inventory.select())
        inventory_summary = {
            'total_items': len(inventory_items),
            'in_stock': len([i for i in inventory_items if i.status == 'in_stock']),
            'in_transit': len([i for i in inventory_items if i.status == 'in_transit']),
            'out_of_stock': len([i for i in inventory_items if i.status == 'out_of_stock']),
            'total_quantity': sum(item.quantity for item in inventory_items)
        }
        
        # Recent transactions
        recent_transactions = list(InventoryTransaction.select().order_by(
            InventoryTransaction.timestamp.desc()
        ).limit(10))
        
        # Recent anomalies
        recent_anomalies = list(VibrationData.select().where(
            VibrationData.is_anomaly == True
        ).order_by(VibrationData.timestamp.desc()).limit(5))
        
        dashboard = {
            'warehouse_conditions': latest_sensor.to_dict() if latest_sensor else None,
            'forklifts': forklift_summary,
            'forklift_details': [f.to_dict() for f in forklifts],
            'inventory': inventory_summary,
            'recent_transactions': [t.to_dict() for t in recent_transactions],
            'recent_anomalies': [a.to_dict() for a in recent_anomalies],
            'timestamp': datetime.utcnow().isoformat()
        }
        
        return jsonify(dashboard), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/activity', methods=['GET'])
def get_activity_summary():
    """Get activity summary for specified time period"""
    try:
        hours = int(request.args.get('hours', 24))
        start_time = datetime.utcnow() - timedelta(hours=hours)
        
        # Transaction counts by type
        transactions = list(InventoryTransaction.select().where(
            InventoryTransaction.timestamp >= start_time
        ))
        transaction_summary = {
            'total': len(transactions),
            'pickup': len([t for t in transactions if t.transaction_type == 'pickup']),
            'dropoff': len([t for t in transactions if t.transaction_type == 'dropoff']),
            'relocation': len([t for t in transactions if t.transaction_type == 'relocation']),
            'dispatch': len([t for t in transactions if t.transaction_type == 'dispatch'])
        }
        
        # Vibration anomalies
        anomalies = VibrationData.select().where(
            (VibrationData.timestamp >= start_time) &
            (VibrationData.is_anomaly == True)
        ).count()
        
        # Location data points
        location_count = ForkliftLocation.select().where(
            ForkliftLocation.timestamp >= start_time
        ).count()
        
        activity = {
            'period_hours': hours,
            'transactions': transaction_summary,
            'vibration_anomalies': anomalies,
            'location_updates': location_count,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        return jsonify(activity), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/forklift/<forklift_id>/performance', methods=['GET'])
def get_forklift_performance(forklift_id):
    """Get performance metrics for specific forklift"""
    try:
        hours = int(request.args.get('hours', 24))
        start_time = datetime.utcnow() - timedelta(hours=hours)
        
        # Transactions by this forklift
        transactions = list(InventoryTransaction.select().where(
            (InventoryTransaction.forklift_id == forklift_id) &
            (InventoryTransaction.timestamp >= start_time)
        ))
        
        # Distance traveled (approximate from location updates)
        locations = list(ForkliftLocation.select().where(
            (ForkliftLocation.forklift_id == forklift_id) &
            (ForkliftLocation.timestamp >= start_time)
        ).order_by(ForkliftLocation.timestamp.asc()))
        
        # Calculate approximate distance
        distance = 0
        if len(locations) > 1:
            for i in range(1, len(locations)):
                if locations[i].latitude and locations[i-1].latitude:
                    # Simple Euclidean distance (for indoor tracking)
                    dx = locations[i].latitude - locations[i-1].latitude
                    dy = locations[i].longitude - locations[i-1].longitude
                    distance += (dx**2 + dy**2) ** 0.5
        
        # Anomalies
        anomalies = VibrationData.select().where(
            (VibrationData.forklift_id == forklift_id) &
            (VibrationData.timestamp >= start_time) &
            (VibrationData.is_anomaly == True)
        ).count()
        
        performance = {
            'forklift_id': forklift_id,
            'period_hours': hours,
            'total_transactions': len(transactions),
            'items_moved': sum(t.quantity for t in transactions),
            'distance_traveled': round(distance, 2),
            'vibration_anomalies': anomalies,
            'location_updates': len(locations),
            'timestamp': datetime.utcnow().isoformat()
        }
        
        return jsonify(performance), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/inventory/low-stock', methods=['GET'])
def get_low_stock_items():
    """Get items with low stock"""
    try:
        threshold = int(request.args.get('threshold', 10))
        
        low_stock = list(Inventory.select().where(
            (Inventory.quantity <= threshold) &
            (Inventory.status == 'in_stock')
        ).order_by(Inventory.quantity.asc()))
        
        return jsonify({
            'threshold': threshold,
            'count': len(low_stock),
            'items': [item.to_dict() for item in low_stock]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
