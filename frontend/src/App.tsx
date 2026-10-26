// ==============================================================================
// File: src/App.tsx
// Description: Main Warehouse IoT Dashboard Application Shell.
// Purpose: Orchestrates real-time WebSocket state subscriptions, manages global
//          views (Map, Vision, Inventory, Live Logs), and coordinates safety modals.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { WarehouseCanvas } from './components/WarehouseCanvas';
import { LiveCameraFeed } from './components/LiveCameraFeed';
import { ForkliftTelemetryCard } from './components/ForkliftTelemetryCard';
import { VibrationGauge } from './components/VibrationGauge';
import { EnvironmentalWidget } from './components/EnvironmentalWidget';
import { InventoryLedger } from './components/InventoryLedger';
import { LiveLogViewer } from './components/LiveLogViewer';
import { ZoneEditorModal } from './components/ZoneEditorModal';
import { SafetyAlertsDrawer } from './components/SafetyAlertsDrawer';

import {
  ForkliftPosition,
  WarehouseZone,
  GatewayNode,
  SafetyAlert,
  EnvironmentalData,
  ZonePoint,
} from './types';
import { api } from './services/api';
import { socketService } from './services/socket';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'map' | 'vision' | 'inventory' | 'logs'>('map');
  const [isConnected, setIsConnected] = useState(false);

  // Core Real-Time Telemetry State
  const [forkliftPos, setForkliftPos] = useState<ForkliftPosition | null>({
    forklift_id: 'forklift_1',
    x: 2.5,
    y: 2.5,
    speed_mps: 0.0,
    confidence: 90,
    status: 'idle',
  });
  const [zones, setZones] = useState<WarehouseZone[]>([]);
  const [gateways, setGateways] = useState<GatewayNode[]>([]);
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [envData, setEnvData] = useState<EnvironmentalData | null>(null);

  // Modals & Drawers
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [draftZonePoints, setDraftZonePoints] = useState<ZonePoint[]>([]);

  // Initial Data Bootstrap
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [zonesRes, gwsRes, alertsRes] = await Promise.all([
          api.getZones(),
          api.getGateways(),
          api.getAlerts(false, 50),
        ]);
        setZones(zonesRes);
        setGateways(gwsRes);
        setAlerts(alertsRes);
      } catch (err) {
        console.error('Initial data bootstrap failed:', err);
      }
    };
    bootstrap();
  }, []);

  // Connect WebSocket & Register Event Streams
  useEffect(() => {
    const socket = socketService.connect();

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // 1. Live 5 Hz Kinematic Coordinates
    const unsubPos = socketService.onForkliftPosition((pos) => {
      setForkliftPos(pos);
    });

    // 2. Real-Time Safety Incident Alerts
    const unsubAlert = socketService.onSafetyAlert((alert) => {
      setAlerts((prev) => [alert, ...prev]);
    });

    // 3. Environmental Readings
    const unsubEnv = socketService.onSensorTelemetry((data) => {
      setEnvData(data);
    });

    // 4. M/N-K Vision State Machine Load & Unload Events
    const unsubLoad = socketService.onLoadDetected((data) => {
      console.log('LOAD DETECTED by Vision Worker:', data);
      if (data?.sku) {
        setForkliftPos((prev) => (prev ? { ...prev, status: 'carrying', loaded_sku: data.sku } : null));
      }
    });

    const unsubUnload = socketService.onUnloadDetected((data) => {
      console.log('UNLOAD DETECTED by Vision Worker:', data);
      setForkliftPos((prev) => (prev ? { ...prev, status: 'idle', loaded_sku: null } : null));
    });

    return () => {
      unsubPos();
      unsubAlert();
      unsubEnv();
      unsubLoad();
      unsubUnload();
      socketService.disconnect();
    };
  }, []);

  const handleOpenCreateZoneModal = (points: ZonePoint[]) => {
    setDraftZonePoints(points);
    setIsZoneModalOpen(true);
  };

  const handleZoneCreated = (newZone: WarehouseZone) => {
    setZones((prev) => [...prev, newZone]);
  };

  const handleAlertAcknowledged = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.alert_id === alertId ? { ...a, is_acknowledged: true } : a))
    );
  };

  const unackAlertsCount = alerts.filter((a) => !a.is_acknowledged).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f19] text-gray-100">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isConnected={isConnected}
        forkliftPos={forkliftPos}
        unackAlertsCount={unackAlertsCount}
        onOpenAlerts={() => setIsAlertsOpen(true)}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        {activeTab === 'map' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 2D Spatial Canvas (Left 2 Columns) */}
            <div className="lg:col-span-2">
              <WarehouseCanvas
                forkliftPos={forkliftPos}
                zones={zones}
                gateways={gateways}
                onOpenCreateZoneModal={handleOpenCreateZoneModal}
                warehouseWidthMeters={10.0}
                warehouseHeightMeters={10.0}
              />
            </div>

            {/* Right Telemetry Column */}
            <div className="flex flex-col gap-4">
              <ForkliftTelemetryCard
                forkliftPos={forkliftPos}
                onStatusChanged={(s) =>
                  setForkliftPos((prev) => (prev ? { ...prev, status: s } : null))
                }
              />
              <VibrationGauge
                ax={0.04}
                ay={0.02}
                az={0.99}
                magnitude={0.99}
                threshold={5.0}
              />
              <EnvironmentalWidget data={envData} />
            </div>
          </div>
        )}

        {activeTab === 'vision' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LiveCameraFeed
              loadedSku={forkliftPos?.loaded_sku}
              forkliftStatus={forkliftPos?.status}
            />

            <div className="flex flex-col gap-4">
              <ForkliftTelemetryCard
                forkliftPos={forkliftPos}
                onStatusChanged={(s) =>
                  setForkliftPos((prev) => (prev ? { ...prev, status: s } : null))
                }
              />
              <div className="glass-panel rounded-2xl p-5 border border-gray-800">
                <h3 className="font-['Outfit'] font-bold text-sm text-white mb-2">
                  Paper 5: M/N-K Decision State Machine
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed mb-3">
                  Eliminates duplicate SKU storms by tracking a sliding window of N=5 observation cycles.
                  Requires M=3 detections to verify LOAD, and K=5 consecutive disappearances to verify UNLOAD.
                </p>
                <div className="grid grid-cols-3 gap-2 font-mono text-xs text-center">
                  <div className="bg-gray-900 p-2.5 rounded-xl border border-gray-800">
                    <span className="text-[10px] text-gray-500 block">WINDOW N</span>
                    <span className="text-blue-400 font-bold">5 Frames</span>
                  </div>
                  <div className="bg-gray-900 p-2.5 rounded-xl border border-gray-800">
                    <span className="text-[10px] text-gray-500 block">THRESHOLD M</span>
                    <span className="text-emerald-400 font-bold">3 Hits</span>
                  </div>
                  <div className="bg-gray-900 p-2.5 rounded-xl border border-gray-800">
                    <span className="text-[10px] text-gray-500 block">DISAPPEAR K</span>
                    <span className="text-rose-400 font-bold">5 Misses</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && <InventoryLedger />}

        {activeTab === 'logs' && <LiveLogViewer />}
      </main>

      {/* Slide-over & Dialog Modals */}
      <ZoneEditorModal
        isOpen={isZoneModalOpen}
        points={draftZonePoints}
        onClose={() => setIsZoneModalOpen(false)}
        onZoneCreated={handleZoneCreated}
      />

      <SafetyAlertsDrawer
        isOpen={isAlertsOpen}
        alerts={alerts}
        onClose={() => setIsAlertsOpen(false)}
        onAlertAcknowledged={handleAlertAcknowledged}
      />
    </div>
  );
};

export default App;
