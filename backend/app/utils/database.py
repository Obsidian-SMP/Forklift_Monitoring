from datetime import datetime, timedelta
import logging

from app.models import WarehouseSensor, ForkliftLocation, VibrationData

logger = logging.getLogger(__name__)


def cleanup_old_data(retention_days):
    """Clean up old sensor data based on retention policy"""
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        
        # Delete old warehouse sensor data
        sensor_deleted = WarehouseSensor.objects(timestamp__lt=cutoff_date).delete()
        logger.info(f"Deleted {sensor_deleted} old warehouse sensor records")
        
        # Delete old GPS location data
        location_deleted = ForkliftLocation.objects(timestamp__lt=cutoff_date).delete()
        logger.info(f"Deleted {location_deleted} old location records")
        
        # Delete old vibration data
        vibration_deleted = VibrationData.objects(timestamp__lt=cutoff_date).delete()
        logger.info(f"Deleted {vibration_deleted} old vibration records")
        
        return {
            'sensor_deleted': sensor_deleted,
            'location_deleted': location_deleted,
            'vibration_deleted': vibration_deleted
        }
    except Exception as e:
        logger.error(f"Error cleaning up old data: {e}")
        return None
