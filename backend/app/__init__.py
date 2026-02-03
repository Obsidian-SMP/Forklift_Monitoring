from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from flask import send_from_directory
import os

from app.config import Config

socketio = SocketIO()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Enable CORS
    CORS(app, resources={r"/*": {"origins": "*"}})
    
    # Initialize SocketIO (use threading for Python 3.13+ compatibility)
    socketio.init_app(app, cors_allowed_origins="*", async_mode='threading')
    
    # Initialize SQLite Database
    from app.models import init_db
    init_db(app.config['DATABASE'])
    
    # Create upload folder
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # Register blueprints
    from app.routes.sensor_routes import sensor_bp
    from app.routes.forklift_routes import forklift_bp
    from app.routes.inventory_routes import inventory_bp
    from app.routes.analytics_routes import analytics_bp
    from app.routes.rssi_routes import rssi_bp
    from app.routes.dht_routes import dht_bp
    from app.routes.warehouse_routes import warehouse_bp
    from app.routes.camera_routes import camera_bp
    from app.routes.alerts_routes import alerts_bp
    
    app.register_blueprint(sensor_bp, url_prefix='/api/sensors')
    app.register_blueprint(forklift_bp, url_prefix='/api/forklift')
    app.register_blueprint(inventory_bp, url_prefix='/api/inventory')
    app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
    app.register_blueprint(rssi_bp, url_prefix='/api/rssi')
    app.register_blueprint(dht_bp, url_prefix='/api/dht')
    app.register_blueprint(warehouse_bp, url_prefix='/api/warehouse')
    app.register_blueprint(camera_bp, url_prefix='/api/camera')
    app.register_blueprint(alerts_bp, url_prefix='/api/alerts')
    
    # Initialize MQTT service
    from app.services.mqtt_service import mqtt_service
    mqtt_service.init_app(app, socketio)
    
    @app.route('/')
    def index():
        return {'message': 'Warehouse IoT Monitoring System API', 'status': 'running'}
    
    @app.route('/health')
    def health():
        return {'status': 'healthy'}
    
    @app.route('/api/health')
    def api_health():
        return {'status': 'healthy', 'service': 'Warehouse IoT API'}
    
    # Serve uploaded images
    @app.route('/uploads/<path:filename>')
    def uploaded_file(filename):
        upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
        return send_from_directory(upload_dir, filename)
    
    @app.route('/uploads/images/<path:filename>')
    def uploaded_image(filename):
        upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), app.config['UPLOAD_FOLDER'])
        return send_from_directory(upload_dir, filename)
    
    # Start background thread for periodic RSSI cleanup
    import threading
    import time
    def rssi_cleanup_loop():
        from app.utils.cleanup_rssi import cleanup_old_rssi
        while True:
            try:
                cleanup_old_rssi()
            except Exception as e:
                print(f"[RSSI Cleanup Thread] Error: {e}")
            time.sleep(300)  # Run every 5 minutes

    cleanup_thread = threading.Thread(target=rssi_cleanup_loop, daemon=True)
    cleanup_thread.start()

    return app
