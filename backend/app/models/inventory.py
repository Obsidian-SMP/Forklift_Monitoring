# ==============================================================================
# File: app/models/inventory.py
# Description: Warehouse Inventory, State Tracker, and Transaction Audit Models.
# Purpose: Manages inventory SKUs, stock levels, physical coordinates, and the
#          complete audit ledger for pickup and dropoff workflows.
# ==============================================================================

from datetime import datetime, timezone, timedelta
from peewee import (
    Model,
    CharField,
    IntegerField,
    FloatField,
    DateTimeField,
    TextField,
    ForeignKeyField,
)
from app.core.database import db

IST = timezone(timedelta(hours=5, minutes=30))


class InventoryItem(Model):
    """
    Represents an inventory item/pallet stored or moving in the warehouse.
    """

    item_id = CharField(unique=True, index=True)  # e.g. "red_box-001"
    item_name = CharField()
    category = CharField(default="box", index=True)  # "red_box", "blue_box", "black_box"
    quantity = IntegerField(default=1)
    unit = CharField(default="boxes")

    # Physical Location
    zone = CharField(null=True, index=True)  # Zone ID where stored
    shelf = CharField(null=True)             # Specific shelf / slot
    position_x = FloatField(default=0.0)
    position_y = FloatField(default=0.0)

    # Operational Lifecycle
    status = CharField(default="in_stock", index=True)  # 'in_stock', 'in_transit', 'dispatched'
    image_url = CharField(null=True)                    # Evidence crop
    
    placed_at = DateTimeField(default=lambda: datetime.now(IST))
    dispatched_at = DateTimeField(null=True)
    last_updated = DateTimeField(default=lambda: datetime.now(IST))

    class Meta:
        database = db
        table_name = "inventory_items"

    def to_dict(self):
        return {
            "id": self.id,
            "item_id": self.item_id,
            "item_name": self.item_name,
            "category": self.category,
            "quantity": self.quantity,
            "unit": self.unit,
            "zone": self.zone,
            "shelf": self.shelf,
            "position": {
                "x": round(self.position_x, 2),
                "y": round(self.position_y, 2),
            },
            "status": self.status,
            "image_url": self.image_url,
            "placed_at": self.placed_at.isoformat() if self.placed_at else None,
            "dispatched_at": self.dispatched_at.isoformat() if self.dispatched_at else None,
            "last_updated": self.last_updated.isoformat() if self.last_updated else None,
        }


class InventoryTransaction(Model):
    """
    Immutable audit ledger recording physical pickup, dropoff, and dispatch events.
    Fulfills Paper 4 & 5 transactional tracking requirements.
    """

    transaction_id = CharField(unique=True, index=True)
    item = ForeignKeyField(InventoryItem, backref="transactions", on_delete="CASCADE")
    forklift_id = CharField(index=True)
    
    # Operation type: 'pickup', 'dropoff', 'relocation', 'dispatch'
    transaction_type = CharField(index=True)
    quantity = IntegerField(default=1)

    # Coordinate tracking of movement
    from_x = FloatField(null=True)
    from_y = FloatField(null=True)
    to_x = FloatField(null=True)
    to_y = FloatField(null=True)

    image_url = CharField(null=True)  # Visual verification frame
    notes = TextField(null=True)
    timestamp = DateTimeField(default=lambda: datetime.now(IST), index=True)

    class Meta:
        database = db
        table_name = "inventory_transactions"

    def to_dict(self):
        return {
            "transaction_id": self.transaction_id,
            "item_id": self.item.item_id if self.item else None,
            "item_name": self.item.item_name if self.item else None,
            "forklift_id": self.forklift_id,
            "type": self.transaction_type,
            "quantity": self.quantity,
            "from_coords": {"x": self.from_x, "y": self.from_y} if self.from_x is not None else None,
            "to_coords": {"x": self.to_x, "y": self.to_y} if self.to_x is not None else None,
            "image_url": self.image_url,
            "notes": self.notes,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


class DetectedPallet(Model):
    """
    Persistent vision record stamped with the forklift's real location when detected.
    Eliminates the previous bug where coordinates were hardcoded to (0, 0, 0).
    """

    detection_id = CharField(unique=True, index=True)
    object_type = CharField(index=True)  # 'red_box', 'blue_box', 'black_box'
    forklift_id = CharField(index=True)
    
    # Coordinate where the detection occurred (sourced from EKF at capture time)
    forklift_x = FloatField()
    forklift_y = FloatField()
    
    confidence_score = FloatField()
    bounding_box = CharField()  # "[x, y, w, h]"
    photo_url = CharField()
    
    status = CharField(default="detected")  # 'detected', 'loaded', 'placed'
    detected_at = DateTimeField(default=lambda: datetime.now(IST), index=True)

    class Meta:
        database = db
        table_name = "detected_pallets"

    def to_dict(self):
        return {
            "detection_id": self.detection_id,
            "object_type": self.object_type,
            "forklift_id": self.forklift_id,
            "location": {
                "x": round(self.forklift_x, 2),
                "y": round(self.forklift_y, 2),
            },
            "confidence": round(self.confidence_score, 2),
            "photo_url": self.photo_url,
            "status": self.status,
            "detected_at": self.detected_at.isoformat() if self.detected_at else None,
        }
