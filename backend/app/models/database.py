from peewee import SqliteDatabase
import os

# Global database instance with WAL mode for concurrent writes
db = SqliteDatabase(None, pragmas={
    'journal_mode': 'wal',  # Write-Ahead Logging for concurrent access
    'cache_size': -1024 * 64,  # 64MB cache
    'foreign_keys': 1,
    'ignore_check_constraints': 0,
    'synchronous': 1,  # NORMAL mode (faster than FULL, still safe)
    'busy_timeout': 10000  # 10 second timeout for lock retries
})

def init_db(database_path):
    """Initialize SQLite database"""
    db.init(database_path, pragmas={
        'journal_mode': 'wal',
        'cache_size': -1024 * 64,
        'foreign_keys': 1,
        'ignore_check_constraints': 0,
        'synchronous': 1,
        'busy_timeout': 10000
    })
    
    # Import all models
    from app.models.sensor_data import WarehouseSensor
    from app.models.forklift import Forklift, ForkliftLocation, VibrationData
    from app.models.inventory import Inventory, InventoryTransaction
    from app.models.ble_rssi import WiFiGateway, BLERSSIData, ForkliftPositionTrilateration
    from app.models.warehouse import WarehouseMap
    
    # Create tables if they don't exist
    db.create_tables([
        WarehouseSensor,
        Forklift,
        ForkliftLocation,
        VibrationData,
        Inventory,
        InventoryTransaction,
        WiFiGateway,
        BLERSSIData,
        ForkliftPositionTrilateration,
        WarehouseMap
    ], safe=True)
    
    print(f"✓ SQLite database initialized: {database_path}")
