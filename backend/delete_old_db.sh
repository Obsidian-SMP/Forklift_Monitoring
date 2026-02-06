#!/bin/bash
# Quick script to delete old database and create fresh one

echo "================================================"
echo "DATABASE RESET - Deleting Old Database Files"
echo "================================================"
echo ""

cd /home/rpi/warehouse_iot/backend

# Check if database exists
if [ -f "warehouse_iot.db" ]; then
    echo "Found old database file: warehouse_iot.db"
    rm -f warehouse_iot.db
    echo "✓ Deleted warehouse_iot.db"
else
    echo "No warehouse_iot.db found"
fi

# Remove WAL and SHM files
if [ -f "warehouse_iot.db-wal" ]; then
    rm -f warehouse_iot.db-wal
    echo "✓ Deleted warehouse_iot.db-wal"
fi

if [ -f "warehouse_iot.db-shm" ]; then
    rm -f warehouse_iot.db-shm
    echo "✓ Deleted warehouse_iot.db-shm"
fi

if [ -f "warehouse_iot.db-journal" ]; then
    rm -f warehouse_iot.db-journal
    echo "✓ Deleted warehouse_iot.db-journal"
fi

echo ""
echo "✅ Old database files removed!"
echo ""
echo "Now run: python create_tables.py"
echo "This will create fresh tables with updated schema."
