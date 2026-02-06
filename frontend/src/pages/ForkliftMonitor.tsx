import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Camera, Wifi, RefreshCw, Trash2, Plus, X } from 'lucide-react';

interface ForkliftCamera {
  id: string;
  ip: string | null;
  status: string;
  stream_url: string | null;
}

export default function ForkliftMonitor() {
  const [forklifts, setForklifts] = useState<ForkliftCamera[]>([]);
  const [selectedForklift, setSelectedForklift] = useState<string>('forklift-001');
  const [cameraIp, setCameraIp] = useState<string>('');
  const [showIpInput, setShowIpInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForkliftModal, setShowAddForkliftModal] = useState(false);
  const [newForkliftId, setNewForkliftId] = useState<string>('');

  // Fetch forklift list on mount
  useEffect(() => {
    fetchForkliftList();
    
    // Refresh forklift list every 10 seconds to detect newly discovered forklifts from RSSI
    const interval = setInterval(fetchForkliftList, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchForkliftList = async () => {
    try {
      setError(null);
      const response = await fetch('http://10.136.57.165:5000/api/camera/forklifts');
      
      if (response.ok) {
        const data = await response.json();
        setForklifts(data.forklifts);
        
        // Set first available forklift as selected, or default to forklift-001
        if (data.forklifts.length > 0) {
          const defaultForklift = data.forklifts.find((f: ForkliftCamera) => f.id === 'forklift-001') || data.forklifts[0];
          setSelectedForklift(defaultForklift.id);
        }
      } else {
        setError('Failed to fetch forklift list');
      }
    } catch (err) {
      setError('Failed to connect to camera service');
      console.error('Error fetching forklift list:', err);
    } finally {
      setLoading(false);
    }
  };

  const registerCamera = async () => {
    if (!cameraIp) {
      setError('Please enter camera IP address');
      return;
    }

    try {
      setError(null);
      const response = await fetch(`http://10.136.57.165:5000/api/camera/${selectedForklift}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: cameraIp })
      });

      if (response.ok) {
        const data = await response.json();
        setCameraIp('');
        setShowIpInput(false);
        await fetchForkliftList();
      } else {
        setError('Failed to register camera');
      }
    } catch (err) {
      setError('Error registering camera');
      console.error('Error:', err);
    }
  };

  const unregisterCamera = async () => {
    try {
      setError(null);
      const response = await fetch(`http://10.136.57.165:5000/api/camera/${selectedForklift}/unregister`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        await fetchForkliftList();
      } else {
        setError('Failed to unregister camera');
      }
    } catch (err) {
      setError('Error unregistering camera');
      console.error('Error:', err);
    }
  };

  const addForklift = async () => {
    if (!newForkliftId.trim()) {
      setError('Please enter a forklift ID');
      return;
    }

    try {
      setError(null);
      const response = await fetch(`http://10.136.57.165:5000/api/camera/${newForkliftId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: null })
      });

      if (response.ok) {
        setNewForkliftId('');
        setShowAddForkliftModal(false);
        await fetchForkliftList();
      } else {
        setError('Failed to add forklift');
      }
    } catch (err) {
      setError('Error adding forklift');
      console.error('Error:', err);
    }
  };

  const deleteForklift = async (forkliftId: string) => {
    if (forkliftId === 'forklift-001') {
      setError('Cannot delete forklift-001 (default forklift)');
      return;
    }

    try {
      setError(null);
      const response = await fetch(`http://10.136.57.165:5000/api/camera/${forkliftId}/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        await fetchForkliftList();
        // If deleted forklift was selected, switch to forklift-001
        if (selectedForklift === forkliftId) {
          setSelectedForklift('forklift-001');
        }
      } else {
        setError('Failed to delete forklift');
      }
    } catch (err) {
      setError('Error deleting forklift');
      console.error('Error:', err);
    }
  };

  const currentForklift = forklifts.find(f => f.id === selectedForklift);
  const streamUrl = currentForklift?.stream_url ? `http://10.136.57.165:5000${currentForklift.stream_url}` : '';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Camera className="w-8 h-8" />
              Forklift Monitor
            </h1>
            <p className="text-muted-foreground">Live camera streams for forklift fleet</p>
          </div>
          <Button variant="outline" onClick={fetchForkliftList}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Forklift Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Select Forklift</CardTitle>
                <CardDescription>Choose which forklift camera to monitor</CardDescription>
              </div>
              <Button 
                onClick={() => setShowAddForkliftModal(true)}
                variant="outline"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Forklift
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap items-center">
              {forklifts.map((forklift) => (
                <div key={forklift.id} className="relative flex items-center">
                  <Button
                    onClick={() => setSelectedForklift(forklift.id)}
                    variant={selectedForklift === forklift.id ? 'default' : 'outline'}
                    className="relative pr-8"
                  >
                    {forklift.id}
                    {forklift.status === 'online' && (
                      <span className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full -mr-1 -mt-1"></span>
                    )}
                  </Button>
                  {forklift.id !== 'forklift-001' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteForklift(forklift.id);
                      }}
                      className="ml-1 p-1 text-muted-foreground hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded transition"
                      title={`Delete ${forklift.id}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Add Forklift Modal */}
        {showAddForkliftModal && (
          <Card className="border-blue-500 bg-blue-500/10">
            <CardHeader>
              <CardTitle>Add Forklift (Testing)</CardTitle>
              <CardDescription>Create a new forklift entry for testing multi-camera functionality</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Forklift ID</label>
                  <Input
                    placeholder="e.g., forklift-002"
                    value={newForkliftId}
                    onChange={(e) => setNewForkliftId(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={addForklift}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Forklift
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowAddForkliftModal(false);
                      setNewForkliftId('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Alerts */}
        {error && (
          <Alert className="border-red-500 bg-red-500/10">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-800 dark:text-red-300">{error}</AlertDescription>
          </Alert>
        )}

        {currentForklift && currentForklift.status === 'online' && (
          <Alert className="border-green-500 bg-green-500/10">
            <AlertDescription className="text-green-800 dark:text-green-300">
              ✓ Camera online - {currentForklift.ip}
            </AlertDescription>
          </Alert>
        )}

        {currentForklift && currentForklift.status === 'offline' && currentForklift.ip && (
          <Alert className="border-yellow-500 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-300">
              ⚠️ Camera offline - Last IP: {currentForklift.ip}
            </AlertDescription>
          </Alert>
        )}

        {currentForklift && !currentForklift.ip && (
          <Alert className="border-blue-500 bg-blue-500/10">
            <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-300">
              📡 No camera registered for {selectedForklift}
            </AlertDescription>
          </Alert>
        )}

        {/* Camera Management */}
        <Card>
          <CardHeader>
            <CardTitle>Camera Configuration</CardTitle>
            <CardDescription>Register or update camera for {selectedForklift}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {showIpInput ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., 192.168.1.100"
                    value={cameraIp}
                    onChange={(e) => setCameraIp(e.target.value)}
                  />
                  <Button onClick={registerCamera}>Register</Button>
                  <Button variant="outline" onClick={() => setShowIpInput(false)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={() => setShowIpInput(true)}>
                    <Wifi className="w-4 h-4 mr-2" />
                    {currentForklift?.ip ? 'Update Camera IP' : 'Register Camera'}
                  </Button>
                  {currentForklift?.ip && (
                    <Button 
                      variant="destructive" 
                      onClick={unregisterCamera}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Unregister
                    </Button>
                  )}
                </div>
              )}
              {currentForklift?.ip && (
                <p className="text-sm text-muted-foreground">Current IP: <span className="font-mono">{currentForklift.ip}</span></p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Camera Stream */}
        {currentForklift?.status === 'online' && streamUrl && (
          <Card>
            <CardHeader>
              <CardTitle>Live Camera Stream</CardTitle>
              <CardDescription>{selectedForklift} - Real-time MJPEG stream</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-black rounded-lg overflow-hidden aspect-video">
                <img
                  src={streamUrl}
                  alt={`${selectedForklift} Camera Stream`}
                  className="w-full h-full object-contain"
                  onError={() => setError('Failed to load camera stream')}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {currentForklift && currentForklift.status !== 'online' && (
          <Card>
            <CardHeader>
              <CardTitle>Camera Offline</CardTitle>
              <CardDescription>{selectedForklift}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-64 bg-muted rounded">
              <div className="text-center">
                <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">Camera is offline or not registered</p>
                <p className="text-sm text-muted-foreground">Register a camera to start monitoring</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stream Info */}
        {currentForklift?.ip && (
          <Card>
            <CardHeader>
              <CardTitle>Camera Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold">Forklift:</span> {selectedForklift}</p>
                <p><span className="font-semibold">IP Address:</span> <code className="bg-muted px-2 py-1 rounded">{currentForklift.ip}</code></p>
                <p><span className="font-semibold">Status:</span> {currentForklift.status === 'online' ? '✓ Online' : '✗ Offline'}</p>
                <p><span className="font-semibold">Stream Type:</span> MJPEG</p>
                <p><span className="font-semibold">Resolution:</span> 640×480 @ 30 FPS</p>
                <p><span className="font-semibold">Stream URL:</span> <code className="bg-muted px-2 py-1 rounded text-xs">/api/camera/{selectedForklift}/stream</code></p>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </DashboardLayout>
  );
}
