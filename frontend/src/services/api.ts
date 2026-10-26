// ==============================================================================
// File: src/services/api.ts
// Description: Centralized HTTP REST Client for Backend Endpoints.
// Purpose: Encapsulates asynchronous API calls for Forklifts, Polygon Zones,
//          Inventory catalog & transactions, Safety Alerts, Logs, and Gateways.
// ==============================================================================

import {
  ForkliftRecord,
  WarehouseZone,
  InventoryItem,
  InventoryTransaction,
  SafetyAlert,
  LogEntry,
  GatewayNode,
} from '../types';

const API_BASE = '/api';

export const api = {
  // ---------------------------------------------------------------------------
  // Forklifts
  // ---------------------------------------------------------------------------
  async getForklifts(): Promise<ForkliftRecord[]> {
    const res = await fetch(`${API_BASE}/forklifts`);
    if (!res.ok) throw new Error(`Failed to fetch forklifts: ${res.statusText}`);
    const data = await res.json();
    return data.forklifts || [];
  },

  async updateForkliftStatus(forkliftId: string, status: string, loadedSku?: string | null) {
    const res = await fetch(`${API_BASE}/forklifts/${forkliftId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, loaded_sku: loadedSku }),
    });
    if (!res.ok) throw new Error('Failed to update forklift status');
    return res.json();
  },

  async getForkliftHistory(forkliftId: string, limit = 100) {
    const res = await fetch(`${API_BASE}/forklifts/${forkliftId}/history?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch forklift trail');
    return res.json();
  },

  // ---------------------------------------------------------------------------
  // Warehouse Zones
  // ---------------------------------------------------------------------------
  async getZones(): Promise<WarehouseZone[]> {
    const res = await fetch(`${API_BASE}/zones`);
    if (!res.ok) throw new Error(`Failed to fetch zones: ${res.statusText}`);
    const data = await res.json();
    return data.zones || [];
  },

  async createZone(zoneData: Partial<WarehouseZone>): Promise<WarehouseZone> {
    const res = await fetch(`${API_BASE}/zones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zoneData),
    });
    if (!res.ok) throw new Error(`Failed to create zone: ${res.statusText}`);
    const data = await res.json();
    return data.zone;
  },

  async updateZone(zoneId: string, zoneData: Partial<WarehouseZone>): Promise<WarehouseZone> {
    const res = await fetch(`${API_BASE}/zones/${zoneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zoneData),
    });
    if (!res.ok) throw new Error(`Failed to update zone: ${res.statusText}`);
    const data = await res.json();
    return data.zone;
  },

  async deleteZone(zoneId: string, hard = false): Promise<void> {
    const res = await fetch(`${API_BASE}/zones/${zoneId}?hard=${hard}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete zone: ${res.statusText}`);
  },

  // ---------------------------------------------------------------------------
  // Inventory
  // ---------------------------------------------------------------------------
  async getInventory(status?: string, search?: string): Promise<InventoryItem[]> {
    let url = `${API_BASE}/inventory?`;
    if (status) url += `status=${encodeURIComponent(status)}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch inventory');
    const data = await res.json();
    return data.inventory || [];
  },

  async getTransactions(limit = 50): Promise<InventoryTransaction[]> {
    const res = await fetch(`${API_BASE}/inventory/transactions?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch inventory transactions');
    const data = await res.json();
    return data.transactions || [];
  },

  // ---------------------------------------------------------------------------
  // Safety Alerts
  // ---------------------------------------------------------------------------
  async getAlerts(unackOnly = false, limit = 50): Promise<SafetyAlert[]> {
    const res = await fetch(`${API_BASE}/alerts?unack_only=${unackOnly}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch safety alerts');
    const data = await res.json();
    return data.alerts || [];
  },

  async acknowledgeAlert(alertId: string): Promise<SafetyAlert> {
    const res = await fetch(`${API_BASE}/alerts/${alertId}/ack`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to acknowledge alert');
    const data = await res.json();
    return data.alert;
  },

  // ---------------------------------------------------------------------------
  // Observability & System Logs (Option A)
  // ---------------------------------------------------------------------------
  async getLogs(level?: string, search?: string, limit = 200): Promise<{ logs: LogEntry[]; total_in_buffer: number }> {
    let url = `${API_BASE}/logs?limit=${limit}&`;
    if (level) url += `level=${encodeURIComponent(level)}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch logs');
    return res.json();
  },

  async clearLogs(): Promise<void> {
    const res = await fetch(`${API_BASE}/logs/clear`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to clear logs');
  },

  // ---------------------------------------------------------------------------
  // Gateways
  // ---------------------------------------------------------------------------
  async getGateways(): Promise<GatewayNode[]> {
    const res = await fetch(`${API_BASE}/gateways`);
    if (!res.ok) throw new Error('Failed to fetch gateways');
    const data = await res.json();
    return data.gateways || [];
  },
};
