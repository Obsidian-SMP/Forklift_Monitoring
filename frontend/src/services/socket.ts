// ==============================================================================
// File: src/services/socket.ts
// Description: Real-Time Socket.IO WebSocket Service Layer.
// Purpose: Establishes a persistent, low-latency WebSocket connection to the
//          central laptop backend. Automatically reconnects and dispatches
//          positioning updates, vision load/drop events, alarms, and live logs.
// ==============================================================================

import { io, Socket } from 'socket.io-client';
import { ForkliftPosition, SafetyAlert, EnvironmentalData, LogEntry } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;

  public connect(url?: string): Socket {
    if (this.socket) {
      return this.socket;
    }

    // Default to the current host origin (proxied through Vite dev server)
    const targetUrl = url || (window.location.port === '3000' ? 'http://localhost:5000' : window.location.origin);

    this.socket = io(targetUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log('[WebSocket] Connected to central backend:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.warn('[WebSocket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error.message);
    });

    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public onForkliftPosition(callback: (pos: ForkliftPosition) => void) {
    this.socket?.on('forklift_position', callback);
    return () => this.socket?.off('forklift_position', callback);
  }

  public onSafetyAlert(callback: (alert: SafetyAlert) => void) {
    this.socket?.on('safety_alert', callback);
    return () => this.socket?.off('safety_alert', callback);
  }

  public onSensorTelemetry(callback: (data: EnvironmentalData) => void) {
    this.socket?.on('sensor_telemetry', callback);
    return () => this.socket?.off('sensor_telemetry', callback);
  }

  public onLogEvent(callback: (entry: LogEntry) => void) {
    this.socket?.on('system_log', callback);
    return () => this.socket?.off('system_log', callback);
  }

  public onLoadDetected(callback: (data: any) => void) {
    this.socket?.on('load_detected', callback);
    return () => this.socket?.off('load_detected', callback);
  }

  public onUnloadDetected(callback: (data: any) => void) {
    this.socket?.on('unload_detected', callback);
    return () => this.socket?.off('unload_detected', callback);
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }
}

export const socketService = new SocketService();
