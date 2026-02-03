/**
 * Warehouse Layout & Gateway Positioning Component
 * Displays warehouse grid with gateway positions and forklift location
 * Allows dragging gateways to reposition them
 */

import { useState, useEffect, useRef } from 'react';
import apiService, { GatewayData, PositionData } from '@/services/api';

interface DraggingGateway {
  id: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export default function WarehouseLayout() {
  // State
  const [gateways, setGateways] = useState<GatewayData[]>([]);
  const [position, setPosition] = useState<PositionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggingGateway, setDraggingGateway] = useState<DraggingGateway | null>(null);
  const [warehouseSize, setWarehouseSize] = useState({ width: 100, height: 80 });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(2000); // 2 second refresh
  const canvasRef = useRef<HTMLDivElement>(null);

  // Warehouse configuration (meters)
  const WAREHOUSE_WIDTH = 100; // 100 meters
  const WAREHOUSE_HEIGHT = 80; // 80 meters

  // Fetch data
  const fetchData = async () => {
    try {
      setError(null);
      const [gatewaysRes, posRes] = await Promise.all([
        apiService.getGateways().catch(() => ({ count: 0, gateways: [] })),
        apiService.getLatestPosition().catch(() => ({ position: null })),
      ]);

      setGateways(gatewaysRes.gateways || []);
      setPosition(posRes.position);
    } catch (err) {
      console.error('Failed to fetch warehouse data:', err);
      setError('Failed to load warehouse data');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and setup
  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  // Handle gateway drag start
  const handleGatewayDragStart = (
    e: React.MouseEvent<HTMLDivElement>,
    gateway: GatewayData
  ) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    // Convert pixel coordinates to warehouse coordinates
    const warehouseX = (relX / rect.width) * WAREHOUSE_WIDTH;
    const warehouseY = (relY / rect.height) * WAREHOUSE_HEIGHT;

    setDraggingGateway({
      id: gateway.gateway_id,
      startX: gateway.location.x,
      startY: gateway.location.y,
      currentX: warehouseX,
      currentY: warehouseY,
    });
  };

  // Handle drag move
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingGateway || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const relX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const relY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const warehouseX = (relX / rect.width) * WAREHOUSE_WIDTH;
    const warehouseY = (relY / rect.height) * WAREHOUSE_HEIGHT;

    setDraggingGateway({
      ...draggingGateway,
      currentX: Math.max(0, Math.min(warehouseX, WAREHOUSE_WIDTH)),
      currentY: Math.max(0, Math.min(warehouseY, WAREHOUSE_HEIGHT)),
    });
  };

  // Handle drag end
  const handleMouseUp = async () => {
    if (!draggingGateway) return;

    try {
      // Update gateway position in backend
      const gateway = gateways.find((g) => g.gateway_id === draggingGateway.id);
      if (gateway) {
        const updatedGateway = await apiService.updateGateway(
          gateway.gateway_id,
          {
            ...gateway,
            location: {
              x: draggingGateway.currentX,
              y: draggingGateway.currentY,
              z: gateway.location.z,
            },
          }
        );

        setGateways(
          gateways.map((g) =>
            g.gateway_id === updatedGateway.gateway_id ? updatedGateway : g
          )
        );
      }
    } catch (err) {
      console.error('Failed to update gateway position:', err);
      setError('Failed to save gateway position');
    }

    setDraggingGateway(null);
  };

  // Convert warehouse coordinates to pixel coordinates
  const toPixelX = (x: number, containerWidth: number): number =>
    (x / WAREHOUSE_WIDTH) * containerWidth;

  const toPixelY = (y: number, containerHeight: number): number =>
    (y / WAREHOUSE_HEIGHT) * containerHeight;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading warehouse layout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Warehouse Layout</h1>
          <p className="text-gray-300">
            Interactive warehouse map with BLE gateway positioning and forklift tracking
          </p>
        </div>

