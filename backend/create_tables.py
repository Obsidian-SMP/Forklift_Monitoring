#!/usr/bin/env python3
"""
Database migration script to create DetectedObject and WarehouseEntry tables
Run this on the RPi after deploying the updated backend
"""
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app import create_app
from app.models import db, Inventory, InventoryTransaction, DetectedObject, WarehouseEntry

def create_tables():
    """Create all necessary tables"""
    app = create_app()
    
    with app.app_context():
        print("Creating database tables...")
        
        # Create all tables
        try:
            # Create base tables first
            Inventory.create_table(safe=True)
            print("✓ Inventory table created/verified")
            
            InventoryTransaction.create_table(safe=True)
            print("✓ InventoryTransaction table created/verified")
            
            # Create new tables
            DetectedObject.create_table(safe=True)
            print("✓ DetectedObject table created/verified")
            
            WarehouseEntry.create_table(safe=True)
            print("✓ WarehouseEntry table created/verified")
            
            print("\n✅ All tables created successfully!")
            
            # Verify table contents
            inventory_count = Inventory.select().count()
            detected_count = DetectedObject.select().count()
            events_count = WarehouseEntry.select().count()
            
            print(f"\nDatabase status:")
            print(f"  Inventory items: {inventory_count}")
            print(f"  Detected objects: {detected_count}")
            print(f"  Warehouse events: {events_count}")
            
        except Exception as e:
            print(f"❌ Error creating tables: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    return True

if __name__ == '__main__':
    success = create_tables()
    sys.exit(0 if success else 1)
