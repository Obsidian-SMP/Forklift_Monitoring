/**
 * DHT Sensor Display Component
 * Real-time temperature and humidity from GPIO pin 40
 */

import { useState, useEffect } from 'react';
import { dhtService } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface DHTReading {
  temperature: number;
  humidity: number;
  timestamp: string;
  status?: string;
  source?: string;
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
      const errorMsg = err instanceof Error ? err.message : 'Failed to read DHT sensor';
      setError(errorMsg);
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

  // Temperature color coding
  const getTempColor = (temp: number) => {
    if (temp < 10) return 'from-blue-500 to-blue-600';
    if (temp < 15) return 'from-cyan-500 to-cyan-600';
    if (temp < 20) return 'from-green-500 to-green-600';
    if (temp < 25) return 'from-yellow-500 to-yellow-600';
    if (temp < 30) return 'from-orange-500 to-orange-600';
    return 'from-red-500 to-red-600';
  };

  const getTempStatus = (temp: number) => {
    if (temp < 10) return { emoji: '❄️', label: 'Cold' };
    if (temp < 15) return { emoji: '🧊', label: 'Cool' };
    if (temp < 20) return { emoji: '✓', label: 'Comfortable' };
    if (temp < 25) return { emoji: '🌡️', label: 'Warm' };
    if (temp < 30) return { emoji: '🔥', label: 'Hot' };
    return { emoji: '⚠️', label: 'Very Hot' };
  };

  // Humidity color coding
  const getHumidityColor = (humidity: number) => {
    if (humidity < 30) return 'from-yellow-500 to-yellow-600';
    if (humidity < 70) return 'from-green-500 to-green-600';
    return 'from-blue-500 to-blue-600';
  };

  const getHumidityStatus = (humidity: number) => {
    if (humidity < 30) return { emoji: '🌵', label: 'Dry' };
    if (humidity < 70) return { emoji: '✓', label: 'Optimal' };
    return { emoji: '💧', label: 'Humid' };
  };

  if (loading && !reading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg">🌡️ Environment Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-red-300">
        <CardHeader>
          <CardTitle className="text-lg text-red-600 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Environment Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-600">Error: {error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
      {/* Sensor Not Detected Warning Banner */}
      {reading?.status === 'unavailable' && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-400 text-sm mb-1">
                ⚠️ DHT Sensor Not Detected
              </h3>
              <p className="text-amber-300/70 text-xs leading-relaxed">
                Hardware sensor not found on GPIO pin 21 (physical pin 40). 
                <br />
                The system is displaying simulated values for testing purposes.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-cyan-300 font-semibold">🌡️ Environment (GPIO Pin 40)</CardTitle>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              autoRefresh ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'
            }`}
          >
            {autoRefresh ? '🔄 Live' : '⏸ Paused'}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {reading && (
          <>
            {/* Temperature Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-300">Temperature</span>
                  <span className="text-2xl">{getTempStatus(reading.temperature).emoji}</span>
                </div>
                <span className="text-xs text-gray-400">{getTempStatus(reading.temperature).label}</span>
              </div>
              
              {/* Temperature Value */}
              <div className={`bg-gradient-to-r ${getTempColor(reading.temperature)} rounded-lg p-4`}>
                <div className="text-white">
                  <div className="text-4xl font-bold">{reading.temperature.toFixed(1)}°C</div>
                </div>
              </div>
              
              {/* Temperature Progress Bar */}
              <div className="space-y-1">
                <div className="relative h-4 bg-slate-700 rounded-full overflow-hidden">
                  {/* Safe zone (15-25°C) */}
                  <div className="absolute h-full bg-green-500/30" style={{ left: '30%', width: '40%' }} />
                  {/* Warning zones */}
                  <div className="absolute h-full bg-yellow-500/30" style={{ left: '10%', width: '20%' }} />
                  <div className="absolute h-full bg-yellow-500/30" style={{ left: '70%', width: '20%' }} />
                  {/* Danger zones */}
                  <div className="absolute h-full bg-red-500/30" style={{ left: '0%', width: '10%' }} />
                  <div className="absolute h-full bg-red-500/30" style={{ right: '0%', width: '10%' }} />
                  
                  {/* Current temperature indicator */}
                  <div
                    className={`absolute h-full w-1 bg-gradient-to-r ${getTempColor(reading.temperature)} rounded transition-all duration-300`}
                    style={{ left: `${Math.min(Math.max((reading.temperature / 40) * 100, 0), 100)}%`, transform: 'translateX(-50%)' }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0°C</span>
                  <span>15°C</span>
                  <span>25°C</span>
                  <span>40°C</span>
                </div>
              </div>
            </div>

            {/* Humidity Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-300">Humidity</span>
                  <span className="text-2xl">{getHumidityStatus(reading.humidity).emoji}</span>
                </div>
                <span className="text-xs text-gray-400">{getHumidityStatus(reading.humidity).label}</span>
              </div>
              
              {/* Humidity Value */}
              <div className={`bg-gradient-to-r ${getHumidityColor(reading.humidity)} rounded-lg p-4`}>
                <div className="text-white">
                  <div className="text-4xl font-bold">{reading.humidity.toFixed(1)}%</div>
                </div>
              </div>
              
              {/* Humidity Progress Bar */}
              <div className="space-y-1">
                <div className="relative h-4 bg-slate-700 rounded-full overflow-hidden">
                  {/* Safe zone (30-70%) */}
                  <div className="absolute h-full bg-green-500/30" style={{ left: '30%', width: '40%' }} />
                  {/* Warning zones */}
                  <div className="absolute h-full bg-yellow-500/30" style={{ left: '20%', width: '10%' }} />
                  <div className="absolute h-full bg-yellow-500/30" style={{ left: '70%', width: '10%' }} />
                  {/* Danger zones */}
                  <div className="absolute h-full bg-red-500/30" style={{ left: '0%', width: '20%' }} />
                  <div className="absolute h-full bg-red-500/30" style={{ right: '0%', width: '20%' }} />
                  
                  {/* Current humidity indicator */}
                  <div
                    className={`absolute h-full w-1 bg-gradient-to-r ${getHumidityColor(reading.humidity)} rounded transition-all duration-300`}
                    style={{ left: `${reading.humidity}%`, transform: 'translateX(-50%)' }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0%</span>
                  <span>30%</span>
                  <span>70%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* Status Footer */}
            <div className="pt-4 border-t border-slate-700">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Last updated: {new Date(reading.timestamp.endsWith('Z') ? reading.timestamp : reading.timestamp + 'Z').toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })} IST</span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  Connected
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
