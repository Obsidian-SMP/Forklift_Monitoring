// ==============================================================================
// File: src/components/Navbar.tsx
// Description: Global Top Navigation Header & Live System Status Bar.
// Purpose: Displays warehouse logo, active telemetry WebSocket heartbeat,
//          forklift battery gauge, unacknowledged safety alerts indicator,
//          and switches between primary operational views.
// ==============================================================================

import React from 'react';
import {
  Activity,
  AlertTriangle,
  Radio,
  Cpu,
  Layers,
  Video,
  Package,
  Terminal,
  Battery,
} from 'lucide-react';
import { ForkliftPosition } from '../types';

interface NavbarProps {
  activeTab: 'map' | 'vision' | 'inventory' | 'logs';
  setActiveTab: (tab: 'map' | 'vision' | 'inventory' | 'logs') => void;
  isConnected: boolean;
  forkliftPos: ForkliftPosition | null;
  unackAlertsCount: number;
  onOpenAlerts: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isConnected,
  forkliftPos,
  unackAlertsCount,
  onOpenAlerts,
}) => {
  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-gray-800 bg-[#0b0f19]/90 backdrop-blur-md px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand & System Status */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/10">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-['Outfit'] font-bold text-lg tracking-wide text-white">
                APOLLO WMS
              </h1>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold">
                v2.0 REVISED
              </span>
            </div>
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
              {isConnected ? 'Real-Time Telemetry Online' : 'WebSocket Disconnected'}
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <nav className="flex items-center bg-gray-900/80 p-1 rounded-xl border border-gray-800">
          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'map'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Warehouse Map
          </button>

          <button
            onClick={() => setActiveTab('vision')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'vision'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            <Video className="h-3.5 w-3.5" />
            Vision & Camera
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'inventory'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            Inventory & Audits
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'logs'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            System Logs
          </button>
        </nav>

        {/* Live Quick Metrics & Alerts Button */}
        <div className="flex items-center gap-3">
          {forkliftPos && (
            <div className="hidden lg:flex items-center gap-3 bg-gray-900/60 border border-gray-800 px-3 py-1.5 rounded-lg text-xs">
              <div className="flex items-center gap-1.5 text-gray-300">
                <Radio className="h-3.5 w-3.5 text-blue-400" />
                <span className="font-mono text-gray-400">POS:</span>
                <span className="font-mono font-medium text-white">
                  ({forkliftPos.x.toFixed(1)}m, {forkliftPos.y.toFixed(1)}m)
                </span>
              </div>
              <div className="h-3 w-[1px] bg-gray-700" />
              <div className="flex items-center gap-1 text-emerald-400 font-mono">
                <Battery className="h-3.5 w-3.5" />
                <span>96%</span>
              </div>
            </div>
          )}

          <button
            onClick={onOpenAlerts}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              unackAlertsCount > 0
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 animate-pulse'
                : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700/50'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            <span>Alerts</span>
            {unackAlertsCount > 0 && (
              <span className="h-5 min-w-[20px] px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center">
                {unackAlertsCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
