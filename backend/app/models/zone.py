# ==============================================================================
# File: app/models/zone.py
# Description: Warehouse Geofence & Danger Zone Domain Model.
# Purpose: Persists user-defined 2D polygon boundaries, operational zones,
#          and restricted danger areas directly in the database.
# ==============================================================================

import json
from datetime import datetime, timezone, timedelta
from peewee import Model, CharField, DateTimeField, BooleanField, TextField
from app.core.database import db

IST = timezone(timedelta(hours=5, minutes=30))


class WarehouseZone(Model):
    """
    Defines a physical region in the warehouse.
    Supports both 4-point bounding boxes and arbitrary multi-point polygons.
    """

    zone_id = CharField(unique=True, index=True)
    name = CharField()
    zone_type = CharField(default="danger", index=True)  # 'danger', 'loading', 'storage', 'aisle'
    color = CharField(default="#ef4444")  # Hex color for canvas rendering
    
    # JSON-encoded array of 2D vertex points: [{"x": 2.0, "y": 4.5}, {"x": 5.0, "y": 4.5}, ...]
    polygon_points = TextField(default="[]")
    
    # Boundary extremes for fast bounding-box pre-filtering
    min_x = CharField(default="0.0")
    max_x = CharField(default="0.0")
    min_y = CharField(default="0.0")
    max_y = CharField(default="0.0")

    notify_on_entry = BooleanField(default=True)
    is_active = BooleanField(default=True)
    created_at = DateTimeField(default=lambda: datetime.now(IST))
    updated_at = DateTimeField(default=lambda: datetime.now(IST))

    class Meta:
        database = db
        table_name = "warehouse_zones"

    def set_points(self, points_list):
        """Sets vertex points and auto-computes bounding box extremes."""
        self.polygon_points = json.dumps(points_list)
        if points_list:
            xs = [p["x"] for p in points_list if "x" in p]
            ys = [p["y"] for p in points_list if "y" in p]
            if xs and ys:
                self.min_x = str(min(xs))
                self.max_x = str(max(xs))
                self.min_y = str(min(ys))
                self.max_y = str(max(ys))

    def get_points(self):
        """Returns vertex coordinates as a Python list of dicts."""
        try:
            return json.loads(self.polygon_points or "[]")
        except (ValueError, TypeError):
            return []

    def to_dict(self):
        return {
            "id": self.id,
            "zone_id": self.zone_id,
            "name": self.name,
            "zone_type": self.zone_type,
            "color": self.color,
            "points": self.get_points(),
            "bounding_box": {
                "min_x": float(self.min_x),
                "max_x": float(self.max_x),
                "min_y": float(self.min_y),
                "max_y": float(self.max_y),
            },
            "notify_on_entry": self.notify_on_entry,
            "is_active": self.is_active,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
