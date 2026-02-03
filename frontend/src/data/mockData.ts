import type {
  Forklift,
  EnvironmentReading,
  InventoryItem,
  Alert,
  SystemStatus,
  KPIData,
  AnalyticsData,
  ForkliftTelemetry,
  ThresholdSettings,
  AlertRule,
  User,
} from '@/types/warehouse';

// Generate timestamps for the last N hours
const generateTimestamps = (hours: number, intervalMinutes: number = 30) => {
  const now = new Date();
  const timestamps: string[] = [];
  for (let i = hours * (60 / intervalMinutes); i >= 0; i--) {
    const time = new Date(now.getTime() - i * intervalMinutes * 60 * 1000);
    timestamps.push(time.toISOString());
  }
  return timestamps;
};

// KPI Data
export const mockKPIData: KPIData = {
  activeForklifts: 12,
  totalForklifts: 15,
  forkliftsMoving: 7,
  inventoryDetectedToday: 1847,
  alertsToday: 23,
  avgTemperature: 18.5,
  avgHumidity: 45,
  systemHealth: 98.5,
};

// Forklifts
export const mockForklifts: Forklift[] = [
  { id: 'FL-001', name: 'Forklift Alpha', status: 'moving', batteryLevel: 85, signalStrength: 95, speed: 12.5, maxSpeed: 20, lastUpdate: new Date().toISOString(), zone: 'Zone A', operator: 'John Smith', position: { x: 120, y: 80 } },
  { id: 'FL-002', name: 'Forklift Beta', status: 'active', batteryLevel: 72, signalStrength: 88, speed: 0, maxSpeed: 20, lastUpdate: new Date().toISOString(), zone: 'Zone B', operator: 'Jane Doe', position: { x: 250, y: 150 } },
  { id: 'FL-003', name: 'Forklift Gamma', status: 'idle', batteryLevel: 45, signalStrength: 92, speed: 0, maxSpeed: 20, lastUpdate: new Date().toISOString(), zone: 'Zone A', operator: 'Mike Johnson', position: { x: 180, y: 220 } },
  { id: 'FL-004', name: 'Forklift Delta', status: 'charging', batteryLevel: 25, signalStrength: 100, speed: 0, maxSpeed: 20, lastUpdate: new Date().toISOString(), zone: 'Charging Station', position: { x: 50, y: 300 } },
  { id: 'FL-005', name: 'Forklift Epsilon', status: 'moving', batteryLevel: 90, signalStrength: 78, speed: 15.2, maxSpeed: 20, lastUpdate: new Date().toISOString(), zone: 'Zone C', operator: 'Sarah Wilson', position: { x: 350, y: 100 } },
  { id: 'FL-006', name: 'Forklift Zeta', status: 'offline', batteryLevel: 0, signalStrength: 0, speed: 0, maxSpeed: 20, lastUpdate: new Date(Date.now() - 3600000).toISOString(), zone: 'Maintenance', position: { x: 400, y: 350 } },
  { id: 'FL-007', name: 'Forklift Eta', status: 'active', batteryLevel: 68, signalStrength: 85, speed: 8.3, maxSpeed: 20, lastUpdate: new Date().toISOString(), zone: 'Zone B', operator: 'Tom Brown', position: { x: 280, y: 200 } },
  { id: 'FL-008', name: 'Forklift Theta', status: 'moving', batteryLevel: 55, signalStrength: 90, speed: 11.0, maxSpeed: 20, lastUpdate: new Date().toISOString(), zone: 'Zone A', operator: 'Lisa Davis', position: { x: 150, y: 120 } },
];

// Environment readings for charts
export const generateEnvironmentData = (hours: number = 24): EnvironmentReading[] => {
  const timestamps = generateTimestamps(hours);
  return timestamps.map((timestamp, i) => ({
    timestamp,
    temperature: 17 + Math.sin(i / 10) * 3 + Math.random() * 2,
    humidity: 42 + Math.cos(i / 8) * 8 + Math.random() * 5,
    zone: ['Zone A', 'Zone B', 'Zone C'][i % 3],
    sensorId: `SENSOR-${(i % 5) + 1}`,
  }));
};

export const mockEnvironmentData = generateEnvironmentData(24);

// Forklift telemetry
export const generateTelemetryData = (forkliftId: string, minutes: number = 60): ForkliftTelemetry[] => {
  const data: ForkliftTelemetry[] = [];
  const now = new Date();
  for (let i = minutes; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 1000);
    data.push({
      forkliftId,
      timestamp: time.toISOString(),
      speed: Math.max(0, 10 + Math.sin(i / 5) * 8 + Math.random() * 3),
      vibrationX: Math.random() * 0.5,
      vibrationY: Math.random() * 0.4,
      vibrationZ: Math.random() * 0.3 + 0.1,
      batteryLevel: Math.max(20, 85 - (minutes - i) * 0.1),
      motionState: i % 10 < 3 ? 'loading' : i % 10 < 5 ? 'stationary' : 'moving',
    });
  }
  return data;
};

