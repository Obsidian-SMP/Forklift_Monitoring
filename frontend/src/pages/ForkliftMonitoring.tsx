import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusIndicator } from '@/components/dashboard/StatusIndicator';
import apiService from '@/services/api';
import { 
  Camera,
  Video,
  AlertCircle,
  RefreshCw,
  Wifi,
  Activity,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function ForkliftMonitoring() {
  const [forklift, setForklift] = useState<any>(null);
  const [cameraData, setCameraData] = useState<any>(null);
  const [streamError, setStreamError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [imageKey, setImageKey] = useState(0); // Force image refresh
  const [useMJPEG, setUseMJPEG] = useState(false); // Toggle between MJPEG and polling mode

  // Fetch forklift and camera data
  useEffect(() => {
    fetchForkliftData();
    const interval = setInterval(fetchForkliftData, 15000); // Refresh every 15 seconds (reduced server load)
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh camera image every 2 seconds (balanced performance on RPi) - only in polling mode
  useEffect(() => {
    if (forklift?.id && cameraData?.status === 'online' && !useMJPEG) {
      const imageRefreshInterval = setInterval(() => {
        setImageKey(prev => prev + 1); // Force image reload by changing key
      }, 1000); // Refresh every 1 second for faster updates
      
      return () => clearInterval(imageRefreshInterval);
    }
  }, [forklift?.id, cameraData?.status, useMJPEG]);

  const fetchForkliftData = async () => {
    try {
      console.log('📹 Fetching forklift camera data...');
      const data = await apiService.getCameraForklifts();
      console.log('📹 Camera data received:', data);
      
      // Find the first online forklift with a camera
      const onlineForklift = data.forklifts.find((f: any) => f.ip && f.status === 'online');
      
      if (onlineForklift) {
        setForklift(onlineForklift);
        setCameraData(onlineForklift);
        setStreamError('');
      } else if (data.forklifts.length > 0) {
        // Show first registered forklift even if offline
        const firstForklift = data.forklifts[0];
        setForklift(firstForklift);
        setCameraData(firstForklift);
        setStreamError(firstForklift.status === 'offline' ? 'Camera offline' : 'No camera configured');
      } else {
        setStreamError('No forklifts found. Upload an image from ESP32-CAM to register.');
      }
      setLoading(false);
    } catch (error) {
      console.error('❌ Failed to fetch forklift data:', error);
      setStreamError('Backend not connected. Start backend server.');
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Forklift Camera Monitoring</h1>
            <p className="text-muted-foreground mt-1">Live ESP32-CAM video stream from warehouse forklift</p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchForkliftData}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-spin" />
              <p className="text-muted-foreground">Loading forklift data...</p>
            </div>
          </div>
        ) : !forklift ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">No Forklifts Registered</p>
              <p className="text-sm text-muted-foreground">
                Upload an image from ESP32-CAM to auto-register your forklift
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Camera Stream */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="h-5 w-5" />
                    Live Camera Feed
                  </CardTitle>
                  <CardDescription>
                    {cameraData?.ip ? `Streaming from ${cameraData.ip}` : 'Camera not available'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {cameraData?.ip && cameraData?.status === 'online' ? (
                    <div className="space-y-4">
                      {/* Stream Mode Toggle */}
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <Zap className="h-5 w-5 text-amber-500" />
                          <div>
                            <Label htmlFor="mjpeg-mode" className="text-sm font-medium cursor-pointer">
                              Fast Mode (MJPEG Stream)
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              {useMJPEG ? '⚡ Fastest - Single viewer only' : '👥 Slower - Multiple viewers OK'}
                            </p>
                          </div>
                        </div>
                        <Switch 
                          id="mjpeg-mode"
                          checked={useMJPEG}
                          onCheckedChange={setUseMJPEG}
                        />
                      </div>
                      
                      {/* Camera Stream */}
                      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                        {useMJPEG ? (
                          // MJPEG Stream Mode - Faster, single viewer
                          <img 
                            src={`${import.meta.env.VITE_API_URL?.replace('/api', '')}/api/camera/${forklift.id}/stream`}
                            alt={`${forklift.id} MJPEG stream`}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              console.error('📹 MJPEG stream error');
                              setStreamError('MJPEG stream unavailable. Try polling mode.');
                            }}
                            onLoad={() => {
                              console.log('📹 MJPEG stream connected');
                              setStreamError('');
                            }}
                          />
                        ) : (
                          // Polling Mode - Slower but supports multiple viewers
                          <img 
                            key={imageKey}
                            src={apiService.getCameraLatestImageUrl(forklift.id)}
                            alt={`${forklift.id} camera feed`}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              console.error('📹 Image load error');
                              setStreamError('Image unavailable. Check ESP32-CAM connection.');
                            }}
                            onLoad={() => {
                              console.log('📹 Image loaded successfully');
                              setStreamError('');
                            }}
                          />
                        )}
                      {streamError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                          <div className="text-center">
                            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-2" />
                            <p className="text-white text-sm">{streamError}</p>
                          </div>
                        </div>
                      )}
                      {/* Live Indicator */}
                      {!streamError && (
                        <div className="absolute top-4 left-4">
                          <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                            </span>
                            {useMJPEG ? 'LIVE • MJPEG' : 'LIVE'}
                          </div>
                        </div>
                      )}
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <Video className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-lg font-medium mb-2">
                          {cameraData?.status === 'offline' 
                            ? 'Camera Offline' 
                            : 'No Camera Configured'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {cameraData?.status === 'offline' 
                            ? 'Check ESP32-CAM power and WiFi connection' 
                            : 'Configure camera for this forklift'}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar Info */}
            <div className="space-y-6">
              {/* Forklift Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Forklift Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">ID</span>
                    <span className="font-mono font-medium">{forklift.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Camera Status</span>
                    {cameraData?.status === 'online' ? (
                      <StatusIndicator variant="safe" label="Online" size="sm" />
                    ) : (
                      <StatusIndicator variant="offline" label="Offline" size="sm" />
                    )}
                  </div>
                  {cameraData?.ip && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Camera IP</span>
                      <span className="font-mono text-sm">{cameraData.ip}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Stream Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Stream Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Latest Image (1s refresh)</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                      {apiService.getCameraLatestImageUrl(forklift.id).split('?')[0]}
                    </code>
                  </div>
                  {cameraData?.ip && (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Direct ESP32-CAM Stream</p>
                        <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                          http://{cameraData.ip}/
                        </code>
                      </div>
                    </>
                  )}
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Format</span>
                      <span className="font-medium">JPEG (Auto-refresh)</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-muted-foreground">Update Rate</span>
                      <span className="font-medium">1 frame/second</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-muted-foreground">Frame Rate</span>
                      <span className="font-medium">~15 FPS</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Connection Guide */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Wifi className="h-4 w-4" />
                    Connection
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      ESP32-CAM automatically registers on first image upload
                    </p>
                    <div className="pt-2 border-t space-y-1">
                      <p className="font-medium text-xs">Status Checks:</p>
                      <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                        <li>Camera power and LED indicator</li>
                        <li>WiFi connection strength</li>
                        <li>Backend server running on port 5000</li>
                        <li>Network accessibility</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
