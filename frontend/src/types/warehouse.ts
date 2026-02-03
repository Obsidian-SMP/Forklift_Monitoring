// Core types for the Warehouse IoT Dashboard

export type StatusLevel = 'safe' | 'warning' | 'danger' | 'offline';
export type ForkliftStatus = 'active' | 'idle' | 'moving' | 'charging' | 'offline' | 'maintenance';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertType = 'temperature' | 'humidity' | 'collision' | 'speed' | 'battery' | 'inventory' | 'system';

export interface EnvironmentReading {
  timestamp: string;
  temperature: number;
  humidity: number;
  zone: string;
  sensorId: string;
}

export interface Forklift {
  id: string;
  name: string;
  status: ForkliftStatus;
  batteryLevel: number;
  signalStrength: number;
  speed: number;
  maxSpeed: number;
  lastUpdate: string;
  zone: string;
  operator?: string;
  position: {
    x: number;
    y: number;
  };
}

export interface ForkliftTelemetry {
  forkliftId: string;
  timestamp: string;
  speed: number;
  vibrationX: number;
  vibrationY: number;
  vibrationZ: number;
  batteryLevel: number;
  motionState: 'stationary' | 'moving' | 'loading' | 'unloading';
}

export interface InventoryItem {
  id: string;
  itemId: string;
  forkliftId: string;
  detectionTime: string;
  placementLocation: string;
  category: string;
  confidenceScore: number;
  status: 'detected' | 'placed' | 'mismatch' | 'missing';
}

export interface PathPoint {
  x: number;
  y: number;
  timestamp: string;
}

export interface ForkliftPath {
  forkliftId: string;
  actualPath: PathPoint[];
  optimalPath: PathPoint[];
  totalDistance: number;
  deviation: number;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  source: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface SystemStatus {
  component: string;
  status: 'online' | 'offline' | 'degraded';
  lastHeartbeat: string;
  latency?: number;
  uptime?: number;
}

export interface KPIData {
  activeForklifts: number;
  totalForklifts: number;
  forkliftsMoving: number;
  inventoryDetectedToday: number;
  alertsToday: number;
  avgTemperature: number;
  avgHumidity: number;
  systemHealth: number;
}

export interface AnalyticsData {
  forkliftId: string;
  date: string;
  distanceTraveled: number;
  activeTime: number;
  idleTime: number;
  loadsHandled: number;
  incidents: number;
}

export interface ThresholdSettings {
  id: string;
  name: string;
  metric: string;
  warningMin?: number;
  warningMax?: number;
  dangerMin?: number;
  dangerMax?: number;
  enabled: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  severity: AlertSeverity;
  enabled: boolean;
  notifyEmail: boolean;
  notifySms: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'operator' | 'viewer';
  lastLogin?: string;
}
