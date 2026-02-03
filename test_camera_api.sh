#!/bin/bash

echo "================================================"
echo "🧪 Testing Camera API Endpoints"
echo "================================================"
echo ""

BASE_URL="http://localhost:5000"

# Test 1: Backend health
echo "1️⃣ Testing backend health..."
curl -s "${BASE_URL}/api/health" | jq '.' || echo "❌ Backend not running!"
echo ""

# Test 2: Get camera forklifts list
echo "2️⃣ Getting camera forklifts list..."
curl -s "${BASE_URL}/api/camera/forklifts" | jq '.' || echo "❌ Failed to get forklifts"
echo ""

# Test 3: Check forklift_1 camera status
echo "3️⃣ Checking forklift_1 camera status..."
curl -s "${BASE_URL}/api/camera/forklift_1/status" 2>&1 || echo "Camera not online (expected if ESP32-CAM not connected)"
echo ""

# Test 4: Manual camera registration (if you know ESP32-CAM IP)
echo "4️⃣ To manually register a camera, run:"
echo "   curl -X POST ${BASE_URL}/api/camera/forklift_1/register \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"ip\": \"YOUR_ESP32_IP\"}'"
echo ""

echo "================================================"
echo "✅ API test complete!"
echo "================================================"
