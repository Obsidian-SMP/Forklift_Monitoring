/**
 * Forklift Monitoring - Real-time Fleet Status
 * Shows all forklifts with location, temperature, battery, and status
 */

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import apiService from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Battery, Thermometer, Activity, MapPin, Zap } from 'lucide-react';

export default function ForkliftMonitoringReal() {
  const [forklifts, setForklifts] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(3000);

  const fetchData = async () => {
    try {
      const res = await apiService.getForklifts().catch(() => ({ forklifts: [] }));
      setForklifts(res.forklifts || []);
      if (!selectedId && res.forklifts?.length > 0) {
        setSelectedId(res.forklifts[0].forklift_id);
      }
    } catch (err) {
      console.error('Failed to fetch forklifts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const selected = forklifts.find(f => f.forklift_id === selectedId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'idle':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'offline':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'charging':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getBatteryColor = (battery: number) => {
    if (battery > 70) return 'text-green-400';
    if (battery > 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getTempColor = (temp: number) => {
    if (temp < 15) return 'text-blue-400';
    if (temp < 25) return 'text-green-400';
    if (temp < 35) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Calculate health based on vibration
  const getHealthStatus = (vibration?: number) => {
    if (vibration === undefined) return { status: 'unknown', color: 'bg-gray-500/20 text-gray-300', label: '?' };
    if (vibration < 0.5) return { status: 'excellent', color: 'bg-green-500/20 text-green-300', label: '✓ Excellent' };
    if (vibration < 1.0) return { status: 'good', color: 'bg-blue-500/20 text-blue-300', label: '✓ Good' };
    if (vibration < 2.0) return { status: 'fair', color: 'bg-yellow-500/20 text-yellow-300', label: '⚠ Fair' };
    return { status: 'poor', color: 'bg-red-500/20 text-red-300', label: '✗ Poor' };
  };

  // Check if forklift is active (data received in last 3 minutes)
  const isActive = (lastSeen?: string) => {
    if (!lastSeen) return false;
    const lastSeenTime = new Date(lastSeen).getTime();
    const now = Date.now();
    const threeMinutesMs = 3 * 60 * 1000;
    return (now - lastSeenTime) < threeMinutesMs;
  };

  if (loading && forklifts.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading forklift data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
        <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">🚜 Forklift Fleet Monitor</h1>
            <p className="text-gray-300">Real-time status of all warehouse forklifts</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg transition text-white ${
                autoRefresh ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              {autoRefresh ? '⏸️' : '▶️'} Auto
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-8">
          {/* Forklifts List */}
          {forklifts.length > 0 ? (
            forklifts.map((forklift) => {
              const health = getHealthStatus(forklift.vibration);
              const active = isActive(forklift.last_seen);
              
              return (
                <div
                  key={forklift.forklift_id}
                  onClick={() => setSelectedId(forklift.forklift_id)}
                  className={`bg-slate-700 rounded-lg p-6 cursor-pointer transition hover:bg-slate-600 border-l-4 ${
                    selectedId === forklift.forklift_id ? 'border-blue-500 bg-slate-600' : 'border-slate-600'
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                    {/* Forklift ID */}
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider">Forklift ID</div>
                      <div className="text-2xl font-bold text-white">{forklift.forklift_id}</div>
                    </div>
                    
                    {/* Vibration */}
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider">Vibration</div>
                      <div className="text-2xl font-bold text-orange-400">
                        {forklift.vibration?.toFixed(2) ?? '—'}g
                      </div>
                    </div>
                    
                    {/* Health Status */}
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider">Health</div>
                      <Badge className={`${health.color} text-sm px-3 py-1 border`}>
                        {health.label}
                      </Badge>
                    </div>
                    
                    {/* Active Status */}
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider">Status</div>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${active ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                        <span className={`text-lg font-bold ${active ? 'text-green-400' : 'text-gray-400'}`}>
                          {active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Battery */}
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider">Battery</div>
                      <div className="flex items-center gap-2">
                        <div className={`text-xl font-bold ${getBatteryColor(forklift.battery_level ?? 0)}`}>
                          {forklift.battery_level ?? '—'}%
                        </div>
                        <div className="w-12 bg-slate-600 rounded-full h-2">
                          <div
                            className={`h-full rounded-full ${
                              (forklift.battery_level ?? 0) > 70 ? 'bg-green-500' :
                              (forklift.battery_level ?? 0) > 40 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${forklift.battery_level ?? 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-slate-700 rounded-lg p-12 text-center">
              <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4 opacity-50" />
              <p className="text-gray-400 text-lg mb-2">No forklifts available</p>
              <p className="text-gray-500 text-sm">Waiting for forklift data from the warehouse...</p>
            </div>
          )}
        </div>

        {/* Detailed View of Selected Forklift */}
        {selected && (
          <div className="bg-slate-700 rounded-lg p-8 space-y-6">
            <div className="border-b border-slate-600 pb-4">
              <h2 className="text-3xl font-bold text-white mb-2">{selected.forklift_id} - Details</h2>
              <p className="text-gray-400">Last Updated: {selected.last_seen ? new Date(selected.last_seen).toLocaleString() : 'No data'}</p>
            </div>

            {/* Detailed Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Location */}
              <div className="bg-slate-600 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-bold text-white">Location</h3>
                </div>
                {selected.location ? (
                  <div className="space-y-1 text-gray-300">
                    <div>X: <span className="font-mono text-blue-400">{selected.location.x?.toFixed(2) || '—'}m</span></div>
                    <div>Y: <span className="font-mono text-green-400">{selected.location.y?.toFixed(2) || '—'}m</span></div>
                    <div>Z: <span className="font-mono text-purple-400">{selected.location.z?.toFixed(2) || '—'}m</span></div>
                  </div>
                ) : (
                  <div className="text-gray-400">No location data</div>
                )}
              </div>

              {/* Battery */}
              <div className="bg-slate-600 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Battery className={`w-5 h-5 ${getBatteryColor(selected.battery_level ?? 0)}`} />
                  <h3 className="text-lg font-bold text-white">Battery</h3>
                </div>
                <div className={`text-3xl font-bold mb-2 ${getBatteryColor(selected.battery_level ?? 0)}`}>
                  {selected.battery_level ?? '—'}%
                </div>
                <div className="w-full bg-slate-500 rounded-full h-2">
                  <div
                    className={`h-full rounded-full ${
                      (selected.battery_level ?? 0) > 70 ? 'bg-green-500' :
                      (selected.battery_level ?? 0) > 40 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${selected.battery_level ?? 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Temperature */}
              <div className="bg-slate-600 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Thermometer className={`w-5 h-5 ${getTempColor(selected.temperature ?? 0)}`} />
                  <h3 className="text-lg font-bold text-white">Temperature</h3>
                </div>
                <div className={`text-3xl font-bold ${getTempColor(selected.temperature ?? 0)}`}>
                  {selected.temperature ?? '—'}°C
                </div>
              </div>

              {/* Vibration Details */}
              <div className="bg-slate-600 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-5 h-5 text-orange-400" />
                  <h3 className="text-lg font-bold text-white">Vibration</h3>
                </div>
                {selected.vibration_x !== undefined ? (
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-orange-400">{selected.vibration?.toFixed(2) ?? '—'} g</div>
                    <div className="pt-2 border-t border-slate-500 space-y-1 text-sm">
                      <div>X: <span className="text-blue-400 font-mono">{selected.vibration_x.toFixed(2)}</span>g</div>
                      <div>Y: <span className="text-green-400 font-mono">{selected.vibration_y?.toFixed(2) ?? '—'}</span>g</div>
                      <div>Z: <span className="text-purple-400 font-mono">{selected.vibration_z?.toFixed(2) ?? '—'}</span>g</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-400">No vibration data</div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </DashboardLayout>
  );
}
