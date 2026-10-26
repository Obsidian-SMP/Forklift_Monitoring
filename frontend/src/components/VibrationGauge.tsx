// ==============================================================================
// File: src/components/VibrationGauge.tsx
// Description: LSM6DS3 IMU 3-Axis Acceleration & Impact Monitor Component.
// Purpose: Displays real-time vibration metrics, calculates 3D magnitude |a|,
//          shows Zero-Velocity Detection (ZUPT) status, and alarms on severe impacts (>5g).
// ==============================================================================

import React from 'react';
import { Activity, Zap, ShieldAlert, CheckCircle } from 'lucide-react';

interface VibrationGaugeProps {
  ax?: number;
  ay?: number;
  az?: number;
  magnitude?: number;
  threshold?: number;
}

export const VibrationGauge: React.FC<VibrationGaugeProps> = ({
  ax = 0.04,
  ay = 0.02,
  az = 0.99,
  magnitude = 0.99,
  threshold = 5.0,
}) => {
  const isImpact = magnitude >= threshold;
  const isStationary = Math.hypot(ax, ay) < 0.08;

  // Percentage of threshold gauge
  const gaugePercent = Math.min(100, Math.round((magnitude / threshold) * 100));

  return (
    <div className={`glass-panel rounded-2xl p-4 border transition-all ${
      isImpact ? 'border-rose-500 bg-rose-500/10 animate-pulse' : 'border-gray-800'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-['Outfit'] font-bold text-sm text-white flex items-center gap-2">
              LSM6DS3 IMU Vibration
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400">
                100ms BLE STREAM
              </span>
            </h3>
            <p className="text-xs text-gray-400">
              Chassis Shock & Collision Sensing
            </p>
          </div>
        </div>

        {/* State Badge */}
        <div>
          {isImpact ? (
            <span className="flex items-center gap-1 text-xs font-bold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/40">
              <ShieldAlert className="h-3 w-3" />
              IMPACT SPIKE!
            </span>
          ) : isStationary ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <CheckCircle className="h-3 w-3" />
              Stationary (ZUPT Active)
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
              <Zap className="h-3 w-3" />
              Moving / Vibration
            </span>
          )}
        </div>
      </div>

      {/* Magnitude Gauge */}
      <div className="my-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-400">Total Acceleration Magnitude |a|</span>
          <span className="font-mono font-bold text-base text-white">
            {magnitude.toFixed(2)} <span className="text-xs font-normal text-gray-400">g</span>
            <span className="text-xs text-gray-500 font-normal ml-1">/ Limit {threshold.toFixed(1)}g</span>
          </span>
        </div>
        <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden border border-gray-800">
          <div
            className={`h-2 rounded-full transition-all duration-150 ${
              isImpact
                ? 'bg-rose-500'
                : magnitude > threshold * 0.7
                ? 'bg-amber-500'
                : 'bg-blue-500'
            }`}
            style={{ width: `${gaugePercent}%` }}
          />
        </div>
      </div>

      {/* 3-Axis Detail */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-gray-900/60 p-2 rounded-xl border border-gray-800">
          <span className="text-gray-400 block text-[10px]">Ax (Lateral)</span>
          <span className="font-mono font-semibold text-white">{ax > 0 ? `+${ax.toFixed(2)}` : ax.toFixed(2)}g</span>
        </div>
        <div className="bg-gray-900/60 p-2 rounded-xl border border-gray-800">
          <span className="text-gray-400 block text-[10px]">Ay (Forward)</span>
          <span className="font-mono font-semibold text-white">{ay > 0 ? `+${ay.toFixed(2)}` : ay.toFixed(2)}g</span>
        </div>
        <div className="bg-gray-900/60 p-2 rounded-xl border border-gray-800">
          <span className="text-gray-400 block text-[10px]">Az (Vertical)</span>
          <span className="font-mono font-semibold text-white">{az > 0 ? `+${az.toFixed(2)}` : az.toFixed(2)}g</span>
        </div>
      </div>
    </div>
  );
};
