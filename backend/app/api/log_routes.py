# ==============================================================================
# File: app/api/log_routes.py
# Description: In-Dashboard Live Log Viewer & Observability Endpoints.
# Purpose: Supports Option A (In-Dashboard Live Log Viewer). Serves filtered,
#          structured system logs directly from the in-memory ring buffer and
#          enables full-text search, level filtering, and buffer management.
# ==============================================================================

import os
from flask import Blueprint, request, jsonify, send_file

from app.core.config import Config
from app.core.logger import system_logger, log_event

log_bp = Blueprint("logs", __name__, url_prefix="/api/logs")


@log_bp.route("", methods=["GET"])
def get_logs():
    """
    Returns recent structured system log entries from the in-memory ring buffer.
    Query parameters:
      - limit: Number of entries (default 200, max 1000)
      - level: Filter by minimum severity (DEBUG, INFO, WARNING, ERROR)
      - module: Filter by emitting component name
      - search: Full-text substring search across messages and modules
    """
    limit = min(int(request.args.get("limit", 200)), 1000)
    level_filter = request.args.get("level", "").upper()
    module_filter = request.args.get("module", "").lower()
    search = request.args.get("search", "").lower()

    all_logs = system_logger.get_memory_logs(limit=1000)

    # Priority mapping for level filtering
    level_weights = {"DEBUG": 10, "INFO": 20, "WARNING": 30, "ERROR": 40}
    min_weight = level_weights.get(level_filter, 0)

    filtered = []
    for entry in all_logs:
        # 1. Level filter
        entry_weight = level_weights.get(entry.get("level", "INFO"), 20)
        if entry_weight < min_weight:
            continue

        # 2. Module filter
        if module_filter and module_filter not in entry.get("module", "").lower():
            continue

        # 3. Text search
        if search:
            msg = entry.get("message", "").lower()
            mod = entry.get("module", "").lower()
            if search not in msg and search not in mod:
                continue

        filtered.append(entry)

    # Slice to requested limit (newest first or chronological)
    sliced = filtered[-limit:]

    return jsonify({
        "logs": sliced,
        "returned_count": len(sliced),
        "total_in_buffer": len(all_logs),
    }), 200


@log_bp.route("/clear", methods=["POST"])
def clear_logs():
    """Clears the in-memory log buffer."""
    system_logger.clear_memory_buffer()
    log_event("INFO", "In-memory log buffer cleared by operator", "LogViewer")
    return jsonify({"status": "cleared"}), 200


@log_bp.route("/download", methods=["GET"])
def download_disk_log():
    """Downloads the current active disk log file for offline debugging."""
    log_path = Config.LOG_FILE_PATH
    if not os.path.exists(log_path):
        return jsonify({"error": "Log file does not exist yet"}), 404

    return send_file(
        log_path,
        mimetype="text/plain",
        as_attachment=True,
        download_name="warehouse_system.log",
    )