// Inventory items
export const mockInventoryItems: InventoryItem[] = [
  { id: 'INV-001', itemId: 'PALLET-A1234', forkliftId: 'FL-001', detectionTime: new Date().toISOString(), placementLocation: 'Rack A-12', category: 'Electronics', confidenceScore: 98.5, status: 'placed' },
  { id: 'INV-002', itemId: 'PALLET-B5678', forkliftId: 'FL-002', detectionTime: new Date().toISOString(), placementLocation: 'Rack B-05', category: 'Furniture', confidenceScore: 95.2, status: 'detected' },
  { id: 'INV-003', itemId: 'PALLET-C9012', forkliftId: 'FL-005', detectionTime: new Date().toISOString(), placementLocation: 'Rack C-18', category: 'Food & Beverage', confidenceScore: 87.3, status: 'mismatch' },
  { id: 'INV-004', itemId: 'PALLET-D3456', forkliftId: 'FL-007', detectionTime: new Date().toISOString(), placementLocation: 'Rack A-03', category: 'Automotive', confidenceScore: 99.1, status: 'placed' },
  { id: 'INV-005', itemId: 'PALLET-E7890', forkliftId: 'FL-008', detectionTime: new Date().toISOString(), placementLocation: 'Rack B-22', category: 'Apparel', confidenceScore: 92.8, status: 'detected' },
  { id: 'INV-006', itemId: 'PALLET-F1234', forkliftId: 'FL-001', detectionTime: new Date().toISOString(), placementLocation: 'Rack D-07', category: 'Electronics', confidenceScore: 96.4, status: 'placed' },
  { id: 'INV-007', itemId: 'PALLET-G5678', forkliftId: 'FL-003', detectionTime: new Date().toISOString(), placementLocation: 'Rack C-11', category: 'Chemicals', confidenceScore: 78.2, status: 'missing' },
  { id: 'INV-008', itemId: 'PALLET-H9012', forkliftId: 'FL-005', detectionTime: new Date().toISOString(), placementLocation: 'Rack A-19', category: 'Furniture', confidenceScore: 94.7, status: 'placed' },
];

// Alerts
export const mockAlerts: Alert[] = [
  { id: 'ALT-001', type: 'temperature', severity: 'high', message: 'Temperature exceeds threshold in Zone B', source: 'SENSOR-03', timestamp: new Date().toISOString(), acknowledged: false },
  { id: 'ALT-002', type: 'collision', severity: 'critical', message: 'Near-collision detected between FL-001 and FL-003', source: 'FL-001', timestamp: new Date(Date.now() - 300000).toISOString(), acknowledged: true, acknowledgedBy: 'Admin', acknowledgedAt: new Date(Date.now() - 180000).toISOString() },
  { id: 'ALT-003', type: 'battery', severity: 'medium', message: 'Low battery warning for FL-004 (25%)', source: 'FL-004', timestamp: new Date(Date.now() - 600000).toISOString(), acknowledged: false },
  { id: 'ALT-004', type: 'speed', severity: 'low', message: 'Speed limit exceeded in Zone C', source: 'FL-005', timestamp: new Date(Date.now() - 900000).toISOString(), acknowledged: true, acknowledgedBy: 'Manager', acknowledgedAt: new Date(Date.now() - 800000).toISOString() },
  { id: 'ALT-005', type: 'inventory', severity: 'medium', message: 'Inventory mismatch detected at Rack C-18', source: 'CAMERA-07', timestamp: new Date(Date.now() - 1200000).toISOString(), acknowledged: false },
  { id: 'ALT-006', type: 'humidity', severity: 'high', message: 'Humidity level critical in cold storage', source: 'SENSOR-12', timestamp: new Date(Date.now() - 1500000).toISOString(), acknowledged: false },
  { id: 'ALT-007', type: 'system', severity: 'low', message: 'Sensor SENSOR-05 heartbeat delayed', source: 'SENSOR-05', timestamp: new Date(Date.now() - 1800000).toISOString(), acknowledged: true, acknowledgedBy: 'Tech', acknowledgedAt: new Date(Date.now() - 1700000).toISOString() },
];

// System status
export const mockSystemStatus: SystemStatus[] = [
  { component: 'Main Server', status: 'online', lastHeartbeat: new Date().toISOString(), latency: 12, uptime: 99.98 },
  { component: 'Database', status: 'online', lastHeartbeat: new Date().toISOString(), latency: 5, uptime: 99.99 },
  { component: 'IoT Gateway', status: 'online', lastHeartbeat: new Date().toISOString(), latency: 28, uptime: 99.95 },
  { component: 'Camera System', status: 'online', lastHeartbeat: new Date().toISOString(), latency: 45, uptime: 99.87 },
  { component: 'WiFi Positioning', status: 'degraded', lastHeartbeat: new Date(Date.now() - 30000).toISOString(), latency: 150, uptime: 98.5 },
  { component: 'Backup Server', status: 'online', lastHeartbeat: new Date().toISOString(), latency: 8, uptime: 100 },
  { component: 'Alert Service', status: 'online', lastHeartbeat: new Date().toISOString(), latency: 15, uptime: 99.92 },
  { component: 'Analytics Engine', status: 'offline', lastHeartbeat: new Date(Date.now() - 300000).toISOString(), latency: 0, uptime: 95.2 },
];

