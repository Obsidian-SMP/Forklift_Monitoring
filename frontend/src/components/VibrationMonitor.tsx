import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Activity, TrendingUp, Clock } from 'lucide-react';

interface VibrationData {
  id: number;
  forklift_id: string;
  accel_x: number;
  accel_y: number;
  accel_z: number;
  magnitude: number;
  is_anomaly: boolean;
  timestamp: string;
}

interface VibrationMonitorProps {
  forkliftId: string;
}

export function VibrationMonitor({ forkliftId }: VibrationMonitorProps) {
  const [currentData, setCurrentData] = useState<VibrationData | null>(null);
  const [anomalies, setAnomalies] = useState<VibrationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = 'http://10.136.57.165:5000/api';

  useEffect(() => {
    fetchVibrationData();
    const interval = setInterval(fetchVibrationData, 2000); // Update every 2 seconds
    return () => clearInterval(interval);
  }, [forkliftId]);

  const fetchVibrationData = async () => {
    try {
      setError(null);
      
      // Fetch current vibration data
      const currentRes = await fetch(`${API_BASE}/forklift/${forkliftId}/vibration/current`);
      if (currentRes.ok) {
        const data = await currentRes.json();
        setCurrentData(data);
      }
      
      // Fetch anomalies from last 24 hours
      const anomaliesRes = await fetch(`${API_BASE}/forklift/${forkliftId}/vibration/anomalies?hours=24`);
      if (anomaliesRes.ok) {
        const data = await anomaliesRes.json();
        setAnomalies(data.anomalies || []);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching vibration data:', err);
      setError('Failed to load vibration data');
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
    return date.toLocaleTimeString();
  };

  const getVibrationLevel = (magnitude: number): { level: string; color: string; bgColor: string } => {
    if (magnitude > 5.0) return { level: 'Critical', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500/10 border-red-500/30' };
    if (magnitude > 3.0) return { level: 'High', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-500/10 border-orange-500/30' };
    if (magnitude > 1.5) return { level: 'Moderate', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-500/10 border-yellow-500/30' };
    return { level: 'Normal', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-500/10 border-green-500/30' };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Loading vibration data...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!currentData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Vibration Monitor
          </CardTitle>
          <CardDescription>Real-time accelerometer data from forklift</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No vibration data available. Check if vibration sensor is connected.
          </div>
        </CardContent>
      </Card>
    );
  }

  const vibLevel = getVibrationLevel(currentData.magnitude);

  return (
    <div className="space-y-4">
      {/* Current Vibration Status */}
      <Card className={`border-2 ${vibLevel.bgColor}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Vibration Monitor
            </CardTitle>
            <Badge variant={currentData.is_anomaly ? 'destructive' : 'secondary'}>
              {currentData.is_anomaly ? 'ANOMALY' : 'NORMAL'}
            </Badge>
          </div>
          <CardDescription>Real-time accelerometer data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Magnitude Display */}
          <div className="text-center">
            <div className={`text-5xl font-bold ${vibLevel.color}`}>
              {currentData.magnitude.toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">g-force magnitude</div>
            <Badge variant="outline" className="mt-2">
              {vibLevel.level}
            </Badge>
          </div>

          {/* Individual Axes */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">X-Axis</div>
              <div className="text-xl font-semibold text-foreground">
                {currentData.accel_x.toFixed(3)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">Y-Axis</div>
              <div className="text-xl font-semibold text-foreground">
                {currentData.accel_y.toFixed(3)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-1">Z-Axis</div>
              <div className="text-xl font-semibold text-foreground">
                {currentData.accel_z.toFixed(3)}
              </div>
            </div>
          </div>

          {/* Timestamp */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
            <Clock className="h-3 w-3" />
            <span>Updated {formatTimestamp(currentData.timestamp)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Anomalies List */}
      {anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Recent Anomalies ({anomalies.length})
            </CardTitle>
            <CardDescription>Vibration events exceeding threshold (last 24h)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {anomalies.slice(0, 5).map((anomaly) => (
                <div
                  key={anomaly.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-orange-500/5 border border-orange-500/20"
                >
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <div>
                      <div className="font-semibold text-foreground">
                        {anomaly.magnitude.toFixed(2)} g
                      </div>
                      <div className="text-xs text-muted-foreground">
                        X: {anomaly.accel_x.toFixed(2)}, Y: {anomaly.accel_y.toFixed(2)}, Z: {anomaly.accel_z.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatTimestamp(anomaly.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Normal:</strong> &lt; 1.5g - Smooth operation
            </p>
            <p>
              <strong>Moderate:</strong> 1.5-3.0g - Typical warehouse movement
            </p>
            <p>
              <strong>High:</strong> 3.0-5.0g - Rough handling or uneven terrain
            </p>
            <p>
              <strong>Critical:</strong> &gt; 5.0g - Potential damage or unsafe operation
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
