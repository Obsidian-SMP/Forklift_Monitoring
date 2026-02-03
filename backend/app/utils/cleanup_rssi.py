
import os
from app.models.database import init_db
# Set the correct path to your SQLite DB
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "warehouse_iot.db")
init_db(DB_PATH)

from app.models.ble_rssi import BLERSSIData
from peewee import fn

# For each gateway, keep only the latest 25 RSSI values, delete the rest
def cleanup_old_rssi():
    gateways = (BLERSSIData
                .select(BLERSSIData.gateway_id)
                .distinct())
    total_deleted = 0
    for gw in gateways:
        # Get IDs of latest 25 RSSI records for this gateway
        latest_ids = (BLERSSIData
                      .select(BLERSSIData.id)
                      .where(BLERSSIData.gateway_id == gw.gateway_id)
                      .order_by(BLERSSIData.timestamp.desc())
                      .limit(25))
        # Delete all except these
        delete_query = (BLERSSIData
                        .delete()
                        .where(
                            (BLERSSIData.gateway_id == gw.gateway_id) &
                            (BLERSSIData.id.not_in(latest_ids))
                        ))
        deleted = delete_query.execute()
        total_deleted += deleted
        if deleted:
            print(f"Deleted {deleted} old RSSI records for gateway {gw.gateway_id}")
    print(f"Total deleted: {total_deleted}")

if __name__ == "__main__":
    cleanup_old_rssi()
