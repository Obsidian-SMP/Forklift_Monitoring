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
}

interface DetectedObject {
  id: string;
  object_id: string;
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
  detected_objects: {
    total: number;
    placed: number;
    dispatched: number;
    mismatches: number;
  };
  inventory: {
    total_items: number;
    in_stock: number;
    in_transit: number;
  };
}

export default function InventoryManagement() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [stats, setStats] = useState<WarehouseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'inventory' | 'objects' | 'stats'>('stats');
  const [showAddItem, setShowAddItem] = useState(false);
  const [selectedObject, setSelectedObject] = useState<DetectedObject | null>(null);
  
  // Form state
  const [newItemId, setNewItemId] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('1');
  const [isCapturing, setIsCapturing] = useState(false);
  const [autoDetectEnabled, setAutoDetectEnabled] = useState(false);
  const [lastDetectionTime, setLastDetectionTime] = useState<string | null>(null);
  const [detectionMessage, setDetectionMessage] = useState<string | null>(null);

  const API_BASE = 'http://10.136.57.165:5000/api';

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
        setLastDetectionTime(new Date().toLocaleTimeString());
        
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
    const interval = setInterval(loadAllData, 5000);
    return () => clearInterval(interval);
  }, []);

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

  const addInventoryItem = async () => {
    if (!newItemId || !newItemName) {
      setError('Item ID and Name are required');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: newItemId,
          item_name: newItemName,
          category: newItemCategory,
          quantity: parseInt(newItemQuantity),
          status: 'in_stock'
        })
      });

      if (response.ok) {
        setNewItemId('');
        setNewItemName('');
        setNewItemCategory('');
        setNewItemQuantity('1');
        setShowAddItem(false);
        await fetchInventory();
      } else {
        setError('Failed to add inventory item');
      }
    } catch (err) {
      setError('Error adding item');
      console.error(err);
    }
  };

  const linkObjectToItem = async (objectId: string, itemId: string) => {
    try {
      const response = await fetch(`${API_BASE}/inventory/detected-objects/${objectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory_item_id: itemId })
      });

      if (response.ok) {
        await fetchDetectedObjects();
      }
    } catch (err) {
      console.error('Error linking object:', err);
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
            <p className="text-gray-600">Track objects detected via camera and warehouse inventory</p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="border-red-500 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Objects In</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.warehouse_events.entries}</div>
                <p className="text-xs text-gray-500">forklift entries</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Objects Out</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.warehouse_events.exits}</div>
                <p className="text-xs text-gray-500">forklift exits</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Net Objects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.warehouse_events.net_objects}</div>
                <p className="text-xs text-gray-500">in warehouse</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Detected Objects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.detected_objects.total}</div>
                <p className="text-xs text-gray-500">total detected</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Location Mismatches</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.detected_objects.mismatches}</div>
                <p className="text-xs text-gray-500">flagged</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Inventory Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.inventory.total_items}</div>
                <p className="text-xs text-gray-500">total items</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 font-medium border-b-2 ${
              activeTab === 'stats'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Statistics
          </button>
          <button
            onClick={() => setActiveTab('objects')}
            className={`px-4 py-2 font-medium border-b-2 ${
              activeTab === 'objects'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Detected Objects ({detectedObjects.length})
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 font-medium border-b-2 ${
              activeTab === 'inventory'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
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
                            <div>
                              <CardTitle className="text-lg">{obj.object_id}</CardTitle>
                              <CardDescription>
                                Forklift: {obj.forklift_id}
                              </CardDescription>
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
                                src={`http://10.136.57.165:5000${obj.photo_url}`}
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
                            <span className={`ml-2 px-2 py-1 rounded text-xs ${
                              obj.status === 'detected' ? 'bg-blue-100 text-blue-800' :
                              obj.status === 'placed' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {obj.status}
                            </span>
                          </div>

                          {/* Location Mismatch Flag */}
                          {obj.is_mismatch_flagged && (
                            <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                              <Flag className="w-4 h-4 text-yellow-600" />
                              <div className="text-sm">
                                <p className="font-medium text-yellow-800">Location Mismatch</p>
                                <p className="text-yellow-700">{obj.location_mismatch}</p>
                              </div>
                            </div>
                          )}

                          {/* Position */}
                          <div className="text-sm text-gray-600 flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            X: {obj.position.x?.toFixed(1)}, Y: {obj.position.y?.toFixed(1)}
                          </div>

                          {/* Link to Inventory */}
                          {!obj.inventory_item_id && inventoryItems.length > 0 && (
                            <div>
                              <label className="text-sm font-medium">Link to Inventory</label>
                              <select 
                                onChange={(e) => linkObjectToItem(obj.object_id, e.target.value)}
                                className="w-full mt-1 p-2 border rounded text-sm"
                              >
                                <option value="">Select item...</option>
                                {inventoryItems.map(item => (
                                  <option key={item.id} value={item.item_id}>
                                    {item.item_name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Actions */}
                          <button
                            onClick={() => setSelectedObject(obj)}
                            className="w-full flex items-center justify-center gap-2 p-2 text-blue-600 hover:bg-blue-50 rounded text-sm font-medium"
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Inventory Items</CardTitle>
                  <CardDescription>Manually manage warehouse inventory</CardDescription>
                </div>
                <Button onClick={() => setShowAddItem(true)} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Item Form */}
              {showAddItem && (
                <div className="border rounded p-4 bg-blue-50">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Item ID (e.g., INV-001)"
                      value={newItemId}
                      onChange={(e) => setNewItemId(e.target.value)}
                    />
                    <Input
                      placeholder="Item Name"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                    />
                    <Input
                      placeholder="Category"
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Quantity"
                      value={newItemQuantity}
                      onChange={(e) => setNewItemQuantity(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button onClick={addInventoryItem} size="sm">Create</Button>
                    <Button 
                      onClick={() => setShowAddItem(false)} 
                      variant="outline" 
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Items Table */}
              {inventoryItems.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No inventory items</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">{item.item_id}</TableCell>
                          <TableCell>{item.item_name}</TableCell>
                          <TableCell>{item.category || '-'}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              item.status === 'in_stock' ? 'bg-green-100 text-green-800' :
                              item.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {item.status}
                            </span>
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
            {/* Warehouse Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Warehouse Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{stats.warehouse_events.entries}</div>
                    <p className="text-sm text-gray-600 mt-2">Forklift Entries</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600">{stats.warehouse_events.exits}</div>
                    <p className="text-sm text-gray-600 mt-2">Forklift Exits</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">{stats.warehouse_events.net_objects}</div>
                    <p className="text-sm text-gray-600 mt-2">Net Objects Inside</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Object Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Detected Objects Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Detected</p>
                    <p className="text-2xl font-bold">{stats.detected_objects.total}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Placed in Zone</p>
                    <p className="text-2xl font-bold text-green-600">{stats.detected_objects.placed}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Dispatched</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.detected_objects.dispatched}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Location Mismatch</p>
                    <p className="text-2xl font-bold text-yellow-600">{stats.detected_objects.mismatches}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Object Details Modal */}
      {selectedObject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">{selectedObject.object_id}</h2>
                <button
                  onClick={() => setSelectedObject(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Object Image */}
              <div className="mb-6">
                <img
                  src={`http://10.136.57.165:5000${selectedObject.photo_url}`}
                  alt={selectedObject.object_id}
                  className="w-full h-64 object-contain bg-gray-100 rounded"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23ddd" width="400" height="300"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle"%3EImage Not Available%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>

              {/* Object Details */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Object ID</p>
                    <p className="font-semibold">{selectedObject.object_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Forklift</p>
                    <p className="font-semibold">{selectedObject.forklift_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                      selectedObject.status === 'detected' ? 'bg-blue-100 text-blue-800' :
                      selectedObject.status === 'placed' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedObject.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Detection Time</p>
                    <p className="font-semibold">
                      {new Date(selectedObject.detection_timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>

                {selectedObject.position && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Position</p>
                    <p className="font-semibold">
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
                  >
                    Mark as Placed
                  </Button>
                  <Button
                    onClick={() => handleUpdateStatus(selectedObject.object_id, 'dispatched')}
                    className="flex-1"
                    variant="outline"
                  >
                    Mark as Dispatched
                  </Button>
                  <Button
                    onClick={() => {
                      handleDeleteObject(selectedObject.object_id);
                      setSelectedObject(null);
                    }}
                    variant="destructive"
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
