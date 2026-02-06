#!/usr/bin/env python3
"""
Reset database - Delete old database and create fresh tables with updated schema
"""
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.models import db, Inventory, InventoryTransaction, DetectedObject, WarehouseEntry

def reset_database():
    """Delete old database and create fresh tables"""
    app = create_app()
    
    with app.app_context():
        # Get database path
        db_path = db.database
        
        print(f"🗑️  Deleting old database: {db_path}")
        
        # Close any existing connections
        if not db.is_closed():
            db.close()
        
        # Delete database file if it exists
        if os.path.exists(db_path):
            try:
                os.remove(db_path)
                print(f"✓ Deleted old database file")
            except Exception as e:
                print(f"❌ Error deleting database: {e}")
                return False
        
        # Delete WAL and SHM files if they exist
        for ext in ['-wal', '-shm', '-journal']:
            wal_path = db_path + ext
            if os.path.exists(wal_path):
                try:
                    os.remove(wal_path)
                    print(f"✓ Deleted {wal_path}")
                except Exception as e:
                    print(f"Warning: Could not delete {wal_path}: {e}")
        
        print("\n📦 Creating fresh database with updated schema...")
        
        # Reconnect to create new database
        db.connect(reuse_if_open=True)
        
        try:
            # Create all tables with updated schema
            db.create_tables([Inventory, InventoryTransaction, DetectedObject, WarehouseEntry])
            
            print("✓ Inventory table created (with placed_at, dispatched_at fields)")
            print("✓ InventoryTransaction table created")
            print("✓ DetectedObject table created (with object_type field)")
            print("✓ WarehouseEntry table created")
            
            print("\n✅ Database reset successfully!")
            print(f"📍 Database location: {db_path}")
            print("\nAll tables have been created with the latest schema:")
            print("  - Inventory: includes placed_at and dispatched_at timestamps")
            print("  - DetectedObject: includes object_type field for colored boxes")
            print("  - Ready for fresh data!")
            
            return True
            
        except Exception as e:
            print(f"❌ Error creating tables: {e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            db.close()

if __name__ == '__main__':
    print("=" * 60)
    print("DATABASE RESET SCRIPT")
    print("=" * 60)
    print("\nThis will DELETE the old database and create fresh tables.")
    print("All existing data will be lost!")
    print()
    
    response = input("Are you sure you want to continue? (yes/no): ")
    
    if response.lower() in ['yes', 'y']:
        success = reset_database()
        sys.exit(0 if success else 1)
    else:
        print("\n❌ Database reset cancelled.")
        sys.exit(0)
