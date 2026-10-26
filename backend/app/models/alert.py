# ==============================================================================
# File: app/models/alert.py
# Description: Safety Alarms & Incident Event Domain Models.
# Purpose: Persists geofence breaches, physical impact anomalies, high-speed
#          violations, and environmental excursions with full audit metadata.
# ==============================================================================

import json
from datetime import datetime, timezone, timedelta
from peewee import Model, CharField, DateTimeField, TextField, BooleanField
from app.core.database import db

IST = timezone(timedelta(hours=5, minutes=30))


class SafetyAlert(Model):
    """
    Persisted safety incident event log.
    Categorizes alarms by severity and supports operator acknowledgement.
    """

    alert_id = CharField(unique=True, index=True)
    alert_type = CharField(index=True)  # 'danger_zone_breach', 'impact_collision', 'speed_violation', 'temperature_alarm'
    severity = CharField(index=True)    # 'critical', 'warning', 'info'
    source = CharField(index=True)      # e.g., 'forklift_1', 'zone_red_1', 'dht11'
    message = TextField()
    metadata_json = TextField(default="{}")

    is_acknowledged = BooleanField(default=False, index=True)
    acknowledged_at = DateTimeField(null=True)
    created_at = DateTimeField(default=lambda: datetime.now(IST), index=True)

    class Meta:
        database = db
        table_name = "safety_alerts"

    def set_metadata(self, meta_dict):
        self.metadata_json = json.dumps(meta_dict or {})

    def get_metadata(self):
        try:
            return json.loads(self.metadata_json or "{}")
        except (ValueError, TypeError):
            return {}

    def to_dict(self):
        return {
            "id": self.id,
            "alert_id": self.alert_id,
            "type": self.alert_type,
            "severity": self.severity,
            "source": self.source,
            "message": self.message,
            "metadata": self.get_metadata(),
            "is_acknowledged": self.is_acknowledged,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
