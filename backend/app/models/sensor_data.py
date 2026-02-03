from peewee import Model, FloatField, DateTimeField, CharField
from datetime import datetime
from app.models.database import db


class WarehouseSensor(Model):
    """Model for warehouse environmental sensor data (DHT11)"""
    
    temperature = FloatField()
    humidity = FloatField()
    sensor_id = CharField(default='warehouse_main')
    timestamp = DateTimeField(default=datetime.utcnow)
    
    class Meta:
        database = db
        table_name = 'warehouse_sensors'
        indexes = (
            (('timestamp',), False),
        )
    
    def to_dict(self):
        return {
            'id': self.id,
            'temperature': self.temperature,
            'humidity': self.humidity,
            'sensor_id': self.sensor_id,
            'timestamp': self.timestamp.isoformat()
        }
