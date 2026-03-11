import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Package, Plus, Trash2, MapPin, Flag, Eye } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface InventoryItem {
  id: string;
  item_id: string;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  zone: string;
  status: string;
  image_url: string;
  placed_at: string | null;
  dispatched_at: string | null;
}

interface DetectedObject {
  id: string;
  object_id: string;
  object_type: string;
  forklift_id: string;
  photo_url: string;
  position: { x: number; y: number; z?: number };
  status: string;
  is_mismatch_flagged: boolean;
  location_mismatch: string;
  detection_timestamp: string;
  inventory_item_id: string;
}

interface WarehouseStats {
  warehouse_events: {
    entries: number;
    exits: number;
    net_objects: number;
  };
  detection_statistics: {
    total_detected: number;
    red_boxes_detected: number;
    blue_boxes_detected: number;
    black_boxes_detected: number;
  };
  warehouse_statistics: {
    red_boxes_in_warehouse: number;
    blue_boxes_in_warehouse: number;
    black_boxes_in_warehouse: number;
    total_in_warehouse: number;
  };
  inventory: {
    total_items: number;
    mismatches: number;
  };
}

interface GeneralStatistics {
  period: string;
  period_label: string;
  time_range: {
    start: string;
    end: string;
  };
  entering: {
    red_boxes: number;
    blue_boxes: number;
    black_boxes: number;
    total: number;
  };
  exiting: {
    red_boxes: number;
    blue_boxes: number;
    black_boxes: number;
    total: number;
  };
  statistics: {
    total_movement: number;
    entering_percentage: number;
    exiting_percentage: number;
    avg_entering: number;
    avg_exiting: number;
    net_change: number;
  };
}

