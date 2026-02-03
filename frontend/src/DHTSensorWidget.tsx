/**
 * DHT Sensor Display Component
 * Real-time temperature and humidity from GPIO pin 40
 */

import { useState, useEffect } from 'react';
import { dhtService } from '@/services/api';
import { Thermometer, Droplets, AlertCircle } from 'lucide-react';

interface DHTReading {
  temperature: number;
  humidity: number;
  timestamp: string;
}

export function DHTSensorWidget() {
  const [reading, setReading] = useState<DHTReading | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchDHTData = async () => {
    try {
      setError(null);
      const data = await dhtService.getDHTReading();
      setReading(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read DHT sensor');
      console.error('DHT fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDHTData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchDHTData, 3000); // Update every 3 seconds
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getTempColor = (temp: number) => {
    if (temp < 10) return 'text-blue-400';
    if (temp < 20) return 'text-cyan-400';
    if (temp < 25) return 'text-green-400';
    if (temp < 30) return 'text-yellow-400';
    if (temp < 35) return 'text-orange-400';
    return 'text-red-400';
  };

  const getHumidityColor = (humidity: number) => {
    if (humidity < 30) return 'text-yellow-400';
    if (humidity < 60) return 'text-green-400';
    return 'text-blue-400';
  };

  return (
    <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">📊 Environment (GPIO Pin 40)</h2>
        <button
          onClick={fetchDHTData}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition"
        >
          🔄
        </button>
      </div>

      {error ? (
        <div className="p-4 bg-red-500/20 border border-red-500 rounded text-red-300 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : reading ? (
        <div className="space-y-4">
          {/* Temperature */}
          <div className="bg-slate-600/50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <Thermometer className={`w-6 h-6 ${getTempColor(reading.temperature)}`} />
              <span className="text-gray-300 font-semibold">Temperature</span>
            </div>
            <div className={`text-4xl font-bold ${getTempColor(reading.temperature)}`}>
              {reading.temperature.toFixed(1)}°C
            </div>
            <div className="text-xs text-gray-400 mt-2">
              {reading.temperature < 10 ? '❄️ Cold' :
               reading.temperature < 20 ? '🧊 Cool' :
               reading.temperature < 25 ? '✓ Comfortable' :
               reading.temperature < 30 ? '🌡️ Warm' :
               reading.temperature < 35 ? '🔥 Hot' :
               '⚠️ Very Hot'}
            </div>
          </div>

          {/* Humidity */}
          <div className="bg-slate-600/50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <Droplets className={`w-6 h-6 ${getHumidityColor(reading.humidity)}`} />
              <span className="text-gray-300 font-semibold">Humidity</span>
            </div>
            <div className={`text-4xl font-bold ${getHumidityColor(reading.humidity)}`}>
              {reading.humidity.toFixed(1)}%
            </div>
            <div className="w-full bg-slate-500 rounded-full h-2 mt-2 overflow-hidden">
              <div
                className={`h-full ${
                  reading.humidity < 30 ? 'bg-yellow-400' :
                  reading.humidity < 60 ? 'bg-green-400' :
                  'bg-blue-400'
                }`}
                style={{ width: `${Math.min(reading.humidity, 100)}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              {reading.humidity < 30 ? '🌵 Dry' :
               reading.humidity < 60 ? '✓ Optimal' :
               '💧 Humid'}
            </div>
          </div>

          {/* Timestamp */}
          <div className="text-xs text-gray-500 text-center">
            Last update: {new Date(reading.timestamp).toLocaleTimeString()}
          </div>

          {/* Auto-refresh toggle */}
          <div className="flex items-center justify-center gap-2 text-xs">
            <label className="flex items-center gap-2 text-gray-300">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4"
              />
              Auto-refresh
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default DHTSensorWidget;
