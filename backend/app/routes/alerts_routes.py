"""
Alerts and Notifications Routes
Real-time alerts from warehouse data
"""

from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta
from app.services.alerts_service import AlertsService, NotificationService
from app.models import Inventory, DetectedObject, WarehouseEntry, InventoryTransaction

alerts_bp = Blueprint('alerts', __name__)

# Store alert settings in memory (in production, use database)
ALERT_SETTINGS = {
    'low_stock_threshold': 10,
    'confidence_threshold': 0.75,
    'enabled_alerts': {
        'inventory_detected': True,
        'inventory_mismatch': True,
        'forklift_entry': True,
        'forklift_exit': True,
        'forklift_in_zone': True,
        'low_inventory': True,
        'out_of_stock': True,
        'item_added': True,
        'high_detection_confidence': True,
        'low_detection_confidence': True,
    },
    'notification_channels': {
        'in_app': True,
        'email': False,
        'sms': False,
    },
    'notification_recipients': {
        'email': [],
        'sms': []
    }
}


@alerts_bp.route('/', methods=['GET'])
def get_alerts():
    """Get all real alerts from warehouse data"""
    try:
        # Get query parameters
        severity = request.args.get('severity')
        alert_type = request.args.get('type')
        source = request.args.get('source')
        limit = int(request.args.get('limit', 100))
        
        filters = {
            'severity': severity,
            'type': alert_type,
            'source': source,
            'limit': limit,
            'low_stock_threshold': ALERT_SETTINGS['low_stock_threshold']
        }
        
        # Get alerts from service with error handling
        try:
            alerts = AlertsService.get_all_alerts(filters)
        except Exception as e:
            print(f"Error getting alerts from service: {e}")
            alerts = []
        
        # Filter by enabled alerts
        alerts = [a for a in alerts if ALERT_SETTINGS['enabled_alerts'].get(a.get('type', ''), True)]
        
        return jsonify({
            'count': len(alerts),
            'alerts': alerts,
            'settings': ALERT_SETTINGS
        }), 200
    except Exception as e:
        print(f"Error in get_alerts: {str(e)}")
        return jsonify({
            'count': 0,
            'alerts': [],
            'settings': ALERT_SETTINGS,
            'error': str(e)
        }), 200