export default function InventoryManagement() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [stats, setStats] = useState<WarehouseStats | null>(null);
  const [generalStats, setGeneralStats] = useState<GeneralStatistics | null>(null);
  const [timePeriod, setTimePeriod] = useState<'day' | 'month' | 'year'>('day');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'inventory' | 'objects' | 'stats'>('stats');
  const [selectedObject, setSelectedObject] = useState<DetectedObject | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [autoDetectEnabled, setAutoDetectEnabled] = useState(false);
  const [lastDetectionTime, setLastDetectionTime] = useState<string | null>(null);
  const [detectionMessage, setDetectionMessage] = useState<string | null>(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const API_HOST = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');

  // Shared detection logic - checks if object is new, adds to DB if needed
  const performDetection = async (position?: { x: number; y: number; z: number }) => {
    try {
      setIsCapturing(true);
      
      // Use provided position or random for testing
      const detectionPosition = position || {
        x: 100 + Math.random() * 300,
        y: 100 + Math.random() * 300,
        z: 10
      };

      const response = await fetch(`${API_BASE}/inventory/test-detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forklift_id: 'forklift-001',
          position: detectionPosition
        })
      });

      if (response.ok) {
        const result = await response.json();
        setLastDetectionTime(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST');
        
        // Show feedback about the detection
        if (result.is_new) {
          setDetectionMessage(`✓ New object detected: ${result.object.object_id}`);
        } else {
          setDetectionMessage(`⟳ Updated existing object: ${result.object.object_id}`);
        }
        
        // Clear message after 3 seconds
        setTimeout(() => setDetectionMessage(null), 3000);
        
        // Refresh detected objects
        await fetchDetectedObjects();
      } else {
        setDetectionMessage('⚠ Detection failed');
        setTimeout(() => setDetectionMessage(null), 3000);
      }
    } catch (err) {
      console.error('Detection error:', err);
      setDetectionMessage('✗ Error during detection');
      setTimeout(() => setDetectionMessage(null), 3000);
    } finally {
      setIsCapturing(false);
    }
  };

  // Fetch data on mount
  useEffect(() => {
    loadAllData();
    fetchGeneralStats(timePeriod);
    const interval = setInterval(() => {
      loadAllData();
      fetchGeneralStats(timePeriod);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch general stats when time period changes
  useEffect(() => {
    fetchGeneralStats(timePeriod);
  }, [timePeriod]);

  // Auto-detection every 5 seconds
  useEffect(() => {
    if (!autoDetectEnabled) return;

    const autoDetect = async () => {
      try {
        await performDetection();
      } catch (err) {
        console.error('Auto-detection error:', err);
      }
    };

    // Run detection immediately and then every 5 seconds
    autoDetect();
    const interval = setInterval(autoDetect, 5000);
    return () => clearInterval(interval);
  }, [autoDetectEnabled]);

  const loadAllData = async () => {
    try {
      await Promise.all([
        fetchInventory(),
        fetchDetectedObjects(),
        fetchStats()
      ]);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  const fetchInventory = async () => {
    try {
      const response = await fetch(`${API_BASE}/inventory`);
      if (response.ok) {
        const data = await response.json();
        setInventoryItems(data.items || []);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    }
  };

  const fetchDetectedObjects = async () => {
    try {
      const response = await fetch(`${API_BASE}/inventory/detected-objects`);
      if (response.ok) {
        const data = await response.json();
        setDetectedObjects(data.objects || []);
      }
    } catch (err) {
      console.error('Error fetching detected objects:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/inventory/warehouse-stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGeneralStats = async (period: 'day' | 'month' | 'year') => {
    try {
      const response = await fetch(`${API_BASE}/inventory/general-statistics?period=${period}`);
      if (response.ok) {
        const data = await response.json();
        setGeneralStats(data);
      }
    } catch (err) {
      console.error('Error fetching general stats:', err);
    }
  };

  const markLocationMismatch = async (objectId: string, notes: string) => {
    try {
      const response = await fetch(`${API_BASE}/inventory/detected-objects/${objectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_mismatch_flagged: true,
          location_mismatch: notes
        })
      });

      if (response.ok) {
        await fetchDetectedObjects();
      }
    } catch (err) {
      console.error('Error marking mismatch:', err);
    }
  };

  const deleteObject = async (objectId: string) => {
    try {
      const response = await fetch(`${API_BASE}/inventory/detected-objects/${objectId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchDetectedObjects();
      }
    } catch (err) {
      console.error('Error deleting object:', err);
    }
  };

  const deleteAllObjects = async () => {
    if (!confirm('Are you sure you want to delete ALL detected objects and their images? This action cannot be undone!')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/inventory/detected-objects/delete-all`, {
        method: 'DELETE'
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Successfully deleted ${data.objects_deleted} objects and ${data.images_deleted} images`);
        await fetchDetectedObjects();
        await fetchStats();
      } else {
        setError('Failed to delete all objects');
      }
    } catch (err) {
      setError('Error deleting all objects');
      console.error(err);
    }
  };

  const handleUpdateStatus = async (objectId: string, status: string) => {
    try {
      const response = await fetch(`${API_BASE}/inventory/detected-objects/${objectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        const result = await response.json();
        // Close modal and refresh all data
        setSelectedObject(null);
        await Promise.all([
          fetchDetectedObjects(),
          fetchInventory(),
          fetchStats(),
          fetchGeneralStats(timePeriod)
        ]);
        
        // Show success message
        const statusLabel = status === 'placed' ? 'placed in warehouse' : 'dispatched';
        alert(`Successfully ${statusLabel}: ${objectId}`);
      } else {
        setError('Failed to update object status');
      }
    } catch (err) {
      setError('Error updating object');
      console.error(err);
    }
  };

  const handleDeleteObject = async (objectId: string) => {
    if (!confirm('Are you sure you want to delete this object? This will permanently remove it from the database.')) {
      return;
    }

    try {
      await deleteObject(objectId);
      await Promise.all([
        fetchDetectedObjects(),
        fetchInventory(),
        fetchStats(),
        fetchGeneralStats(timePeriod)
      ]);
      alert(`Successfully deleted: ${objectId}`);
    } catch (err) {
      setError('Error deleting object');
      console.error(err);
    }
  };

  const handleDispatchInventoryItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to dispatch this item?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/inventory/${itemId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        await Promise.all([
          fetchInventory(),
          fetchDetectedObjects(),
          fetchStats(),
          fetchGeneralStats(timePeriod)
        ]);
        alert(`Successfully dispatched: ${itemId}`);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to dispatch item');
      }
    } catch (err) {
      setError('Error dispatching item');
      console.error(err);
    }
  };

  const handleDeleteInventoryItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this inventory item? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/inventory/${itemId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await Promise.all([
          fetchInventory(),
          fetchDetectedObjects(),
          fetchStats(),
          fetchGeneralStats(timePeriod)
        ]);
        alert(`Successfully deleted: ${itemId}`);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete item');
      }
    } catch (err) {
      setError('Error deleting item');
      console.error(err);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Package className="w-8 h-8" />
              Inventory Management
            </h1>
            <p className="text-muted-foreground">Track objects detected via camera and warehouse inventory</p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="border-red-500 bg-red-500/10">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-800 dark:text-red-300">{error}</AlertDescription>
          </Alert>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 font-medium border-b-2 ${
              activeTab === 'stats'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Statistics
          </button>
          <button
            onClick={() => setActiveTab('objects')}
            className={`px-4 py-2 font-medium border-b-2 ${
              activeTab === 'objects'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Detected Objects ({detectedObjects.length})
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 font-medium border-b-2 ${
              activeTab === 'inventory'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Inventory Items ({inventoryItems.length})
          </button>
        </div>

        {/* DETECTED OBJECTS TAB */}
        {activeTab === 'objects' && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Detected Objects</CardTitle>
                  <CardDescription>Objects detected automatically by ESP32-CAM AI in real-time</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={deleteAllObjects}
                    size="sm"
                    variant="destructive"
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete All
                  </Button>
                  
                  {detectionMessage && (
                    <span className={`text-xs font-medium ${
                      detectionMessage.includes('✓') ? 'text-green-600' :
                      detectionMessage.includes('⟳') ? 'text-blue-600' :
                      'text-orange-600'
                    }`}>
                      {detectionMessage}
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {detectedObjects.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No detected objects yet</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {detectedObjects.map((obj) => (
                      <Card key={obj.id} className="relative">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg">{obj.object_id}</CardTitle>
                              <CardDescription>
                                Forklift: {obj.forklift_id}
                              </CardDescription>
                              {obj.object_type && (
                                <div className="mt-2">
                                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                    obj.object_type === 'red_box' ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30' :
                                    obj.object_type === 'blue_box' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30' :
                                    obj.object_type === 'black_box' ? 'bg-slate-500/20 text-foreground border border-slate-500/30' :
                                    'bg-muted text-foreground border border-border'
                                  }`}>
                                    {obj.object_type?.replace('_', ' ').toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => deleteObject(obj.object_id)}
                              className="text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* Photo */}
                          {obj.photo_url && (
                            <div className="bg-gray-100 rounded aspect-video flex items-center justify-center overflow-hidden">
                              <img 
                                src={`${API_HOST}${obj.photo_url}`}
                                alt={obj.object_id}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.parentElement!.innerHTML = '<div class="text-gray-400 text-sm">Image not available</div>';
                                }}
                              />
                            </div>
                          )}

                          {/* Status */}
                          <div className="text-sm">
                            <span className="font-medium">Status:</span>
                            <span className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
                              obj.status === 'detected' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30' :
                              obj.status === 'placed' ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30' :
                              obj.status === 'dispatched' ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30' :
                              'bg-muted text-foreground border border-border'
                            }`}>
                              {obj.status.toUpperCase()}
                            </span>
                          </div>

                          {/* Location Mismatch Flag */}
                          {obj.is_mismatch_flagged && (
                            <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
                              <Flag className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                              <div className="text-sm">
                                <p className="font-medium text-yellow-800 dark:text-yellow-300">Location Mismatch</p>
                                <p className="text-yellow-700 dark:text-yellow-400">{obj.location_mismatch}</p>
                              </div>
                            </div>
                          )}

                          {/* Position */}
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            X: {obj.position.x?.toFixed(1)}, Y: {obj.position.y?.toFixed(1)}
                          </div>

                          {/* Actions */}
                          <button
                            onClick={() => setSelectedObject(obj)}
                            className="w-full flex items-center justify-center gap-2 p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded text-sm font-medium"
                          >
                            <Eye className="w-4 h-4" />
                            View Details
                          </button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* INVENTORY ITEMS TAB */}
        {activeTab === 'inventory' && (
          <Card>
            <CardHeader>
              <CardTitle>Inventory Items</CardTitle>
              <CardDescription>Manually manage warehouse inventory</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Items Table */}
              {inventoryItems.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No inventory items. Items will appear here when objects are marked as "Placed".</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Image</TableHead>
                        <TableHead>Item ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Zone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Placed At</TableHead>
                        <TableHead>Dispatched At</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {item.image_url ? (
                              <img 
                                src={`${API_HOST}${item.image_url}`}
                                alt={item.item_name}
                                className="w-12 h-12 object-cover rounded"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                <Package className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{item.item_id}</TableCell>
                          <TableCell className="font-medium">{item.item_name}</TableCell>
                          <TableCell>{item.category || '-'}</TableCell>
                          <TableCell className="font-semibold">{item.quantity}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.zone || '-'}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              item.status === 'in_stock' ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30' :
                              item.status === 'dispatched' ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30' :
                              item.status === 'in_transit' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30' :
                              'bg-muted text-foreground border border-border'
                            }`}>
                              {item.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.placed_at ? new Date(item.placed_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.dispatched_at ? new Date(item.dispatched_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : '-'}
                          </TableCell>
                          <TableCell>
                            {item.status === 'in_stock' && (
                              <Button
                                onClick={() => handleDispatchInventoryItem(item.item_id)}
                                size="sm"
                                variant="outline"
                                className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-500/10"
                              >
                                Dispatch
                              </Button>
                            )}
                            {item.status === 'dispatched' && (
                              <Button
                                onClick={() => handleDeleteInventoryItem(item.item_id)}
                                size="sm"
                                variant="destructive"
                                className="gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STATISTICS TAB */}
        {activeTab === 'stats' && stats && (
          <div className="space-y-6">
            {/* Detection Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold">Detection Statistics</CardTitle>
                <CardDescription>Overall object detection metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center p-4 bg-muted border border-border rounded-lg">
                    <div className="text-3xl font-bold text-foreground">{stats.detection_statistics.total_detected}</div>
                    <p className="text-sm text-muted-foreground mt-2">Total Detected Objects</p>
                  </div>
                  <div className="text-center p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.detection_statistics.red_boxes_detected}</div>
                    <p className="text-sm text-muted-foreground mt-2">Red Boxes Detected</p>
                  </div>
                  <div className="text-center p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.detection_statistics.blue_boxes_detected}</div>
                    <p className="text-sm text-muted-foreground mt-2">Blue Boxes Detected</p>
                  </div>
                  <div className="text-center p-4 bg-slate-500/10 border border-slate-500/30 rounded-lg">
                    <div className="text-3xl font-bold text-slate-700 dark:text-slate-300">{stats.detection_statistics.black_boxes_detected}</div>
                    <p className="text-sm text-muted-foreground mt-2">Black Boxes Detected</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Warehouse Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold">Warehouse Statistics</CardTitle>
                <CardDescription>Current stock levels by box color</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center p-4 border-2 border-blue-200 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600">{stats.warehouse_statistics.total_in_warehouse}</div>
                    <p className="text-sm text-muted-foreground mt-2">Total Boxes in Warehouse</p>
                  </div>
                  <div className="text-center p-4 border-2 border-red-500/30 bg-red-500/10 rounded-lg">
                    <div className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.warehouse_statistics.red_boxes_in_warehouse}</div>
                    <p className="text-sm text-muted-foreground mt-2">Red Boxes</p>
                  </div>
                  <div className="text-center p-4 border-2 border-blue-500/30 bg-blue-500/10 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.warehouse_statistics.blue_boxes_in_warehouse}</div>
                    <p className="text-sm text-muted-foreground mt-2">Blue Boxes</p>
                  </div>
                  <div className="text-center p-4 border-2 border-border bg-muted rounded-lg">
                    <div className="text-3xl font-bold text-foreground">{stats.warehouse_statistics.black_boxes_in_warehouse}</div>
                    <p className="text-sm text-muted-foreground mt-2">Black Boxes</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* General Statistics */}
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-bold">General Statistics</CardTitle>
                    <CardDescription>Time-based box movement analytics</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={timePeriod === 'day' ? 'default' : 'outline'}
                      onClick={() => setTimePeriod('day')}
                    >
                      Per Day
                    </Button>
                    <Button
                      size="sm"
                      variant={timePeriod === 'month' ? 'default' : 'outline'}
                      onClick={() => setTimePeriod('month')}
                    >
                      Per Month
                    </Button>
                    <Button
                      size="sm"
                      variant={timePeriod === 'year' ? 'default' : 'outline'}
                      onClick={() => setTimePeriod('year')}
                    >
                      Per Year
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {generalStats ? (
                  <div className="space-y-6">
                    {/* Entering/Exiting Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                          📥 Boxes Entering Warehouse
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{generalStats.entering.red_boxes}</div>
                            <p className="text-xs text-muted-foreground mt-1">Red Boxes</p>
                          </div>
                          <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{generalStats.entering.blue_boxes}</div>
                            <p className="text-xs text-muted-foreground mt-1">Blue Boxes</p>
                          </div>
                          <div className="bg-muted border border-border p-4 rounded-lg">
                            <div className="text-2xl font-bold text-foreground">{generalStats.entering.black_boxes}</div>
                            <p className="text-xs text-muted-foreground mt-1">Black Boxes</p>
                          </div>
                          <div className="bg-blue-500/15 border-2 border-blue-500/40 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{generalStats.entering.total}</div>
                            <p className="text-xs text-muted-foreground mt-1">Total Entering</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-green-600 dark:text-green-400 flex items-center gap-2">
                          📤 Boxes Exiting Warehouse
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{generalStats.exiting.red_boxes}</div>
                            <p className="text-xs text-muted-foreground mt-1">Red Boxes</p>
                          </div>
                          <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{generalStats.exiting.blue_boxes}</div>
                            <p className="text-xs text-muted-foreground mt-1">Blue Boxes</p>
                          </div>
                          <div className="bg-muted border border-border p-4 rounded-lg">
                            <div className="text-2xl font-bold text-foreground">{generalStats.exiting.black_boxes}</div>
                            <p className="text-xs text-muted-foreground mt-1">Black Boxes</p>
                          </div>
                          <div className="bg-green-500/15 border-2 border-green-500/40 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{generalStats.exiting.total}</div>
                            <p className="text-xs text-muted-foreground mt-1">Total Exiting</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Analytics Summary */}
                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold mb-4">📊 Movement Analytics ({generalStats.period_label})</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg text-center">
                          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{generalStats.statistics.total_movement}</div>
                          <p className="text-xs text-muted-foreground mt-1">Total Movement</p>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg text-center">
                          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{generalStats.statistics.entering_percentage}%</div>
                          <p className="text-xs text-muted-foreground mt-1">Entering %</p>
                        </div>
                        <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg text-center">
                          <div className="text-xl font-bold text-green-600 dark:text-green-400">{generalStats.statistics.exiting_percentage}%</div>
                          <p className="text-xs text-muted-foreground mt-1">Exiting %</p>
                        </div>
                        <div className="bg-purple-500/10 border border-purple-500/30 p-4 rounded-lg text-center">
                          <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{generalStats.statistics.avg_entering}</div>
                          <p className="text-xs text-muted-foreground mt-1">Avg Entering</p>
                        </div>
                        <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg text-center">
                          <div className="text-xl font-bold text-green-600 dark:text-green-400">{generalStats.statistics.avg_exiting}</div>
                          <p className="text-xs text-muted-foreground mt-1">Avg Exiting</p>
                        </div>
                        <div className={`border p-4 rounded-lg text-center ${generalStats.statistics.net_change >= 0 ? 'bg-green-500/15 border-green-500/40' : 'bg-red-500/15 border-red-500/40'}`}>
                          <div className={`text-xl font-bold ${generalStats.statistics.net_change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {generalStats.statistics.net_change >= 0 ? '+' : ''}{generalStats.statistics.net_change}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Net Change</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">Loading statistics...</div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Object Details Modal */}
      {selectedObject && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{selectedObject.object_id}</h2>
                  {selectedObject.object_type && (
                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedObject.object_type === 'red_box' ? 'bg-red-100 text-red-800' :
                      selectedObject.object_type === 'blue_box' ? 'bg-blue-100 text-blue-800' :
                      selectedObject.object_type === 'black_box' ? 'bg-slate-500/20 text-slate-700 dark:text-slate-300' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedObject.object_type?.replace('_', ' ').toUpperCase()}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedObject(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Object Image */}
              <div className="mb-6">
                <img
                  src={`${API_HOST}${selectedObject.photo_url}`}
                  alt={selectedObject.object_id}
                  className="w-full h-64 object-contain bg-muted rounded"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23ddd" width="400" height="300"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle"%3EImage Not Available%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>

              {/* Object Details */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Object ID</p>
                    <p className="font-semibold text-foreground">{selectedObject.object_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Forklift</p>
                    <p className="font-semibold text-foreground">{selectedObject.forklift_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <span className={`inline-block px-3 py-1 rounded text-xs font-semibold ${
                      selectedObject.status === 'detected' ? 'bg-blue-100 text-blue-800' :
                      selectedObject.status === 'placed' ? 'bg-green-100 text-green-800' :
                      selectedObject.status === 'dispatched' ? 'bg-orange-100 text-orange-800' :
                      'bg-muted text-foreground'
                    }`}>
                      {selectedObject.status.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Detection Time</p>
                    <p className="font-semibold text-foreground">
                      {new Date(selectedObject.detection_timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                    </p>
                  </div>
                </div>

                {selectedObject.position && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Position</p>
                    <p className="font-semibold text-foreground">
                      X: {selectedObject.position.x.toFixed(1)}, 
                      Y: {selectedObject.position.y.toFixed(1)}
                      {selectedObject.position.z && `, Z: ${selectedObject.position.z.toFixed(1)}`}
                    </p>
                  </div>
                )}

                {selectedObject.is_mismatch_flagged && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Location Mismatch: {selectedObject.location_mismatch}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={() => handleUpdateStatus(selectedObject.object_id, 'placed')}
                    className="flex-1"
                    variant="default"
                    disabled={selectedObject.status === 'placed' || selectedObject.status === 'dispatched'}
                  >
                    {selectedObject.status === 'placed' ? '✓ In Warehouse' : 'Place in Warehouse'}
                  </Button>
                  <Button
                    onClick={() => handleUpdateStatus(selectedObject.object_id, 'dispatched')}
                    className="flex-1"
                    variant="outline"
                    disabled={selectedObject.status === 'dispatched'}
                  >
                    {selectedObject.status === 'dispatched' ? '✓ Dispatched' : 'Dispatch Item'}
                  </Button>
                  <Button
                    onClick={() => {
                      handleDeleteObject(selectedObject.object_id);
                      setSelectedObject(null);
                    }}
                    variant="destructive"
                    title="Delete this object from database"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
