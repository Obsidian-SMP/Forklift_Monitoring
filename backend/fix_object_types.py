#!/usr/bin/env python3
"""Fix object_type field for existing detected objects by extracting from object_id"""

from app.models import db, DetectedObject

def fix_object_types():
    """Populate object_type field from object_id for existing records"""
    db.init('warehouse_iot.db')
    db.connect()
    
    try:
        # Get all objects with NULL object_type
        objects = DetectedObject.select().where(DetectedObject.object_type.is_null())
        
        updated_count = 0
        for obj in objects:
            # Extract type from object_id (e.g., "black_box-001" -> "black_box")
            if obj.object_id and '-' in obj.object_id:
                object_type = obj.object_id.rsplit('-', 1)[0]  # Split from right, take first part
                obj.object_type = object_type
                obj.save()
                updated_count += 1
                print(f"Updated {obj.object_id} -> type: {object_type}")
        
        print(f"\n✓ Updated {updated_count} records")
        
        # Show statistics
        print("\nObject type statistics:")
        print(f"  Red boxes: {DetectedObject.select().where(DetectedObject.object_type == 'red_box').count()}")
        print(f"  Blue boxes: {DetectedObject.select().where(DetectedObject.object_type == 'blue_box').count()}")
        print(f"  Black boxes: {DetectedObject.select().where(DetectedObject.object_type == 'black_box').count()}")
        print(f"  Other types: {DetectedObject.select().where(~DetectedObject.object_type.in_(['red_box', 'blue_box', 'black_box']) & DetectedObject.object_type.is_null(False)).count()}")
        print(f"  Still NULL: {DetectedObject.select().where(DetectedObject.object_type.is_null()).count()}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == '__main__':
    print("Fixing object_type fields for existing detected objects...\n")
    fix_object_types()
