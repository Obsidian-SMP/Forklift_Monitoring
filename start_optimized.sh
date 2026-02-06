#!/bin/bash
# Quick Start Script - Optimized Backend + Frontend

echo "🚀 Starting Warehouse IoT System (Speed Optimized)"
echo "=================================================="

# Kill existing processes
echo "📋 Stopping existing services..."
pkill -f "python3 run.py" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
sleep 2

# Start backend
echo "🔧 Starting backend (AI + Camera optimized)..."
cd /home/rpi/warehouse_iot/backend
python3 run.py > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "✓ Backend started (PID: $BACKEND_PID)"
sleep 3

# Start frontend
echo "🎨 Starting frontend..."
cd /home/rpi/warehouse_iot/frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✓ Frontend started (PID: $FRONTEND_PID)"

echo ""
echo "✅ System Ready!"
echo "=================================================="
echo "📊 Backend:  http://10.136.57.165:5000"
echo "🖥️  Frontend: http://10.136.57.165:8080"
echo ""
echo "⚡ Performance Features:"
echo "   • Real-time AI detection (every frame)"
echo "   • 70% image compression (faster transfer)"
echo "   • Smart queue (always latest frame)"
echo "   • MJPEG streaming option (fastest mode)"
echo "   • 1s polling refresh rate"
echo ""
echo "📝 Logs:"
echo "   • Backend:  tail -f logs/backend.log"
echo "   • Frontend: tail -f logs/frontend.log"
echo ""
echo "🛑 To stop: pkill -f 'python3 run.py' && pkill -f 'npm run dev'"
