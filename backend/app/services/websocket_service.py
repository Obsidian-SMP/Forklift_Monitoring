import logging

logger = logging.getLogger(__name__)


def broadcast_update(socketio, event, data):
    """
    Broadcast real-time update to all connected WebSocket clients
    
    Args:
        socketio: SocketIO instance
        event: Event name (e.g., 'warehouse_sensor', 'forklift_location')
        data: Data to broadcast
    """
    try:
        socketio.emit(event, data, namespace='/')
        logger.info(f"Broadcasted {event} to WebSocket clients")
    except Exception as e:
        logger.error(f"Error broadcasting {event}: {e}")
