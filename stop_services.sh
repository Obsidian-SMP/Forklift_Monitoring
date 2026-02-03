#!/bin/bash

# Stop all warehouse IoT services

echo "Stopping Warehouse IoT Services..."

# Kill backend
if [ -f "/home/rpi/warehouse_iot/logs/backend.pid" ]; then
    PID=$(cat /home/rpi/warehouse_iot/logs/backend.pid)
    echo "Stopping backend (PID: $PID)..."
    kill -9 $PID 2>/dev/null
    rm /home/rpi/warehouse_iot/logs/backend.pid
fi

# Kill frontend  
if [ -f "/home/rpi/warehouse_iot/logs/frontend.pid" ]; then
    PID=$(cat /home/rpi/warehouse_iot/logs/frontend.pid)
    echo "Stopping frontend (PID: $PID)..."
    kill -9 $PID 2>/dev/null
    rm /home/rpi/warehouse_iot/logs/frontend.pid
fi

# Kill any remaining processes on ports
if lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Killing process on port 5000..."
    kill -9 $(lsof -ti:5000) 2>/dev/null
fi

if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Killing process on port 5173..."
    kill -9 $(lsof -ti:5173) 2>/dev/null
fi

echo "✓ All services stopped"
