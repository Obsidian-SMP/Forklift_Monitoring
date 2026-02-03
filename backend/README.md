# Warehouse IoT Monitoring System - Backend

Complete Flask backend for smart warehouse and forklift monitoring system with IoT integration.

## System Architecture

### Hardware Components
- **Raspberry Pi 4B**: Main server running Flask backend, MongoDB, and MQTT broker
- **DHT11 Sensor**: Temperature and humidity monitoring (connected to RPi)
- **Arduino Nano 33 IoT**: Forklift monitoring (accelerometer, GPS data forwarding)
- **ESP32-CAM**: Visual load detection and counting
- **GPS Module**: Outdoor/Indoor positioning

### Software Stack
- **Backend**: Flask (Python)
- **Database**: MongoDB
- **Communication**: MQTT + REST API
- **Real-time**: WebSocket (Flask-SocketIO)
- **Image Processing**: YOLOv8 (Ultralytics)

## Features

### Core Functionality
1. **Warehouse Environmental Monitoring**
   - Real-time temperature and humidity tracking
   - Alert system for threshold violations
   - Historical data with retention policy

2. **Forklift Tracking**
   - GPS positioning (outdoor)
   - WiFi-based indoor positioning
   - Real-time location tracking
   - Path history and replay

3. **Load Detection**
   - Computer vision-based goods counting
   - ESP32-CAM image capture
   - YOLOv8 object detection
   - Automatic load tracking

4. **Vibration Monitoring**
   - Accelerometer data from Arduino Nano 33 IoT
   - Anomaly detection
   - Maintenance alerts

5. **Inventory Management**
   - Item tracking and location
   - Transaction history (pickup, dropoff, dispatch)
   - Low stock alerts
   - Integration with forklift movements

6. **Analytics Dashboard**
   - Real-time metrics
   - Performance statistics
   - Activity summaries
   - Forklift utilization

## API Endpoints

### Sensor Data
```
GET  /api/sensors/environment/current        - Latest temperature/humidity
GET  /api/sensors/environment/history        - Historical data
GET  /api/sensors/environment/stats          - Statistical summary
POST /api/sensors/environment                - Add sensor reading
```

### Forklift Management
```
GET  /api/forklift/                          - All forklifts
GET  /api/forklift/<id>                      - Specific forklift
GET  /api/forklift/<id>/location/current     - Latest position
GET  /api/forklift/<id>/location/track       - Path history
GET  /api/forklift/<id>/vibration/current    - Latest vibration
GET  /api/forklift/<id>/vibration/anomalies  - Anomaly list
PUT  /api/forklift/<id>/status               - Update status
POST /api/forklift/<id>/location             - Add location
POST /api/forklift/<id>/vibration            - Add vibration data
```

### Inventory
```
GET    /api/inventory/                       - All items
GET    /api/inventory/<id>                   - Specific item
POST   /api/inventory/                       - Create item
PUT    /api/inventory/<id>                   - Update item
DELETE /api/inventory/<id>                   - Delete item
GET    /api/inventory/transactions           - Transaction history
POST   /api/inventory/transactions           - Create transaction
```

### Analytics
```
GET /api/analytics/dashboard                 - Dashboard overview
GET /api/analytics/activity                  - Activity summary
GET /api/analytics/forklift/<id>/performance - Forklift metrics
GET /api/analytics/inventory/low-stock       - Low stock items
```

## MQTT Topics

### Subscribe (Server listens to)
```
warehouse/environment/data              - DHT11 sensor data
warehouse/forklift/+/data               - Forklift status
warehouse/forklift/+/gps                - GPS coordinates
warehouse/forklift/+/vibration          - Accelerometer data
warehouse/forklift/+/image              - Camera images (base64)
```

### Publish (Server sends to)
```
warehouse/alerts/environment            - Environmental alerts
warehouse/alerts/vibration              - Vibration anomalies
warehouse/commands/forklift/+           - Control commands
```

## WebSocket Events

Real-time updates sent to dashboard:
```
warehouse_sensor     - Temperature/humidity updates
forklift_status      - Forklift state changes
forklift_location    - Position updates
load_detection       - New load detected
vibration_alert      - Anomaly detected
```

## Installation

### 1. Raspberry Pi Setup
```bash
# Transfer setup script to RPi
scp raspberry_pi/setup_raspberry_pi.sh pi@<RPI_IP>:~/

# Run setup script on RPi
ssh pi@<RPI_IP>
chmod +x setup_raspberry_pi.sh
sudo ./setup_raspberry_pi.sh
```

### 2. Backend Installation
```bash
# On Raspberry Pi
cd /home/pi/warehouse_iot

# Copy backend files
# (Transfer via scp, git clone, or USB)

# Install dependencies globally
sudo pip3 install -r requirements.txt

# Configure environment
cp .env.example .env
nano .env  # Edit with your settings

# Test run
python3 run.py
```

### 3. Database Setup
```bash
# MongoDB should be running from setup script
mongosh
> use warehouse_iot
> show collections
```

## Configuration

### Environment Variables (.env)
```bash
# Copy example and edit
cp .env.example .env

# Required settings:
MONGODB_HOST=localhost
MQTT_BROKER=localhost
YOLO_MODEL=yolov8n.pt
```

### Alert Thresholds
Adjust in `.env`:
```
TEMP_MIN=15
TEMP_MAX=30
HUMIDITY_MIN=30
HUMIDITY_MAX=70
VIBRATION_THRESHOLD=5.0
```

