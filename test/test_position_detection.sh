#!/bin/bash

# Comprehensive test for position detection and path tracking
API_BASE="http://10.136.57.165:5000/api"

echo "🧪 Testing Position Detection System"
echo "===================================="
echo ""

# 1. Setup gateways
echo "1️⃣ Setting up gateways..."
curl -s "$API_BASE/rssi/setup" | python3 -m json.tool
echo ""

# 2. Check gateway configuration
echo "2️⃣ Checking gateway positions..."
curl -s "$API_BASE/rssi/gateways" | python3 -m json.tool
echo ""

# 3. Test with 2 gateways (forklift closer to phone_1 and phone_2)
echo "3️⃣ Simulating 2 gateways detecting forklift..."
echo "   phone_1: RSSI -60 (closer)"
curl -X POST "$API_BASE/rssi" \
  -H "Content-Type: application/json" \
  -d '{"gateway_id": "phone_1", "rssi": -60, "forklift_id": "forklift_001"}' \
  | python3 -m json.tool
echo ""

sleep 0.5

echo "   phone_2: RSSI -70 (further)"
curl -X POST "$API_BASE/rssi" \
  -H "Content-Type: application/json" \
  -d '{"gateway_id": "phone_2", "rssi": -70, "forklift_id": "forklift_001"}' \
  | python3 -m json.tool
echo ""

sleep 1

# 4. Check if position was calculated
echo "4️⃣ Checking calculated position (bilateration with 2 gateways)..."
curl -s "$API_BASE/rssi/position/latest" | python3 -m json.tool
echo ""

# 5. Test with all 3 gateways (better accuracy)
echo "5️⃣ Simulating all 3 gateways detecting forklift..."
curl -X POST "$API_BASE/rssi" \
  -H "Content-Type: application/json" \
  -d '{"gateway_id": "phone_1", "rssi": -65}' > /dev/null
curl -X POST "$API_BASE/rssi" \
  -H "Content-Type: application/json" \
  -d '{"gateway_id": "phone_2", "rssi": -68}' > /dev/null
curl -X POST "$API_BASE/rssi" \
  -H "Content-Type: application/json" \
  -d '{"gateway_id": "phone_3", "rssi": -66}' > /dev/null

sleep 1

echo "6️⃣ Checking calculated position (trilateration with 3 gateways)..."
curl -s "$API_BASE/rssi/position/latest" | python3 -m json.tool
echo ""

# 6. Check position history (path tracking)
echo "7️⃣ Checking position history (path)..."
curl -s "$API_BASE/rssi/position/history?limit=10" | python3 -m json.tool
echo ""

# 7. Debug info
echo "8️⃣ System debug info..."
curl -s "$API_BASE/rssi/debug" | python3 -m json.tool
echo ""

echo "✅ Test complete!"
echo ""
echo "📊 Expected Results:"
echo "  - With 2 gateways: Position calculated using bilateration (lower accuracy)"
echo "  - With 3 gateways: Position calculated using trilateration (higher accuracy)"
echo "  - Path history: Shows movement over time"
echo ""
