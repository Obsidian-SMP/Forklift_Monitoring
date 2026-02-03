#!/bin/bash
# Real-time DHT monitoring test - watches data flow from sensor to frontend

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     REAL-TIME DHT SENSOR MONITORING TEST                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Current system time: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo ""

# Test 1: Live sensor reading
echo "━━━ TEST 1: DHT Sensor Live Read ━━━"
for i in {1..5}; do
    echo -n "Reading $i/5: "
    timeout 8 curl -s http://localhost:5000/api/dht/reading 2>/dev/null | \
    python3 -c "
import sys, json
from datetime import datetime
try:
    d = json.load(sys.stdin)
    ts = datetime.fromisoformat(d['timestamp'])
    print(f\"{d['temperature']:.1f}°C, {d['humidity']:.1f}% @ {ts.strftime('%H:%M:%S')}\")
except:
    print('Failed')
    " || echo "Timeout"
    [ $i -lt 5 ] && sleep 3
done
echo ""

# Test 2: Database latest entry
echo "━━━ TEST 2: Database Latest Entry ━━━"
curl -s "http://localhost:5000/api/sensors/environment/current" 2>/dev/null | \
python3 -c "
import sys, json
from datetime import datetime
try:
    d = json.load(sys.stdin)
    ts = datetime.fromisoformat(d['timestamp'])
    age = (datetime.utcnow() - ts).total_seconds()
    print(f\"Temperature: {d['temperature']:.1f}°C\")
    print(f\"Humidity:    {d['humidity']:.1f}%\")
    print(f\"Timestamp:   {ts.strftime('%Y-%m-%d %H:%M:%S')}\")
    print(f\"Age:         {int(age)} seconds old\")
except Exception as e:
    print(f'Error: {e}')
"
echo ""

# Test 3: Frontend polling simulation
echo "━━━ TEST 3: Frontend Widget Polling (3s interval) ━━━"
echo "Simulating frontend behavior for 15 seconds..."
for i in {1..5}; do
    echo -n "Poll $i: "
    curl -s http://localhost:5000/api/dht/reading 2>/dev/null | \
    python3 -c "
import sys, json
from datetime import datetime
try:
    d = json.load(sys.stdin)
    ts = datetime.fromisoformat(d['timestamp'])
    print(f\"{ts.strftime('%H:%M:%S')} → {d['temperature']:.1f}°C, {d['humidity']:.1f}%\")
except:
    print('Failed')
    " || echo "Failed"
    [ $i -lt 5 ] && sleep 3
done
echo ""

# Test 4: Historical data count
echo "━━━ TEST 4: Historical Data Availability ━━━"
curl -s "http://localhost:5000/api/sensors/environment/history?hours=1" 2>/dev/null | \
python3 -c "
import sys, json
from datetime import datetime
try:
    d = json.load(sys.stdin)
    count = d['count']
    if count > 0:
        first = d['data'][0]
        last = d['data'][-1]
        first_ts = datetime.fromisoformat(first['timestamp'])
        last_ts = datetime.fromisoformat(last['timestamp'])
        print(f\"Records in last hour: {count}\")
        print(f\"Newest: {first_ts.strftime('%H:%M:%S')} ({first['temperature']:.1f}°C)\")
        print(f\"Oldest: {last_ts.strftime('%H:%M:%S')} ({last['temperature']:.1f}°C)\")
    else:
        print('No historical data')
except Exception as e:
    print(f'Error: {e}')
"
echo ""

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Test Complete! Check browser at http://localhost:8080         ║"
echo "║  Environment tab should update every 3 seconds                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
