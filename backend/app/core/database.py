# ==============================================================================
# File: app/core/database.py
# Description: High-Concurrency SQLite Database Engine for Warehouse IoT.
# Purpose: Manages Peewee ORM database initialization with Write-Ahead Logging
#          (WAL), foreign key integrity, and safe thread connection handling.
# ==============================================================================

import os
from peewee import SqliteDatabase
from app.core.config import Config
from app.core.logger import log_event

# Global SQLite database instance configured with WAL mode
db = SqliteDatabase(
    None,
    pragmas={
        "journal_mode": "wal",       # Write-Ahead Logging for high concurrency
        "cache_size": -1024 * 64,     # 64 MB in-memory cache
        "foreign_keys": 1,            # Enforce relational integrity
        "synchronous": 1,             # NORMAL mode: safe and fast on SSD/laptop
        "busy_timeout": 10000,        # 10s retry window to prevent lock errors
    },
)


def init_db(database_path: str = None):
    """
    Initializes the SQLite database connection and creates required tables.
    """
    target_path = database_path or Config.DATABASE_PATH
    os.makedirs(os.path.dirname(os.path.abspath(target_path)), exist_ok=True)

    db.init(
        target_path,
        pragmas={
            "journal_mode": "wal",
            "cache_size": -1024 * 64,
            "foreign_keys": 1,
            "synchronous": 1,
            "busy_timeout": 10000,
        },
    )

    # Import models locally to register schemas
    from app.models.zone import WarehouseZone
    from app.models.forklift import Forklift, ForkliftTrack, VibrationReading
    from app.models.inventory import InventoryItem, InventoryTransaction, DetectedPallet
    from app.models.alert import SafetyAlert
    from app.models.sensor import SensorReading
    from app.models.gateway import GatewayNode, SystemSetting

    with db:
        db.create_tables(
            [
                WarehouseZone,
                Forklift,
                ForkliftTrack,
                VibrationReading,
                InventoryItem,
                InventoryTransaction,
                DetectedPallet,
                SafetyAlert,
                SensorReading,
                GatewayNode,
                SystemSetting,
            ],
            safe=True,
        )

    log_event("INFO", "DATABASE", f"SQLite database initialized: {target_path}")
