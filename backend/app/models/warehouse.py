from peewee import Model, TextField, DateTimeField
from datetime import datetime
from app.models.database import db


class WarehouseMap(Model):
    """Store warehouse floor plan images"""
    image_data = TextField()  # Base64 encoded image
    width = TextField(default="100")  # Warehouse width in meters
    height = TextField(default="100")  # Warehouse height in meters
    created_at = DateTimeField(default=datetime.utcnow)
    updated_at = DateTimeField(default=datetime.utcnow)
    
    class Meta:
        database = db
        table_name = 'warehouse_map'
    
    @classmethod
    def get_current_map(cls):
        """Get the most recent map (only one should exist at a time)"""
        try:
            return cls.select().order_by(cls.created_at.desc()).first()
        except:
            return None
    
    @classmethod
    def save_new_map(cls, image_data, width="100", height="100"):
        """Delete old map and save new one"""
        cls.delete().execute()  # Remove all old maps
        return cls.create(
            image_data=image_data,
            width=width,
            height=height,
            updated_at=datetime.utcnow()
        )
