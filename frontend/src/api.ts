/**
 * API Service - Warehouse IoT Backend Integration
 * Connects frontend to Flask backend for RSSI, position, and gateway data
 * Handles local environment variable or default IP to RPi
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://10.136.57.165:5000/api';

console.log('🔌 API Service initialized with base URL:', API_BASE_URL);

// Generic fetch wrapper with error handling
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`📡 Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
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
   * Get position history (track)
   */
  getPositionHistory: (hours: number = 8) => apiCall<{
    count: number;
    positions: PositionData[];
  }>(`/rssi/position/history?hours=${hours}`),

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
  forklift_id: string;
  x: number;
  y: number;
  z: number;
  accuracy?: number;
  timestamp?: string;
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
};

export default apiService;
