import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { StatusIndicator } from '@/components/dashboard/StatusIndicator';
import { mockThresholdSettings, mockAlertRules, mockForklifts, mockUsers } from '@/data/mockData';
import { 
  Settings as SettingsIcon, 
  Thermometer, 
  Bell, 
  Truck, 
  Users,
  Map,
  Save,
  Plus,
  Trash2,
  Edit2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function Settings() {
  const [thresholds, setThresholds] = useState(mockThresholdSettings);
  const [alertRules, setAlertRules] = useState(mockAlertRules);

  const handleThresholdToggle = (id: string) => {
    setThresholds(prev => prev.map(t => 
      t.id === id ? { ...t, enabled: !t.enabled } : t
    ));
  };

  const handleAlertRuleToggle = (id: string) => {
    setAlertRules(prev => prev.map(r => 
      r.id === id ? { ...r, enabled: !r.enabled } : r
    ));
  };

  const handleSave = () => {
    toast({
      title: 'Settings Saved',
      description: 'Your changes have been saved successfully.',
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">Configure system thresholds and alerts</p>
          </div>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>

        {/* Settings Tabs */}
        <Tabs defaultValue="thresholds" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="thresholds" className="gap-2">
              <Thermometer className="h-4 w-4" />
              <span className="hidden sm:inline">Thresholds</span>
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Alert Rules</span>
            </TabsTrigger>
            <TabsTrigger value="forklifts" className="gap-2">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Forklifts</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="map" className="gap-2">
              <Map className="h-4 w-4" />
              <span className="hidden sm:inline">Map</span>
            </TabsTrigger>
          </TabsList>

          {/* Sensor Thresholds */}
          <TabsContent value="thresholds">
            <DashboardCard 
              title="Sensor Thresholds" 
              description="Configure warning and danger levels for sensors"
              actions={
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Threshold
                </Button>
              }
            >
              <div className="space-y-6 mt-4">
                {thresholds.map((threshold) => (
                  <div 
                    key={threshold.id}
                    className={cn(
                      'p-4 rounded-lg border',
                      !threshold.enabled && 'opacity-50'
                    )}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-medium">{threshold.name}</h4>
                        <p className="text-sm text-muted-foreground">Metric: {threshold.metric}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Switch 
                          checked={threshold.enabled} 
                          onCheckedChange={() => handleThresholdToggle(threshold.id)}
                        />
                        <Button variant="ghost" size="icon">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {threshold.warningMin !== undefined && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Warning Min</Label>
                          <Input 
                            type="number" 
                            value={threshold.warningMin} 
                            className="mt-1"
                            disabled={!threshold.enabled}
                          />
                        </div>
                      )}
                      {threshold.warningMax !== undefined && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Warning Max</Label>
                          <Input 
                            type="number" 
                            value={threshold.warningMax} 
                            className="mt-1"
                            disabled={!threshold.enabled}
                          />
                        </div>
                      )}
                      {threshold.dangerMin !== undefined && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Danger Min</Label>
                          <Input 
                            type="number" 
                            value={threshold.dangerMin} 
                            className="mt-1"
                            disabled={!threshold.enabled}
                          />
                        </div>
                      )}
                      {threshold.dangerMax !== undefined && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Danger Max</Label>
                          <Input 
                            type="number" 
                            value={threshold.dangerMax} 
                            className="mt-1"
                            disabled={!threshold.enabled}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </DashboardCard>
          </TabsContent>

          {/* Alert Rules */}
          <TabsContent value="alerts">
            <DashboardCard 
              title="Alert Rules" 
              description="Configure alert conditions and notifications"
              actions={
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              }
            >
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule Name</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Notifications</TableHead>
                    <TableHead>Enabled</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alertRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell className="font-mono text-sm">{rule.condition}</TableCell>
                      <TableCell>
                        <StatusIndicator 
                          variant={
                            rule.severity === 'critical' ? 'danger' :
                            rule.severity === 'high' ? 'warning' :
                            'safe'
                          }
                          label={rule.severity}
                          size="sm"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {rule.notifyEmail && <Badge variant="secondary">Email</Badge>}
                          {rule.notifySms && <Badge variant="secondary">SMS</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch 
                          checked={rule.enabled} 
                          onCheckedChange={() => handleAlertRuleToggle(rule.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DashboardCard>
          </TabsContent>

          {/* Forklift Registration */}
          <TabsContent value="forklifts">
            <DashboardCard 
              title="Forklift Registration" 
              description="Manage registered forklifts"
              actions={
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Register Forklift
                </Button>
              }
            >
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Operator</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockForklifts.map((forklift) => (
                    <TableRow key={forklift.id}>
                      <TableCell className="font-mono">{forklift.id}</TableCell>
                      <TableCell className="font-medium">{forklift.name}</TableCell>
                      <TableCell>
                        <StatusIndicator 
                          variant={
                            forklift.status === 'offline' ? 'offline' :
                            forklift.status === 'maintenance' ? 'danger' :
                            forklift.status === 'idle' || forklift.status === 'charging' ? 'warning' :
                            'safe'
                          }
                          label={forklift.status}
                          size="sm"
                        />
                      </TableCell>
                      <TableCell>{forklift.zone}</TableCell>
                      <TableCell>{forklift.operator || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DashboardCard>
          </TabsContent>

          {/* User Roles */}
          <TabsContent value="users">
            <DashboardCard 
              title="User Management" 
              description="Manage user access and roles"
              actions={
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              }
            >
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DashboardCard>
          </TabsContent>

          {/* Map Calibration */}
          <TabsContent value="map">
            <DashboardCard title="Map Calibration" description="Configure warehouse floor map">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="space-y-4">
                  <div>
                    <Label>Floor Plan Image</Label>
                    <div className="mt-2 border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                      <p>Drop floor plan image here or click to upload</p>
                      <Button variant="outline" className="mt-4">
                        Upload Image
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Floor Width (meters)</Label>
                      <Input type="number" defaultValue={100} className="mt-1" />
                    </div>
                    <div>
                      <Label>Floor Height (meters)</Label>
                      <Input type="number" defaultValue={80} className="mt-1" />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label>Positioning System</Label>
                    <Select defaultValue="wifi">
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wifi">WiFi Triangulation</SelectItem>
                        <SelectItem value="uwb">Ultra-Wideband (UWB)</SelectItem>
                        <SelectItem value="ble">Bluetooth Low Energy</SelectItem>
                        <SelectItem value="gps">GPS/GNSS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Update Interval (seconds)</Label>
                    <Input type="number" defaultValue={1} className="mt-1" />
                  </div>
                  <div>
                    <Label>Position Accuracy (meters)</Label>
                    <Input type="number" defaultValue={0.5} step={0.1} className="mt-1" />
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <Label>Enable Path Recording</Label>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Show Heatmap</Label>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
            </DashboardCard>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
