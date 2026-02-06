import paho.mqtt.client as mqtt
import json
import base64
from datetime import datetime, timezone, timedelta
import logging
import os

# IST timezone (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

import json as json_module
from app.models import (
    WarehouseSensor, Forklift, ForkliftLocation, 
    VibrationData, Inventory, InventoryTransaction
)
from app.services.websocket_service import broadcast_update
from app.services.alert_service import AlertService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MQTTService:
    def __init__(self):
        self.client = None
        self.app = None
        self.socketio = None
        self.alert_service = None
        
    def init_app(self, app, socketio):
        """Initialize MQTT service with Flask app"""
        self.app = app
        self.socketio = socketio
        self.alert_service = AlertService(app.config)
        
        # Use unique client ID to avoid conflicts with Flask reloader
        client_id = f"warehouse_server_{os.getpid()}"
        self.client = mqtt.Client(client_id=client_id)
        
        # Set username and password if provided
        if app.config['MQTT_USERNAME'] and app.config['MQTT_USERNAME'].strip():
            self.client.username_pw_set(
                app.config['MQTT_USERNAME'], 
                app.config['MQTT_PASSWORD']
            )
        
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        
        try:
            self.client.connect(
                app.config['MQTT_BROKER'],
                app.config['MQTT_PORT'],
                app.config['MQTT_KEEPALIVE']
            )
            self.client.loop_start()
            logger.info(f"MQTT client connected to {app.config['MQTT_BROKER']}:{app.config['MQTT_PORT']}")
        except Exception as e:
            logger.error(f"Failed to connect to MQTT broker: {e}")
    
    def on_connect(self, client, userdata, flags, rc):
        """Callback when connected to MQTT broker"""
        if rc == 0:
            logger.info("Connected to MQTT Broker!")
            # Subscribe to all topics
            for topic_name, topic in self.app.config['MQTT_TOPICS'].items():
                client.subscribe(topic)
                logger.info(f"Subscribed to {topic}")
        else:
            logger.error(f"Failed to connect, return code {rc}")
    
    def on_disconnect(self, client, userdata, rc):
        """Callback when disconnected from MQTT broker"""
        if rc != 0:
            logger.warning(f"Unexpected disconnection. Return code: {rc}")
    
    def on_message(self, client, userdata, msg):
        """Callback when message is received"""
        try:
            topic = msg.topic
            logger.info(f"Received message on topic: {topic}")
            
            # Route message based on topic
            if 'environment/data' in topic:
                self.handle_warehouse_sensor(msg)
            elif 'forklift' in topic and 'gps' in topic:
                self.handle_gps_data(msg)
            elif 'forklift' in topic and 'vibration' in topic:
                self.handle_vibration_data(msg)
            elif 'forklift' in topic and 'image' in topic:
                self.handle_camera_data(msg)
            elif 'forklift' in topic and 'data' in topic:
                self.handle_forklift_data(msg)
                
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    def handle_warehouse_sensor(self, msg):
        """Handle DHT11 temperature and humidity data"""
        try:
            data = json.loads(msg.payload.decode())
            
            sensor = WarehouseSensor.create(
                temperature=data['temperature'],
                humidity=data['humidity'],
                sensor_id=data.get('sensor_id', 'warehouse_main')
            )
            
            # Check for alerts
            alerts = self.alert_service.check_environment_alerts(
                data['temperature'], 
                data['humidity']
            )
            
            # Broadcast to WebSocket
            broadcast_update(self.socketio, 'warehouse_sensor', {
                **sensor.to_dict(),
                'alerts': alerts
            })
            
            logger.info(f"Saved warehouse sensor data: {data}")
            
        except Exception as e:
            logger.error(f"Error handling warehouse sensor: {e}")
    
    def handle_forklift_data(self, msg):
        """Handle general forklift status data from Arduino"""
        try:
            data = json.loads(msg.payload.decode())
            forklift_id = data.get('forklift_id', 'forklift_1')
            
            # Update or create forklift
            forklift = Forklift.get_or_none(Forklift.forklift_id == forklift_id)
            if not forklift:
                forklift = Forklift.create(forklift_id=forklift_id)
            else:
                forklift.status = data.get('status', 'active')
                forklift.battery_level = data.get('battery_level', 100)
                forklift.last_seen = datetime.now(IST)
                forklift.is_lifting = data.get('is_lifting', False)
                forklift.save()
            
            # Broadcast to WebSocket
            broadcast_update(self.socketio, 'forklift_status', forklift.to_dict())
            
            logger.info(f"Updated forklift data: {forklift_id}")
            
        except Exception as e:
            logger.error(f"Error handling forklift data: {e}")
    
    def handle_gps_data(self, msg):
        """Handle GPS and WiFi positioning data"""
        try:
            data = json.loads(msg.payload.decode())
            forklift_id = data.get('forklift_id', 'forklift_1')
            
            wifi_pos = data.get('wifi_position', {})
            
            location = ForkliftLocation.create(
                forklift_id=forklift_id,
                latitude=data.get('latitude'),
                longitude=data.get('longitude'),
                wifi_position=json_module.dumps(wifi_pos) if wifi_pos else None,
                altitude=data.get('altitude'),
                speed=data.get('speed'),
                heading=data.get('heading'),
                accuracy=data.get('accuracy')
            )
            
            # Broadcast to WebSocket for live tracking
            broadcast_update(self.socketio, 'forklift_location', location.to_dict())
            
            logger.info(f"Saved GPS location for {forklift_id}")
            
        except Exception as e:
            logger.error(f"Error handling GPS data: {e}")
    
    def handle_vibration_data(self, msg):
        """Handle accelerometer vibration data"""
        try:
            data = json.loads(msg.payload.decode())
            forklift_id = data.get('forklift_id', 'forklift_1')
            
            # Calculate magnitude
            magnitude = (data['accel_x']**2 + data['accel_y']**2 + data['accel_z']**2) ** 0.5
            
            # Check for anomaly
            is_anomaly = self.alert_service.check_vibration_anomaly(magnitude)
            
            vibration = VibrationData.create(
                forklift_id=forklift_id,
                accel_x=data['accel_x'],
                accel_y=data['accel_y'],
                accel_z=data['accel_z'],
                magnitude=magnitude,
                is_anomaly=is_anomaly
            )
            
            # Broadcast if anomaly detected
            if is_anomaly:
                broadcast_update(self.socketio, 'vibration_alert', {
                    **vibration.to_dict(),
                    'alert': 'Excessive vibration detected'
                })
            
            logger.info(f"Saved vibration data for {forklift_id}, magnitude: {magnitude:.2f}")
            
        except Exception as e:
            logger.error(f"Error handling vibration data: {e}")
    
    def handle_camera_data(self, msg):
        """Handle ESP32-CAM image data"""
        try:
            data = json.loads(msg.payload.decode())
            forklift_id = data.get('forklift_id', 'forklift_1')
            
            # Decode base64 image
            image_data = base64.b64decode(data['image'])
            
            # AI detection disabled - just save image without processing
            # Save image to uploads folder
            os.makedirs('uploads/images', exist_ok=True)
            timestamp = datetime.now(IST).strftime('%Y%m%d_%H%M%S')
            filename = f"{forklift_id}_{timestamp}.jpg"
            filepath = os.path.join('uploads', 'images', filename)
            
            with open(filepath, 'wb') as f:
                f.write(image_data)
            
            image_url = f"/uploads/images/{filename}"
            
            logger.info(f"Saved camera image for {forklift_id}: {filename}")
            
        except Exception as e:
            logger.error(f"Error handling camera data: {e}")
    
    def publish(self, topic, payload):
        """Publish message to MQTT topic"""
        try:
            self.client.publish(topic, json.dumps(payload))
            logger.info(f"Published to {topic}: {payload}")
        except Exception as e:
            logger.error(f"Error publishing message: {e}")


# Singleton instance
mqtt_service = MQTTService()
