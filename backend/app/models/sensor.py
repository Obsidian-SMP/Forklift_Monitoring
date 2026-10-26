# ==============================================================================
# File: app/models/sensor.py
# Description: Environmental Telemetry Domain Model.
# Purpose: Persists temperature and humidity readings received from the Raspberry
#          Pi DHT11 sensor node with timezone-aware timestamps.
# ==============================================================================

from datetime import datetime, timezone, timedelta
from peewee import Model, CharField, FloatField, DateTimeField
from app.core.database import db

IST = timezone(timedelta(hours=5, minutes=30))


class SensorReading(Model):
    """
    Environmental data log capturing ambient warehouse temperature and relative humidity.
    """

    sensor_id = CharField(default="dht11_rpi", index=True)
    temperature_celsius = FloatField()
    humidity_percent = FloatField()
    timestamp = DateTimeField(default=lambda: datetime.now(IST), index=True)

    class Meta:
        database = db
        table_name = "sensor_readings"
        indexes = ((("sensor_id", "timestamp"), False),)

    def to_dict(self):
        return {
            "id": self.id,
            "sensor_id": self.sensor_id,
            "temperature": round(self.temperature_celsius, 1),
            "humidity": round(self.humidity_percent, 1),
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }
