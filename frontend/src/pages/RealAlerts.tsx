import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Bell, Check, Filter, Search, Clock, CheckCircle2, XCircle, Settings, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  source: string;
  timestamp: string;
  metadata?: any;
  acknowledged?: boolean;
}

interface AlertSettings {
  low_stock_threshold: number;
  confidence_threshold: number;
  enabled_alerts: Record<string, boolean>;
  notification_channels: Record<string, boolean>;
  notification_recipients: {
    email: string[];
    sms: string[];
  };
}

export default function RealAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertSettings, setAlertSettings] = useState<AlertSettings | null>(null);
  const [alertStats, setAlertStats] = useState<any>(null);
  const [inventoryStats, setInventoryStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const API_BASE = 'http://10.136.57.165:5000/api';

  // Fetch all data
  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchAllData = async () => {
    try {
      const [alertsRes, settingsRes, statsRes, inventoryRes] = await Promise.all([
        fetch(`${API_BASE}/alerts`).then(r => r.json()),
        fetch(`${API_BASE}/alerts/settings`).then(r => r.json()),
        fetch(`${API_BASE}/alerts/statistics`).then(r => r.json()),
        fetch(`${API_BASE}/alerts/inventory-analytics`).then(r => r.json()),
      ]);

      setAlerts(alertsRes.alerts || []);
      setAlertSettings(settingsRes);
      setAlertStats(statsRes);
      setInventoryStats(inventoryRes);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setLoading(false);
    }
  };

  const handleUpdateSettings = async (key: string, value: any) => {
    try {
      const updated = {
        ...alertSettings,
        [key]: value,
      };
      
      const response = await fetch(`${API_BASE}/alerts/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      if (response.ok) {
        const result = await response.json();
        setAlertSettings(result.settings);
        toast({
          title: 'Settings Updated',
          description: 'Alert settings have been updated successfully.',
        });
      }
    } catch (err) {
      console.error('Error updating settings:', err);
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        variant: 'destructive',
      });
    }
  };

  const toggleAlertType = async (alertType: string, enabled: boolean) => {
    try {
      const response = await fetch(`${API_BASE}/alerts/settings/alert-type/${alertType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        await fetchAllData();
        toast({
          title: 'Alert Updated',
          description: `${alertType} alerts ${enabled ? 'enabled' : 'disabled'}.`,
        });
      }
    } catch (err) {
      console.error('Error toggling alert:', err);
    }
  };

  const severityConfig: Record<string, { color: string; bg: string; icon: string }> = {
    critical: { color: 'text-red-600', bg: 'bg-red-50', icon: '🔴' },
    high: { color: 'text-orange-600', bg: 'bg-orange-50', icon: '🟠' },
    medium: { color: 'text-yellow-600', bg: 'bg-yellow-50', icon: '🟡' },
    low: { color: 'text-blue-600', bg: 'bg-blue-50', icon: '🔵' },
    info: { color: 'text-green-600', bg: 'bg-green-50', icon: '🟢' },
  };

  const typeIcons: Record<string, string> = {
    inventory_detected: '📦',
    inventory_mismatch: '⚠️',
    forklift_entry: '📥',
    forklift_exit: '📤',
    forklift_in_zone: '📍',
    low_inventory: '📉',
    out_of_stock: '❌',
    item_added: '✅',
    high_detection_confidence: '✨',
    low_detection_confidence: '❓',
  };

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter;
    const matchesType = typeFilter === 'all' || alert.type === typeFilter;
    return matchesSearch && matchesSeverity && matchesType;
  });

  const alertTypes = [...new Set(alerts.map(a => a.type))];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Loading alerts...</div>
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
            <h1 className="text-2xl font-bold tracking-tight">Real-Time Alerts & Notifications</h1>
            <p className="text-muted-foreground">Live alerts from warehouse operations and inventory</p>
          </div>
          <Button 
            onClick={() => setShowSettings(!showSettings)}
            variant={showSettings ? 'default' : 'outline'}
          >
            <Settings className="h-4 w-4 mr-2" />
            {showSettings ? 'Hide' : 'Alert'} Settings
          </Button>
        </div>

        {/* Alert Statistics Cards */}
        {alertStats && alertStats.by_severity && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{alertStats.total || 0}</div>
                <p className="text-xs text-gray-500">all time</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-red-600">Critical</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{alertStats.by_severity?.critical || 0}</div>
                <p className="text-xs text-gray-500">immediate action</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-orange-600">High</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{alertStats.by_severity?.high || 0}</div>
                <p className="text-xs text-gray-500">attention needed</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-yellow-600">Medium</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{alertStats.by_severity?.medium || 0}</div>
                <p className="text-xs text-gray-500">monitor</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-blue-600">Recent (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{alertStats.recent_24h || 0}</div>
                <p className="text-xs text-gray-500">last 24 hours</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && alertSettings && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle>Alert Configuration</CardTitle>
              <CardDescription>Customize alert thresholds and notification settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Thresholds */}
              <div className="space-y-4">
                <h3 className="font-semibold">Thresholds</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Low Stock Threshold</label>
                    <Input
                      type="number"
                      value={alertSettings.low_stock_threshold}
                      onChange={(e) => handleUpdateSettings('low_stock_threshold', parseInt(e.target.value))}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Items below this quantity trigger low stock alert</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Confidence Threshold</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={alertSettings.confidence_threshold}
                      onChange={(e) => handleUpdateSettings('confidence_threshold', parseFloat(e.target.value))}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Detection confidence below this value triggers alert</p>
                  </div>
                </div>
              </div>

              {/* Notification Channels */}
              <div className="space-y-4">
                <h3 className="font-semibold">Notification Channels</h3>
                <div className="flex gap-4">
                  {Object.entries(alertSettings.notification_channels).map(([channel, enabled]) => (
                    <label key={channel} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enabled as boolean}
                        onChange={(e) => {
                          const updated = {
                            ...alertSettings.notification_channels,
                            [channel]: e.target.checked,
                          };
                          handleUpdateSettings('notification_channels', updated);
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm capitalize">{channel}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Enable/Disable Alert Types */}
              <div className="space-y-4">
                <h3 className="font-semibold">Alert Types</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(alertSettings.enabled_alerts).map(([alertType, enabled]) => (
                    <label key={alertType} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-100 rounded">
                      <input
                        type="checkbox"
                        checked={enabled as boolean}
                        onChange={(e) => toggleAlertType(alertType, e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm capitalize">{alertType.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Inventory Statistics */}
        {inventoryStats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Inventory Statistics
              </CardTitle>
              <CardDescription>Real-time inventory status and movement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500 font-medium">Total Items</p>
                  <p className="text-2xl font-bold">{inventoryStats.summary.total_items}</p>
                </div>
                <div className="border rounded-lg p-3 bg-green-50">
                  <p className="text-xs text-gray-500 font-medium">Remaining</p>
                  <p className="text-2xl font-bold text-green-600">{inventoryStats.summary.total_quantity_remaining}</p>
                </div>
                <div className="border rounded-lg p-3 bg-blue-50">
                  <p className="text-xs text-gray-500 font-medium">Supplied (Out)</p>
                  <p className="text-2xl font-bold text-blue-600">{inventoryStats.summary.total_supplied}</p>
                </div>
                <div className="border rounded-lg p-3 bg-red-50">
                  <p className="text-xs text-gray-500 font-medium">Out of Stock</p>
                  <p className="text-2xl font-bold text-red-600">{inventoryStats.summary.out_of_stock}</p>
                </div>
                <div className="border rounded-lg p-3 bg-yellow-50">
                  <p className="text-xs text-gray-500 font-medium">Low Stock</p>
                  <p className="text-2xl font-bold text-yellow-600">{inventoryStats.summary.low_stock}</p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500 font-medium">Threshold</p>
                  <p className="text-2xl font-bold">{inventoryStats.threshold_settings.low_stock_threshold}</p>
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-semibold mb-4">Status Distribution</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(inventoryStats.status_breakdown).map(([status, count]) => (
                    <div key={status} className="p-4 border rounded-lg">
                      <p className="text-sm text-gray-600 capitalize">{status.replace('_', ' ')}</p>
                      <p className="text-3xl font-bold mt-2">{count}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category Breakdown */}
              {Object.keys(inventoryStats.categories).length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-semibold mb-4">Category Breakdown</h4>
                  <div className="space-y-2">
                    {Object.entries(inventoryStats.categories).map(([category, data]: any) => (
                      <div key={category} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                        <span className="text-sm">{category}</span>
                        <div className="flex gap-4">
                          <span className="text-sm text-gray-600">Items: {data.total}</span>
                          <span className="text-sm font-medium">Qty: {data.quantity}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Alert List */}
        <Card>
          <CardHeader>
            <CardTitle>Alert Feed</CardTitle>
            <CardDescription>Real-time alerts from warehouse operations</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search alerts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full"
                />
              </div>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {alertTypes.map(type => (
                    <SelectItem key={type} value={type} className="capitalize">
                      {typeIcons[type]} {type.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Alert List */}
            <div className="space-y-3">
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No alerts match your filters</p>
                </div>
              ) : (
                filteredAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      'flex items-start gap-4 p-4 rounded-lg border',
                      severityConfig[alert.severity].bg
                    )}
                  >
                    {/* Icon */}
                    <div className="text-2xl shrink-0">{typeIcons[alert.type] || '⚡'}</div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="capitalize text-xs">
                          {alert.severity}
                        </Badge>
                        <Badge variant="outline" className="capitalize text-xs">
                          {alert.type.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="font-medium">{alert.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>Source: {alert.source}</span>
                        <span>•</span>
                        <span>{new Date(alert.timestamp).toLocaleString()}</span>
                      </div>
                      {alert.metadata && (
                        <div className="text-xs text-muted-foreground mt-2">
                          {JSON.stringify(alert.metadata, null, 2).split('\n').slice(0, 3).join(' ')}...
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
