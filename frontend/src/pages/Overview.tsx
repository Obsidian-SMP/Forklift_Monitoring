import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardGrid, DashboardCard, DashboardSection } from '@/components/dashboard/DashboardCard';
import { KPICard } from '@/components/dashboard/KPICard';
import { StatusIndicator } from '@/components/dashboard/StatusIndicator';
import { mockKPIData, mockEnvironmentData, mockAlertSeverityData, mockAlerts } from '@/data/mockData';
import { 
  Truck, 
  Package, 
  AlertTriangle, 
  Thermometer, 
  Droplets, 
  Activity,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};

const chartData = mockEnvironmentData.slice(-24).map(d => ({
  time: formatTime(d.timestamp),
  temperature: Number(d.temperature.toFixed(1)),
  humidity: Number(d.humidity.toFixed(1)),
}));

export default function Overview() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
            <p className="text-muted-foreground">Real-time warehouse monitoring and analytics</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>

        {/* KPI Cards */}
        <DashboardGrid columns={4}>
          <KPICard
            title="Active Forklifts"
            value={`${mockKPIData.activeForklifts}/${mockKPIData.totalForklifts}`}
            subtitle="units online"
            icon={Truck}
            status="safe"
            trend={{ value: 5, direction: 'up' }}
          />
          <KPICard
            title="Forklifts Moving"
            value={mockKPIData.forkliftsMoving}
            subtitle="in operation"
            icon={Activity}
            status="safe"
            trend={{ value: 12, direction: 'up' }}
          />
          <KPICard
            title="Inventory Detected"
            value={mockKPIData.inventoryDetectedToday.toLocaleString()}
            subtitle="items today"
            icon={Package}
            trend={{ value: 8, direction: 'up' }}
          />
          <KPICard
            title="Alerts Today"
            value={mockKPIData.alertsToday}
            subtitle="active alerts"
            icon={AlertTriangle}
            status={mockKPIData.alertsToday > 20 ? 'warning' : 'safe'}
            trend={{ value: -15, direction: 'down' }}
          />
        </DashboardGrid>

        {/* Environment summary */}
        <DashboardGrid columns={2}>
          <KPICard
            title="Avg. Temperature"
            value={`${mockKPIData.avgTemperature.toFixed(1)}°C`}
            subtitle="within safe range"
            icon={Thermometer}
            status="safe"
          />
          <KPICard
            title="Avg. Humidity"
            value={`${mockKPIData.avgHumidity}%`}
            subtitle="optimal level"
            icon={Droplets}
            status="safe"
          />
        </DashboardGrid>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Environment Trend */}
          <DashboardCard 
            title="Environment Trend (24h)" 
            description="Temperature and humidity over time"
            className="lg:col-span-2"
          >
            <div className="h-[300px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 12 }} 
                    className="text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    yAxisId="temp"
                    tick={{ fontSize: 12 }} 
                    className="text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    domain={[10, 30]}
                    label={{ value: '°C', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                  />
                  <YAxis 
                    yAxisId="humidity"
                    orientation="right"
                    tick={{ fontSize: 12 }} 
                    className="text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    domain={[20, 80]}
                    label={{ value: '%', angle: 90, position: 'insideRight', style: { textAnchor: 'middle' } }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line 
                    yAxisId="temp"
                    type="monotone" 
                    dataKey="temperature" 
                    stroke="hsl(var(--chart-3))" 
                    strokeWidth={2}
                    dot={false}
                    name="Temperature (°C)"
                  />
                  <Line 
                    yAxisId="humidity"
                    type="monotone" 
                    dataKey="humidity" 
                    stroke="hsl(var(--chart-1))" 
                    strokeWidth={2}
                    dot={false}
                    name="Humidity (%)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>

          {/* Alert Severity Breakdown */}
          <DashboardCard 
            title="Alert Breakdown" 
            description="By severity level"
          >
            <div className="h-[300px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mockAlertSeverityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {mockAlertSeverityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span className="text-sm">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>
        </div>

        {/* Recent Alerts */}
        <DashboardSection title="Recent Alerts">
          <DashboardCard title="Latest Activity" noPadding>
            <div className="divide-y">
              {mockAlerts.slice(0, 5).map((alert) => (
                <div 
                  key={alert.id} 
                  className="flex items-center gap-4 px-6 py-4 hover:bg-muted/50"
                >
                  <StatusIndicator 
                    variant={
                      alert.severity === 'critical' ? 'danger' :
                      alert.severity === 'high' ? 'warning' :
                      alert.severity === 'medium' ? 'safe' :
                      'offline'
                    }
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{alert.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {alert.source} • {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <Badge 
                    variant="outline"
                    className={cn(
                      alert.severity === 'critical' && 'border-status-danger text-status-danger',
                      alert.severity === 'high' && 'border-status-warning text-status-warning',
                      alert.severity === 'medium' && 'border-primary text-primary',
                      alert.severity === 'low' && 'border-muted-foreground text-muted-foreground'
                    )}
                  >
                    {alert.severity}
                  </Badge>
                  {alert.acknowledged && (
                    <Badge variant="secondary" className="text-xs">
                      Acknowledged
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </DashboardCard>
        </DashboardSection>
      </div>
    </DashboardLayout>
  );
}
