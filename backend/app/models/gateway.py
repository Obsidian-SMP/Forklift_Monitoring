# ==============================================================================
# File: app/models/gateway.py
# Description: BLE Gateway Configuration & Persistent System Settings Models.
# Purpose: Persists mobile phone gateway 3D anchor coordinates, calibration
#          parameters, and operator settings (notifications, warehouse layout).
# ==============================================================================

import json
from datetime import datetime, timezone, timedelta
from peewee import Model, CharField, FloatField, BooleanField, DateTimeField, TextField
from app.core.database import db

IST = timezone(timedelta(hours=5, minutes=30))


class GatewayNode(Model):
    """
    Physical coordinates and calibration values of the Android BLE gateway phones.
    """

    gateway_id = CharField(unique=True, index=True)  # e.g., 'phone_1', 'phone_2'
    name = CharField(default="BLE Gateway")
    location_x = FloatField(default=0.0)
    location_y = FloatField(default=0.0)
    location_z = FloatField(default=2.5)  # Mounting height in meters

    # Per-gateway calibration overrides (falls back to global config if null)
    calibrated_tx_power = FloatField(null=True)
    calibrated_path_loss_n = FloatField(null=True)

    is_active = BooleanField(default=True)
    last_seen = DateTimeField(default=lambda: datetime.now(IST))
    created_at = DateTimeField(default=lambda: datetime.now(IST))

    class Meta:
        database = db
        table_name = "gateway_nodes"

    def to_dict(self):
        return {
            "gateway_id": self.gateway_id,
            "name": self.name,
            "position": {
                "x": round(self.location_x, 2),
                "y": round(self.location_y, 2),
                "z": round(self.location_z, 2),
            },
            "calibration": {
                "tx_power": self.calibrated_tx_power,
                "path_loss_n": self.calibrated_path_loss_n,
            },
            "is_active": self.is_active,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
        }


class SystemSetting(Model):
    """
    Persistent key-value configuration store.
    Eliminates the previous bug where alert settings reset on backend restart.
    """

    key = CharField(unique=True, index=True)
    value_json = TextField(default="{}")
    updated_at = DateTimeField(default=lambda: datetime.now(IST))

    class Meta:
        database = db
        table_name = "system_settings"

    @classmethod
    def get_setting(cls, key: str, default=None):
        """Retrieves a setting by key, parsing JSON safely."""
        record = cls.get_or_none(cls.key == key)
        if not record:
            return default
        try:
            return json.loads(record.value_json)
        except (ValueError, TypeError):
            return default

    @classmethod
    def set_setting(cls, key: str, value):
        """Persists a setting key-value pair as JSON."""
        val_str = json.dumps(value)
        record, created = cls.get_or_create(key=key, defaults={"value_json": val_str})
        if not created:
            record.value_json = val_str
            record.updated_at = datetime.now(IST)
            record.save()
