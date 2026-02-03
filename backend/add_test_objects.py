#!/usr/bin/env python3
"""
Script to add test detected objects with sample images
"""
import os
import sys
import cv2
import numpy as np
from datetime import datetime

# Add the backend app to path
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.models import DetectedObject, WarehouseEntry

# Create Flask app context
app = create_app()

def create_sample_image(title, color, filename):
    """Create a sample image with OpenCV"""
    # Create a blank image (640x480)
    img = np.ones((480, 640, 3), dtype=np.uint8) * 200
    
    # Add some shapes to simulate warehouse objects
    if 'box' in title:
        # Draw a box
        cv2.rectangle(img, (100, 100), (400, 300), color, -1)
        cv2.rectangle(img, (100, 100), (400, 300), (0, 0, 0), 3)
    elif 'pallet' in title:
        # Draw a pallet
        cv2.rectangle(img, (80, 80), (560, 320), color, -1)
        # Draw slats
        for i in range(100, 550, 80):
            cv2.line(img, (i, 80), (i, 320), (0, 0, 0), 2)
    else:
        # Draw a crate
        cv2.rectangle(img, (120, 120), (380, 280), color, 2)
        cv2.rectangle(img, (140, 140), (360, 260), color, 2)
        cv2.rectangle(img, (160, 160), (340, 240), color, 2)
    
    # Add title
    cv2.putText(img, title, (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 
                1, (0, 0, 0), 2)
    
    # Add timestamp
    timestamp = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    cv2.putText(img, timestamp, (20, 430), cv2.FONT_HERSHEY_SIMPLEX, 
                0.7, (0, 0, 0), 1)
    
    # Save image
    os.makedirs('uploads/images', exist_ok=True)
    filepath = os.path.join('uploads', 'images', filename)
    cv2.imwrite(filepath, img)
    print(f"✓ Created sample image: {filepath}")
    return f"/uploads/images/{filename}"


def add_test_objects():
    """Add 3 test detected objects"""
    with app.app_context():
        import json
        # Clear existing test objects
        print("Adding test detected objects with images...")
        
        # Test Object 1: Box
        obj1_image = create_sample_image(
            'Box - Object 001',
            (100, 180, 200),  # Light blue
            '001_box_test.jpg'
        )
        
        obj1 = DetectedObject.create(
            object_id='object-001',
            forklift_id='forklift-001',
            photo_url=obj1_image,
            position_x=150.5,
            position_y=200.3,
            position_z=10.0,
            status='detected',
            confidence_score=0.92,
            notes='Test cardboard box - high confidence detection'
        )
        print(f"✓ Created {obj1.object_id}: {obj1.notes}")
        
        # Test Object 2: Pallet
        obj2_image = create_sample_image(
            'Pallet - Object 002',
            (50, 200, 50),  # Green
            '002_pallet_test.jpg'
        )
        
        obj2 = DetectedObject.create(
            object_id='object-002',
            forklift_id='forklift-001',
            photo_url=obj2_image,
            position_x=300.2,
            position_y=250.8,
            position_z=15.0,
            status='placed',
            confidence_score=0.88,
            notes='Test wooden pallet in storage zone A'
        )
        print(f"✓ Created {obj2.object_id}: {obj2.notes}")
        
        # Test Object 3: Crate
        obj3_image = create_sample_image(
            'Crate - Object 003',
            (200, 100, 50),  # Orange
            '003_crate_test.jpg'
        )
        
        obj3 = DetectedObject.create(
            object_id='object-003',
            forklift_id='forklift-001',
            photo_url=obj3_image,
            position_x=450.0,
            position_y=180.5,
            position_z=12.0,
            status='detected',
            confidence_score=0.85,
            notes='Test wooden crate - medium confidence'
        )
        print(f"✓ Created {obj3.object_id}: {obj3.notes}")
        
        # Add a warehouse entry event
        event = WarehouseEntry.create(
            event_id='event-test-001',
            forklift_id='forklift-001',
            event_type='entry',
            position_x=0.0,
            position_y=0.0,
            object_count=3,
            object_ids=json.dumps(['object-001', 'object-002', 'object-003'])
        )
        print(f"✓ Created warehouse event: {event.event_id}")
        
        print("\n✅ All test objects added successfully!")
        print("\nTest data summary:")
        print(f"  - object-001: Box (detected) with photo")
        print(f"  - object-002: Pallet (placed) with photo")
        print(f"  - object-003: Crate (detected) with photo")
        print(f"\nPhotos are saved in uploads/images/ directory")
        print(f"View in inventory: http://localhost:5173/inventory")


if __name__ == '__main__':
    add_test_objects()