        {/* Controls */}
        <div className="flex gap-4 mb-6 flex-wrap">
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
            {autoRefresh ? '⏸️ Pause' : '▶️ Resume'} Auto-Refresh
          </button>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg"
          >
            <option value={1000}>1s refresh</option>
            <option value={2000}>2s refresh</option>
            <option value={5000}>5s refresh</option>
            <option value={10000}>10s refresh</option>
          </select>
        </div>

        {error && (
          <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg mb-6 text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Warehouse Canvas */}
          <div className="lg:col-span-2">
            <div className="bg-slate-700 rounded-lg p-6 shadow-lg">
              <h2 className="text-2xl font-bold text-white mb-4">Warehouse Map</h2>

              <div
                ref={canvasRef}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="relative w-full bg-gradient-to-br from-slate-600 to-slate-800 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing"
                style={{ aspectRatio: '16 / 12' }}
              >
                {/* Grid background */}
                <svg
                  className="absolute inset-0 w-full h-full opacity-20"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path
                        d="M 40 0 L 0 0 0 40"
                        fill="none"
                        stroke="white"
                        strokeWidth="0.5"
                      />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>

                {/* Warehouse dimensions text */}
                <div className="absolute bottom-2 right-2 text-slate-400 text-xs pointer-events-none">
                  {WAREHOUSE_WIDTH}m × {WAREHOUSE_HEIGHT}m
                </div>

                {/* Gateways */}
                {canvasRef.current &&
                  gateways.map((gateway) => {
                    const rect = canvasRef.current!.getBoundingClientRect();
                    const pixelX = toPixelX(gateway.location.x, rect.width);
                    const pixelY = toPixelY(gateway.location.y, rect.height);

                    const isDragging =
                      draggingGateway?.id === gateway.gateway_id;

                    return (
                      <div
                        key={gateway.gateway_id}
                        onMouseDown={(e) => handleGatewayDragStart(e, gateway)}
                        className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-move ${
                          isDragging ? 'z-50 scale-125' : 'z-10 hover:scale-110'
                        }`}
                        style={{
                          left: isDragging
                            ? `${(draggingGateway.currentX / WAREHOUSE_WIDTH) * 100}%`
                            : `${(gateway.location.x / WAREHOUSE_WIDTH) * 100}%`,
                          top: isDragging
                            ? `${(draggingGateway.currentY / WAREHOUSE_HEIGHT) * 100}%`
                            : `${(gateway.location.y / WAREHOUSE_HEIGHT) * 100}%`,
                        }}
                        title={`${gateway.name} - (${gateway.location.x.toFixed(1)}, ${gateway.location.y.toFixed(
                          1
                        )})m`}
                      >
                        {/* Gateway circle with signal radius */}
                        <div
                          className="absolute inset-0 rounded-full opacity-20"
                          style={{
                            width: '60px',
                            height: '60px',
                            marginLeft: '-30px',
                            marginTop: '-30px',
                            backgroundColor:
                              gateway.is_active === 'true' ||
                              gateway.is_active === true
                                ? '#3b82f6'
                                : '#6b7280',
                          }}
                        ></div>

                        {/* Gateway marker */}
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold text-white ${
                            gateway.is_active === 'true' ||
                            gateway.is_active === true
                              ? 'bg-blue-500 border-blue-300 shadow-lg shadow-blue-500/50'
                              : 'bg-gray-500 border-gray-300'
                          }`}
                        >
                          📍
                        </div>

                        {/* Label */}
                        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap text-xs text-white bg-slate-900/80 px-2 py-1 rounded pointer-events-none">
                          {gateway.name}
                        </div>
                      </div>
                    );
                  })}

