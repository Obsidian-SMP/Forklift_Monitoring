# ==============================================================================
# File: app/core/logger.py
# Description: High-Performance Structured Logging & In-Dashboard Event Broadcaster.
# Purpose: Replaces slow, blocking console print statements with rotating file
#          logging and an in-memory ring buffer streamed live to the React
#          dashboard via WebSockets (Option A).
# ==============================================================================

import os
import uuid
import logging
from logging.handlers import RotatingFileHandler
from collections import deque
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Any

from app.core.config import Config

# Indian Standard Time (UTC+5:30) helper for display consistency
IST = timezone(timedelta(hours=5, minutes=30))


class InDashboardLogHandler(logging.Handler):
    """
    Custom Logging Handler that:
    1. Stores formatted structured logs into an in-memory ring buffer.
    2. Emits new log events directly to browser clients via Socket.IO.
    """

    def __init__(self, capacity: int = 1000):
        super().__init__()
        self.buffer: deque = deque(maxlen=capacity)
        self.socketio_instance: Any = None

    def set_socketio(self, socketio):
        """Attaches the active Flask-SocketIO server instance for live broadcast."""
        self.socketio_instance = socketio

    def emit(self, record: logging.LogRecord):
        try:
            # Extract optional component and metadata attributes if attached
            component = getattr(record, "component", record.name)
            metadata = getattr(record, "metadata", {})

            now_ist = datetime.now(IST)
            log_entry = {
                "id": str(uuid.uuid4())[:8],
                "timestamp": now_ist.strftime("%H:%M:%S.%f")[:-3],
                "iso_timestamp": now_ist.isoformat(),
                "level": record.levelname,
                "module": component,
                "component": component,
                "message": record.getMessage(),
                "data": metadata,
                "metadata": metadata,
            }

            # Append to in-memory sliding window
            self.buffer.append(log_entry)

            # Broadcast to web dashboard if WebSocket is ready
            if self.socketio_instance is not None:
                self.socketio_instance.emit("system_log", log_entry, namespace="/")
        except Exception:
            self.handleError(record)


# Instantiate the memory handler
memory_handler = InDashboardLogHandler(capacity=Config.IN_MEMORY_LOG_LIMIT)


def setup_logger(name: str = "WarehouseIoT") -> logging.Logger:
    """Configures rotating file logging and dashboard streaming with minimal overhead."""
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG if Config.DEBUG else logging.INFO)

    # Avoid duplicate handlers if reloaded
    if logger.hasHandlers():
        logger.handlers.clear()

    # Ensure log directory exists
    os.makedirs(Config.LOG_DIR, exist_ok=True)

    # 1. Rotating File Handler (Option B) - Disk safe, buffered
    file_formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    file_handler = RotatingFileHandler(
        filename=Config.LOG_FILE_PATH,
        maxBytes=Config.LOG_MAX_BYTES,
        backupCount=Config.LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    file_handler.setFormatter(file_formatter)
    file_handler.setLevel(logging.DEBUG if Config.DEBUG else logging.INFO)
    logger.addHandler(file_handler)

    # 2. In-Memory Handler (Option A) - Feeds the Live React Console
    memory_handler.setLevel(logging.INFO)
    logger.addHandler(memory_handler)

    # 3. Clean, Minimal Console Handler (only for warnings & errors to keep terminal quiet)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.WARNING)
    console_formatter = logging.Formatter("[%(levelname)s] %(name)s: %(message)s")
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

    return logger


# Global logger instance
app_logger = setup_logger()


def log_event(level: str, *args, **kwargs):
    """
    Flexible convenience method for logging structured events.
    Supports:
      log_event("INFO", "POSITIONING", "Vehicle moved")
      log_event("INFO", "Vehicle moved", "POSITIONING", data={...})
    """
    metadata = kwargs.get("data") or kwargs.get("metadata") or {}
    if len(args) == 0:
        message = ""
        component = "System"
    elif len(args) == 1:
        message = str(args[0])
        component = kwargs.get("module") or kwargs.get("component") or "System"
    else:
        arg1, arg2 = str(args[0]), str(args[1])
        # If arg1 is short and looks like a tag while arg2 is longer or has spaces:
        if len(arg1) < 20 and (" " not in arg1 or arg1.isupper()) and (" " in arg2 or len(arg2) > len(arg1)):
            component, message = arg1, arg2
        elif len(arg2) < 25 and (" " not in arg2 or arg2.isupper()):
            message, component = arg1, arg2
        else:
            component, message = arg1, arg2

    level_upper = level.upper()
    lvl = getattr(logging, level_upper, logging.INFO)
    extra = {"component": component, "metadata": metadata}
    app_logger.log(lvl, message, extra=extra)


class SystemLoggerAdapter:
    """Adapter class providing backward-compatible methods for system logging."""

    def set_socketio(self, socketio):
        memory_handler.set_socketio(socketio)

    def get_memory_logs(self, limit: int = 1000) -> List[Dict[str, Any]]:
        return list(memory_handler.buffer)[-limit:]

    def clear_memory_buffer(self):
        memory_handler.buffer.clear()


system_logger = SystemLoggerAdapter()


def get_recent_logs(
    limit: int = 100,
    level: Optional[str] = None,
    component: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Retrieves recent logs from the in-memory ring buffer with optional filtering."""
    logs = list(memory_handler.buffer)

    if level:
        level_clean = level.upper().strip()
        logs = [entry for entry in logs if entry["level"] == level_clean]

    if component:
        comp_clean = component.lower().strip()
        logs = [
            entry for entry in logs if comp_clean in entry["component"].lower()
        ]

    # Return newest logs first up to limit
    return logs[-limit:][::-1]


def clear_memory_logs():
    """Clears the in-memory buffer."""
    memory_handler.buffer.clear()

