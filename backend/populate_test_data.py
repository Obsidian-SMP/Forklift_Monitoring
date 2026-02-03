#!/usr/bin/env python3
"""
Populate database with test DHT sensor data for visualization
"""

from app.models.database import db
from app.models.sensor_data import WarehouseSensor
from datetime import datetime, timedelta
import random

def populate_test_data():
    """Insert test sensor readings for the last 24 hours"""
    print("📊 Populating test DHT sensor data...")
    
    # Connect to database
    from app.config import Config
    db.init(Config.DATABASE)
    db.connect()
    print("✓ Database connected")
    
    base_time = datetime.utcnow()
    count = 0
    
    # Insert readings for last 24 hours (every minute = 1440 readings)
    for i in range(1440):
        timestamp = base_time - timedelta(minutes=i)
        
        # Realistic temperature variation (24-28°C with daily cycle)
        hour_of_day = timestamp.hour
        temp_base = 26.0 + 2.0 * ((hour_of_day - 12) / 12.0)  # Warmer in afternoon
        temp = temp_base + random.uniform(-0.5, 0.5)
        
        # Realistic humidity variation (40-50%)
        humidity = 43.0 + random.uniform(-3, 7)
        
        WarehouseSensor.create(
            temperature=round(temp, 1),
            humidity=round(humidity, 1),
            sensor_id='dht11_gpio21',
            timestamp=timestamp
        )
        count += 1
        
        if count % 100 == 0:
            print(f"  Inserted {count}/1440 readings...")
    
    print(f"✅ Successfully inserted {count} test readings")
    print(f"   Time range: {base_time - timedelta(minutes=1439)} to {base_time}")
    
    # Verify
    total = WarehouseSensor.select().count()
    print(f"   Total records in database: {total}")

if __name__ == '__main__':
    populate_test_data()
