# ==============================================================================
# File: app/models/forklift.py
# Description: Forklift Fleet & Kinematic Telemetry Domain Models.
# Purpose: Tracks real-time vehicle positions, velocities, battery levels,
#          carrying status, historical trajectory breadcrumbs, and IMU impacts.
# ==============================================================================

from datetime import datetime, timezone, timedelta
from peewee import (
    Model,
    CharField,
    FloatField,
    IntegerField,
    BooleanField,
    DateTimeField,
    ForeignKeyField,
)
from app.core.database import db

IST = timezone(timedelta(hours=5, minutes=30))


class Forklift(Model):
    """
    Main entity for warehouse forklifts.
    Maintains operational status, kinematics, and cargo link.
    """

    forklift_id = CharField(unique=True, index=True)
    name = CharField(default="Forklift 1")
    status = CharField(default="idle", index=True)  # 'idle', 'carrying', 'maintenance'
    
    # Real-time kinematic state estimated by EKF
    current_x = FloatField(default=0.0)
    current_y = FloatField(default=0.0)
    velocity_x = FloatField(default=0.0)
    velocity_y = FloatField(default=0.0)
    speed_mps = FloatField(default=0.0)
    position_confidence = FloatField(default=100.0)  # 0 to 100%

    # Operational load info
    is_carrying = BooleanField(default=False)
    carrying_item_id = CharField(null=True)  # ID of item currently on the fork
    battery_level = IntegerField(default=100)

    last_seen = DateTimeField(default=lambda: datetime.now(IST))
    created_at = DateTimeField(default=lambda: datetime.now(IST))

    class Meta:
        database = db
        table_name = "forklifts"

    def to_dict(self):
        return {
            "id": self.id,
            "forklift_id": self.forklift_id,
            "name": self.name,
            "status": self.status,
            "position": {
                "x": round(self.current_x, 2),
                "y": round(self.current_y, 2),
            },
            "velocity": {
                "vx": round(self.velocity_x, 2),
                "vy": round(self.velocity_y, 2),
            },
            "speed_mps": round(self.speed_mps, 2),
            "position_confidence": round(self.position_confidence, 1),
            "is_carrying": self.is_carrying,
            "carrying_item_id": self.carrying_item_id,
            "battery_level": self.battery_level,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
        }


class ForkliftTrack(Model):
    """
    Downsampled trajectory history (1 Hz) for breadcrumb path tracking and replay.
    """

    forklift = ForeignKeyField(Forklift, backref="tracks", on_delete="CASCADE")
    x = FloatField()
    y = FloatField()
    speed_mps = FloatField(default=0.0)
    confidence = FloatField(default=100.0)
    timestamp = DateTimeField(default=lambda: datetime.now(IST), index=True)

    class Meta:
        database = db
        table_name = "forklift_tracks"
        indexes = ((("forklift", "timestamp"), False),)

    def to_dict(self):
        return {
            "x": round(self.x, 2),
            "y": round(self.y, 2),
            "speed": round(self.speed_mps, 2),
            "confidence": round(self.confidence, 1),
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


class VibrationReading(Model):
    """
    Stores accelerometer and impact measurements from the Arduino Nano 33 IoT.
    """

    forklift_id = CharField(index=True)
    accel_x = FloatField()
    accel_y = FloatField()
    accel_z = FloatField()
    magnitude_g = FloatField()
    is_impact_anomaly = BooleanField(default=False, index=True)
    timestamp = DateTimeField(default=lambda: datetime.now(IST), index=True)

    class Meta:
        database = db
        table_name = "vibration_readings"

    def to_dict(self):
        return {
            "forklift_id": self.forklift_id,
            "accel": {
                "x": round(self.accel_x, 3),
                "y": round(self.accel_y, 3),
                "z": round(self.accel_z, 3),
            },
            "magnitude_g": round(self.magnitude_g, 3),
            "is_impact_anomaly": self.is_impact_anomaly,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }
