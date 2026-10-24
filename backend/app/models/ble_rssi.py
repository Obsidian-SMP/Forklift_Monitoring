"""
BLE/Bluetooth RSSI tracking models for mobile app gateways
Used for trilateration-based forklift positioning
"""

from peewee import Model, CharField, FloatField, IntegerField, DateTimeField, TextField
from datetime import datetime
import json
from app.models.database import db


class WiFiGateway(Model):
    """Model for storing gateway (phone) configuration and positions"""
    
    gateway_id = CharField(unique=True, index=True)  # e.g., "phone_1", "phone_2"
    name = CharField(default='Gateway 1')
    location_x = FloatField()  # X coordinate in meters
    location_y = FloatField()  # Y coordinate in meters
    location_z = FloatField(default=2.0)  # Z coordinate (height in meters)
    is_active = CharField(default='true')  # "true" or "false"
    last_seen = DateTimeField(default=datetime.utcnow)
    created_at = DateTimeField(default=datetime.utcnow)
    
    class Meta:
        database = db
        table_name = 'wifi_gateways'
    
    def to_dict(self):
        return {
            'id': self.id,
            'gateway_id': self.gateway_id,
            'name': self.name,
            'location': {
                'x': self.location_x,
                'y': self.location_y,
                'z': self.location_z
            },
            'is_active': self.is_active == 'true',
            'last_seen': self.last_seen.isoformat(),
            'created_at': self.created_at.isoformat()
        }


class BLERSSIData(Model):
    """Model for storing Bluetooth RSSI readings from mobile app gateways"""
    
    gateway_id = CharField(index=True)  # Which gateway sent this (phone_1, phone_2, etc.)
    forklift_id = CharField(default='forklift_001')  # Detected forklift beacon name
    rssi = IntegerField()  # Signal strength in dBm (negative value, e.g., -65)
    timestamp = DateTimeField(default=datetime.utcnow, index=True)
    
    class Meta:
        database = db
        table_name = 'ble_rssi_data'
        indexes = (
            (('gateway_id', 'timestamp'), False),
        )
    
    def to_dict(self):
        return {
            'id': self.id,
            'gateway_id': self.gateway_id,
            'forklift_id': self.forklift_id,
            'rssi': self.rssi,
            'timestamp': self.timestamp.isoformat()
        }
