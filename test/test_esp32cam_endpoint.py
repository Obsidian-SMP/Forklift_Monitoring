#!/usr/bin/env python3
"""
Test ESP32-CAM Image Upload Endpoint
This script tests the image upload functionality without needing actual hardware
"""

import requests
import os
from PIL import Image
import io

print("=" * 60)
print("ESP32-CAM Image Upload Test")
print("=" * 60)

# Configuration
BACKEND_URL = "http://localhost:5000"
FORKLIFT_ID = "test_forklift_1"

# Create a test image
def create_test_image():
    """Create a simple test JPEG image"""
    img = Image.new('RGB', (800, 600), color='blue')
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    return img_bytes.read()

# Test 1: Health Check
print("\n1. Testing backend health...")
try:
    response = requests.get(f"{BACKEND_URL}/api/health", timeout=5)
    if response.status_code == 200:
        print("   ✓ Backend is running")
        print(f"   Response: {response.json()}")
    else:
        print(f"   ✗ Backend returned status {response.status_code}")
except requests.exceptions.ConnectionError:
    print("   ✗ Cannot connect to backend. Is it running?")
    print("   Start with: cd backend && python run.py")
    exit(1)

# Test 2: Image Upload (Simulating ESP32-CAM)
print("\n2. Testing image upload (simulating ESP32-CAM)...")
try:
    image_data = create_test_image()
    
    headers = {
        'Content-Type': 'image/jpeg',
        'X-Forklift-ID': FORKLIFT_ID
    }
    
    response = requests.post(
        f"{BACKEND_URL}/api/forklift/{FORKLIFT_ID}/image",
        data=image_data,
        headers=headers,
        timeout=10
    )
    
    if response.status_code in [200, 201]:
        print("   ✓ Image uploaded successfully")
        result = response.json()
        print(f"   Filename: {result.get('filename')}")
        print(f"   Size: {result.get('size')} bytes")
        print(f"   Forklift: {result.get('forklift_id')}")
    else:
        print(f"   ✗ Upload failed with status {response.status_code}")
        print(f"   Response: {response.text}")
except Exception as e:
    print(f"   ✗ Error: {e}")

# Test 3: Check uploaded files
print("\n3. Checking uploaded files...")
upload_dir = "uploads/images"
if os.path.exists(upload_dir):
    files = [f for f in os.listdir(upload_dir) if f.startswith(FORKLIFT_ID)]
    if files:
        print(f"   ✓ Found {len(files)} image(s) from {FORKLIFT_ID}")
        for f in files[-3:]:  # Show last 3
            size = os.path.getsize(os.path.join(upload_dir, f))
            print(f"   - {f} ({size} bytes)")
    else:
        print(f"   No images found for {FORKLIFT_ID}")
else:
    print(f"   Upload directory not found: {upload_dir}")

# Test 4: Forklift Status
print("\n4. Checking forklift status...")
try:
    response = requests.get(f"{BACKEND_URL}/api/forklift/{FORKLIFT_ID}", timeout=5)
    if response.status_code == 200:
        forklift = response.json()
        print("   ✓ Forklift entry created")
        print(f"   ID: {forklift.get('forklift_id')}")
        print(f"   Last Seen: {forklift.get('last_seen')}")
        print(f"   Status: {forklift.get('status')}")
    elif response.status_code == 404:
        print("   Note: Forklift not in database yet (normal on first run)")
    else:
        print(f"   Response: {response.status_code}")
except Exception as e:
    print(f"   Error: {e}")

print("\n" + "=" * 60)
print("Test Complete!")
print("=" * 60)
print("\nESP32-CAM Configuration:")
print(f"  - Set RPI_IP to your Raspberry Pi IP")
print(f"  - Endpoint: {BACKEND_URL}/api/forklift/<forklift_id>/image")
print(f"  - Content-Type: image/jpeg")
print(f"  - Method: POST with raw JPEG data")
print("\nNext Steps:")
print("  1. Flash ESP32-CAM with code in esp32_cam_forklift.ino")
print("  2. Update WiFi credentials and RPI_IP")
print("  3. Monitor uploads: tail -f backend/logs/backend.log")
print("=" * 60)
