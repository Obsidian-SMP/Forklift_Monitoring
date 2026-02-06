from peewee import Model, FloatField, DateTimeField, CharField
from datetime import datetime, timezone, timedelta
from app.models.database import db

# IST timezone (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))


class WarehouseSensor(Model):
    """Model for warehouse environmental sensor data (DHT11)"""
    
    temperature = FloatField()
    humidity = FloatField()
    sensor_id = CharField(default='warehouse_main')
    timestamp = DateTimeField(default=lambda: datetime.now(IST))
    
    class Meta:
        database = db
        table_name = 'warehouse_sensors'
        indexes = (
            (('timestamp',), False),
        )
    
    def to_dict(self):
        # Handle timestamp - could be datetime object or string
        timestamp_str = self.timestamp
        if isinstance(timestamp_str, datetime):
            timestamp_str = timestamp_str.isoformat()
        elif not isinstance(timestamp_str, str):
            # If it's something else, convert to string
            timestamp_str = str(timestamp_str)
            
        return {
            'id': self.id,
            'temperature': self.temperature,
            'humidity': self.humidity,
            'sensor_id': self.sensor_id,
            'timestamp': timestamp_str
        }
