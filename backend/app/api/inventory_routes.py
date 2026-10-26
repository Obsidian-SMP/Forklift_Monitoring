# ==============================================================================
# File: app/api/inventory_routes.py
# Description: Warehouse Inventory Ledger & Transaction History Endpoints.
# Purpose: Provides catalog querying, stock status management, and complete
#          audit trail retrieval for forklift pickup and drop-off operations
#          with verified 2D geospatial coordinates and shelf allocations.
# ==============================================================================

from flask import Blueprint, request, jsonify

from app.core.logger import log_event
from app.core.database import db
from app.models.inventory import InventoryItem, InventoryTransaction, DetectedPallet

inventory_bp = Blueprint("inventory", __name__, url_prefix="/api/inventory")


@inventory_bp.route("", methods=["GET"])
def get_inventory():
    """
    Returns inventory items with optional filtering by status, category, or search term.
    """
    status_filter = request.args.get("status")
    category_filter = request.args.get("category")
    search = request.args.get("search", "").strip().lower()

    try:
        with db.connection_context():
            query = InventoryItem.select()
            if status_filter:
                query = query.where(InventoryItem.status == status_filter)
            if category_filter:
                query = query.where(InventoryItem.category == category_filter)

            items = []
            for item in query:
                if search and search not in item.item_id.lower() and search not in item.item_name.lower():
                    continue
                items.append(item.to_dict())

        return jsonify({"inventory": items, "count": len(items)}), 200

    except Exception as e:
        log_event("ERROR", f"Failed to retrieve inventory: {e}", "InventoryAPI")
        return jsonify({"error": "Database error"}), 500


@inventory_bp.route("", methods=["POST"])
def create_inventory_item():
    """Creates a new inventory item in the catalog."""
    data = request.get_json(silent=True)
    item_id = data.get("item_id") or data.get("sku") if data else None
    if not data or not item_id:
        return jsonify({"error": "item_id (or sku) is required"}), 400

    item_id = item_id.strip()
    item_name = data.get("item_name") or data.get("name", item_id)

    try:
        with db.connection_context():
            existing = InventoryItem.get_or_none(InventoryItem.item_id == item_id)
            if existing:
                return jsonify({"error": f"Item with ID '{item_id}' already exists"}), 409

            item = InventoryItem.create(
                item_id=item_id,
                item_name=item_name,
                category=data.get("category", "box"),
                quantity=int(data.get("quantity", 1)),
                unit=data.get("unit", "boxes"),
                zone=data.get("zone", data.get("current_zone", "Aisle-1")),
                shelf=data.get("shelf", data.get("current_shelf", "Shelf-A")),
                status=data.get("status", "in_stock"),
            )
            item_dict = item.to_dict()

        log_event("INFO", f"Registered new inventory item ID '{item_id}'", "InventoryAPI", data=item_dict)
        return jsonify({"item": item_dict}), 201

    except Exception as e:
        log_event("ERROR", f"Failed to create inventory item: {e}", "InventoryAPI")
        return jsonify({"error": "Database error"}), 500


@inventory_bp.route("/transactions", methods=["GET"])
def get_transactions():
    """
    Returns audit trail of pickup and dropoff transactions with (x, y) coordinates.
    Query params: ?limit=50 (default 50, max 200).
    """
    limit = min(int(request.args.get("limit", 50)), 200)

    try:
        with db.connection_context():
            txs = (
                InventoryTransaction.select()
                .order_by(InventoryTransaction.timestamp.desc())
                .limit(limit)
            )
            result = [t.to_dict() for t in txs]

        return jsonify({"transactions": result, "count": len(result)}), 200

    except Exception as e:
        log_event("ERROR", f"Failed to retrieve transactions: {e}", "InventoryAPI")
        return jsonify({"error": "Database error"}), 500


@inventory_bp.route("/detected_pallets", methods=["GET"])
def get_detected_pallets():
    """Returns recent computer vision pallet detections."""
    limit = min(int(request.args.get("limit", 30)), 100)

    try:
        with db.connection_context():
            pallets = (
                DetectedPallet.select()
                .order_by(DetectedPallet.created_at.desc())
                .limit(limit)
            )
            result = [p.to_dict() for p in pallets]

        return jsonify({"detected_pallets": result, "count": len(result)}), 200

    except Exception as e:
        log_event("ERROR", f"Failed to retrieve detected pallets: {e}", "InventoryAPI")
        return jsonify({"error": "Database error"}), 500
