/**
 * Gateway Management Page
 * Add, update, and view WiFi gateway configurations
 */

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Wifi, MapPin, Plus, RefreshCw } from 'lucide-react';
import apiService from '@/services/api';

interface Gateway {
  id: number;
  gateway_id: string;
  name: string;
  location_x: number;
  location_y: number;
  location_z: number;
  is_active: boolean;
  last_seen: string;
  created_at?: string;
}

export default function GatewayManagement() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    location_x: 0,
    location_y: 0,
    location_z: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch all gateways
  const fetchGateways = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getAllGateways();
      setGateways(response.gateways || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch gateways');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGateways();
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate form
      if (!formData.name.trim()) {
        setError('Gateway name is required');
        setSubmitting(false);
        return;
      }

      const response = await apiService.addOrUpdateGateway(
        formData.name,
        formData.location_x,
        formData.location_y,
        formData.location_z
      );

      setSuccess(`Gateway "${formData.name}" ${response.status === 'created' ? 'created' : 'updated'} successfully!`);
      
      // Reset form
      setFormData({
        name: '',
        location_x: 0,
        location_y: 0,
        location_z: 0,
      });

      // Refresh gateway list
      await fetchGateways();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add/update gateway');
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              📡 Gateway Management
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Add and manage WiFi gateways for position tracking
            </p>
          </div>
          <button
            onClick={fetchGateways}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <Alert className="bg-red-500/10 border border-red-500">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-500 ml-2">{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="bg-green-500/10 border border-green-500">
            <AlertCircle className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-500 ml-2">{success}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add/Update Gateway Form */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add/Update Gateway
              </CardTitle>
              <CardDescription>
                Enter gateway details or update existing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Gateway Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Gateway Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., phone_1, office_gateway"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Location X */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    X Position (meters) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="10.5"
                    value={formData.location_x}
                    onChange={(e) => setFormData({ ...formData, location_x: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Location Y */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Y Position (meters) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="20.3"
                    value={formData.location_y}
                    onChange={(e) => setFormData({ ...formData, location_y: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Location Z */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Z Position (height in meters)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="1.5"
                    value={formData.location_z}
                    onChange={(e) => setFormData({ ...formData, location_z: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting || !formData.name.trim()}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition font-semibold"
                >
                  {submitting ? 'Saving...' : 'Save Gateway'}
                </button>
              </form>
            </CardContent>
          </Card>

          {/* Gateways List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="w-5 h-5" />
                Configured Gateways
              </CardTitle>
              <CardDescription>
                Total: {gateways.length} gateway(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : gateways.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No gateways configured yet. Add one using the form!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {gateways.map((gateway) => (
                    <div
                      key={gateway.id}
                      className="bg-slate-700 dark:bg-slate-800 rounded-lg p-4 space-y-2"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Wifi className="w-4 h-4 text-blue-400" />
                          <h3 className="font-bold text-white text-lg">{gateway.name}</h3>
                          <Badge
                            className={`${
                              gateway.is_active
                                ? 'bg-green-500/20 text-green-300'
                                : 'bg-gray-500/20 text-gray-300'
                            }`}
                          >
                            {gateway.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>

                      {/* Position Info */}
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-blue-400" />
                          <span className="text-gray-300">
                            X: <span className="font-mono text-blue-300">{gateway.location_x.toFixed(2)}m</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-green-400" />
                          <span className="text-gray-300">
                            Y: <span className="font-mono text-green-300">{gateway.location_y.toFixed(2)}m</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-purple-400" />
                          <span className="text-gray-300">
                            Z: <span className="font-mono text-purple-300">{gateway.location_z.toFixed(2)}m</span>
                          </span>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="text-xs text-gray-400 border-t border-slate-600 pt-2 mt-2">
                        <div>ID: <span className="font-mono">{gateway.gateway_id}</span></div>
                        <div>Last Seen: {formatTime(gateway.last_seen)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info Section */}
        <Card className="bg-blue-500/10 border border-blue-500/30">
          <CardHeader>
            <CardTitle className="text-blue-400">How to Use</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <p>
              <strong>Add New Gateway:</strong> Enter a unique gateway name and its position (X, Y, Z coordinates in meters). Click "Save Gateway" to create it.
            </p>
            <p>
              <strong>Update Position:</strong> If you enter a name that already exists, the gateway's position will be updated with the new coordinates.
            </p>
            <p>
              <strong>Real-time Tracking:</strong> Gateways automatically become active when they send RSSI signals. The "Last Seen" timestamp updates whenever the gateway sends data.
            </p>
            <p>
              <strong>Position Format:</strong> Use real-world coordinates relative to your warehouse reference point (e.g., 0,0 at entrance).
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
