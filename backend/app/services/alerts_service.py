"""
Real-time Alert Generation Service
Monitors warehouse events and generates alerts based on actual data
"""

from datetime import datetime, timedelta
from app.models import (
    DetectedObject, WarehouseEntry, Inventory, 
    InventoryTransaction, Forklift, ForkliftLocation
)
import json

class AlertsService:
    """Service for generating and managing warehouse alerts"""
    
    # Alert types and their configurations
    ALERT_TYPES = {
        'inventory_detected': {
            'description': 'New object detected in warehouse',
            'severity': 'info',
            'category': 'inventory'
        },
        'inventory_mismatch': {
            'description': 'Inventory location mismatch detected',
            'severity': 'high',
            'category': 'inventory'
        },
        'forklift_entry': {
            'description': 'Forklift entered warehouse',
            'severity': 'low',
            'category': 'warehouse_event'
        },
        'forklift_exit': {
            'description': 'Forklift exited warehouse',
            'severity': 'low',
            'category': 'warehouse_event'
        },
        'forklift_in_zone': {
            'description': 'Forklift detected in zone',
            'severity': 'low',
            'category': 'location'
        },
        'low_inventory': {
            'description': 'Inventory level below threshold',
            'severity': 'medium',
            'category': 'inventory'
        },
        'out_of_stock': {
            'description': 'Item out of stock',
            'severity': 'high',
            'category': 'inventory'
        },
        'item_added': {
            'description': 'New item added to inventory',
            'severity': 'low',
            'category': 'inventory'
        },
        'high_detection_confidence': {
            'description': 'High confidence object detection',
            'severity': 'low',
            'category': 'detection'
        },
        'low_detection_confidence': {
            'description': 'Low confidence object detection',
            'severity': 'medium',
            'category': 'detection'
        },
    }
    
    @staticmethod
    def get_detected_object_alerts():
        """Generate alerts from recently detected objects"""
        alerts = []
        
        # Get recent detected objects (last hour)
        recent_time = datetime.utcnow() - timedelta(hours=1)
        recent_objects = DetectedObject.select().where(
            DetectedObject.detection_timestamp >= recent_time
        ).order_by(DetectedObject.detection_timestamp.desc())
        
        for obj in recent_objects:
            # New detection alert
            alerts.append({
                'id': f"alert-obj-{obj.object_id}",
                'type': 'inventory_detected',
                'severity': 'info',
                'message': f"Object {obj.object_id} detected on forklift {obj.forklift_id}",
                'source': obj.object_id,
                'timestamp': obj.detection_timestamp.isoformat(),
                'metadata': {
                    'object_id': obj.object_id,
                    'forklift_id': obj.forklift_id,
                    'confidence_score': float(obj.confidence_score) if obj.confidence_score else 0,
                    'position': {
                        'x': float(obj.position_x) if obj.position_x else 0,
                        'y': float(obj.position_y) if obj.position_y else 0,
                    }
                }
            })
            
            # Low confidence alert
            if obj.confidence_score and obj.confidence_score < 0.75:
                alerts.append({
                    'id': f"alert-conf-{obj.object_id}",
                    'type': 'low_detection_confidence',
                    'severity': 'medium',
                    'message': f"Low confidence ({obj.confidence_score*100:.1f}%) for object {obj.object_id}",
                    'source': obj.object_id,
                    'timestamp': obj.detection_timestamp.isoformat(),
                    'metadata': {'confidence_score': float(obj.confidence_score)}
                })
            
            # Location mismatch alert
            if obj.is_mismatch_flagged == 'true':
                alerts.append({
                    'id': f"alert-mismatch-{obj.object_id}",
                    'type': 'inventory_mismatch',
                    'severity': 'high',
                    'message': f"Location mismatch: {obj.location_mismatch}",
                    'source': obj.object_id,
                    'timestamp': obj.detection_timestamp.isoformat(),
                    'metadata': {'mismatch_details': obj.location_mismatch}
                })
        
        return alerts
    
    @staticmethod
    def get_warehouse_event_alerts():
        """Generate alerts from warehouse entry/exit events"""
        alerts = []
        
        # Get recent events (last 2 hours)
        recent_time = datetime.utcnow() - timedelta(hours=2)
        events = WarehouseEntry.select().where(
            WarehouseEntry.event_timestamp >= recent_time
        ).order_by(WarehouseEntry.event_timestamp.desc())
        
        for event in events:
            alert_type = 'forklift_entry' if event.event_type == 'entry' else 'forklift_exit'
            emoji = '📥' if event.event_type == 'entry' else '📤'
            
            alerts.append({
                'id': f"alert-event-{event.event_id}",
                'type': alert_type,
                'severity': 'low',
                'message': f"{emoji} Forklift {event.forklift_id} {event.event_type} with {event.object_count} objects",
                'source': event.forklift_id,
                'timestamp': event.event_timestamp.isoformat(),
                'metadata': {
                    'forklift_id': event.forklift_id,
                    'event_type': event.event_type,
                    'object_count': event.object_count,
                    'position': {
                        'x': float(event.position_x) if event.position_x else 0,
                        'y': float(event.position_y) if event.position_y else 0,
                    }
                }
            })
        
        return alerts
    
    @staticmethod
    def get_inventory_alerts(low_stock_threshold=10):
        """Generate alerts from inventory levels"""
        alerts = []
        
        inventory_items = Inventory.select()
        
        for item in inventory_items:
            # Low stock alert
            if item.quantity <= low_stock_threshold and item.quantity > 0:
                alerts.append({
                    'id': f"alert-low-{item.item_id}",
                    'type': 'low_inventory',
                    'severity': 'medium',
                    'message': f"Low inventory: {item.item_name} ({item.quantity} remaining)",
                    'source': item.item_id,
                    'timestamp': item.last_updated.isoformat(),
                    'metadata': {
                        'item_id': item.item_id,
                        'item_name': item.item_name,
                        'quantity': item.quantity,
                        'threshold': low_stock_threshold
                    }
                })
            
            # Out of stock alert
            if item.quantity == 0:
                alerts.append({
                    'id': f"alert-oos-{item.item_id}",
                    'type': 'out_of_stock',
                    'severity': 'high',
                    'message': f"Out of stock: {item.item_name}",
                    'source': item.item_id,
                    'timestamp': item.last_updated.isoformat(),
                    'metadata': {
                        'item_id': item.item_id,
                        'item_name': item.item_name,
                        'category': item.category
                    }
                })
        
        return alerts
    
    @staticmethod
    def get_forklift_location_alerts(zone_mappings=None):
        """Generate alerts for forklifts in specific zones"""
        alerts = []
        
        if zone_mappings is None:
            zone_mappings = {
                'charging_station': {'x_min': 0, 'x_max': 50, 'y_min': 0, 'y_max': 50},
                'loading_dock': {'x_min': 100, 'x_max': 150, 'y_min': 0, 'y_max': 50},
                'storage_a': {'x_min': 0, 'x_max': 100, 'y_min': 50, 'y_max': 150},
            }
        
        # Get recent locations - use group_by instead of distinct with field
        recent_time = datetime.utcnow() - timedelta(minutes=5)
        recent_locations = (ForkliftLocation
                           .select()
                           .where(ForkliftLocation.timestamp >= recent_time)
                           .group_by(ForkliftLocation.forklift_id)
                           .order_by(ForkliftLocation.timestamp.desc()))
        
        for location in recent_locations:
            # Check which zone forklift is in
            for zone_name, bounds in zone_mappings.items():
                x_min = bounds.get('x_min', 0)
                x_max = bounds.get('x_max', 0)
                y_min = bounds.get('y_min', 0)
                y_max = bounds.get('y_max', 0)
                
                if x_min <= location.latitude <= x_max and y_min <= location.longitude <= y_max:
                    alerts.append({
                        'id': f"alert-zone-{location.forklift_id}-{zone_name}",
                        'type': 'forklift_in_zone',
                        'severity': 'low',
                        'message': f"Forklift {location.forklift_id} detected in {zone_name.replace('_', ' ')}",
                        'source': location.forklift_id,
                        'timestamp': location.timestamp.isoformat(),
                        'metadata': {
                            'forklift_id': location.forklift_id,
                            'zone': zone_name,
                            'position': {
                                'x': float(location.latitude) if location.latitude else 0,
                                'y': float(location.longitude) if location.longitude else 0,
                            }
                        }
                    })
        
        return alerts
    
    @staticmethod
    def get_all_alerts(filters=None):
        """Get all real alerts from warehouse data"""
        if filters is None:
            filters = {}
        
        all_alerts = []
        
        # Collect alerts from all sources with error handling
        try:
            all_alerts.extend(AlertsService.get_detected_object_alerts())
        except Exception as e:
            print(f"Error getting detected object alerts: {e}")
        
        try:
            all_alerts.extend(AlertsService.get_warehouse_event_alerts())
        except Exception as e:
            print(f"Error getting warehouse event alerts: {e}")
        
        try:
            all_alerts.extend(AlertsService.get_inventory_alerts(
                filters.get('low_stock_threshold', 10)
            ))
        except Exception as e:
            print(f"Error getting inventory alerts: {e}")
        
        try:
            all_alerts.extend(AlertsService.get_forklift_location_alerts())
        except Exception as e:
            print(f"Error getting forklift location alerts: {e}")
        
        # Sort by timestamp (newest first)
        if all_alerts:
            try:
                all_alerts.sort(key=lambda x: x['timestamp'], reverse=True)
            except Exception as e:
                print(f"Error sorting alerts: {e}")
        
        # Apply filters
        if filters.get('severity'):
            all_alerts = [a for a in all_alerts if a['severity'] == filters['severity']]
        
        if filters.get('type'):
            all_alerts = [a for a in all_alerts if a['type'] == filters['type']]
        
        if filters.get('source'):
            all_alerts = [a for a in all_alerts if a['source'] == filters['source']]
        
        if filters.get('limit'):
            all_alerts = all_alerts[:filters['limit']]
        
        return all_alerts


# Import NotificationService from separate module
from app.services.notification_service import NotificationService
