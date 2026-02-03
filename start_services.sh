#!/bin/bash

# Start backend in background
echo ' Starting Backend on port 5000...'
cd /home/rpi/warehouse_iot/backend
python3 run.py > /home/rpi/warehouse_iot/logs/backend.log 2>&1 &
BACKEND_PID=$!
echo Backend PID: 

# Start frontend in background
echo ' Starting Frontend on port 5173...'
cd /home/rpi/warehouse_iot/frontend
npm run dev -- --host 0.0.0.0 > /home/rpi/warehouse_iot/logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo Frontend PID: 

echo ''
echo ' Services started!'
echo 'Backend:  http://10.136.57.165:5000/api'
echo 'Frontend: http://10.136.57.165:5173'
echo ''
echo 'Logs:'
echo '  Backend:  tail -f /home/rpi/warehouse_iot/logs/backend.log'
echo '  Frontend: tail -f /home/rpi/warehouse_iot/logs/frontend.log'

# Wait for both
wait