### Data Retention
```
SENSOR_DATA_RETENTION=7      # days
GPS_DATA_RETENTION=30        # days
```

## Arduino/ESP32 Integration

### Arduino Nano 33 IoT Setup
1. Install Arduino IDE
2. Install libraries:
   - WiFiNINA
   - ArduinoMqttClient
   - Arduino_LSM6DS3
   - ArduinoJson
   - TinyGPS++

3. Update code with your settings:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   const char* mqtt_broker = "RASPBERRY_PI_IP";
   ```

4. Upload: `arduino_code/nano_33_iot/forklift_sensor/forklift_sensor.ino`

### ESP32-CAM Setup
1. Install ESP32 board support
2. Install libraries:
   - PubSubClient
   - ArduinoJson
   - base64

3. Update code with RPi IP address

4. Upload: `arduino_code/esp32_cam/camera_client/camera_client.ino`

### GPS Module
Connect to Arduino Nano 33 IoT:
- GPS TX → Arduino RX1
- GPS RX → Arduino TX1
- VCC → 3.3V
- GND → GND

## Running the System

### Start Services on Raspberry Pi
```bash
# Start backend server
sudo systemctl start warehouse-iot

# Start DHT11 sensor
sudo systemctl start dht11-sensor

# Check status
sudo systemctl status warehouse-iot
sudo systemctl status dht11-sensor

# View logs
sudo journalctl -u warehouse-iot -f
```

### Manual Testing

#### Test MQTT
```bash
# Subscribe to all topics
mosquitto_sub -h localhost -t "warehouse/#" -v

# Publish test data
mosquitto_pub -h localhost -t "warehouse/environment/data" \
  -m '{"temperature":25.5,"humidity":60.0,"sensor_id":"warehouse_main"}'
```

#### Test REST API
```bash
# Get dashboard data
curl http://localhost:5000/api/analytics/dashboard

# Add sensor data
curl -X POST http://localhost:5000/api/sensors/environment \
  -H "Content-Type: application/json" \
  -d '{"temperature":25.5,"humidity":60.0}'

# Get forklift location
curl http://localhost:5000/api/forklift/forklift_1/location/current
```

#### Test WebSocket
```javascript
// In browser console or Node.js
const socket = io('http://RASPBERRY_PI_IP:5000');

socket.on('connect', () => {
    console.log('Connected to WebSocket');
});

socket.on('warehouse_sensor', (data) => {
    console.log('Sensor update:', data);
});

socket.on('forklift_location', (data) => {
    console.log('Location update:', data);
});
```

## Development

### Project Structure
```
backend/
├── app/
│   ├── __init__.py           # Flask app factory
│   ├── config.py             # Configuration
│   ├── models/               # MongoDB models
│   ├── routes/               # API endpoints
│   ├── services/             # Business logic
│   └── utils/                # Utilities
├── arduino_code/             # Embedded code
├── raspberry_pi/             # RPi scripts
├── requirements.txt
├── run.py                    # Entry point
└── .env                      # Environment config
```

### Adding New Endpoints
```python
# In app/routes/your_routes.py
from flask import Blueprint, jsonify

your_bp = Blueprint('your_feature', __name__)

@your_bp.route('/endpoint', methods=['GET'])
def your_endpoint():
    return jsonify({'message': 'Hello'}), 200

# Register in app/__init__.py
app.register_blueprint(your_bp, url_prefix='/api/your_feature')
```

## Troubleshooting

### MQTT Connection Issues
```bash
# Check Mosquitto status
sudo systemctl status mosquitto

# Test MQTT locally
mosquitto_pub -h localhost -t "test" -m "hello"
mosquitto_sub -h localhost -t "test"

# Check firewall
sudo ufw status
sudo ufw allow 1883/tcp
```

### MongoDB Issues
```bash
# Check MongoDB status
sudo systemctl status mongod

# View MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log

# Restart MongoDB
sudo systemctl restart mongod
```

### Camera/Image Processing Issues
```bash
# Test OpenCV installation
python3 -c "import cv2; print(cv2.__version__)"

# Test YOLO model
python3 -c "from ultralytics import YOLO; model = YOLO('yolov8n.pt')"

# Check image upload folder permissions
ls -la uploads/images
```

### Arduino Connection Issues
- Verify WiFi credentials
- Check Raspberry Pi IP address
- Test MQTT with `mosquitto_sub`
- Check Arduino Serial Monitor for errors

## Performance Optimization

### Raspberry Pi 4B
- Use 64-bit Raspberry Pi OS
- Allocate more RAM to GPU for OpenCV
- Use SSD instead of SD card for database
- Enable swap if running out of memory

### Image Processing
- Reduce image resolution in ESP32-CAM config
- Use YOLOv8n (nano) model for RPi
- Process images asynchronously
- Cache detection results

## Security Considerations

- Change default passwords
- Use MQTT authentication
- Enable MongoDB authentication
- Use HTTPS for production
- Implement API authentication
- Restrict database access
- Update all packages regularly

## Next Steps

1. **Frontend Development**: Create React dashboard
2. **Authentication**: Add user login system
3. **Cloud Integration**: Deploy to cloud for remote access
4. **Mobile App**: Build companion mobile app
5. **Advanced Analytics**: Add ML predictions
6. **Notifications**: Email/SMS alerts
7. **Backup System**: Automated database backups

## Support

For issues or questions:
1. Check logs: `sudo journalctl -u warehouse-iot -f`
2. Verify all services are running
3. Test individual components
4. Review Arduino Serial Monitor output

## License

MIT License - Feel free to modify and use for your project.
