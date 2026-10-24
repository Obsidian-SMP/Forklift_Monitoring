import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, Settings, AlertTriangle, Navigation, ZoomIn, ZoomOut } from 'lucide-react';
import apiService from '@/services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
  gateway_id: string;
  name: string;
  location: { x: number; y: number; z?: number };
}

interface Position {
  x: number;
  y: number;
  z?: number;
  forklift_id?: string;
  accuracy?: number;
  timestamp: string;
  gateway_count?: number;
  method?: string;
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
  const enteredZonesRef = useRef<Set<string>>(new Set());
  
  // Map dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [tempOffset, setTempOffset] = useState({ x: 0, y: 0 });
  const [mapScale, setMapScale] = useState(1);

  // Fetch gateways only (called once on mount and manually when needed)
  const fetchGateways = async () => {
    try {
      const gatewaysRes = await apiService.getGateways();
      const gws = gatewaysRes.gateways || [];
      setGateways(gws);
    } catch (err) {
      console.error('Error fetching gateways:', err);
    }
  };

  // Fetch the current position (auto-refreshes every second)
  const fetchPositionData = async () => {
    try {
      setError(null);

      const positionRes = await Promise.allSettled([
        apiService.getLatestPosition(),
      ]);

      // Handle position response - 404 is OK when no data yet, not an error
      if (positionRes[0].status === 'fulfilled') {
        const data = positionRes[0].value as any;
        // Handle both direct position data and nested position object
        if (data.position) {
          if (typeof data.position === 'object' && data.position.x !== undefined) {
            // Position is { x, y, z }
            setCurrentPosition({
              ...data.position,
              accuracy: data.accuracy,
              timestamp: data.timestamp,
            });
          } else {
            // Position might be null/undefined
            setCurrentPosition(null);
          }
        }
      } else if (positionRes[0].status === 'rejected') {
        // Silently ignore 404 errors - position data hasn't been calculated yet
        const error = positionRes[0].reason as any;
        if (error?.message?.includes('404')) {
          setCurrentPosition(null); // No position data available yet
        } else {
          console.error('Error fetching position:', error);
        }
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setLoading(false);
    }
  };

  // Load gateways on component mount only
  useEffect(() => {
    fetchGateways();
  }, []);

  // Auto refresh position data only (not gateways)
  useEffect(() => {
    if (!autoRefresh) return;

    fetchPositionData(); // Initial fetch
    const interval = setInterval(() => {
      fetchPositionData();
    }, 1000);
    return () => clearInterval(interval);
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
        const response = await fetch(`${API_BASE}/warehouse/map`);
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
          const response = await fetch(`${API_BASE}/warehouse/map`, {
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
      const response = await fetch(`${API_BASE}/warehouse/map`, {
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
    
    // Undo the centered zoom and map translation applied while rendering.
    const canvasCenterX = canvas.width / 2;
    const canvasCenterY = canvas.height / 2;
    const canvasPixelX = canvasCenterX
      + ((clientX - rect.left) * scaleX - canvasCenterX - mapOffset.x) / mapScale;
    const canvasPixelY = canvasCenterY
      + ((clientY - rect.top) * scaleY - canvasCenterY - mapOffset.y) / mapScale;
    
    // Convert from canvas pixels to map coordinates
    const mapX = (canvasPixelX / canvas.width) * mapWidth;
    const mapY = (canvasPixelY / canvas.height) * mapHeight;
    
    return { x: mapX, y: mapY };
  };

  // Handle zone drawing
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Pan with either mouse button when zone drawing is not active.
    if (e.button === 2 || (e.button === 0 && !isDrawingZone)) {
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

  const handleMapPanStart = (e: React.MouseEvent<HTMLElement>) => {
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setTempOffset(mapOffset);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    // Handle map dragging
    if (isDragging) {
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      const scaleX = canvas && rect ? canvas.width / rect.width : 1;
      const scaleY = canvas && rect ? canvas.height / rect.height : 1;
      const dx = (e.clientX - dragStart.x) * scaleX;
      const dy = (e.clientY - dragStart.y) * scaleY;
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

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLElement>) => {
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
    enteredZonesRef.current.delete(id);
  };

  useEffect(() => {
    if (!currentPosition || zones.length === 0) return;

    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const currentZoneIds = new Set<string>();

    zones.forEach((zone) => {
      const inside = currentPosition.x >= zone.x1 &&
        currentPosition.x <= zone.x2 &&
        currentPosition.y >= zone.y1 &&
        currentPosition.y <= zone.y2;

      if (!inside) return;
      currentZoneIds.add(zone.id);

      if (zone.notifyEntry && !enteredZonesRef.current.has(zone.id)) {
        enteredZonesRef.current.add(zone.id);
        fetch(`${apiBase}/alerts/zone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            zone_id: zone.id,
            zone_name: zone.name,
            forklift_id: currentPosition.forklift_id || 'forklift_001',
            position: {
              x: currentPosition.x,
              y: currentPosition.y,
            },
          }),
        }).catch((error) => {
          console.error('Failed to report danger-zone entry:', error);
          enteredZonesRef.current.delete(zone.id);
        });
      }
    });

    enteredZonesRef.current.forEach((zoneId) => {
      if (!currentZoneIds.has(zoneId)) {
        enteredZonesRef.current.delete(zoneId);
      }
    });
  }, [currentPosition, zones]);

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
        drawMapContent(ctx, canvas, img);
      };
      img.src = warehouseImage;
    } else {
      drawMapContent(ctx, canvas);
    }
  }, [layoutConfigured, gateways, currentPosition, mapWidth, mapHeight, zones, warehouseImage, currentDrawing, isDrawingZone, mapOffset, mapScale]);

  // Helper function to draw map content
  const drawMapContent = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    image?: HTMLImageElement
  ) => {
    // Apply the map offset and centered zoom to all map content.
    ctx.save();
    ctx.translate(canvas.width / 2 + mapOffset.x, canvas.height / 2 + mapOffset.y);
    ctx.scale(mapScale, mapScale);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    if (image) {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    }
    
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
      ctx.font = `bold ${12 / mapScale}px Arial`;
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

    // Draw current position
    if (currentPosition) {
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
            <p className="text-muted-foreground">Loading map...</p>
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
            <p className="text-gray-600">Real-time forklift location</p>
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
            <p className="text-gray-600">Real-time forklift location</p>
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
            <Button variant="outline" onClick={fetchPositionData} title="Refresh positions and path">
              🔄
            </Button>
          </div>
        </div>

        {/* Warnings */}
        {error && (
          <Alert className="border-yellow-500 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-300">{error}</AlertDescription>
          </Alert>
        )}

        {gateways.length < 3 && (
          <Alert className="border-red-500 bg-red-500/10">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-800 dark:text-red-300">
              ⚠️ Only {gateways.length} gateway(s) detected. At least 3 gateways are required for accurate location. Position accuracy will be limited.
            </AlertDescription>
          </Alert>
        )}

        {/* Map Canvas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Warehouse Floor Map</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMapScale((scale) => Math.max(0.5, scale - 0.25))}
                  disabled={mapScale <= 0.5}
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="min-w-14 text-center text-sm text-muted-foreground">
                  {Math.round(mapScale * 100)}%
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMapScale((scale) => Math.min(3, scale + 0.25))}
                  disabled={mapScale >= 3}
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setMapOffset({ x: 0, y: 0 });
                    setMapScale(1);
                  }}
                  title="Reset map position and zoom"
                >
                  🔄 Reset View
                </Button>
              </div>
            </CardTitle>
            <CardDescription>
              {gateways.length >= 3
                ? '📍 Real-time forklift position (green dot) • Click + drag to move map'
                : '📍 Gateway positions (blue dots) - Add more gateways for tracking • Click + drag to move map'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4">
              <div
                className="relative"
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={isDragging ? handleCanvasMouseUp : undefined}
              >
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={480}
                  onMouseDown={handleCanvasMouseDown}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`w-full border-2 border-border rounded-lg bg-card ${
                    isDragging ? 'cursor-grabbing' : isDrawingZone ? 'cursor-crosshair' : 'cursor-grab'
                  }`}
                />
                <div className="pointer-events-none absolute inset-0">
                  {gateways.map((gateway) => {
                    const x = gateway.location.x * (600 / mapWidth);
                    const y = gateway.location.y * (480 / mapHeight);
                    const screenX = 300 + mapOffset.x + (x - 300) * mapScale;
                    const screenY = 240 + mapOffset.y + (y - 240) * mapScale;
                    const isVisible = screenX >= 0 && screenX <= 600 && screenY >= 0 && screenY <= 480;

                    if (!isVisible) return null;

                    return (
                      <div
                        key={gateway.gateway_id}
                        className="group pointer-events-auto absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-white bg-blue-500 shadow-md transition-transform hover:scale-125 hover:bg-blue-600"
                        style={{
                          left: `${(screenX / 600) * 100}%`,
                          top: `${(screenY / 480) * 100}%`,
                        }}
                        aria-label={gateway.name}
                        onMouseDown={handleMapPanStart}
                      >
                        <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground shadow-lg group-hover:block">
                          {gateway.name}
                        </span>
                      </div>
                    );
                  })}
                  {currentPosition && (
                    (() => {
                      const forkliftX = 300 + mapOffset.x
                        + ((currentPosition.x * (600 / mapWidth)) - 300) * mapScale;
                      const forkliftY = 240 + mapOffset.y
                        + ((currentPosition.y * (480 / mapHeight)) - 240) * mapScale;
                      const isVisible = forkliftX >= 0 && forkliftX <= 600
                        && forkliftY >= 0 && forkliftY <= 480;
                      const forkliftName = currentPosition.forklift_id || 'forklift_001';

                      if (!isVisible) return null;

                      return (
                        <div
                          className="group pointer-events-auto absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-[10px] font-bold text-white shadow-md transition-transform hover:scale-125 hover:bg-emerald-600"
                          style={{
                            left: `${(forkliftX / 600) * 100}%`,
                            top: `${(forkliftY / 480) * 100}%`,
                          }}
                          aria-label={forkliftName}
                          onMouseDown={handleMapPanStart}
                        >
                          F
                          <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground shadow-lg group-hover:block">
                            {forkliftName}
                          </span>
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Position Info */}
        {currentPosition && gateways.length >= 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-green-600" />
                Current Position
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {currentPosition.x.toFixed(2)}m
                  </div>
                  <div className="text-sm text-gray-600">X Coordinate</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {currentPosition.y.toFixed(2)}m
                  </div>
                  <div className="text-sm text-gray-600">Y Coordinate</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {(currentPosition.z || 0).toFixed(2)}m
                  </div>
                  <div className="text-sm text-gray-600">Z Height</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">
                    ±{(currentPosition.accuracy || 0).toFixed(2)}m
                  </div>
                  <div className="text-sm text-gray-600">Accuracy</div>
                </div>
              </div>
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
              Gateway Status ({gateways.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gateways.length === 0 ? (
              <p className="text-muted-foreground">No gateways configured. Add gateways in RSSI Monitor.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {gateways.map((gateway) => (
                  <div
                    key={gateway.gateway_id}
                    className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg"
                  >
                    <div className="font-semibold text-blue-600 dark:text-blue-400">{gateway.name}</div>
                    <div className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                      Position: ({gateway.location.x.toFixed(1)}m, {gateway.location.y.toFixed(1)}m)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-muted border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-sm text-foreground">{zone.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
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
                    className="w-full px-3 py-2 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
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
                    className="w-full px-3 py-2 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Current: {tempWidth}m</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Warehouse Height (meters)</label>
                  <input
                    type="number"
                    min="100"
                    step="10"
                    value={tempHeight}
                    onChange={(e) => setTempHeight(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Current: {tempHeight}m</p>
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
