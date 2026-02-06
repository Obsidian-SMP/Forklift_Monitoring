import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Bell, Check, Filter, Search, Clock, CheckCircle2, XCircle, Settings } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const API_BASE = 'http://10.136.57.165:5000/api';

  // Fetch all data
  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchAllData = async () => {
    try {
      const [alertsRes, settingsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/alerts`).then(r => r.json()),
        fetch(`${API_BASE}/alerts/settings`).then(r => r.json()),
        fetch(`${API_BASE}/alerts/statistics`).then(r => r.json()),
      ]);

      setAlerts(alertsRes.alerts || []);
      setAlertSettings(settingsRes);
      setAlertStats(statsRes);
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

  const handleDeleteRecipient = async (type: 'email' | 'sms', value: string) => {
    if (!alertSettings) return;

    try {
      const updatedRecipients = {
        ...alertSettings.notification_recipients,
        [type]: alertSettings.notification_recipients?.[type]?.filter((item: string) => item !== value) || [],
      };

      const response = await fetch(`${API_BASE}/alerts/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_recipients: updatedRecipients }),
      });

      if (response.ok) {
        const result = await response.json();
        setAlertSettings(result.settings);
        toast({
          title: '✅ Recipient Removed',
          description: `${type === 'email' ? 'Email' : 'Phone number'} has been removed from notifications.`,
        });
      }
    } catch (err) {
      console.error('Error removing recipient:', err);
      toast({
        title: 'Error',
        description: 'Failed to remove recipient',
        variant: 'destructive',
      });
    }
  };

  const handleAddRecipient = async () => {
    if (!alertSettings) return;

    const isEmailEnabled = alertSettings.notification_channels?.email;
    const isPhoneEnabled = alertSettings.notification_channels?.whatsapp;

    // Check if at least one field is filled
    if (!newEmail && !newPhone) {
      toast({
        title: 'Invalid Input',
        description: 'Please enter at least an email or phone number.',
        variant: 'destructive',
      });
      return;
    }

    // Validate email if provided and email channel is enabled
    if (newEmail && !isEmailEnabled) {
      toast({
        title: 'Invalid Input',
        description: 'Email channel is not enabled. Please enable email notifications first.',
        variant: 'destructive',
      });
      return;
    }

    // Validate phone if provided and phone channel is enabled
    if (newPhone && !isPhoneEnabled) {
      toast({
        title: 'Invalid Input',
        description: 'WhatsApp channel is not enabled. Please enable WhatsApp notifications first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const updatedRecipients = {
        email: isEmailEnabled && newEmail ? [...(alertSettings.notification_recipients?.email || []), newEmail] : (alertSettings.notification_recipients?.email || []),
        sms: isPhoneEnabled && newPhone ? [...(alertSettings.notification_recipients?.sms || []), newPhone] : (alertSettings.notification_recipients?.sms || []),
      };

      const response = await fetch(`${API_BASE}/alerts/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_recipients: updatedRecipients }),
      });

      if (response.ok) {
        const result = await response.json();
        setAlertSettings(result.settings);
        setNewEmail('');
        setNewPhone('');
        
        // Show success message with test notification results
        const testResults = result.test_notifications;
        let description = 'Notification recipients have been saved successfully.';
        
        if (testResults && testResults.total_count > 0) {
          description += ` Test notifications sent: ${testResults.success_count}/${testResults.total_count} delivered.`;
        }
        
        toast({
          title: '✅ Recipients Updated',
          description,
        });
      }
    } catch (err) {
      console.error('Error adding recipient:', err);
      toast({
        title: 'Error',
        description: 'Failed to save recipient',
        variant: 'destructive',
      });
    }
  };

  const severityConfig: Record<string, { color: string; bg: string; icon: string }> = {
    critical: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: '🔴' },
    high: { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', icon: '🟠' },
    medium: { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: '🟡' },
    low: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', icon: '🔵' },
    info: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10 border-green-500/30', icon: '🟢' },
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
                <p className="text-xs text-muted-foreground">all time</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-red-600 dark:text-red-400">Critical</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{alertStats.by_severity?.critical || 0}</div>
                <p className="text-xs text-muted-foreground">immediate action</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-orange-600 dark:text-orange-400">High</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{alertStats.by_severity?.high || 0}</div>
                <p className="text-xs text-muted-foreground">attention needed</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Medium</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{alertStats.by_severity?.medium || 0}</div>
                <p className="text-xs text-muted-foreground">monitor</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-blue-600 dark:text-blue-400">Recent (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{alertStats.recent_24h || 0}</div>
                <p className="text-xs text-muted-foreground">last 24 hours</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && alertSettings && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle>Alert Configuration</CardTitle>
              <CardDescription>Customize alert thresholds and notification settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Thresholds */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground">Thresholds</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Low Stock Threshold</label>
                    <Input
                      type="number"
                      value={alertSettings.low_stock_threshold}
                      onChange={(e) => handleUpdateSettings('low_stock_threshold', parseInt(e.target.value))}
                      className="mt-1 bg-background"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Items below this quantity trigger low stock alert</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Confidence Threshold</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={alertSettings.confidence_threshold}
                      onChange={(e) => handleUpdateSettings('confidence_threshold', parseFloat(e.target.value))}
                      className="mt-1 bg-background"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Detection confidence below this value triggers alert</p>
                  </div>
                </div>
              </div>

              {/* Notification Channels */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground">Notification Channels</h3>
                <div className="flex gap-4 flex-wrap">
                  {['email', 'whatsapp'].map((channel) => (
                    <label key={channel} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alertSettings.notification_channels?.[channel] || false}
                        onChange={(e) => {
                          const updated = {
                            ...alertSettings.notification_channels,
                            [channel]: e.target.checked,
                          };
                          handleUpdateSettings('notification_channels', updated);
                        }}
                        className="w-4 h-4 rounded border-input bg-background ring-offset-background accent-primary cursor-pointer"
                      />
                      <span className="text-sm capitalize text-foreground">{channel}</span>
                    </label>
                  ))}
                </div>
                
                {/* Recipient Configuration */}
                {(alertSettings.notification_channels?.email || alertSettings.notification_channels?.whatsapp) && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border space-y-3">
                    <h4 className="font-medium text-sm text-foreground">Add Recipients</h4>
                    
                    {alertSettings.notification_channels?.email && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Email Address</label>
                        <Input
                          type="email"
                          placeholder="Enter email address"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          className="bg-background"
                        />
                        {alertSettings.notification_recipients?.email && alertSettings.notification_recipients.email.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {alertSettings.notification_recipients.email.map((email, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs flex items-center gap-1">
                                {email}
                                <button
                                  onClick={() => handleDeleteRecipient('email', email)}
                                  className="ml-1 hover:text-red-500 transition-colors"
                                  title="Remove email"
                                >
                                  ✕
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {alertSettings.notification_channels?.whatsapp && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Phone Number (WhatsApp)</label>
                        <Input
                          type="tel"
                          placeholder="Enter phone number (e.g., +919916570764)"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          className="bg-background"
                        />
                        {alertSettings.notification_recipients?.sms && alertSettings.notification_recipients.sms.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {alertSettings.notification_recipients.sms.map((phone, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs flex items-center gap-1">
                                {phone}
                                <button
                                  onClick={() => handleDeleteRecipient('sms', phone)}
                                  className="ml-1 hover:text-red-500 transition-colors"
                                  title="Remove phone number"
                                >
                                  ✕
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <Button 
                      onClick={handleAddRecipient}
                      size="sm"
                      className="w-full"
                    >
                      Add Recipient
                    </Button>
                  </div>
                )}
              </div>

              {/* Enable/Disable Alert Types */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground">Alert Types</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(alertSettings.enabled_alerts).map(([alertType, enabled]) => (
                    <label key={alertType} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-accent rounded">
                      <input
                        type="checkbox"
                        checked={enabled as boolean}
                        onChange={(e) => toggleAlertType(alertType, e.target.checked)}
                        className="w-4 h-4 rounded border-input bg-background ring-offset-background accent-primary cursor-pointer"
                      />
                      <span className="text-sm capitalize text-foreground">{alertType.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
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
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "capitalize text-xs",
                            alert.severity === 'critical' && "border-red-500/50 text-red-600 dark:text-red-400 bg-red-500/10",
                            alert.severity === 'high' && "border-orange-500/50 text-orange-600 dark:text-orange-400 bg-orange-500/10",
                            alert.severity === 'medium' && "border-yellow-500/50 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10",
                            alert.severity === 'low' && "border-blue-500/50 text-blue-600 dark:text-blue-400 bg-blue-500/10",
                            alert.severity === 'info' && "border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/10"
                          )}
                        >
                          {alert.severity}
                        </Badge>
                        <Badge variant="outline" className="capitalize text-xs border-border bg-muted">
                          {alert.type.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="font-medium text-foreground">{alert.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>Source: {alert.source}</span>
                        <span>•</span>
                        <span>{new Date(alert.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
                      </div>
                      {alert.metadata && (
                        <div className="text-xs text-muted-foreground mt-2 font-mono bg-muted/50 p-2 rounded">
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
