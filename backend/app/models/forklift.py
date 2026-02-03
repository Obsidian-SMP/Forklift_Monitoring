from peewee import (
    Model, CharField, FloatField, IntegerField, 
    DateTimeField, BooleanField, TextField
)
from datetime import datetime
import json
from app.models.database import db


class Forklift(Model):
    """Model for forklift metadata and current status"""
    
    forklift_id = CharField(unique=True, index=True)
    name = CharField(default='Forklift 1')
    status = CharField(default='idle')  # idle, active, maintenance, offline
    battery_level = FloatField(default=100.0)
    last_seen = DateTimeField(default=datetime.utcnow)
    current_load = IntegerField(default=0)
    is_lifting = BooleanField(default=False)
    
    class Meta:
        database = db
        table_name = 'forklifts'
    
    def to_dict(self):
        return {
            'id': self.id,
            'forklift_id': self.forklift_id,
            'name': self.name,
            'status': self.status,
            'battery_level': self.battery_level,
            'last_seen': self.last_seen.isoformat(),
            'current_load': self.current_load,
            'is_lifting': self.is_lifting
        }


class ForkliftLocation(Model):
    """Model for forklift GPS and positioning data"""
    
    forklift_id = CharField(index=True)
    latitude = FloatField(null=True)
    longitude = FloatField(null=True)
    wifi_position = TextField(null=True)  # JSON string
    altitude = FloatField(null=True)
    speed = FloatField(null=True)
    heading = FloatField(null=True)
    accuracy = FloatField(null=True)
    timestamp = DateTimeField(default=datetime.utcnow, index=True)
    
    class Meta:
        database = db
        table_name = 'forklift_locations'
    
    def to_dict(self):
        wifi_pos = None
        if self.wifi_position:
            try:
                wifi_pos = json.loads(self.wifi_position)
            except:
                wifi_pos = {}
        
        return {
            'id': self.id,
            'forklift_id': self.forklift_id,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'wifi_position': wifi_pos,
            'altitude': self.altitude,
            'speed': self.speed,
            'heading': self.heading,
            'accuracy': self.accuracy,
            'timestamp': self.timestamp.isoformat()
        }


class VibrationData(Model):
    """Model for forklift vibration/accelerometer data"""
    
    forklift_id = CharField(index=True)
    accel_x = FloatField()
    accel_y = FloatField()
    accel_z = FloatField()
    magnitude = FloatField(null=True)
    is_anomaly = BooleanField(default=False, index=True)
    timestamp = DateTimeField(default=datetime.utcnow, index=True)
    
    class Meta:
        database = db
        table_name = 'vibration_data'
    
    def to_dict(self):
        return {
            'id': self.id,
            'forklift_id': self.forklift_id,
            'accel_x': self.accel_x,
            'accel_y': self.accel_y,
            'accel_z': self.accel_z,
            'magnitude': self.magnitude,
            'is_anomaly': self.is_anomaly,
            'timestamp': self.timestamp.isoformat()
        }
