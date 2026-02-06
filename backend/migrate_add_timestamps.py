#!/usr/bin/env python3
"""
Database migration script to add placed_at and dispatched_at fields to Inventory table
Run this to update existing databases
"""
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.models import db, Inventory
from playhouse.migrate import migrate, SqliteMigrator
from peewee import DateTimeField

def add_timestamp_fields():
    """Add placed_at and dispatched_at fields to Inventory table"""
    app = create_app()
    
    with app.app_context():
        print("Migrating Inventory table to add timestamp fields...")
        
        try:
            # Create migrator for SQLite
            migrator = SqliteMigrator(db)
            
            # Check if fields already exist
            cursor = db.execute_sql("PRAGMA table_info(inventory)")
            columns = [row[1] for row in cursor.fetchall()]
            
            if 'placed_at' in columns and 'dispatched_at' in columns:
                print("⚠ Timestamp fields already exist - skipping migration")
                return True
            
            # Add timestamp fields (nullable, no index to avoid duplicate index error)
            placed_at_field = DateTimeField(null=True)
            dispatched_at_field = DateTimeField(null=True)
            
            operations = []
            if 'placed_at' not in columns:
                operations.append(migrator.add_column('inventory', 'placed_at', placed_at_field))
                print("✓ Added placed_at field to inventory table")
            
            if 'dispatched_at' not in columns:
                operations.append(migrator.add_column('inventory', 'dispatched_at', dispatched_at_field))
                print("✓ Added dispatched_at field to inventory table")
            
            if operations:
                # Perform migration
                migrate(*operations)
                print("✅ Migration completed successfully!")
            
            # Show current record count
            count = Inventory.select().count()
            print(f"\nTotal inventory items: {count}")
            
            if count > 0:
                print("\nNote: Existing records will have placed_at and dispatched_at = NULL")
                print("New items will automatically populate these fields")
            
        except Exception as e:
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print("⚠ Timestamp fields already exist - skipping migration")
                return True
            else:
                print(f"❌ Error during migration: {e}")
                import traceback
                traceback.print_exc()
                return False
    
    return True

if __name__ == '__main__':
    success = add_timestamp_fields()
    sys.exit(0 if success else 1)
