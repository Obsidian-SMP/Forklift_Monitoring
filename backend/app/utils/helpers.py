import uuid
from datetime import datetime


def generate_transaction_id():
    """Generate unique transaction ID"""
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    unique_id = str(uuid.uuid4())[:8]
    return f"TXN-{timestamp}-{unique_id}"


def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate distance between two coordinates
    Simple Euclidean distance for indoor tracking
    """
    if None in [lat1, lon1, lat2, lon2]:
        return 0
    
    dx = lat2 - lat1
    dy = lon2 - lon1
    return (dx**2 + dy**2) ** 0.5


def format_datetime(dt):
    """Format datetime for API responses"""
    if dt:
        return dt.isoformat()
    return None
