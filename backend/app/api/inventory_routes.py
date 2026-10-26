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
                if search and search not in item.sku.lower() and search not in item.name.lower():
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
    if not data or not data.get("sku"):
        return jsonify({"error": "sku is required"}), 400

    sku = data["sku"].strip()
    name = data.get("name", sku)

    try:
        with db.connection_context():
            existing = InventoryItem.get_or_none(InventoryItem.sku == sku)
            if existing:
                return jsonify({"error": f"Item with SKU '{sku}' already exists"}), 409

            item = InventoryItem.create(
                sku=sku,
                name=name,
                category=data.get("category", "General"),
                quantity=int(data.get("quantity", 1)),
                weight_kg=float(data.get("weight_kg", 10.0)),
                current_zone=data.get("current_zone", "Aisle-1"),
                current_shelf=data.get("current_shelf", "Shelf-A"),
                status=data.get("status", "in_stock"),
            )
            item_dict = item.to_dict()

        log_event("INFO", f"Registered new inventory item SKU '{sku}'", "InventoryAPI", data=item_dict)
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
                .order_by(InventoryTransaction.created_at.desc())
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
