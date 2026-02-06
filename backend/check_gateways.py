#!/usr/bin/env python3
"""Check for duplicate gateways in database"""

import sys
sys.path.insert(0, '/home/rpi/warehouse_iot/backend')

from app.models import init_db, WiFiGateway

# Initialize database
init_db('/home/rpi/warehouse_iot/backend/warehouse.db')

print("=" * 60)
print("GATEWAY DATABASE CHECK")
print("=" * 60)

# Get all gateways
gateways = WiFiGateway.select().order_by(WiFiGateway.created_at.desc())

print(f"\nTotal gateways: {gateways.count()}\n")

# Check for duplicates
gateway_ids = {}
names = {}

for gw in gateways:
    print(f"ID: {gw.id:3d} | gateway_id: {gw.gateway_id:20s} | name: {gw.name:20s} | pos: ({gw.location_x:6.1f}, {gw.location_y:6.1f})")
    
    # Track duplicates
    if gw.gateway_id in gateway_ids:
        gateway_ids[gw.gateway_id].append(gw.id)
    else:
        gateway_ids[gw.gateway_id] = [gw.id]
    
    if gw.name in names:
        names[gw.name].append(gw.id)
    else:
        names[gw.name] = [gw.id]

print("\n" + "=" * 60)
print("DUPLICATE CHECK")
print("=" * 60)

# Check for duplicate gateway_ids (should NEVER happen - unique constraint)
duplicate_gateway_ids = {k: v for k, v in gateway_ids.items() if len(v) > 1}
if duplicate_gateway_ids:
    print("\n⚠️  DUPLICATE GATEWAY_IDS FOUND (CRITICAL!):")
    for gw_id, ids in duplicate_gateway_ids.items():
        print(f"  - gateway_id '{gw_id}' appears in records: {ids}")
else:
    print("\n✅ No duplicate gateway_ids (good)")

# Check for duplicate names (allowed but may cause confusion)
duplicate_names = {k: v for k, v in names.items() if len(v) > 1}
if duplicate_names:
    print("\n⚠️  DUPLICATE NAMES FOUND:")
    for name, ids in duplicate_names.items():
        print(f"  - name '{name}' appears in records: {ids}")
else:
    print("\n✅ No duplicate names (good)")

print("\n" + "=" * 60)
