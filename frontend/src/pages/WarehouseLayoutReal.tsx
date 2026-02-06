/**
 * Warehouse Layout - Real-time Interactive Map
 * Displays warehouse grid with gateway positions and forklift location
 * Shows RSSI signal strength for each gateway
 */

import { useState, useEffect, useRef } from 'react';
import apiService from '@/services/api';

export default function WarehouseLayoutReal() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gateways, setGateways] = useState<any[]>([]);
  const [position, setPosition] = useState<any>(null);
  const [rssiData, setRssiData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(2000);

  const WAREHOUSE_WIDTH = 10;  // meters
  const WAREHOUSE_HEIGHT = 10;  // meters
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 800;

  // Fetch data
  const fetchData = async () => {
    try {
      const [gRes, pRes, rRes] = await Promise.all([
        apiService.getGateways().catch(() => ({ gateways: [] })),
        apiService.getLatestPosition().catch(() => ({ position: null })),
        apiService.getRSSIHistory(100).catch(() => ({ readings: [] })),
      ]);

      setGateways(gRes.gateways || []);
      setPosition(pRes.position);
      setRssiData(rRes.readings || []);
    } catch (err) {
      console.error('Failed to fetch:', err);
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

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw grid
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * CANVAS_WIDTH;
      const y = (i / 10) * CANVAS_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Draw border
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Helper: Convert warehouse coords to canvas coords
    const toCanvasCoords = (x: number, y: number) => ({
      x: (x / WAREHOUSE_WIDTH) * CANVAS_WIDTH,
      y: (y / WAREHOUSE_HEIGHT) * CANVAS_HEIGHT,
    });

    // Helper: Get RSSI for gateway
    const getLatestRSSI = (gId: string) => {
      const readings = rssiData.filter(r => r.gateway_id === gId);
      return readings.length > 0 ? readings[readings.length - 1].rssi : null;
    };

    // Helper: Get color from RSSI
    const getRSSIColor = (rssi: number | null) => {
      if (!rssi) return '#666666';
      if (rssi > -50) return '#22c55e'; // Green
      if (rssi > -70) return '#3b82f6'; // Blue
      if (rssi > -85) return '#eab308'; // Yellow
      if (rssi > -100) return '#f97316'; // Orange
      return '#ef4444'; // Red
    };

    // Draw gateways
    gateways.forEach((gw) => {
      const coords = toCanvasCoords(gw.location.x, gw.location.y);
      const rssi = getLatestRSSI(gw.gateway_id);
      const color = getRSSIColor(rssi);

      // Draw gateway circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, 8, 0, Math.PI * 2);
      ctx.fill();

      // Draw signal rings
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.3;
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, 15 * r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

      // Draw border
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, 8, 0, Math.PI * 2);
      ctx.stroke();

      // Draw label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(gw.name, coords.x, coords.y - 20);

      // Draw RSSI value
      ctx.font = '10px Arial';
      ctx.fillStyle = color;
      ctx.fillText(`${rssi ? rssi + 'dBm' : '—'}`, coords.x, coords.y + 25);
    });

    // Draw forklift position (larger circle with crosshairs)
    if (position) {
      const coords = toCanvasCoords(position.x, position.y);

      // Accuracy circle
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      const radiusPx = (position.accuracy / WAREHOUSE_WIDTH) * CANVAS_WIDTH;
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, radiusPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      // Main circle
      ctx.fillStyle = '#a78bfa';
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, 12, 0, Math.PI * 2);
      ctx.fill();

      // Inner circle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Crosshairs
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(coords.x - 15, coords.y);
      ctx.lineTo(coords.x + 15, coords.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y - 15);
      ctx.lineTo(coords.x, coords.y + 15);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Forklift', coords.x, coords.y - 28);
    }

    // Draw legend
    const legendX = 10;
    const legendY = 10;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(legendX, legendY, 180, 120);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Signal Strength:', legendX + 10, legendY + 20);

    const signals = [
      { rssi: -40, label: 'Excellent' },
      { rssi: -70, label: 'Good' },
      { rssi: -85, label: 'Fair' },
      { rssi: -95, label: 'Weak' },
    ];

    signals.forEach((sig, idx) => {
      const color = getRSSIColor(sig.rssi);
      ctx.fillStyle = color;
      ctx.fillRect(legendX + 10, legendY + 30 + idx * 18, 12, 12);
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px Arial';
      ctx.fillText(sig.label, legendX + 28, legendY + 39 + idx * 18);
    });
  }, [gateways, position, rssiData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading warehouse layout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">🏭 Warehouse Layout Map</h1>
            <p className="text-gray-300">Real-time gateway & forklift position visualization</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg text-white ${
                autoRefresh ? 'bg-green-600' : 'bg-gray-600'
              }`}
            >
              {autoRefresh ? '⏸️' : '▶️'} Auto
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="bg-slate-700 rounded-lg p-4 shadow-lg">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full border-2 border-slate-600 rounded"
          />
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {/* Gateways Info */}
          <div className="bg-slate-700 rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-2">📡 Gateways</h3>
            <div className="text-2xl font-bold text-blue-400">{gateways.length}</div>
            <div className="text-xs text-gray-400 mt-2">
              {gateways.filter(g => g.is_active).length} active
            </div>
          </div>

          {/* Position Info */}
          <div className="bg-slate-700 rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-2">📍 Position</h3>
            {position ? (
              <div>
                <div className="text-sm text-gray-300">
                  X: <span className="font-bold text-blue-400">{position.x.toFixed(1)}m</span>
                </div>
                <div className="text-sm text-gray-300">
                  Y: <span className="font-bold text-green-400">{position.y.toFixed(1)}m</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Accuracy: ±{position.accuracy?.toFixed(2) || '?'}m
                </div>
                {position.speed !== undefined && position.speed > 0.01 && (
                  <div className="text-xs text-teal-400 mt-1">
                    Speed: {(position.speed * 3.6).toFixed(1)} km/h
                  </div>
                )}
                {position.gateway_count && (
                  <div className="text-xs text-purple-400 mt-1">
                    {position.gateway_count} gateway{position.gateway_count > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-400 text-sm">No position data</div>
            )}
          </div>

          {/* Last Update */}
          <div className="bg-slate-700 rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-2">⏱️ Status</h3>
            <div className="text-sm text-gray-300">
              Auto-refresh: <span className={autoRefresh ? 'text-green-400' : 'text-gray-400'}>
                {autoRefresh ? 'ON' : 'OFF'}
              </span>
            </div>
            <div className="text-sm text-gray-300 mt-1">
              Interval: <span className="text-blue-400">{refreshInterval / 1000}s</span>
            </div>
          </div>
        </div>

        {/* Scale Info */}
        <div className="bg-slate-700 rounded-lg p-4 mt-4 text-sm text-gray-300">
          <strong>Scale:</strong> Warehouse is {WAREHOUSE_WIDTH}m × {WAREHOUSE_HEIGHT}m | 
          <strong className="ml-4">🟦 Gateways:</strong> Colored by signal strength | 
          <strong className="ml-4">🟪 Forklift:</strong> Current calculated position
        </div>
      </div>
    </div>
  );
}
