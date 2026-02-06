import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard, DashboardGrid } from '@/components/dashboard/DashboardCard';
import { KPICard } from '@/components/dashboard/KPICard';
import { StatusIndicator, StatusDot } from '@/components/dashboard/StatusIndicator';
import { mockSystemStatus, mockForklifts } from '@/data/mockData';
import { 
  Activity, 
  Server, 
  Wifi, 
  Clock, 
  HardDrive,
  Cpu,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const statusConfig = {
  online: { variant: 'safe' as const, label: 'Online' },
  offline: { variant: 'danger' as const, label: 'Offline' },
  degraded: { variant: 'warning' as const, label: 'Degraded' },
};

export default function SystemHealth() {
  const onlineComponents = mockSystemStatus.filter(s => s.status === 'online').length;
  const onlineForklifts = mockForklifts.filter(f => f.status !== 'offline').length;
  const avgLatency = mockSystemStatus.reduce((sum, s) => sum + (s.latency || 0), 0) / mockSystemStatus.length;
  const avgUptime = mockSystemStatus.reduce((sum, s) => sum + (s.uptime || 0), 0) / mockSystemStatus.length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">System Health</h1>
            <p className="text-muted-foreground">Infrastructure and connectivity status</p>
          </div>
          <Button variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Status
          </Button>
        </div>

        {/* KPI Cards */}
        <DashboardGrid columns={4}>
          <KPICard
            title="System Status"
            value={`${onlineComponents}/${mockSystemStatus.length}`}
            subtitle="components online"
            icon={Server}
            status={onlineComponents === mockSystemStatus.length ? 'safe' : 'warning'}
          />
          <KPICard
            title="Forklifts Online"
            value={`${onlineForklifts}/${mockForklifts.length}`}
            subtitle="connected"
            icon={Wifi}
            status={onlineForklifts >= mockForklifts.length * 0.8 ? 'safe' : 'warning'}
          />
          <KPICard
            title="Avg Latency"
            value={`${avgLatency.toFixed(0)} ms`}
            subtitle="response time"
            icon={Zap}
            status={avgLatency < 100 ? 'safe' : avgLatency < 200 ? 'warning' : 'danger'}
          />
          <KPICard
            title="Avg Uptime"
            value={`${avgUptime.toFixed(1)}%`}
            subtitle="availability"
            icon={Activity}
            status={avgUptime >= 99 ? 'safe' : avgUptime >= 95 ? 'warning' : 'danger'}
          />
        </DashboardGrid>

        {/* System Components */}
        <DashboardCard title="System Components" description="Infrastructure health status">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {mockSystemStatus.map((component) => (
              <div
                key={component.component}
                className={cn(
                  'flex items-center gap-4 p-4 rounded-lg border',
                  component.status === 'offline' && 'border-status-danger/50 bg-status-danger/5',
                  component.status === 'degraded' && 'border-status-warning/50 bg-status-warning/5',
                  component.status === 'online' && 'bg-muted/30'
                )}
              >
                <div className={cn(
                  'w-12 h-12 rounded-lg flex items-center justify-center',
                  component.status === 'online' && 'bg-status-safe/10',
                  component.status === 'degraded' && 'bg-status-warning/10',
                  component.status === 'offline' && 'bg-status-danger/10'
                )}>
                  {component.component.includes('Server') && <Server className="h-6 w-6" />}
                  {component.component.includes('Database') && <HardDrive className="h-6 w-6" />}
                  {component.component.includes('Gateway') && <Wifi className="h-6 w-6" />}
                  {component.component.includes('Camera') && <Activity className="h-6 w-6" />}
                  {component.component.includes('WiFi') && <Wifi className="h-6 w-6" />}
                  {component.component.includes('Alert') && <Zap className="h-6 w-6" />}
                  {component.component.includes('Analytics') && <Cpu className="h-6 w-6" />}
                  {!['Server', 'Database', 'Gateway', 'Camera', 'WiFi', 'Alert', 'Analytics']
                    .some(k => component.component.includes(k)) && <Server className="h-6 w-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{component.component}</span>
                    <StatusIndicator 
                      variant={statusConfig[component.status].variant}
                      label={statusConfig[component.status].label}
                      size="sm"
                    />
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    {component.latency !== undefined && component.latency > 0 && (
                      <span>Latency: {component.latency}ms</span>
                    )}
                    {component.uptime !== undefined && (
                      <span>Uptime: {component.uptime}%</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Last heartbeat</div>
                  <div className="text-sm">
                    {new Date(component.lastHeartbeat).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DashboardCard>

        {/* Forklift Connectivity */}
        <DashboardCard title="Forklift Connectivity" description="Device connection status">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
            {mockForklifts.map((forklift) => (
              <div
                key={forklift.id}
                className={cn(
                  'p-4 rounded-lg border text-center',
                  forklift.status === 'offline' && 'border-status-danger/50 bg-status-danger/5',
                  forklift.status !== 'offline' && 'bg-muted/30'
                )}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <StatusDot 
                    variant={forklift.status === 'offline' ? 'danger' : 'safe'} 
                    pulse={forklift.status !== 'offline'}
                  />
                  <span className="font-medium">{forklift.id}</span>
                </div>
                
                {forklift.status !== 'offline' ? (
                  <>
                    <div className="text-sm text-muted-foreground mb-2">
                      Signal: {forklift.signalStrength}%
                    </div>
                    <Progress value={forklift.signalStrength} className="h-1.5" />
                    <div className="text-xs text-muted-foreground mt-2">
                      Updated: {new Date(forklift.lastUpdate).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-status-danger">
                    Last seen: {new Date(forklift.lastUpdate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                  </div>
                )}
              </div>
            ))}
          </div>
        </DashboardCard>

        {/* Data Latency */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardCard title="Sensor Heartbeats" description="Last check-in times">
            <div className="space-y-4 mt-4">
              {['SENSOR-01', 'SENSOR-02', 'SENSOR-03', 'SENSOR-04', 'SENSOR-05'].map((sensor, i) => {
                const isRecent = i < 4;
                const lastSeen = new Date(Date.now() - (isRecent ? i * 60000 : 600000));
                return (
                  <div key={sensor} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusDot variant={isRecent ? 'safe' : 'danger'} />
                      <span className="font-medium">{sensor}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {lastSeen.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                    </div>
                  </div>
                );
              })}
            </div>
          </DashboardCard>

          <DashboardCard title="Data Pipeline" description="Processing metrics">
            <div className="space-y-4 mt-4">
              {[
                { name: 'Telemetry Ingestion', value: 99.8, latency: 15 },
                { name: 'Event Processing', value: 99.5, latency: 28 },
                { name: 'Database Writes', value: 99.9, latency: 8 },
                { name: 'Real-time Streaming', value: 98.2, latency: 45 },
                { name: 'Alert Distribution', value: 99.7, latency: 12 },
              ].map((pipeline) => (
                <div key={pipeline.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{pipeline.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{pipeline.latency}ms</span>
                      <Badge 
                        variant={pipeline.value >= 99 ? 'default' : 'secondary'}
                        className={cn(
                          pipeline.value >= 99 && 'bg-status-safe text-status-safe-foreground'
                        )}
                      >
                        {pipeline.value}%
                      </Badge>
                    </div>
                  </div>
                  <Progress 
                    value={pipeline.value} 
                    className={cn(
                      'h-1.5',
                      pipeline.value < 99 && '[&>div]:bg-status-warning'
                    )}
                  />
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
