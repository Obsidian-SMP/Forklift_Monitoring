// ==============================================================================
// File: src/components/EnvironmentalWidget.tsx
// Description: Ambient Climate & Warehouse Environment Telemetry Widget.
// Purpose: Visualizes temperature and relative humidity metrics pushed from the
//          Raspberry Pi DHT11 daemon, highlighting safe operating ranges.
// ==============================================================================

import React from 'react';
import { Thermometer, Droplets, ShieldCheck, AlertCircle } from 'lucide-react';
import { EnvironmentalData } from '../types';

interface EnvironmentalWidgetProps {
  data: EnvironmentalData | null;
}

export const EnvironmentalWidget: React.FC<EnvironmentalWidgetProps> = ({ data }) => {
  const temp = data?.temperature ?? 24.2;
  const humidity = data?.humidity ?? 52.0;

  const isTempSafe = temp >= 15.0 && temp <= 32.0;
  const isHumSafe = humidity >= 25.0 && humidity <= 75.0;
  const isAllSafe = isTempSafe && isHumSafe;

  return (
    <div className="glass-panel rounded-2xl p-4 border border-gray-800 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Thermometer className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-['Outfit'] font-bold text-sm text-white flex items-center gap-2">
              Environmental Telemetry
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400">
                RPi DHT11
              </span>
            </h3>
            <p className="text-xs text-gray-400">
              Sensor Node: <span className="font-mono text-gray-300">{data?.sensor_id || 'rpi_warehouse_main'}</span>
            </p>
          </div>
        </div>

        <div>
          {isAllSafe ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <ShieldCheck className="h-3 w-3" />
              Optimal
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              <AlertCircle className="h-3 w-3" />
              Excursion
            </span>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 my-3">
        {/* Temperature */}
        <div className="bg-gray-900/60 p-3 rounded-xl border border-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="flex items-center gap-1">
              <Thermometer className="h-3.5 w-3.5 text-amber-400" />
              Temperature
            </span>
            <span className="text-[10px] text-gray-500">15 - 32°C</span>
          </div>
          <div className="text-xl font-mono font-bold text-white tracking-wide">
            {temp.toFixed(1)} <span className="text-xs font-normal text-gray-400">°C</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-1.5 rounded-full ${isTempSafe ? 'bg-amber-400' : 'bg-rose-500'}`}
              style={{ width: `${Math.min(100, Math.max(10, (temp / 45) * 100))}%` }}
            />
          </div>
        </div>

        {/* Humidity */}
        <div className="bg-gray-900/60 p-3 rounded-xl border border-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="flex items-center gap-1">
              <Droplets className="h-3.5 w-3.5 text-blue-400" />
              Humidity
            </span>
            <span className="text-[10px] text-gray-500">25 - 75%</span>
          </div>
          <div className="text-xl font-mono font-bold text-white tracking-wide">
            {humidity.toFixed(1)} <span className="text-xs font-normal text-gray-400">%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-1.5 rounded-full ${isHumSafe ? 'bg-blue-400' : 'bg-rose-500'}`}
              style={{ width: `${Math.min(100, Math.max(10, humidity))}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
