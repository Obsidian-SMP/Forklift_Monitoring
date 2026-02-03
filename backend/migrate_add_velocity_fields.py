#!/usr/bin/env python3
"""
Database migration: Add velocity and speed fields to ForkliftPositionTrilateration
Run this once to update the database schema
"""

import sys
import os
from peewee import SqliteDatabase

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def migrate():
    """Add new columns to forklift_position_trilateration table"""
    print("Adding velocity and speed columns to forklift_position_trilateration...")
    
    try:
        # Connect directly to database
        db = SqliteDatabase('warehouse_iot.db')
        db.connect()
        
        # Add new columns (SQLite will skip if they already exist)
        queries = [
            "ALTER TABLE forklift_position_trilateration ADD COLUMN velocity_x REAL DEFAULT 0.0",
            "ALTER TABLE forklift_position_trilateration ADD COLUMN velocity_y REAL DEFAULT 0.0",
            "ALTER TABLE forklift_position_trilateration ADD COLUMN speed REAL DEFAULT 0.0"
        ]
        
        for query in queries:
            try:
                db.execute_sql(query)
                print(f"✓ Executed: {query}")
            except Exception as e:
                if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                    print(f"⚠️ Column already exists (skipping): {query}")
                else:
                    print(f"❌ Error: {e}")
                    raise
        
        print("\n✅ Migration completed successfully!")
        print("New fields added:")
        print("  - velocity_x (REAL): Velocity in X direction (m/s)")
        print("  - velocity_y (REAL): Velocity in Y direction (m/s)")
        print("  - speed (REAL): Overall speed (m/s)")
        
        db.close()
        return True
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        db.close()
        return False

if __name__ == '__main__':
    success = migrate()
    sys.exit(0 if success else 1)
