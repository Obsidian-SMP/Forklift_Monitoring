import { useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wifi } from 'lucide-react';

// Convert UTC timestamp to Indian Standard Time (IST - UTC+5:30)
function convertToIST(timestamp: string | number | Date): string {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return 'Invalid Time';
    }
    // Add 5:30 hours for IST
    const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
    return istDate.toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch (e) {
    return 'Invalid Time';
  }
}

interface GatewaySignalData {
  [forkliftId: string]: {
    [gatewayId: string]: {
      latestRssi: number;
      lastSeen: string;
      timestamp: number;
    };
  };
}

interface GatewaySignalComponentProps {
  rssiHistory: any[];
  gateways: any[];
  timeWindow?: number; // Time window in milliseconds (default: 60000 = 1 minute)
}

export function GatewaySignalComponent({
  rssiHistory,
  gateways,
  timeWindow = 60000,
}: GatewaySignalComponentProps) {
  // Process RSSI history to organize by forklift and gateway
  const signalData = useMemo(() => {
    const now = Date.now();
    const data: GatewaySignalData = {};

    // Group readings by forklift and gateway
    rssiHistory.forEach((reading) => {
      // Parse timestamp - handle both ISO strings and milliseconds
      let timestamp = 0;
      if (typeof reading.timestamp === 'number') {
        timestamp = reading.timestamp;
      } else if (typeof reading.timestamp === 'string') {
        // Try to parse as ISO string first, then as milliseconds
        const parsed = new Date(reading.timestamp).getTime();
        timestamp = isNaN(parsed) ? parseInt(reading.timestamp) : parsed;
      }

      // Validate timestamp
      if (isNaN(timestamp) || timestamp === 0) {
        console.warn('Invalid timestamp:', reading.timestamp);
        return; // Skip invalid timestamps
      }

      const timeDiff = now - timestamp;
      const isRecent = timeDiff <= timeWindow;

      console.log(`RSSI: ${reading.forklift_id} @ ${reading.gateway_id} | Timestamp: ${timestamp} | Now: ${now} | Diff: ${timeDiff}ms | Recent: ${isRecent}`);

      if (isRecent) {
        if (!data[reading.forklift_id]) {
          data[reading.forklift_id] = {};
        }

        // Keep only the latest RSSI for each gateway per forklift
        if (
          !data[reading.forklift_id][reading.gateway_id] ||
          timestamp > data[reading.forklift_id][reading.gateway_id].timestamp
        ) {
          data[reading.forklift_id][reading.gateway_id] = {
            latestRssi: reading.rssi,
            lastSeen: reading.timestamp,
            timestamp: timestamp,
          };
        }
      }
    });

    console.log('Final signalData:', data);
    return data;
  }, [rssiHistory, timeWindow]);

  // Get signal strength indicator
  const getSignalStatus = (rssi: number) => {
    if (rssi > -50) {
      return { color: 'bg-green-600', label: 'Excellent', textColor: 'text-green-600' };
    }
    if (rssi > -70) {
      return { color: 'bg-blue-600', label: 'Good', textColor: 'text-blue-600' };
    }
    if (rssi > -85) {
      return { color: 'bg-yellow-600', label: 'Fair', textColor: 'text-yellow-600' };
    }
    if (rssi > -100) {
      return { color: 'bg-orange-600', label: 'Weak', textColor: 'text-orange-600' };
    }
    return { color: 'bg-red-600', label: 'Very Weak', textColor: 'text-red-600' };
  };

  const gatewayNames = useMemo(() => {
    return Object.fromEntries(gateways.map((g) => [g.gateway_id, g.name]));
  }, [gateways]);

  // Sort forklifts for consistent display
  const sortedForklifts = useMemo(() => {
    return Object.keys(signalData).sort();
  }, [signalData]);

  if (sortedForklifts.length === 0) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Gateway Signals (Last Minute)
          </CardTitle>
          <CardDescription>Gateways and their active signal connections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Wifi className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-base font-medium">No active signals from gateways in the last minute</p>
            <p className="text-sm mt-2">Make sure gateways are powered and within range</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Gateway Signals (Last Minute)
        </CardTitle>
        <CardDescription>
          {sortedForklifts.length} forklift(s) with {Object.values(signalData).reduce((acc, gateways) => acc + Object.keys(gateways).length, 0)} active signal(s)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {sortedForklifts.map((forkliftId) => {
            const gateways = signalData[forkliftId];
            const gatewayCount = Object.keys(gateways).length;

            return (
              <div key={forkliftId} className="border rounded-lg p-4 bg-muted/30">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Forklift Info Card */}
                  <div className="bg-card border rounded-md p-4 space-y-3 bg-gradient-to-br from-amber-950 to-orange-900">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">
                        🚜 Forklift ID
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xl font-bold text-amber-200 break-words">
                        {forkliftId}
                      </div>
                      <Badge className="bg-amber-600 text-white border-amber-500">
                        {gatewayCount} signal(s)
                      </Badge>
                    </div>
                  </div>
                  {Object.entries(gateways).map(
                    ([gatewayId, data]: [string, any]) => {
                      const status = getSignalStatus(data.latestRssi);
                      const lastSeen = convertToIST(data.lastSeen);

                      return (
                        <div
                          key={gatewayId}
                          className="bg-card border rounded-md p-4 space-y-3 hover:shadow-md transition"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">
                              📡 {gatewayNames[gatewayId] || gatewayId}
                            </span>
                            <Badge variant="outline" className={`${status.textColor} border-current`}>
                              {status.label}
                            </Badge>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">
                                Latest RSSI
                              </span>
                              <span className="font-semibold text-sm">
                                {data.latestRssi} dBm
                              </span>
                            </div>

                            {/* Signal strength bar */}
                            <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                              <div
                                className={`h-full ${status.color} transition-all duration-300`}
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(0, ((data.latestRssi + 100) / 50) * 100)
                                  )}%`,
                                }}
                              ></div>
                            </div>

                            <div className="text-xs text-muted-foreground">
                              Last seen: {lastSeen}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
