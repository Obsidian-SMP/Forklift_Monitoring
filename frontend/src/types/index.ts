// ==============================================================================
// File: src/types/index.ts
// Description: Core TypeScript Domain Interfaces & Telemetry Type Definitions.
// Purpose: Strongly types all warehouse entities including Forklifts, Geofence
//          Zones, Inventory Items, Transactions, Safety Alerts, and System Logs.
// ==============================================================================

export interface Position2D {
  x: number;
  y: number;
}

export interface ForkliftPosition {
  forklift_id: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  speed_mps: number;
  confidence?: number;
  accuracy_meters?: number;
  gateway_count?: number;
  is_moving?: boolean;
  status?: string; // 'idle', 'carrying', 'maintenance'
  loaded_sku?: string | null;
  last_updated?: string;
  timestamp?: string;
}

export interface ForkliftRecord {
  id: number;
  forklift_id: string;
  name: string;
  model_type: string;
  operator_name: string;
  battery_percentage: number;
  status: string;
  current_position?: ForkliftPosition;
}

export interface ZonePoint {
  x: number;
  y: number;
}

export interface WarehouseZone {
  id: number;
  zone_id: string;
  name: string;
  zone_type: 'danger' | 'loading' | 'storage' | 'aisle';
  color: string;
  points: ZonePoint[];
  bounding_box: {
    min_x: number;
    max_x: number;
    min_y: number;
    max_y: number;
  };
  notify_on_entry: boolean;
  is_active: boolean;
  updated_at?: string;
}

export interface InventoryItem {
  id: number;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  weight_kg: number;
  current_zone: string;
  current_shelf: string;
  status: 'in_stock' | 'in_transit' | 'dispatched';
  last_scanned_at?: string;
}

export interface InventoryTransaction {
  id: number;
  transaction_id: string;
  sku: string;
  event_type: 'PICKUP' | 'DROPOFF' | 'CYCLE_COUNT';
  forklift_id: string;
  pickup_x?: number | null;
  pickup_y?: number | null;
  dropoff_x?: number | null;
  dropoff_y?: number | null;
  from_zone?: string | null;
  to_zone?: string | null;
  created_at: string;
}

export interface SafetyAlert {
  id: number;
  alert_id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  source: string;
  message: string;
  metadata?: Record<string, any>;
  is_acknowledged: boolean;
  created_at: string;
}

export interface EnvironmentalData {
  sensor_id: string;
  temperature: number;
  humidity: number;
  timestamp?: number | string;
}

export interface GatewayNode {
  gateway_id: string;
  name: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  is_active: boolean;
  last_seen?: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  module: string;
  message: string;
  data?: Record<string, any> | null;
}
