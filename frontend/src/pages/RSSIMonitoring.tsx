/**
 * RSSI Monitoring & Dashboard Page
 * Real-time BLE RSSI data with position tracking and warehouse layout
 * Displays live RSSI readings, gateway status, and calculated forklift positions
 */

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { GatewaySignalComponent } from '@/components/dashboard/GatewaySignalComponent';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Wifi, MapPin, Zap, Activity, Plus, RefreshCw, Trash2 } from 'lucide-react';
import apiService from '@/services/api';

// Convert UTC timestamp to Indian Standard Time (IST - UTC+5:30)
function convertToIST(timestamp: string | number | Date): string {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return 'Invalid Time';
    }
    // Add 5:30 hours for IST
    const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
    return istDate.toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch (e) {
    return 'Invalid Time';
  }
}

export default function RSSIMonitoring() {
  const [gateways, setGateways] = useState<any[]>([]);
  const [rssiHistory, setRSSIHistory] = useState<any[]>([]);
  const [position, setPosition] = useState<any>(null);
  const [forklifts, setForklifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(2000);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Gateway management state
  const [gatewayFormData, setGatewayFormData] = useState({
    name: '',
    location_x: 0,
    location_y: 0,
    location_z: 0,
  });
  const [gatewaySubmitting, setGatewaySubmitting] = useState(false);
  const [gatewaySuccess, setGatewaySuccess] = useState<string | null>(null);
  const [gatewayError, setGatewayError] = useState<string | null>(null);

  // Fetch all monitoring data
  const fetchData = async () => {
    try {
      setError(null);

      // Fetch in parallel
      const results = await Promise.allSettled([
        apiService.getGateways(),
        apiService.getRSSIHistory(50),
        apiService.getLatestPosition(),
        apiService.getForklifts(),
      ]);

      const [gatewaysRes, historyRes, positionRes, forkliftRes] = results;

      if (gatewaysRes.status === 'fulfilled') {
        setGateways(gatewaysRes.value.gateways || []);
      }
      if (historyRes.status === 'fulfilled') {
        setRSSIHistory(historyRes.value.readings || []);
      }
      if (positionRes.status === 'fulfilled') {
        setPosition(positionRes.value.position);
      }
      if (forkliftRes.status === 'fulfilled') {
        setForklifts(forkliftRes.value.forklifts || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      console.error('RSSI fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, autoRefresh]);

  // Get latest RSSI for each gateway
  const getLatestRSSI = (gatewayId: string): number | null => {
    const readings = rssiHistory.filter((r) => r.gateway_id === gatewayId);
    return readings.length > 0 ? readings[readings.length - 1].rssi : null;
  };

  // Get RSSI signal strength indicator
  const getSignalStatus = (rssi: number | null) => {
    if (!rssi)
      return { color: 'gray', label: 'No Signal', percent: 0, bg: 'bg-gray-600' };
    if (rssi > -50)
      return { color: 'green', label: 'Excellent', percent: 100, bg: 'bg-green-600' };
    if (rssi > -70)
      return { color: 'blue', label: 'Good', percent: 75, bg: 'bg-blue-600' };
    if (rssi > -85)
      return { color: 'yellow', label: 'Fair', percent: 50, bg: 'bg-yellow-600' };
    if (rssi > -100)
      return { color: 'orange', label: 'Weak', percent: 25, bg: 'bg-orange-600' };
    return { color: 'red', label: 'Very Weak', percent: 10, bg: 'bg-red-600' };
  };

  // Gateway management handlers
  const handleAddGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gatewayFormData.name.trim()) {
      setGatewayError('Gateway name is required');
      return;
    }

    // Check if gateway with same name already exists
    const isDuplicate = gateways.some(
      (gw) => gw.name.toLowerCase() === gatewayFormData.name.toLowerCase()
    );

    if (isDuplicate) {
      setGatewayError(`⚠️ Gateway "${gatewayFormData.name}" already exists!`);
      return;
    }

    try {
      setGatewaySubmitting(true);
      setGatewayError(null);
      await apiService.addOrUpdateGateway(
        gatewayFormData.name,
        gatewayFormData.location_x,
        gatewayFormData.location_y,
        gatewayFormData.location_z
      );
      setGatewaySuccess(`Gateway "${gatewayFormData.name}" saved successfully!`);
      setGatewayFormData({ name: '', location_x: 0, location_y: 0, location_z: 0 });
      setTimeout(() => setGatewaySuccess(null), 3000);
      // Refresh gateways list
      fetchData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save gateway';
      setGatewayError(errorMsg);
    } finally {
      setGatewaySubmitting(false);
    }
  };

  // Delete gateway handler
  const handleDeleteGateway = async (gatewayId: string, gatewayName: string) => {
    if (!confirm(`Are you sure you want to delete gateway "${gatewayName}"?`)) {
      return;
    }

    try {
      await apiService.deleteGateway(gatewayId);
      setGatewaySuccess(`Gateway "${gatewayName}" deleted successfully!`);
      setTimeout(() => setGatewaySuccess(null), 3000);
      fetchData();
    } catch (err) {
      setGatewayError(err instanceof Error ? err.message : 'Failed to delete gateway');
    }
  };

  if (loading && gateways.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading RSSI data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              📡 BLE Gateway & Position Monitor
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Real-time RSSI readings with trilateration positioning
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const elem = document.getElementById('gateway-management');
                elem?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition flex items-center gap-2"
            >
              ⚙️ Manage Gateways
            </button>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg transition ${
                autoRefresh
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-600 hover:bg-gray-700'
              } text-white`}
            >
              {autoRefresh ? '⏸️' : '▶️'} Auto
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg mb-6 text-red-300">
            ⚠️ {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Gateway Status Cards */}
          {gateways.map((gateway) => {
            const rssi = getLatestRSSI(gateway.gateway_id);
            const status = getSignalStatus(rssi);

            return (
              <div
                key={gateway.gateway_id}
                className="bg-slate-700 rounded-lg p-6 shadow-lg hover:shadow-xl transition"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{gateway.name}</h3>
                    <p className="text-xs text-gray-400">{gateway.gateway_id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full ${
                        gateway.is_active ? 'bg-green-500' : 'bg-gray-500'
                      }`}
                    ></div>
                    <button
                      onClick={() => handleDeleteGateway(gateway.gateway_id, gateway.name)}
                      className="p-2 hover:bg-red-500/20 rounded transition text-red-400 hover:text-red-300"
                      title="Delete gateway"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* RSSI Value */}
                <div className="mb-4">
                  <div className="text-3xl font-bold text-white mb-1">
                    {rssi ? `${rssi} dBm` : '—'}
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      status.color === 'green'
                        ? 'text-green-300'
                        : status.color === 'blue'
                        ? 'text-blue-300'
                        : status.color === 'yellow'
                        ? 'text-yellow-300'
                        : status.color === 'orange'
                        ? 'text-orange-300'
                        : status.color === 'red'
                        ? 'text-red-300'
                        : 'text-gray-300'
                    }`}
                  >
                    {status.label}
                  </div>
                </div>

                {/* Signal Strength Bar */}
                <div className="mb-4">
                  <div className="w-full bg-slate-600 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full ${status.bg}`}
                      style={{ width: `${status.percent}%` }}
                    ></div>
                  </div>
                </div>

                {/* Position */}
                <div className="text-sm text-gray-300 space-y-1">
                  <div>
                    <span className="text-gray-400">Position:</span> (
                    {gateway.location.x.toFixed(1)}, {gateway.location.y.toFixed(1)})m
                  </div>
                  {gateway.last_seen && (
                    <div>
                      <span className="text-gray-400">Last seen:</span>{' '}
                      {convertToIST(gateway.last_seen)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Position & Forklift Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Calculated Position */}
          {position && (
            <div className="bg-slate-700 rounded-lg p-6 shadow-lg">
              <h2 className="text-2xl font-bold text-white mb-4">📍 Calculated Position</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-3xl font-bold text-blue-400">
                    {position.x.toFixed(2)}m
                  </div>
                  <div className="text-sm text-gray-400">X Coordinate</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-green-400">
                    {position.y.toFixed(2)}m
                  </div>
                  <div className="text-sm text-gray-400">Y Coordinate</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-purple-400">
                    {position.z.toFixed(2)}m
                  </div>
                  <div className="text-sm text-gray-400">Z Height</div>
                </div>
              </div>
              {position.accuracy && (
                <div className="p-3 bg-slate-600 rounded">
                  <div className="text-yellow-300 font-semibold">
                    Accuracy: ±{position.accuracy.toFixed(2)}m
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Based on trilateration of {gateways.length} gateways
                  </div>
                </div>
              )}
              {position.timestamp && (
                <div className="text-xs text-gray-400 mt-3">
                  Updated: {convertToIST(position.timestamp)}
                </div>
              )}
            </div>
          )}

          {/* Forklift Status */}
          {forklifts.length > 0 && (
            <div className="bg-slate-700 rounded-lg p-6 shadow-lg">
              <h2 className="text-2xl font-bold text-white mb-4">🚜 Forklifts</h2>
              <div className="space-y-3">
                {forklifts.slice(0, 5).map((forklift) => (
                  <div
                    key={forklift.forklift_id}
                    className="p-3 bg-slate-600 rounded"
                  >
                    <div className="font-semibold text-white">
                      {forklift.forklift_id}
                    </div>
                    <div className="text-xs text-gray-300 mt-1">
                      Status:{' '}
                      <span
                        className={
                          forklift.status === 'active'
                            ? 'text-green-300'
                            : 'text-yellow-300'
                        }
                      >
                        {forklift.status}
                      </span>
                    </div>
                    {forklift.battery_level !== undefined && (
                      <div className="text-xs text-gray-300">
                        Battery: {forklift.battery_level}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RSSI History */}
        <div className="bg-slate-700 rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">📊 RSSI History</h2>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="px-3 py-1 bg-slate-600 text-white rounded text-sm"
            >
              <option value={1000}>1s</option>
              <option value={2000}>2s</option>
              <option value={5000}>5s</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-500">
                <tr className="text-gray-400">
                  <th className="text-left py-2 px-3">Gateway</th>
                  <th className="text-left py-2 px-3">RSSI (dBm)</th>
                  <th className="text-left py-2 px-3">Signal</th>
                  <th className="text-left py-2 px-3">Forklift</th>
                  <th className="text-left py-2 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="text-white">
                {rssiHistory.slice(0, 20).map((reading, idx) => {
                  const status = getSignalStatus(reading.rssi);
                  return (
                    <tr key={idx} className="border-b border-slate-600 hover:bg-slate-600">
                      <td className="py-2 px-3 font-mono text-sm">
                        {reading.gateway_id}
                      </td>
                      <td className="py-2 px-3 font-bold">{reading.rssi}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold text-white ${status.bg}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-300">
                        {reading.forklift_id}
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-400">
                        {convertToIST(reading.timestamp)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-gray-400 mt-2">
            Showing latest 20 readings • Total: {rssiHistory.length}
          </div>
        </div>

        {/* Gateway Management Section */}
        <div id="gateway-management" className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-12">
          {/* Add/Update Gateway Form */}
          <div className="bg-slate-700 rounded-lg p-6 shadow-lg">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Plus className="w-6 h-6" /> Add/Update Gateway
            </h2>

            {gatewayError && (
              <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg mb-4 text-red-300 text-sm">
                ⚠️ {gatewayError}
              </div>
            )}
            {gatewaySuccess && (
              <div className="p-3 bg-green-500/20 border border-green-500 rounded-lg mb-4 text-green-300 text-sm">
                ✅ {gatewaySuccess}
              </div>
            )}

            <form onSubmit={handleAddGateway} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Gateway Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g., office_phone, warehouse_tablet"
                  value={gatewayFormData.name}
                  onChange={(e) =>
                    setGatewayFormData({ ...gatewayFormData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-600 text-white rounded-lg border border-slate-500 focus:border-blue-500 outline-none"
                  disabled={gatewaySubmitting}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    X Position (m) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="0"
                    value={gatewayFormData.location_x}
                    onChange={(e) =>
                      setGatewayFormData({ ...gatewayFormData, location_x: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-600 text-white rounded-lg border border-slate-500 focus:border-blue-500 outline-none"
                    disabled={gatewaySubmitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Y Position (m) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="0"
                    value={gatewayFormData.location_y}
                    onChange={(e) =>
                      setGatewayFormData({ ...gatewayFormData, location_y: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-600 text-white rounded-lg border border-slate-500 focus:border-blue-500 outline-none"
                    disabled={gatewaySubmitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Z Position (m)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="0"
                    value={gatewayFormData.location_z}
                    onChange={(e) =>
                      setGatewayFormData({ ...gatewayFormData, location_z: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-600 text-white rounded-lg border border-slate-500 focus:border-blue-500 outline-none"
                    disabled={gatewaySubmitting}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={gatewaySubmitting || !gatewayFormData.name.trim()}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition"
              >
                {gatewaySubmitting ? 'Saving...' : '💾 Save Gateway'}
              </button>
            </form>

            <div className="mt-6 p-4 bg-slate-600/50 rounded-lg text-xs text-gray-300">
              <p className="font-semibold mb-2">💡 How to use:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Enter gateway name (must be unique)</li>
                <li>Set X, Y coordinates (required for trilateration)</li>
                <li>Set Z height (optional, default 0)</li>
                <li>Same name = update position, new name = create gateway</li>
              </ul>
            </div>
          </div>

          {/* Configured Gateways List */}
          <div className="bg-slate-700 rounded-lg p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Wifi className="w-6 h-6" /> Configured Gateways
              </h2>
              <Badge variant="outline" className="bg-slate-600 text-white border-slate-500">
                {gateways.length} gateway(s)
              </Badge>
            </div>

            {gateways.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Wifi className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No gateways configured yet</p>
                <p className="text-xs mt-2">Add one using the form on the left</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {gateways.map((gateway) => (
                  <div key={gateway.gateway_id} className="bg-slate-600 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-white">{gateway.name}</h3>
                        <p className="text-xs text-gray-400">{gateway.gateway_id}</p>
                      </div>
                      <Badge
                        className={`${
                          gateway.is_active
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-600 text-gray-300'
                        }`}
                      >
                        {gateway.is_active ? '✓ Active' : 'Inactive'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-blue-400" />
                        <span className="text-gray-300">
                          X: <span className="font-mono text-blue-300">{gateway.location.x.toFixed(2)}m</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-green-400" />
                        <span className="text-gray-300">
                          Y: <span className="font-mono text-green-300">{gateway.location.y.toFixed(2)}m</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-purple-400" />
                        <span className="text-gray-300">
                          Z: <span className="font-mono text-purple-300">{gateway.location.z.toFixed(2)}m</span>
                        </span>
                      </div>
                    </div>

                    {gateway.last_seen && (
                      <div className="text-xs text-gray-400">
                        Last seen: {convertToIST(gateway.last_seen)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
