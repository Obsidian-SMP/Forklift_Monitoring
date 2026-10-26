// ==============================================================================
// File: src/components/ForkliftTelemetryCard.tsx
// Description: Primary Forklift Asset Status & Kinematics Telemetry Card.
// Purpose: Displays real-time 2D spatial coordinates, vehicle velocity, driver
//          assignment, battery charge gauge, and allows manual state transitions.
// ==============================================================================

import React, { useState } from 'react';
import { Truck, Gauge, Navigation, BatteryCharging, User, Wrench } from 'lucide-react';
import { ForkliftPosition } from '../types';
import { api } from '../services/api';

interface ForkliftTelemetryCardProps {
  forkliftPos: ForkliftPosition | null;
  onStatusChanged?: (newStatus: string) => void;
}

export const ForkliftTelemetryCard: React.FC<ForkliftTelemetryCardProps> = ({
  forkliftPos,
  onStatusChanged,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const currentStatus = forkliftPos?.status || 'idle';
  const speedMps = forkliftPos?.speed_mps || 0.0;
  const speedKmh = speedMps * 3.6;

  const handleToggleMaintenance = async () => {
    const nextStatus = currentStatus === 'maintenance' ? 'idle' : 'maintenance';
    setIsUpdating(true);
    try {
      await api.updateForkliftStatus('forklift_1', nextStatus, forkliftPos?.loaded_sku);
      if (onStatusChanged) onStatusChanged(nextStatus);
    } catch (e) {
      console.error('Failed to change status:', e);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-4 border border-gray-800 flex flex-col justify-between shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-['Outfit'] font-bold text-sm text-white">
              Warehouse Forklift #1
            </h3>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <User className="h-3 w-3 text-gray-500" />
              Driver: <span className="text-gray-300">Sam (Lead Operator)</span>
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize flex items-center gap-1.5 ${
              currentStatus === 'carrying'
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                : currentStatus === 'maintenance'
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                currentStatus === 'carrying'
                  ? 'bg-amber-400'
                  : currentStatus === 'maintenance'
                  ? 'bg-rose-400'
                  : 'bg-emerald-400'
              }`}
            />
            {currentStatus}
          </span>
        </div>
      </div>

      {/* Primary Kinematics Grid */}
      <div className="grid grid-cols-2 gap-3 my-3">
        {/* Coordinates */}
        <div className="bg-gray-900/60 p-3 rounded-xl border border-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="flex items-center gap-1">
              <Navigation className="h-3.5 w-3.5 text-blue-400" />
              Coordinates
            </span>
            <span className="text-[10px] font-mono text-gray-500">EKF Fused</span>
          </div>
          <div className="text-lg font-mono font-bold text-white tracking-wide">
            {forkliftPos ? `${forkliftPos.x.toFixed(2)}m, ${forkliftPos.y.toFixed(2)}m` : '-- , --'}
          </div>
          <span className="text-[10px] text-gray-500">
            Conf: {forkliftPos?.confidence?.toFixed(0) || 85}% • Anchors: {forkliftPos?.gateway_count || 4}
          </span>
        </div>

        {/* Speed */}
        <div className="bg-gray-900/60 p-3 rounded-xl border border-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="flex items-center gap-1">
              <Gauge className="h-3.5 w-3.5 text-blue-400" />
              Velocity
            </span>
            <span className="text-[10px] font-mono text-gray-500">Max 4.0 m/s</span>
          </div>
          <div className="text-lg font-mono font-bold text-white tracking-wide">
            {speedMps.toFixed(1)} <span className="text-xs font-normal text-gray-400">m/s</span>
          </div>
          <span className="text-[10px] text-gray-500">
            {speedKmh.toFixed(1)} km/h • {speedMps > 3.5 ? '⚠️ High Speed' : 'Normal'}
          </span>
        </div>
      </div>

      {/* Battery & Maintenance Action */}
      <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-400 flex items-center gap-1">
              <BatteryCharging className="h-3.5 w-3.5 text-emerald-400" />
              Crown 48V Battery
            </span>
            <span className="font-mono font-bold text-emerald-400">96%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '96%' }} />
          </div>
        </div>

        <button
          onClick={handleToggleMaintenance}
          disabled={isUpdating}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium border border-gray-700 transition-colors disabled:opacity-50"
        >
          <Wrench className="h-3 w-3" />
          {currentStatus === 'maintenance' ? 'Clear Tag' : 'Set Maint.'}
        </button>
      </div>
    </div>
  );
};
