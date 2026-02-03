#!/bin/bash

# Warehouse IoT System Startup Script - Improved Version
# Starts backend and frontend services with health checks

echo "=========================================="
echo "🏭 Warehouse IoT Monitoring System"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Base directory
BASE_DIR="/home/rpi/warehouse_iot"
cd "$BASE_DIR"

echo "📂 Working directory: $BASE_DIR"
echo ""

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 0
    else
        return 1
    fi
}

# Check and kill existing processes
echo "🔍 Checking for existing services..."

if check_port 5000; then
    echo -e "${YELLOW}⚠️  Port 5000 (Backend) is in use. Stopping...${NC}"
    PID=$(lsof -ti:5000)
    kill -9 $PID 2>/dev/null
    sleep 1
fi

if check_port 5173; then
    echo -e "${YELLOW}⚠️  Port 5173 (Frontend) is in use. Stopping...${NC}"
    PID=$(lsof -ti:5173)
    kill -9 $PID 2>/dev/null
    sleep 1
fi

echo -e "${GREEN}✓${NC} Ports cleared"
echo ""

# Create logs directory
mkdir -p logs

# Start Backend Server
echo "=========================================="
echo "🚀 Starting Backend Server..."
echo "=========================================="
cd "$BASE_DIR/backend"

# Start backend in background
echo "Starting Flask server on http://0.0.0.0:5000"
python3 run.py > "$BASE_DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
echo $BACKEND_PID > "$BASE_DIR/logs/backend.pid"

# Wait for backend to start
echo "Waiting for backend to initialize..."
for i in {1..30}; do
    if check_port 5000; then
        echo -e "${GREEN}✓${NC} Backend started successfully!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Backend failed to start. Check logs/backend.log${NC}"
        tail -n 20 "$BASE_DIR/logs/backend.log"
        exit 1
    fi
    sleep 1
    echo -n "."
done
echo ""

# Start Frontend Server
echo ""
echo "=========================================="
echo "🚀 Starting Frontend Server..."
echo "=========================================="
cd "$BASE_DIR/frontend"

# Start frontend in background
echo "Starting Vite dev server on http://0.0.0.0:5173"
npm run dev -- --host 0.0.0.0 > "$BASE_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
echo $FRONTEND_PID > "$BASE_DIR/logs/frontend.pid"

# Wait for frontend to start
echo "Waiting for frontend to initialize..."
for i in {1..30}; do
    if check_port 5173; then
        echo -e "${GREEN}✓${NC} Frontend started successfully!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Frontend failed to start. Check logs/frontend.log${NC}"
        tail -n 20 "$BASE_DIR/logs/frontend.log"
        exit 1
    fi
    sleep 1
    echo -n "."
done
echo ""

cd "$BASE_DIR"

# Get local IP
LOCAL_IP=$(hostname -I | awk '{print $1}')

# System Information
echo ""
echo "=========================================="
echo "✅ System Ready!"
echo "=========================================="
echo ""
echo "📊 Service Status:"
echo -e "  ${GREEN}●${NC} Backend:  http://${LOCAL_IP}:5000  (PID: $BACKEND_PID)"
echo -e "  ${GREEN}●${NC} Frontend: http://${LOCAL_IP}:5173  (PID: $FRONTEND_PID)"
echo ""
echo "📁 Log Files:"
echo "  Backend:  tail -f logs/backend.log"
echo "  Frontend: tail -f logs/frontend.log"
echo ""
echo "🔌 API Endpoints:"
echo "  Health Check:     http://${LOCAL_IP}:5000/api/health"
echo "  ESP32-CAM Upload: http://${LOCAL_IP}:5000/api/forklift/<id>/image"
echo "  Sensor Data:      http://${LOCAL_IP}:5000/api/forklift/<id>/data"
echo ""
echo "📱 ESP32-CAM Configuration:"
echo "  Update esp32_cam_forklift.ino with:"
echo "    - WiFi SSID and password"
echo -e "    - Raspberry Pi IP: ${BLUE}${LOCAL_IP}${NC}"
echo "    - Forklift ID (e.g., forklift_1)"
echo ""
echo "🎮 Management:"
echo "  Stop services: kill $BACKEND_PID $FRONTEND_PID"
echo "  View logs:     tail -f logs/*.log"
echo ""
echo "=========================================="
echo "🎉 All services running!"
echo "=========================================="

# Keep processes running
wait
