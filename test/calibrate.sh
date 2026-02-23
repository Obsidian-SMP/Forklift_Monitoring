#!/bin/bash
# Quick launcher for gateway calibration tool

cd /home/rpi/warehouse_iot/backend

echo "════════════════════════════════════════════════════════════════════"
echo "           Starting Gateway Calibration Tool"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "Prerequisites:"
echo "  ✓ Backend must be running"
echo "  ✓ Arduino beacon (forklift_001) powered on"
echo "  ✓ Mobile gateway(s) active and sending RSSI data"
echo "  ✓ Measuring tape ready"
echo ""
echo "────────────────────────────────────────────────────────────────────"
echo ""

python3 calibrate_gateways.py
