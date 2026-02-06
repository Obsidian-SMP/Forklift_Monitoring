"""
Alerts and Notifications Routes
Real-time alerts from warehouse data
"""

from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta
from app.services.alerts_service import AlertsService, NotificationService
from app.services.notification_service import notification_service
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
        'whatsapp': False,
    },
    'notification_recipients': {
        'email': [],
        'sms': []
    }
}

# Cache for tracking which alerts have been notified
NOTIFIED_ALERTS = set()

def process_alert_notifications(alerts):
    """
    Process alerts and send notifications for high-priority ones
    
    Args:
        alerts: List of alert dictionaries
        
    Returns:
        Dict with notification results
    """
    results = []
    
    # Alert types that should trigger automatic notifications
    AUTO_NOTIFY_TYPES = ['low_inventory', 'out_of_stock', 'inventory_detected']
    
    for alert in alerts:
        alert_id = alert.get('id')
        alert_type = alert.get('type')
        severity = alert.get('severity')
        
        # Skip if already notified or if type shouldn't auto-notify
        if alert_id in NOTIFIED_ALERTS:
            continue
            
        if alert_type not in AUTO_NOTIFY_TYPES:
            continue
        
        # Check if any notification channels are enabled
        channels_enabled = any(ALERT_SETTINGS['notification_channels'].values())
        if not channels_enabled:
            continue
        
        # Send notification
        try:
            result = notification_service.send_alert_notification(
                alert,
                ALERT_SETTINGS
            )
            
            if result.get('all_success'):
                NOTIFIED_ALERTS.add(alert_id)
                results.append({
                    'alert_id': alert_id,
                    'success': True,
                    'result': result
                })
        except Exception as e:
            results.append({
                'alert_id': alert_id,
                'success': False,
                'error': str(e)
            })
    
    return {
        'processed': len(results),
        'results': results
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
        
        # Process alerts for automatic notifications
        notification_result = None
        if alerts:
            try:
                notification_result = process_alert_notifications(alerts)
                if notification_result['processed'] > 0:
                    print(f"✉️ Sent {notification_result['processed']} automatic notifications")
            except Exception as e:
                print(f"Error processing notifications: {e}")
        
        return jsonify({
            'count': len(alerts),
            'alerts': alerts,
            'settings': ALERT_SETTINGS,
            'notifications_sent': notification_result['processed'] if notification_result else 0
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
        
        # Track if recipients were updated
        recipients_updated = False
        old_recipients = ALERT_SETTINGS['notification_recipients'].copy()
        
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
            recipients_updated = True
        
        response_data = {
            'message': 'Settings updated',
            'settings': ALERT_SETTINGS
        }
        
        # Send test notifications when recipients are updated
        if recipients_updated:
            test_results = send_test_notifications_for_new_recipients(
                old_recipients,
                ALERT_SETTINGS['notification_recipients']
            )
            response_data['test_notifications'] = test_results
        
        return jsonify(response_data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400


def send_test_notifications_for_new_recipients(old_recipients: dict, new_recipients: dict) -> dict:
    """
    Send test notifications to newly added recipients
    
    Args:
        old_recipients: Previous recipient list
        new_recipients: Updated recipient list
        
    Returns:
        Dict with test notification results
    """
    results = {}
    
    # Check for new emails
    old_emails = set(old_recipients.get('email', []))
    new_emails = set(new_recipients.get('email', []))
    added_emails = new_emails - old_emails
    
    # Check for new phone numbers
    old_phones = set(old_recipients.get('sms', []))
    new_phones = set(new_recipients.get('sms', []))
    added_phones = new_phones - old_phones
    
    # Send test email to new email addresses
    for email in added_emails:
        subject = "✅ Warehouse Alert System - Email Configured"
        body = (
            "Hello!\n\n"
            "This is a confirmation that your email address has been successfully "
            "added to the warehouse alert notification system.\n\n"
            "You will now receive alert notifications for:\n"
            "- Low inventory alerts\n"
            "- Out of stock alerts\n"
            "- Inventory detection alerts\n\n"
            "If you did not request this, please contact your system administrator.\n\n"
            "Best regards,\n"
            "Warehouse IoT System"
        )
        result = notification_service.send_email(email, subject, body)
        results[f'email_test_{email}'] = result
    
    # Send test WhatsApp to new phone numbers
    for phone in added_phones:
        message = (
            "✅ Warehouse Alert System\n\n"
            "Your phone number has been successfully added to receive alert notifications.\n\n"
            "You will receive alerts for:\n"
            "• Low inventory\n"
            "• Out of stock\n"
            "• Inventory detection\n\n"
            "This is a test message to confirm delivery."
        )
        result = notification_service.send_whatsapp(phone, message)
        results[f'whatsapp_test_{phone}'] = result
    
    return {
        'emails_tested': list(added_emails),
        'phones_tested': list(added_phones),
        'results': results,
        'success_count': sum(1 for r in results.values() if r.get('success', False)),
        'total_count': len(results)
    }


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


# ==================== NOTIFICATION TEST ENDPOINTS ====================

@alerts_bp.route('/test/sms', methods=['POST'])
def test_sms():
    """Test SMS notification"""
    try:
        data = request.get_json() or {}
        to = data.get('to', notification_service.default_phone_to)
        message = data.get('message', 'Test SMS from Warehouse IoT System')
        
        result = notification_service.send_sms(to, message)
        
        return jsonify({
            'success': result.get('success', False),
            'result': result,
            'timestamp': datetime.utcnow().isoformat()
        }), 200 if result.get('success') else 500
        
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


@alerts_bp.route('/test/whatsapp', methods=['POST'])
def test_whatsapp():
    """Test WhatsApp notification"""
    try:
        data = request.get_json() or {}
        to = data.get('to', notification_service.default_whatsapp_to)
        message = data.get('message', '🚨 Test WhatsApp message from Warehouse IoT System\n\nThis is a test notification.')
        
        result = notification_service.send_whatsapp(to, message)
        
        return jsonify({
            'success': result.get('success', False),
            'result': result,
            'timestamp': datetime.utcnow().isoformat()
        }), 200 if result.get('success') else 500
        
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


@alerts_bp.route('/test/email', methods=['POST'])
def test_email():
    """Test Email notification"""
    try:
        data = request.get_json() or {}
        to = data.get('to', notification_service.smtp_email)
        subject = data.get('subject', 'Test Email from Warehouse IoT System')
        body = data.get('body', 'This is a test email notification from the Warehouse IoT System.\n\nIf you received this, email notifications are working correctly.')
        
        result = notification_service.send_email(to, subject, body)
        
        return jsonify({
            'success': result.get('success', False),
            'result': result,
            'timestamp': datetime.utcnow().isoformat()
        }), 200 if result.get('success') else 500
        
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


@alerts_bp.route('/test/notification', methods=['POST'])
def test_full_notification():
    """Test full alert notification (simulates real alert)"""
    try:
        data = request.get_json() or {}
        
        # Create a test alert
        test_alert = {
            'id': f"test-alert-{datetime.utcnow().timestamp()}",
            'type': data.get('type', 'low_inventory'),
            'severity': data.get('severity', 'medium'),
            'message': data.get('message', 'Test alert: Low inventory detected for Box-Red items'),
            'source': 'test',
            'timestamp': datetime.utcnow().isoformat(),
            'metadata': {'test': True}
        }
        
        # Get channels to test (or use all enabled)
        force_channels = data.get('channels')  # e.g., ['email', 'whatsapp']
        
        # Send notification
        result = notification_service.send_alert_notification(
            test_alert, 
            ALERT_SETTINGS,
            force_channels
        )
        
        return jsonify({
            'success': result.get('all_success', False),
            'alert': test_alert,
            'notification_result': result,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


@alerts_bp.route('/send-notification', methods=['POST'])
def send_alert_notification():
    """Send notification for a specific alert"""
    try:
        data = request.get_json() or {}
        
        if not data.get('alert'):
            return jsonify({'error': 'Alert data required', 'success': False}), 400
        
        alert_data = data['alert']
        force_channels = data.get('channels')  # Optional: force specific channels
        
        # Send notification
        result = notification_service.send_alert_notification(
            alert_data, 
            ALERT_SETTINGS,
            force_channels
        )
        
        return jsonify({
            'success': result.get('all_success', False),
            'result': result,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


@alerts_bp.route('/process-notifications', methods=['POST'])
def process_notifications():
    """Process current alerts and send notifications for high-priority ones"""
    try:
        # Get current alerts
        filters = {
            'limit': 100,
            'low_stock_threshold': ALERT_SETTINGS['low_stock_threshold']
        }
        
        alerts = AlertsService.get_all_alerts(filters)
        alerts = [a for a in alerts if ALERT_SETTINGS['enabled_alerts'].get(a.get('type', ''), True)]
        
        # Process and send notifications
        result = process_alert_notifications(alerts)
        
        return jsonify({
            'success': True,
            'total_alerts': len(alerts),
            'notification_result': result,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500