                {/* Forklift Position */}
                {position && canvasRef.current && (
                  <div
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
                    style={{
                      left: `${(position.x / WAREHOUSE_WIDTH) * 100}%`,
                      top: `${(position.y / WAREHOUSE_HEIGHT) * 100}%`,
                    }}
                    title={`Forklift: (${position.x.toFixed(1)}, ${position.y.toFixed(
                      1
                    )})m`}
                  >
                    {/* Position accuracy circle */}
                    <div
                      className="absolute inset-0 rounded-full opacity-30"
                      style={{
                        width: `${Math.max(20, (position.accuracy || 3) * 10)}px`,
                        height: `${Math.max(20, (position.accuracy || 3) * 10)}px`,
                        marginLeft: `${-Math.max(10, (position.accuracy || 3) * 5)}px`,
                        marginTop: `${-Math.max(10, (position.accuracy || 3) * 5)}px`,
                        backgroundColor: '#ef4444',
                      }}
                    ></div>

                    {/* Forklift marker */}
                    <div className="w-8 h-8 rounded-full bg-red-500 border-2 border-red-300 shadow-lg shadow-red-500/50 flex items-center justify-center text-base">
                      🚜
                    </div>

                    {/* Label */}
                    <div className="absolute top-10 left-1/2 transform -translate-x-1/2 whitespace-nowrap text-xs text-white bg-red-900/80 px-2 py-1 rounded pointer-events-none">
                      Forklift
                    </div>
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="mt-4 text-sm text-gray-300 space-y-1">
                <p>💡 <span className="text-blue-300">Blue circles</span> = Active BLE Gateways (draggable)</p>
                <p>🚜 <span className="text-red-300">Red circle</span> = Calculated forklift position</p>
                <p className="text-gray-400">Drag gateways to reposition them and improve trilateration accuracy</p>
              </div>
            </div>
          </div>

          {/* Sidebar - Info */}
          <div className="space-y-4">
            {/* Gateway Status */}
            <div className="bg-slate-700 rounded-lg p-4 shadow-lg">
              <h3 className="text-lg font-bold text-white mb-3">BLE Gateways ({gateways.length})</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {gateways.map((gateway) => (
                  <div
                    key={gateway.gateway_id}
                    className="p-3 bg-slate-600 rounded text-sm text-white"
                  >
                    <div className="font-semibold flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          gateway.is_active === 'true' || gateway.is_active === true
                            ? 'bg-green-500'
                            : 'bg-gray-500'
                        }`}
                      ></span>
                      {gateway.name}
                    </div>
                    <div className="text-xs text-gray-300 mt-1">
                      ID: {gateway.gateway_id}
                    </div>
                    <div className="text-xs text-gray-300">
                      Position: ({gateway.location.x.toFixed(1)}, {gateway.location.y.toFixed(1)})m
                    </div>
                    {gateway.last_seen && (
                      <div className="text-xs text-gray-400 mt-1">
                        Seen: {new Date(gateway.last_seen).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Forklift Position Info */}
            {position && (
              <div className="bg-slate-700 rounded-lg p-4 shadow-lg">
                <h3 className="text-lg font-bold text-white mb-3">Forklift Position</h3>
                <div className="space-y-2 text-sm text-white">
                  <div>
                    <span className="text-gray-400">X:</span> {position.x.toFixed(2)}m
                  </div>
                  <div>
                    <span className="text-gray-400">Y:</span> {position.y.toFixed(2)}m
                  </div>
                  <div>
                    <span className="text-gray-400">Z:</span> {position.z.toFixed(2)}m
                  </div>
                  {position.accuracy && (
                    <div className="text-yellow-300">
                      Accuracy: ±{position.accuracy.toFixed(2)}m
                    </div>
                  )}
                  {position.timestamp && (
                    <div className="text-xs text-gray-400 mt-2">
                      {new Date(position.timestamp).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-slate-700 rounded-lg p-4 shadow-lg">
              <h3 className="text-lg font-bold text-white mb-3">Instructions</h3>
              <ul className="text-xs text-gray-300 space-y-2 list-disc list-inside">
                <li>Drag blue gateways to reposition mobile BLE devices</li>
                <li>Position affects trilateration accuracy</li>
                <li>Position auto-saves when released</li>
                <li>Red circle shows calculated forklift location</li>
                <li>Larger red circle = less accurate estimate</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