// Analytics data
export const mockAnalyticsData: AnalyticsData[] = mockForklifts.slice(0, 5).flatMap(fl => {
  const data: AnalyticsData[] = [];
  for (let i = 7; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      forkliftId: fl.id,
      date: date.toISOString().split('T')[0],
      distanceTraveled: 5000 + Math.random() * 3000,
      activeTime: 6 + Math.random() * 4,
      idleTime: 2 + Math.random() * 2,
      loadsHandled: Math.floor(20 + Math.random() * 30),
      incidents: Math.floor(Math.random() * 3),
    });
  }
  return data;
});

// Threshold settings
export const mockThresholdSettings: ThresholdSettings[] = [
  { id: 'TH-001', name: 'Temperature Warning', metric: 'temperature', warningMin: 15, warningMax: 25, dangerMin: 10, dangerMax: 30, enabled: true },
  { id: 'TH-002', name: 'Humidity Warning', metric: 'humidity', warningMin: 30, warningMax: 60, dangerMin: 20, dangerMax: 70, enabled: true },
  { id: 'TH-003', name: 'Battery Low', metric: 'battery', warningMin: 30, dangerMin: 15, enabled: true },
  { id: 'TH-004', name: 'Speed Limit', metric: 'speed', warningMax: 15, dangerMax: 18, enabled: true },
  { id: 'TH-005', name: 'Vibration Threshold', metric: 'vibration', warningMax: 0.5, dangerMax: 0.8, enabled: false },
];

// Alert rules
export const mockAlertRules: AlertRule[] = [
  { id: 'AR-001', name: 'Critical Temperature', condition: 'temperature > 30 OR temperature < 10', severity: 'critical', enabled: true, notifyEmail: true, notifySms: true },
  { id: 'AR-002', name: 'Low Battery Alert', condition: 'battery < 20', severity: 'high', enabled: true, notifyEmail: true, notifySms: false },
  { id: 'AR-003', name: 'Collision Warning', condition: 'proximity < 2m', severity: 'critical', enabled: true, notifyEmail: true, notifySms: true },
  { id: 'AR-004', name: 'Forklift Offline', condition: 'lastHeartbeat > 5min', severity: 'medium', enabled: true, notifyEmail: true, notifySms: false },
  { id: 'AR-005', name: 'Inventory Mismatch', condition: 'confidence < 85', severity: 'low', enabled: true, notifyEmail: false, notifySms: false },
];

// Users
export const mockUsers: User[] = [
  { id: 'USR-001', name: 'Admin User', email: 'admin@warehouse.com', role: 'admin', lastLogin: new Date().toISOString() },
  { id: 'USR-002', name: 'John Manager', email: 'john.manager@warehouse.com', role: 'manager', lastLogin: new Date(Date.now() - 3600000).toISOString() },
  { id: 'USR-003', name: 'Jane Operator', email: 'jane.operator@warehouse.com', role: 'operator', lastLogin: new Date(Date.now() - 7200000).toISOString() },
  { id: 'USR-004', name: 'Bob Viewer', email: 'bob.viewer@warehouse.com', role: 'viewer', lastLogin: new Date(Date.now() - 86400000).toISOString() },
];

// Alert severity breakdown for charts
export const mockAlertSeverityData = [
  { name: 'Critical', value: 5, fill: 'hsl(var(--status-danger))' },
  { name: 'High', value: 12, fill: 'hsl(var(--status-warning))' },
  { name: 'Medium', value: 28, fill: 'hsl(var(--chart-1))' },
  { name: 'Low', value: 45, fill: 'hsl(var(--status-safe))' },
];

// Inventory category breakdown
export const mockInventoryCategoryData = [
  { name: 'Electronics', value: 450 },
  { name: 'Furniture', value: 320 },
  { name: 'Food & Beverage', value: 280 },
  { name: 'Automotive', value: 220 },
  { name: 'Apparel', value: 180 },
  { name: 'Other', value: 397 },
];

// Zone traffic data for heatmap
export const mockZoneTrafficData = [
  { zone: 'Zone A', traffic: 85 },
  { zone: 'Zone B', traffic: 62 },
  { zone: 'Zone C', traffic: 45 },
  { zone: 'Zone D', traffic: 30 },
  { zone: 'Loading Dock', traffic: 95 },
  { zone: 'Storage Area', traffic: 55 },
];
