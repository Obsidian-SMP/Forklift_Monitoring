#!/usr/bin/env python3
"""Test gateway duplicate prevention"""

import sys
sys.path.insert(0, '/home/rpi/warehouse_iot/backend')

from app.models import init_db, WiFiGateway
from peewee import DoesNotExist

# Initialize database
init_db('/home/rpi/warehouse_iot/backend/warehouse.db')

print("=" * 70)
print("TESTING GATEWAY DUPLICATE PREVENTION")
print("=" * 70)

# Clean up test gateways
print("\n🧹 Cleaning up test gateways...")
WiFiGateway.delete().where(
    WiFiGateway.gateway_id.in_(['test_phone', 'Test_Phone', 'TEST_PHONE'])
).execute()

print("\n" + "=" * 70)
print("TEST 1: Create gateway with lowercase gateway_id")
print("=" * 70)

# Create gateway
gw1 = WiFiGateway.create(
    gateway_id='test_phone',
    name='Test Phone',
    location_x=5.0,
    location_y=10.0,
    location_z=2.0,
    is_active='true'
)
print(f"✅ Created: gateway_id='{gw1.gateway_id}', name='{gw1.name}', position=({gw1.location_x}, {gw1.location_y})")

print("\n" + "=" * 70)
print("TEST 2: Try to find with different case (Test_Phone)")
print("=" * 70)

# Test case-insensitive lookup
found = WiFiGateway.select().where(
    WiFiGateway.gateway_id.collate('NOCASE') == 'Test_Phone'
).first()

if found:
    print(f"✅ FOUND with case-insensitive search!")
    print(f"   gateway_id='{found.gateway_id}', name='{found.name}'")
else:
    print(f"❌ NOT FOUND (this would cause duplicate)")

print("\n" + "=" * 70)
print("TEST 3: Update position via case-different lookup")
print("=" * 70)

# Simulate update with different case
lookup_id = 'TEST_PHONE'  # All caps
found = WiFiGateway.select().where(
    WiFiGateway.gateway_id.collate('NOCASE') == lookup_id
).first()

if found:
    print(f"✅ Found gateway with lookup_id='{lookup_id}'")
    original_gwid = found.gateway_id
    found.location_x = 15.0
    found.location_y = 20.0
    found.save()
    print(f"✅ Updated position to ({found.location_x}, {found.location_y})")
    print(f"✅ gateway_id preserved as: '{found.gateway_id}' (original: '{original_gwid}')")
else:
    print(f"❌ Gateway not found - would create duplicate at (0, 0)")

print("\n" + "=" * 70)
print("TEST 4: Verify only ONE gateway exists")
print("=" * 70)

all_test = WiFiGateway.select().where(
    WiFiGateway.gateway_id.collate('NOCASE') == 'test_phone'
)

count = all_test.count()
print(f"Total gateways matching 'test_phone' (case-insensitive): {count}")

if count == 1:
    print(f"✅ PASS: Only 1 gateway exists")
    gw = all_test.first()
    print(f"   gateway_id='{gw.gateway_id}', position=({gw.location_x}, {gw.location_y})")
else:
    print(f"❌ FAIL: {count} gateways found (should be 1)")
    for gw in all_test:
        print(f"   - gateway_id='{gw.gateway_id}', position=({gw.location_x}, {gw.location_y})")

# Clean up
print("\n🧹 Cleaning up test gateway...")
WiFiGateway.delete().where(
    WiFiGateway.gateway_id.collate('NOCASE') == 'test_phone'
).execute()

print("\n" + "=" * 70)
print("✅ TEST COMPLETE")
print("=" * 70)
