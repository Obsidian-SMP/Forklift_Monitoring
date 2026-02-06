#!/usr/bin/env python3
from app.models import db, WarehouseSensor
from datetime import datetime, timedelta

# Initialize database connection
db.init('warehouse_iot.db')
db.connect()

# Check total readings
total = WarehouseSensor.select().count()
print(f'Total DHT readings in database: {total}')

if total > 0:
    # Get latest reading
    latest = WarehouseSensor.select().order_by(WarehouseSensor.timestamp.desc()).first()
    print(f'\nLatest reading:')
    print(f'  Temperature: {latest.temperature}°C')
    print(f'  Humidity: {latest.humidity}%')
    print(f'  Timestamp: {latest.timestamp}')
    
    # Get readings from last hour
    one_hour_ago = datetime.now() - timedelta(hours=1)
    recent = WarehouseSensor.select().where(WarehouseSensor.timestamp >= one_hour_ago).count()
    print(f'\nReadings in last hour: {recent}')
else:
    print('\n⚠️  No DHT readings found in database!')
    print('The DHT sensor background service may not be running.')

db.close()
