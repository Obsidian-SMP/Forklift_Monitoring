#!/bin/bash

# Test script to verify RSSI positioning system
echo "🔍 Testing RSSI Positioning System"
echo "=================================="
echo ""

API_BASE="http://10.136.57.165:5000/api"

# 1. Check if backend is running
echo "1️⃣ Checking backend health..."
curl -s "$API_BASE/health" | python3 -m json.tool
echo ""

# 2. Check gateway setup
echo "2️⃣ Checking gateways..."
curl -s "$API_BASE/rssi/gateways" | python3 -m json.tool
echo ""

# 3. Check debug info
echo "3️⃣ Checking system debug info..."
curl -s "$API_BASE/rssi/debug" | python3 -m json.tool
echo ""

# 4. Simulate RSSI data from 3 phones
echo "4️⃣ Simulating RSSI data from 3 gateways..."
echo "   Sending from phone_1 (RSSI: -65)..."
curl -X POST "$API_BASE/rssi" \
  -H "Content-Type: application/json" \
  -d '{"gateway_id": "phone_1", "rssi": -65, "forklift_id": "forklift_001"}' \
  | python3 -m json.tool

echo ""
echo "   Sending from phone_2 (RSSI: -70)..."
curl -X POST "$API_BASE/rssi" \
  -H "Content-Type: application/json" \
  -d '{"gateway_id": "phone_2", "rssi": -70, "forklift_id": "forklift_001"}' \
  | python3 -m json.tool

echo ""
echo "   Sending from phone_3 (RSSI: -68)..."
curl -X POST "$API_BASE/rssi" \
  -H "Content-Type: application/json" \
  -d '{"gateway_id": "phone_3", "rssi": -68, "forklift_id": "forklift_001"}' \
  | python3 -m json.tool

echo ""

# 5. Check if position was calculated
echo "5️⃣ Checking if position was calculated..."
sleep 2
curl -s "$API_BASE/rssi/position/latest" | python3 -m json.tool
echo ""

# 6. Check debug info again
echo "6️⃣ Final debug check..."
curl -s "$API_BASE/rssi/debug" | python3 -m json.tool
echo ""

echo "✅ Test complete!"
echo ""
echo "📋 Summary:"
echo "  - If you see 3 gateways, the setup is correct"
echo "  - If you see position calculated after step 4, trilateration is working"
echo "  - If position is null, check that all 3 phones are sending data"
echo ""