@alerts_bp.route('/<alert_id>', methods=['GET'])
def get_alert(alert_id):
    """Get specific alert details"""
    try:
        alerts = AlertsService.get_all_alerts({'limit': 1000})
        alert = next((a for a in alerts if a['id'] == alert_id), None)
        
        if alert:
            return jsonify(alert), 200
        return jsonify({'message': 'Alert not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@alerts_bp.route('/statistics', methods=['GET'])
def get_alert_statistics():
    """Get alert statistics and summary"""
    try:
        alerts = AlertsService.get_all_alerts({'limit': 1000})
        
        # Calculate statistics with error handling
        stats = {
            'total': len(alerts),
            'by_severity': {
                'critical': 0,
                'high': 0,
                'medium': 0,
                'low': 0,
                'info': 0,
            },
            'by_type': {},
            'recent_24h': 0
        }
        
        # Count by severity and type
        for alert in alerts:
            severity = alert.get('severity', 'info')
            alert_type = alert.get('type', 'unknown')
            
            # Increment severity count
            if severity in stats['by_severity']:
                stats['by_severity'][severity] += 1
            
            # Increment type count
            if alert_type not in stats['by_type']:
                stats['by_type'][alert_type] = 0
            stats['by_type'][alert_type] += 1
            
            # Count recent 24h alerts
            try:
                timestamp_str = alert.get('timestamp', '')
                if timestamp_str:
                    alert_time = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    if alert_time > datetime.utcnow() - timedelta(hours=24):
                        stats['recent_24h'] += 1
            except:
                pass  # Skip timestamp parsing errors
        
        return jsonify(stats), 200
    except Exception as e:
        print(f"Error in get_alert_statistics: {str(e)}")
        # Return default stats even on error
        return jsonify({
            'total': 0,
            'by_severity': {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'info': 0},
            'by_type': {},
            'recent_24h': 0,
            'error': str(e)
        }), 200



@alerts_bp.route('/settings', methods=['GET'])
def get_alert_settings():
    """Get alert configuration settings"""
    try:
        return jsonify(ALERT_SETTINGS), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@alerts_bp.route('/settings', methods=['PUT'])
def update_alert_settings():
    """Update alert configuration settings"""
    try:
        global ALERT_SETTINGS
        data = request.get_json()
        
        # Update allowed fields
        if 'low_stock_threshold' in data:
            ALERT_SETTINGS['low_stock_threshold'] = data['low_stock_threshold']
        
        if 'confidence_threshold' in data:
            ALERT_SETTINGS['confidence_threshold'] = data['confidence_threshold']
        
        if 'enabled_alerts' in data:
            ALERT_SETTINGS['enabled_alerts'].update(data['enabled_alerts'])
        
        if 'notification_channels' in data:
            ALERT_SETTINGS['notification_channels'].update(data['notification_channels'])
        
        if 'notification_recipients' in data:
            ALERT_SETTINGS['notification_recipients'].update(data['notification_recipients'])
        
        return jsonify({
            'message': 'Settings updated',
            'settings': ALERT_SETTINGS
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@alerts_bp.route('/settings/alert-type/<alert_type>', methods=['PUT'])
def toggle_alert_type(alert_type):
    """Enable/disable specific alert type"""
    try:
        global ALERT_SETTINGS
        data = request.get_json()
        
        if alert_type in ALERT_SETTINGS['enabled_alerts']:
            ALERT_SETTINGS['enabled_alerts'][alert_type] = data.get('enabled', False)
            return jsonify({
                'message': f'Alert type {alert_type} updated',
                'enabled': ALERT_SETTINGS['enabled_alerts'][alert_type]
            }), 200
        
        return jsonify({'message': 'Alert type not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@alerts_bp.route('/send-notification', methods=['POST'])
def send_notification():
    """Send notification for an alert"""
    try:
        data = request.get_json()
        alert = data.get('alert')
        channels = data.get('channels', ['in_app'])
        recipients = data.get('recipients', [])
        
        notifications = NotificationService.send_notification(
            alert, 
            channels=channels,
            recipients=recipients
        )
        
        return jsonify({
            'message': 'Notifications sent',
            'notifications': notifications
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@alerts_bp.route('/inventory-analytics', methods=['GET'])
def get_inventory_analytics():
    """Get inventory statistics and analytics"""
    try:
        # Get inventory statistics
        total_items = Inventory.select().count()
        in_stock = Inventory.select().where(Inventory.status == 'in_stock').count()
        in_transit = Inventory.select().where(Inventory.status == 'in_transit').count()
        out_of_stock = Inventory.select().where(Inventory.quantity == 0).count()
        low_stock = Inventory.select().where(
            (Inventory.quantity > 0) & (Inventory.quantity <= ALERT_SETTINGS['low_stock_threshold'])
        ).count()
        
        # Category breakdown
        categories = {}
        for item in Inventory.select():
            category = item.category or 'Uncategorized'
            if category not in categories:
                categories[category] = {'total': 0, 'quantity': 0}
            categories[category]['total'] += 1
            categories[category]['quantity'] += item.quantity
        
        # Status breakdown
        status_breakdown = {
            'in_stock': in_stock,
            'in_transit': in_transit,
            'out_of_stock': out_of_stock
        }
        
        # Supplied vs Remaining
        all_items = list(Inventory.select())
        total_quantity_remaining = sum(item.quantity for item in all_items)
        
        # Get recent transactions to estimate supplied
        total_supplied = 0
        try:
            recent_transactions = list(InventoryTransaction.select().order_by(
                InventoryTransaction.timestamp.desc()
            ).limit(100))
            for trans in recent_transactions:
                if trans.transaction_type in ['dispatch', 'exit']:
                    total_supplied += trans.quantity
        except:
            # If transactions table doesn't exist, estimate from warehouse events
            try:
                exits = WarehouseEntry.select().where(
                    WarehouseEntry.event_type == 'exit'
                )
                for event in exits:
                    total_supplied += event.object_count
            except:
                total_supplied = 0
        
        return jsonify({
            'summary': {
                'total_items': total_items,
                'total_quantity_remaining': total_quantity_remaining,
                'total_supplied': total_supplied,
                'out_of_stock': out_of_stock,
                'low_stock': low_stock
            },
            'status_breakdown': status_breakdown,
            'categories': categories,
            'threshold_settings': {
                'low_stock_threshold': ALERT_SETTINGS['low_stock_threshold']
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
