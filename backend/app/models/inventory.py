from peewee import (
    Model, CharField, IntegerField, FloatField,
    DateTimeField, TextField, ForeignKeyField
)
from datetime import datetime
import json
from app.models.database import db


class Inventory(Model):
    """Model for warehouse inventory items"""
    
    item_id = CharField(unique=True, index=True)
    item_name = CharField()
    category = CharField(null=True)
    quantity = IntegerField(default=0)
    unit = CharField(default='boxes')
    
    # Location information
    zone = CharField(null=True, index=True)
    shelf = CharField(null=True)
    position = TextField(null=True)  # JSON string
    
    # Metadata
    last_updated = DateTimeField(default=datetime.utcnow)
    image_url = CharField(null=True)
    description = TextField(null=True)
    
    # Status
    status = CharField(default='in_stock', index=True)  # in_stock, out_of_stock, in_transit, dispatched
    
    class Meta:
        database = db
        table_name = 'inventory'
    
    def to_dict(self):
        pos = None
        if self.position:
            try:
                pos = json.loads(self.position)
            except:
                pos = {}
        
        return {
            'id': self.id,
            'item_id': self.item_id,
            'item_name': self.item_name,
            'category': self.category,
            'quantity': self.quantity,
            'unit': self.unit,
            'zone': self.zone,
            'shelf': self.shelf,
            'position': pos,
            'last_updated': self.last_updated.isoformat(),
            'image_url': self.image_url,
            'description': self.description,
            'status': self.status
        }


class InventoryTransaction(Model):
    """Model for inventory movement transactions"""
    
    transaction_id = CharField(unique=True, index=True)
    item = ForeignKeyField(Inventory, backref='transactions')
    forklift_id = CharField(null=True, index=True)
    
    transaction_type = CharField(index=True)  # pickup, dropoff, relocation, dispatch
    quantity = IntegerField()
    
    # Location information
    from_location = TextField(null=True)  # JSON string
    to_location = TextField(null=True)  # JSON string
    
    # Image evidence
    image_url = CharField(null=True)
    detected_count = IntegerField(null=True)
    
    timestamp = DateTimeField(default=datetime.utcnow, index=True)
    notes = TextField(null=True)
    
    class Meta:
        database = db
        table_name = 'inventory_transactions'
    
    def to_dict(self):
        from_loc = None
        to_loc = None
        
        if self.from_location:
            try:
                from_loc = json.loads(self.from_location)
            except:
                from_loc = {}
        
        if self.to_location:
            try:
                to_loc = json.loads(self.to_location)
            except:
                to_loc = {}
        
        return {
            'id': self.id,
            'transaction_id': self.transaction_id,
            'item_id': self.item.item_id if self.item else None,
            'item_name': self.item.item_name if self.item else None,
            'forklift_id': self.forklift_id,
            'transaction_type': self.transaction_type,
            'quantity': self.quantity,
            'from_location': from_loc,
            'to_location': to_loc,
            'image_url': self.image_url,
            'detected_count': self.detected_count,
            'timestamp': self.timestamp.isoformat(),
            'notes': self.notes
        }

class DetectedObject(Model):
    """Model for objects detected via camera in the warehouse"""
    
    object_id = CharField(unique=True, index=True)  # object-001, object-002, etc.
    forklift_id = CharField(null=True, index=True)
    camera_id = CharField(null=True)
    
    # Detection information
    detection_timestamp = DateTimeField(default=datetime.utcnow, index=True)
    photo_url = CharField(null=True)
    
    # Location information (from forklift position at time of detection)
    position_x = FloatField(null=True)
    position_y = FloatField(null=True)
    position_z = FloatField(null=True)
    
    # Status and movement tracking
    status = CharField(default='detected', index=True)  # detected, placed, picked_up, dispatched, missing
    location_mismatch = CharField(null=True)  # User-marked mismatch notes
    is_mismatch_flagged = CharField(default='false')  # true/false string
    
    # Inventory link
    inventory_item = ForeignKeyField(Inventory, null=True, backref='detected_objects')
    
    # Metadata
    confidence_score = FloatField(null=True)
    notes = TextField(null=True)
    
    class Meta:
        database = db
        table_name = 'detected_objects'
    
    def to_dict(self):
        return {
            'id': self.id,
            'object_id': self.object_id,
            'forklift_id': self.forklift_id,
            'camera_id': self.camera_id,
            'detection_timestamp': self.detection_timestamp.isoformat(),
            'photo_url': self.photo_url,
            'position': {
                'x': self.position_x,
                'y': self.position_y,
                'z': self.position_z
            },
            'status': self.status,
            'location_mismatch': self.location_mismatch,
            'is_mismatch_flagged': self.is_mismatch_flagged == 'true',
            'inventory_item_id': self.inventory_item.item_id if self.inventory_item else None,
            'confidence_score': self.confidence_score,
            'notes': self.notes
        }


class WarehouseEntry(Model):
    """Model for tracking forklift entry/exit events at warehouse boundaries"""
    
    event_id = CharField(unique=True, index=True)
    forklift_id = CharField(index=True)
    
    event_type = CharField(index=True)  # entry, exit
    event_timestamp = DateTimeField(default=datetime.utcnow, index=True)
    
    # Position at time of event
    position_x = FloatField()
    position_y = FloatField()
    
    # Objects on forklift
    object_count = IntegerField(default=0)
    object_ids = TextField(null=True)  # JSON list of object IDs
    
    class Meta:
        database = db
        table_name = 'warehouse_entry'
    
    def to_dict(self):
        obj_ids = []
        if self.object_ids:
            try:
                obj_ids = json.loads(self.object_ids)
            except:
                obj_ids = []
        
        return {
            'id': self.id,
            'event_id': self.event_id,
            'forklift_id': self.forklift_id,
            'event_type': self.event_type,
            'event_timestamp': self.event_timestamp.isoformat(),
            'position': {
                'x': self.position_x,
                'y': self.position_y
            },
            'object_count': self.object_count,
            'object_ids': obj_ids
        }