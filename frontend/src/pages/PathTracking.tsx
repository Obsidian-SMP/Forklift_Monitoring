import { useState, useEffect, useRef, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, Settings, AlertTriangle, Navigation } from 'lucide-react';
import apiService from '@/services/api';
import { toast } from 'sonner';

// Convert UTC timestamp to Indian Standard Time (IST - UTC+5:30)
function convertToIST(timestamp: string | number | Date): string {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return 'Invalid Time';
    }
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

interface Gateway {
  id: number;
  gateway_id: string;
  name: string;
  location: { x: number; y: number; z: number };
  is_active: boolean;
  last_seen: string;
  created_at: string;
}

interface Position {
  x: number;
  y: number;
  z?: number;
  accuracy?: number;
  timestamp: string;
  gateway_count?: number;
  method?: string;
  velocity_x?: number;
  velocity_y?: number;
  speed?: number;
}

interface Zone {
  id: string;
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  notifyEntry: boolean;
}

interface DrawingZone {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export default function PathTracking() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [rawPositions, setRawPositions] = useState<Position[]>([]); // Last 3 raw positions for averaging
  const [pathHistory, setPathHistory] = useState<Position[]>([]);
  const [layoutConfigured, setLayoutConfigured] = useState(true);
  const [mapWidth, setMapWidth] = useState(10);
  const [mapHeight, setMapHeight] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showLayoutModal, setShowLayoutModal] = useState(false);
  const [tempWidth, setTempWidth] = useState(mapWidth);
  const [tempHeight, setTempHeight] = useState(mapHeight);
  const [warehouseImage, setWarehouseImage] = useState<string | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isDrawingZone, setIsDrawingZone] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState<DrawingZone | null>(null);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [zoneNotify, setZoneNotify] = useState(true);
  const [detectedObjects, setDetectedObjects] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastZone, setLastZone] = useState<string | null>(null);
  
  // Map dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [tempOffset, setTempOffset] = useState({ x: 0, y: 0 });

  // Throttle helper function
  const throttle = (func: Function, delay: number) => {
    let lastCall = 0;
    return (...args: any[]) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      }
    };
  };

  // Check if forklift entered a notification zone
  const checkZoneEntry = (position: Position) => {
    for (const zone of zones) {
      if (!zone.notifyEntry) continue;
      
      const { x, y } = position;
      const inZone = x >= zone.x1 && x <= zone.x2 && y >= zone.y1 && y <= zone.y2;
      
      if (inZone && lastZone !== zone.id) {
        // Entered new zone
        setLastZone(zone.id);
        toast.warning(`🚨 Forklift entered ${zone.name}`, {
          description: `Position: (${x.toFixed(1)}m, ${y.toFixed(1)}m)`,
          duration: 5000,
        });
        console.log(`🚨 Zone entry alert: ${zone.name}`);
      } else if (!inZone && lastZone === zone.id) {
        // Exited zone
        setLastZone(null);
        toast.info(`✓ Forklift exited ${zone.name}`);
      }
    }
  };

  // Fetch gateways only (called once on mount and manually when needed)
  const fetchGateways = async () => {
    try {
      const gatewaysRes = await apiService.getGateways();
      const gws = gatewaysRes.gateways || [];
      // Filter only active gateways for display
      const activeGateways = gws.filter((gw: Gateway) => gw.is_active);
      setGateways(activeGateways);
      console.log(`✅ Loaded ${activeGateways.length} active gateways (${gws.length} total)`);
    } catch (err) {
      console.error('Error fetching gateways:', err);
    }
  };

  // Load initial position history (one-time fetch on mount)
  const fetchPositionHistory = async () => {
    try {
      // Use standard RSSI API endpoint for history instead of SSE stream
      const response = await fetch('http://10.136.57.165:5000/api/rssi/position/history?limit=200');
      if (response.ok) {
        const data = await response.json();
        const positions: Position[] = (data.track || []).map((item: any) => ({
          x: item.position?.x || item.calculated_x || 0,
          y: item.position?.y || item.calculated_y || 0,
          z: item.position?.z || item.calculated_z || 0,
          accuracy: item.accuracy,
          timestamp: item.timestamp,
          gateway_count: item.gateway_count,
          method: item.method,
          velocity_x: item.velocity_x,
          velocity_y: item.velocity_y,
          speed: item.speed,
        }));
        setPathHistory(positions);
        console.log(`✅ Loaded ${positions.length} historical positions`);
      }
    } catch (err) {
      console.error('Error fetching position history:', err);
    }
  };

  // Connect to SSE stream for real-time position updates
  const connectSSE = () => {
    try {
      const eventSource = new EventSource('http://10.136.57.165:5000/api/stream/positions');
      
      eventSource.onopen = () => {
        console.log('✅ SSE connection established');
        setIsConnected(true);
        setError(null);
        setLoading(false);
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Raw position from backend
          const rawPosition: Position = {
            x: data.x,
            y: data.y,
            z: data.z || 0,
            accuracy: data.accuracy,
            timestamp: data.timestamp,
            gateway_count: data.gateway_count,
            method: data.method,
            velocity_x: data.velocity_x,
            velocity_y: data.velocity_y,
            speed: data.speed,
          };
          
          // Update raw positions buffer (keep last 3)
          setRawPositions(prev => {
            const updated = [...prev, rawPosition];
            return updated.slice(-3);
          });
          
          // Calculate averaged position from last 3 positions
          setRawPositions(prevRaw => {
            const recentPositions = prevRaw.length > 0 ? prevRaw : [rawPosition];
            const avgX = recentPositions.reduce((sum, p) => sum + p.x, 0) / recentPositions.length;
            const avgY = recentPositions.reduce((sum, p) => sum + p.y, 0) / recentPositions.length;
            
            const smoothedPosition: Position = {
              ...rawPosition,
              x: avgX,
              y: avgY,
            };
            
            setCurrentPosition(smoothedPosition);
            
            // Add smoothed position to path history (keep last 200 positions)
            setPathHistory(prev => {
              const updated = [...prev, smoothedPosition];
              return updated.slice(-200);
            });
            
            // Check zone entry with smoothed position
            checkZoneEntry(smoothedPosition);
            
            return recentPositions;
          });
          
        } catch (err) {
          console.error('Error parsing SSE data:', err);
        }
      };
      
      eventSource.onerror = (err) => {
        console.error('❌ SSE connection error:', err);
        setIsConnected(false);
        eventSource.close();
        
        // Attempt reconnection after 3 seconds
        setTimeout(() => {
          if (autoRefresh) {
            console.log('🔄 Attempting SSE reconnection...');
            connectSSE();
          }
        }, 3000);
      };
      
      return eventSource;
    } catch (err) {
      console.error('Error establishing SSE connection:', err);
      setError('Failed to connect to positioning stream');
      setLoading(false);
      return null;
    }
  };

  // Fetch detected objects
  const fetchDetectedObjects = async () => {
    try {
      const response = await fetch('http://10.136.57.165:5000/api/inventory/detected-objects');
      if (response.ok) {
        const data = await response.json();
        setDetectedObjects(data.objects || []);
      }
    } catch (err) {
      console.error('Error fetching detected objects:', err);
    }
  };

  // Load gateways on component mount only
  useEffect(() => {
    fetchGateways();
    fetchDetectedObjects();
  }, []);

  // Connect to SSE stream and load initial history
  useEffect(() => {
    if (!autoRefresh) return;

    let eventSource: EventSource | null = null;

    // Load initial position history
    fetchPositionHistory();

    // Connect to SSE stream for real-time updates
    eventSource = connectSSE();

    return () => {
      // Cleanup: close SSE connection on unmount or when autoRefresh disabled
      if (eventSource) {
        console.log('🔌 Closing SSE connection');
        eventSource.close();
      }
    };
  }, [autoRefresh, zones]);

  // Poll detected objects every 2 seconds (separate from position updates)
  useEffect(() => {
    if (!autoRefresh) return;

    fetchDetectedObjects();
    const objectInterval = setInterval(fetchDetectedObjects, 2000);

    return () => clearInterval(objectInterval);
  }, [autoRefresh]);

  // Manual refresh for gateways (called after add/delete gateway)
  const handleRefreshGateways = async () => {
    await fetchGateways();
  };

  // Handle warehouse layout save
  const handleSaveLayout = () => {
    setMapWidth(Math.max(1, tempWidth));
    setMapHeight(Math.max(1, tempHeight));
    setShowLayoutModal(false);
  };

  // Handle warehouse image upload
  // Load warehouse map on component mount ONLY - never refresh after this
  useEffect(() => {
    const loadWarehouseMap = async () => {
      try {
        const response = await fetch('http://10.136.57.165:5000/api/warehouse/map');
        if (response.ok) {
          const data = await response.json();
          setWarehouseImage(data.image_data);
        }
      } catch (err) {
        console.log('No warehouse map found');
      }
    };

    loadWarehouseMap();
    // Empty dependency array = loads only once on mount
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const imageData = event.target?.result as string;
        setWarehouseImage(imageData);
        
        // Save to database
        try {
          const response = await fetch('http://10.136.57.165:5000/api/warehouse/map', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image_data: imageData,
              width: String(mapWidth),
              height: String(mapHeight)
            })
          });
          
          if (response.ok) {
            console.log('Map saved to database');
          } else {
            setError('Failed to save map to database');
          }
        } catch (err) {
          console.error('Error saving map:', err);
          setError('Error saving map to database');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveMap = async () => {
    try {
      const response = await fetch('http://10.136.57.165:5000/api/warehouse/map', {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setWarehouseImage(null);
        console.log('Map removed successfully');
      } else {
        setError('Failed to remove map');
      }
    } catch (err) {
      console.error('Error removing map:', err);
      setError('Error removing map');
    }
  };

  // Helper function to convert screen coordinates to map coordinates
  const getMapCoordinates = (clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    // Account for CSS scaling: convert screen pixels to canvas pixels
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Get position relative to canvas in screen pixels
    const canvasPixelX = (clientX - rect.left) * scaleX;
    const canvasPixelY = (clientY - rect.top) * scaleY;
    
    // Convert from canvas pixels to map coordinates
    const mapX = (canvasPixelX / canvas.width) * mapWidth;
    const mapY = (canvasPixelY / canvas.height) * mapHeight;
    
    return { x: mapX, y: mapY };
  };

  // Handle zone drawing
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Right click for dragging
    if (e.button === 2) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setTempOffset(mapOffset);
      return;
    }
    
    // Left click for zone drawing
    if (!isDrawingZone) return;
    
    const coords = getMapCoordinates(e.clientX, e.clientY);
    setCurrentDrawing({ x1: coords.x, y1: coords.y, x2: coords.x, y2: coords.y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle map dragging
    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setMapOffset({
        x: tempOffset.x + dx,
        y: tempOffset.y + dy
      });
      return;
    }
    
    // Handle zone drawing
    if (!isDrawingZone || !currentDrawing) return;
    
    const coords = getMapCoordinates(e.clientX, e.clientY);
    setCurrentDrawing({ ...currentDrawing, x2: coords.x, y2: coords.y });
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // End dragging
    if (isDragging) {
      setIsDragging(false);
      return;
    }
    
    // End zone drawing
    if (!isDrawingZone || !currentDrawing) return;
    
    // Ensure coordinates are in correct order
    const x1 = Math.min(currentDrawing.x1, currentDrawing.x2);
    const y1 = Math.min(currentDrawing.y1, currentDrawing.y2);
    const x2 = Math.max(currentDrawing.x1, currentDrawing.x2);
    const y2 = Math.max(currentDrawing.y1, currentDrawing.y2);
    
    setCurrentDrawing({ x1, y1, x2, y2 });
    setZoneName('');
    setZoneNotify(true);
    setShowZoneModal(true);
  };

  // Save zone
  const handleSaveZone = () => {
    if (!currentDrawing || !zoneName.trim()) return;
    
    const newZone: Zone = {
      id: Date.now().toString(),
      name: zoneName,
      x1: Math.min(currentDrawing.x1, currentDrawing.x2),
      y1: Math.min(currentDrawing.y1, currentDrawing.y2),
      x2: Math.max(currentDrawing.x1, currentDrawing.x2),
      y2: Math.max(currentDrawing.y1, currentDrawing.y2),
      notifyEntry: zoneNotify,
    };
    
    setZones([...zones, newZone]);
    setShowZoneModal(false);
    setCurrentDrawing(null);
    setIsDrawingZone(false);
  };

  // Delete zone
  const handleDeleteZone = (id: string) => {
    setZones(zones.filter(z => z.id !== id));
  };

  // Draw map
  useEffect(() => {
    if (!canvasRef.current || !layoutConfigured) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw warehouse image if available
    if (warehouseImage) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawMapContent(ctx, canvas);
      };
      img.src = warehouseImage;
    } else {
      drawMapContent(ctx, canvas);
    }
  }, [layoutConfigured, gateways, currentPosition, pathHistory, mapWidth, mapHeight, zones, warehouseImage, currentDrawing, isDrawingZone, mapOffset]);

  // Helper function to draw map content
  const drawMapContent = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // Save context and apply translation for map offset
    ctx.save();
    ctx.translate(mapOffset.x, mapOffset.y);
    
    // Draw border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / mapWidth;
    const scaleY = canvas.height / mapHeight;

    // Draw zones
    zones.forEach((zone) => {
      const x1 = zone.x1 * scaleX;
      const y1 = zone.y1 * scaleY;
      const w = (zone.x2 - zone.x1) * scaleX;
      const h = (zone.y2 - zone.y1) * scaleY;

      // Zone rectangle with semi-transparent fill
      ctx.fillStyle = zone.notifyEntry ? '#fbbf2420' : '#d1d5db40';
      ctx.fillRect(x1, y1, w, h);

      // Zone border
      ctx.strokeStyle = zone.notifyEntry ? '#f59e0b' : '#6b7280';
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, w, h);

      // Zone label
      ctx.fillStyle = zone.notifyEntry ? '#b45309' : '#374151';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(zone.name, x1 + 5, y1 + 20);
    });

    // Draw current drawing zone preview
    if (currentDrawing && isDrawingZone) {
      const x1 = currentDrawing.x1 * scaleX;
      const y1 = currentDrawing.y1 * scaleY;
      const x2 = currentDrawing.x2 * scaleX;
      const y2 = currentDrawing.y2 * scaleY;
      const w = Math.abs(x2 - x1);
      const h = Math.abs(y2 - y1);
      const minX = Math.min(x1, x2);
      const minY = Math.min(y1, y2);

      ctx.fillStyle = '#3b82f640';
      ctx.fillRect(minX, minY, w, h);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(minX, minY, w, h);
      ctx.setLineDash([]);
    }

    // Draw gateways
    gateways.forEach((gateway) => {
      const x = gateway.location.x * scaleX;
      const y = gateway.location.y * scaleY;

      // Gateway circle
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();

      // Gateway label
      ctx.fillStyle = '#333';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(gateway.name, x, y - 15);
    });

    // Draw path history with orange line
    const validPathHistory = pathHistory.filter(pos => 
      pos && typeof pos.x === 'number' && typeof pos.y === 'number' && 
      !isNaN(pos.x) && !isNaN(pos.y)
    );
    
    if (validPathHistory.length > 1) {
      // Draw orange connecting line
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.beginPath();

      validPathHistory.forEach((pos, idx) => {
        const x = pos.x * scaleX;
        const y = pos.y * scaleY;
        if (idx === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Draw path points
      validPathHistory.forEach((pos) => {
        const x = pos.x * scaleX;
        const y = pos.y * scaleY;
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Draw current position
    if (currentPosition && typeof currentPosition.x === 'number' && typeof currentPosition.y === 'number') {
      const x = currentPosition.x * scaleX;
      const y = currentPosition.y * scaleY;

      // Accuracy circle
      if (currentPosition.accuracy) {
        const radius = currentPosition.accuracy * scaleX;
        ctx.strokeStyle = '#10b98150';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Forklift marker
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Forklift label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('FK', x, y + 4);
    }
    
    // Restore context (undo translation)
    ctx.restore();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!layoutConfigured) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Path Tracking & Maps</h1>
            <p className="text-gray-600">Real-time forklift location and path history</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Warehouse Layout Configuration</CardTitle>
              <CardDescription>Set up your warehouse dimensions to visualize the map</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Map Width (meters)</label>
                  <input
                    type="number"
                    value={mapWidth}
                    onChange={(e) => setMapWidth(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Map Height (meters)</label>
                  <input
                    type="number"
                    value={mapHeight}
                    onChange={(e) => setMapHeight(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <Button onClick={() => setLayoutConfigured(true)} className="w-full">
                <Settings className="w-4 h-4 mr-2" />
                Configure & Start Tracking
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Path Tracking & Maps</h1>
            <p className="text-gray-600">
              Real-time forklift location and path history
              {isConnected && (
                <span className="ml-2 text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                  ● Live Stream
                </span>
              )}
              {!isConnected && autoRefresh && (
                <span className="ml-2 text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">
                  ● Connecting...
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => document.getElementById('image-upload')?.click()}
              variant="outline"
              title="Upload warehouse floor plan (top view)"
            >
              📷 Upload Map
            </Button>
            {warehouseImage && (
              <Button
                onClick={handleRemoveMap}
                variant="outline"
                className="text-red-600 hover:text-red-700"
                title="Remove current warehouse map"
              >
                ✕ Remove Map
              </Button>
            )}
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <Button
              onClick={() => {
                setIsDrawingZone(!isDrawingZone);
                setCurrentDrawing(null);
              }}
              variant={isDrawingZone ? 'default' : 'outline'}
              title="Click and drag to draw zones"
            >
              {isDrawingZone ? '✓ Drawing Zone' : '+ Add Zone'}
            </Button>
            <Button
              onClick={() => {
                setTempWidth(mapWidth);
                setTempHeight(mapHeight);
                setShowLayoutModal(true);
              }}
              variant="outline"
            >
              <Settings className="w-4 h-4 mr-2" />
              Layout
            </Button>
            
            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant={autoRefresh ? 'default' : 'outline'}
            >
              {autoRefresh ? '⏸️ Stop' : '▶️ Resume'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                fetchGateways();
                fetchPositionHistory();
                toast.success('Refreshed gateway positions and history');
              }} 
              title="Refresh gateway positions and path history"
            >
              🔄
            </Button>
          </div>
        </div>

        {/* Warnings */}
        {error && (
          <Alert className="border-yellow-500 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">{error}</AlertDescription>
          </Alert>
        )}

        {gateways.length < 2 && (
          <Alert className="border-red-500 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              ⚠️ Only {gateways.length} active gateway(s) sending RSSI. At least 2 gateways are required for position tracking (3+ recommended for optimal accuracy).
            </AlertDescription>
          </Alert>
        )}

        {gateways.length >= 2 && gateways.length < 4 && (
          <Alert className="border-yellow-500 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              💡 {gateways.length} active gateways sending RSSI. Add {4 - gateways.length} more gateway(s) to enable weighted least squares positioning (±50% better accuracy with 4+ gateways).
            </AlertDescription>
          </Alert>
        )}

        {gateways.length >= 4 && (
          <Alert className="border-green-500 bg-green-50">
            <AlertTriangle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              ✅ {gateways.length} active gateways sending RSSI! Weighted least squares positioning enabled for optimal accuracy (sub-meter precision).
            </AlertDescription>
          </Alert>
        )}

        {/* Map Canvas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Warehouse Floor Map</span>
              {mapOffset.x !== 0 || mapOffset.y !== 0 ? (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setMapOffset({ x: 0, y: 0 })}
                  title="Reset map position"
                >
                  🔄 Reset View
                </Button>
              ) : null}
            </CardTitle>
            <CardDescription>
              {gateways.length >= 3
                ? '📍 Real-time forklift position (green dot) with path history (red line) • Right-click + drag to move map'
                : '📍 Gateway positions (blue dots) - Add more gateways for tracking • Right-click + drag to move map'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-100 rounded-lg p-4">
              <canvas
                ref={canvasRef}
                width={600}
                height={480}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onContextMenu={(e) => e.preventDefault()}
                className={`w-full border-2 border-gray-300 rounded-lg bg-white ${
                  isDragging ? 'cursor-grabbing' : isDrawingZone ? 'cursor-crosshair' : 'cursor-grab'
                }`}
              />
            </div>
          </CardContent>
        </Card>

        {/* Current Position Info */}
        {currentPosition && gateways.length >= 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-green-600" />
                Calculated Position
                {currentPosition.method && (
                  <span className="ml-auto text-xs font-normal px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    {currentPosition.method === 'weighted_least_squares' && `📊 ${currentPosition.gateway_count || 0} Gateways (WLS)`}
                    {currentPosition.method === 'trilateration' && `🔺 ${currentPosition.gateway_count || 3} Gateways (Trilateration)`}
                    {currentPosition.method === 'bilateration' && `📍 ${currentPosition.gateway_count || 2} Gateways (Bilateration)`}
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Live forklift position using {currentPosition.gateway_count || gateways.length} active gateway{(currentPosition.gateway_count || gateways.length) > 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {currentPosition?.x?.toFixed(2) ?? '0.00'}m
                  </div>
                  <div className="text-sm text-gray-600">X Coordinate</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {currentPosition?.y?.toFixed(2) ?? '0.00'}m
                  </div>
                  <div className="text-sm text-gray-600">Y Coordinate</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {(currentPosition?.z || 0).toFixed(2)}m
                  </div>
                  <div className="text-sm text-gray-600">Z Height</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">
                    ±{(currentPosition?.accuracy || 0).toFixed(2)}m
                  </div>
                  <div className="text-sm text-gray-600">Accuracy</div>
                </div>
              </div>
              {currentPosition?.speed !== undefined && currentPosition.speed > 0.01 && (
                <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-lg font-semibold text-teal-600">
                      {(currentPosition.speed * 3.6).toFixed(2)} km/h
                    </div>
                    <div className="text-xs text-gray-600">Speed ({currentPosition.speed.toFixed(2)} m/s)</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-indigo-600">
                      {currentPosition.velocity_x?.toFixed(2) || '0.00'} m/s
                    </div>
                    <div className="text-xs text-gray-600">X Velocity</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-pink-600">
                      {currentPosition.velocity_y?.toFixed(2) || '0.00'} m/s
                    </div>
                    <div className="text-xs text-gray-600">Y Velocity</div>
                  </div>
                </div>
              )}
              <div className="mt-4 text-sm text-gray-500">
                Updated: {convertToIST(currentPosition.timestamp)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Gateway Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Configured Gateways ({gateways.length} Active)
            </CardTitle>
            <CardDescription>
              Active BLE gateways sending RSSI data for position calculation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {gateways.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No active gateways</p>
                <p className="text-sm mt-1">Start scanning on mobile devices to add gateways</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {gateways.map((gateway) => (
                  <div
                    key={gateway.gateway_id}
                    className="p-3 bg-blue-50 border-2 border-blue-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-semibold text-blue-900">{gateway.name}</div>
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                        Active
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>📍 Position: ({gateway.location.x.toFixed(1)}m, {gateway.location.y.toFixed(1)}m, {gateway.location.z.toFixed(1)}m)</div>
                      <div>🆔 ID: {gateway.gateway_id}</div>
                      <div className="pt-1 border-t text-gray-500">
                        Last seen: {new Date(gateway.last_seen).toLocaleTimeString('en-IN')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Path History */}
        {pathHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Path History</CardTitle>
              <CardDescription>{pathHistory.length} recorded positions in last 2 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {pathHistory
                  .filter(pos => pos && typeof pos.x === 'number' && typeof pos.y === 'number')
                  .slice()
                  .reverse()
                  .map((pos, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-gray-50 border border-gray-200 rounded text-sm"
                    >
                      <span className="text-gray-900">
                        ({pos.x.toFixed(1)}m, {pos.y.toFixed(1)}m, {(pos.z || 0).toFixed(1)}m)
                      </span>
                      <span className="text-gray-500 ml-2">
                        {convertToIST(pos.timestamp)}
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detected Objects Panel */}
        {detectedObjects.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📦 Detected Objects ({detectedObjects.length})
              </CardTitle>
              <CardDescription>Objects detected via camera with their photos and positions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {detectedObjects.map((obj) => (
                  <div key={obj.object_id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg">
                    {/* Object Photo */}
                    {obj.photo_url && (
                      <div className="bg-gray-100 aspect-video flex items-center justify-center overflow-hidden">
                        <img 
                          src={obj.photo_url} 
                          alt={obj.object_id}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    {/* Object Info */}
                    <div className="p-3 space-y-2">
                      <div className="font-semibold text-gray-900">{obj.object_id}</div>
                      
                      {/* Status Badge */}
                      <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        obj.status === 'detected' ? 'bg-blue-100 text-blue-800' :
                        obj.status === 'placed' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {obj.status}
                      </div>
                      
                      {/* Position */}
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>📍 X: {obj.position?.x?.toFixed(1) || 'N/A'}m, Y: {obj.position?.y?.toFixed(1) || 'N/A'}m</div>
                        {obj.confidence_score && (
                          <div>🎯 Confidence: {(obj.confidence_score * 100).toFixed(0)}%</div>
                        )}
                      </div>
                      
                      {/* Mismatch Flag */}
                      {obj.is_mismatch_flagged && (
                        <div className="text-xs bg-yellow-50 border border-yellow-200 p-2 rounded text-yellow-800">
                          ⚠️ Location Mismatch: {obj.location_mismatch}
                        </div>
                      )}
                      
                      {/* Detection Time */}
                      <div className="text-xs text-gray-500 pt-2 border-t">
                        Detected: {convertToIST(obj.detection_timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Zones List Card */}
        {zones.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Warehouse Zones ({zones.length})</CardTitle>
              <CardDescription>Defined zones with entry notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {zones.map((zone) => (
                  <div
                    key={zone.id}
                    className={`p-3 rounded-lg border-2 ${
                      zone.notifyEntry
                        ? 'bg-amber-50 border-amber-300'
                        : 'bg-gray-50 border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-sm">{zone.name}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          ({zone.x1.toFixed(0)}, {zone.y1.toFixed(0)}) to ({zone.x2.toFixed(0)}, {zone.y2.toFixed(0)})
                        </div>
                        {zone.notifyEntry && (
                          <div className="text-xs text-amber-700 mt-1">🔔 Notify on entry</div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteZone(zone.id)}
                        className="text-red-600 hover:text-red-800 text-lg"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Zone Creation Modal */}
        {showZoneModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Create New Zone</CardTitle>
                <CardDescription>Name your zone and configure notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Zone Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Loading Dock, Storage A"
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="notify-entry"
                    checked={zoneNotify}
                    onChange={(e) => setZoneNotify(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="notify-entry" className="text-sm font-medium cursor-pointer">
                    🔔 Notify when forklift enters this zone
                  </label>
                </div>
                <div className="pt-4 border-t flex gap-3">
                  <Button
                    onClick={() => {
                      setShowZoneModal(false);
                      setCurrentDrawing(null);
                      setIsDrawingZone(true);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Redraw
                  </Button>
                  <Button
                    onClick={() => {
                      setShowZoneModal(false);
                      setCurrentDrawing(null);
                      setIsDrawingZone(false);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveZone}
                    disabled={!zoneName.trim()}
                    className="flex-1"
                  >
                    Save Zone
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Warehouse Layout Modal */}
        {showLayoutModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Configure Warehouse Layout</CardTitle>
                <CardDescription>Set your warehouse dimensions for accurate mapping</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Warehouse Width (meters)</label>
                  <input
                    type="number"
                    min="100"
                    step="10"
                    value={tempWidth}
                    onChange={(e) => setTempWidth(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Current: {tempWidth}m</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Warehouse Height (meters)</label>
                  <input
                    type="number"
                    min="100"
                    step="10"
                    value={tempHeight}
                    onChange={(e) => setTempHeight(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Current: {tempHeight}m</p>
                </div>
                <div className="pt-4 border-t flex gap-3">
                  <Button
                    onClick={() => setShowLayoutModal(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveLayout}
                    className="flex-1"
                  >
                    Save Layout
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
