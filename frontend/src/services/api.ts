/**
 * API Service - Warehouse IoT Backend Integration
 * Connects frontend to Flask backend for RSSI, position, and gateway data
 * Handles local environment variable or default IP to RPi
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Generic fetch wrapper with error handling
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    // Allow 404 for position endpoints (no data yet)
    if (!response.ok) {
      if (response.status === 404 && (endpoint.includes('/position/latest') || endpoint.includes('/position/history'))) {
        // Return empty position data instead of throwing error
        const emptyData = endpoint.includes('/history') 
          ? { positions: [] } 
          : { message: 'No position data available', position: null };
        return emptyData as T;
      }
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`❌ Failed to fetch ${endpoint}:`, error);
    throw error;
  }
}

export const apiService = {
  // ===== HEALTH & MONITORING =====
  getHealth: () => apiCall<{ status: string; timestamp: string }>('/health'),
  
  getApiHealth: () => apiCall<{ status: string; api: string }>('/health'),

  // ===== GATEWAYS (Mobile BLE Gateway Positions) =====
  
  /**
   * Initialize gateways in database from backend config
   */
  setupGateways: () => apiCall<{
    status: string;
    message: string;
    gateways: GatewayData[];
  }>('/rssi/setup'),

  /**
   * Get all gateway positions
   */
  getGateways: () => apiCall<{
    count: number;
    gateways: GatewayData[];
  }>('/rssi/gateways'),

  /**
   * Get specific gateway
   */
  getGateway: (gatewayId: string) => apiCall<GatewayData>(`/rssi/gateways/${gatewayId}`),

  /**
   * Update gateway position (for dragging/repositioning on frontend)
   */
  updateGateway: (gatewayId: string, data: Partial<GatewayData>) =>
    apiCall<GatewayData>(`/rssi/gateways/${gatewayId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /**
   * Add new gateway or update existing gateway position
   */
  addOrUpdateGateway: (name: string, location_x: number, location_y: number, location_z: number = 0) =>
    apiCall<{
      status: string;
      message: string;
      gateway: GatewayData;
    }>('/rssi/gateways/add', {
      method: 'POST',
      body: JSON.stringify({
        name,
        location_x,
        location_y,
        location_z,
      }),
    }),

  /**
   * Delete a gateway
   */
  deleteGateway: (gatewayId: string) =>
    apiCall<{ status: string; message: string }>(
      `/rssi/gateways/${gatewayId}`,
      { method: 'DELETE' }
    ),

  /**
   * Get all gateways with their status and positions
   */
  getAllGateways: () => apiCall<{
    status: string;
    count: number;
    gateways: GatewayData[];
  }>('/rssi/gateways/list'),

  // ===== RSSI DATA =====
  
  /**
   * Get recent RSSI history
   */
  getRSSIHistory: (limit: number = 100) => apiCall<{
    count: number;
    readings: RSSIReading[];
  }>(`/rssi/history?limit=${limit}`),

  /**
   * Submit RSSI reading from mobile (backend will calculate position)
   */
  submitRSSI: (gatewayId: string, rssi: number, forkliftId: string = 'forklift_001') =>
    apiCall<{
      status: string;
      message: string;
      rssi_record: RSSIReading;
      position?: PositionData;
    }>('/rssi', {
      method: 'POST',
      body: JSON.stringify({
        gateway_id: gatewayId,
        rssi,
        forklift_id: forkliftId,
      }),
    }),

  // ===== POSITION DATA =====
  
  /**
   * Get latest calculated position
   */
  getLatestPosition: () => apiCall<{
    message: string;
    position?: PositionData;
  }>('/rssi/position/latest'),

  /**
   * Get position history (track) - Uses trilateration calculated positions
   */
  getPositionHistory: (hours: number = 2, forkliftId: string = 'forklift_001') => apiCall<{
    forklift_id: string;
    count: number;
    period_hours: number;
    track: PositionData[];
  }>(`/rssi/position/history?forklift_id=${forkliftId}&hours=${hours}`),

  /**
   * Get position with trilateration accuracy
   */
  getPositionAccuracy: () => apiCall<{
    message: string;
    position?: PositionData & { accuracy: number };
  }>('/rssi/position/latest'),

  // ===== FORKLIFTS =====
  
  /**
   * Get all forklifts
   */
  getForklifts: () => apiCall<{
    count: number;
    forklifts: ForkliftData[];
  }>('/forklift'),

  /**
   * Get specific forklift
   */
  getForklift: (id: string) => apiCall<ForkliftData>(`/forklift/${id}`),

  /**
   * Get forklift current location
   */
  getForkliftLocation: (id: string) => apiCall<any>(`/forklift/${id}/location/current`),

  /**
   * Get forklift location history
   */
  getForkliftLocationTrack: (id: string, hours: number = 8) => 
    apiCall<{
      forklift_id: string;
      count: number;
      track: any[];
    }>(`/forklift/${id}/location/track?hours=${hours}`),

  /**
   * Get forklift vibration data
   */
  getForkliftVibration: (id: string) => apiCall<any>(`/forklift/${id}/vibration/current`),
};

// Type definitions
export interface GatewayData {
  id?: number;
  gateway_id: string;
  name: string;
  location: {
    x: number;
    y: number;
    z: number;
  };
  is_active: boolean;
  last_seen?: string;
  created_at?: string;
}

export interface RSSIReading {
  id: number;
  gateway_id: string;
  forklift_id: string;
  rssi: number;
  timestamp: string;
}

export interface PositionData {
  forklift_id?: string;
  x: number;
  y: number;
  z: number;
  accuracy?: number;
  timestamp?: string;
  gateway_count?: number;
  method?: string;  // 'weighted_least_squares', 'trilateration', 'bilateration'
  velocity_x?: number;  // Velocity in X direction (m/s)
  velocity_y?: number;  // Velocity in Y direction (m/s)
  speed?: number;  // Overall speed (m/s)
  average_rssi?: number;
}

export interface ForkliftData {
  forklift_id: string;
  status: string;
  battery_level: number;
  last_location?: {
    x: number;
    y: number;
    z: number;
  };
  created_at?: string;
  updated_at?: string;
}

// DHT Sensor endpoints
export const dhtService = {
  async getTemperature(): Promise<{ temperature: number; unit: string; timestamp: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/dht/temperature`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return response.json();
    } catch (error) {
      console.error('Failed to fetch temperature:', error);
      throw error;
    }
  },

  async getHumidity(): Promise<{ humidity: number; unit: string; timestamp: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/dht/humidity`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return response.json();
    } catch (error) {
      console.error('Failed to fetch humidity:', error);
      throw error;
    }
  },

  async getDHTReading(): Promise<{ temperature: number; humidity: number; timestamp: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/dht/reading`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return response.json();
    } catch (error) {
      console.error('Failed to fetch DHT reading:', error);
      throw error;
    }
  },

  // Environment sensor endpoints (historical data)
  async getEnvironmentCurrent(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/sensors/environment/current`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return response.json();
    } catch (error) {
      console.error('[API] Failed to fetch current environment:', error);
      throw error;
    }
  },

  async getEnvironmentHistory(hours: number = 24): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/sensors/environment/history?hours=${hours}`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return response.json();
    } catch (error) {
      console.error('[API] Failed to fetch environment history:', error);
      throw error;
    }
  },

  async getEnvironmentStats(hours: number = 24): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/sensors/environment/stats?hours=${hours}`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return response.json();
    } catch (error) {
      console.error('[API] Failed to fetch environment stats:', error);
      throw error;
    }
  },

  // Camera API
  async getCameraForklifts(): Promise<{ forklifts: any[] }> {
    try {
      const baseUrl = API_BASE_URL.replace('/api', '');
      const response = await fetch(`${baseUrl}/api/camera/forklifts`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return response.json();
    } catch (error) {
      console.error('Failed to fetch camera forklifts:', error);
      throw error;
    }
  },

  async getCameraStatus(forkliftId: string): Promise<any> {
    try {
      const baseUrl = API_BASE_URL.replace('/api', '');
      const response = await fetch(`${baseUrl}/api/camera/${forkliftId}/status`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return response.json();
    } catch (error) {
      console.error(`Failed to fetch camera status for ${forkliftId}:`, error);
      throw error;
    }
  },

  // Get latest camera image URL (for auto-refreshing feed)
  getCameraLatestImageUrl(forkliftId: string): string {
    const baseUrl = API_BASE_URL.replace('/api', '');
    return `${baseUrl}/api/camera/${forkliftId}/latest?t=${Date.now()}`;
  },

  // Get camera stream URL (MJPEG stream from ESP32-CAM via proxy)
  getCameraStreamUrl(forkliftId: string): string {
    const baseUrl = API_BASE_URL.replace('/api', '');
    return `${baseUrl}/api/camera/${forkliftId}/stream`;
  }
};

export default apiService;
