#!/usr/bin/env python3
"""
Database migration script to add object_type field to DetectedObject table
Run this to update existing databases
"""
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.models import db, DetectedObject
from playhouse.migrate import migrate, SqliteMigrator
from peewee import CharField

def add_object_type_field():
    """Add object_type field to DetectedObject table"""
    app = create_app()
    
    with app.app_context():
        print("Migrating DetectedObject table to add object_type field...")
        
        try:
            # Create migrator for SQLite
            migrator = SqliteMigrator(db)
            
            # Add object_type field (nullable, indexed)
            object_type_field = CharField(null=True, index=True)
            
            # Perform migration
            migrate(
                migrator.add_column('detected_objects', 'object_type', object_type_field),
            )
            
            print("✓ Added object_type field to detected_objects table")
            print("✅ Migration completed successfully!")
            
            # Show current record count
            count = DetectedObject.select().count()
            print(f"\nTotal detected objects: {count}")
            
            if count > 0:
                print("\nNote: Existing records will have object_type=NULL")
                print("New detections will automatically populate this field")
            
        except Exception as e:
            if "duplicate column name" in str(e).lower():
                print("⚠ object_type field already exists - skipping migration")
                return True
            else:
                print(f"❌ Error during migration: {e}")
                import traceback
                traceback.print_exc()
                return False
    
    return True

if __name__ == '__main__':
    success = add_object_type_field()
    sys.exit(0 if success else 1)
