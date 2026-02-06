import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard, DashboardGrid } from '@/components/dashboard/DashboardCard';
import { KPICard } from '@/components/dashboard/KPICard';
import { mockAnalyticsData, mockForklifts } from '@/data/mockData';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Route,
  Download,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export default function AnalyticsReports() {
  const [selectedForklift, setSelectedForklift] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7d');

  const filteredData = mockAnalyticsData.filter(d => 
    selectedForklift === 'all' || d.forkliftId === selectedForklift
  );

  // Aggregate data by date
  const aggregatedByDate = filteredData.reduce((acc, curr) => {
    const existing = acc.find(a => a.date === curr.date);
    if (existing) {
      existing.distanceTraveled += curr.distanceTraveled;
      existing.activeTime += curr.activeTime;
      existing.idleTime += curr.idleTime;
      existing.loadsHandled += curr.loadsHandled;
    } else {
      acc.push({ ...curr });
    }
    return acc;
  }, [] as typeof mockAnalyticsData);

  const chartData = aggregatedByDate.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric' }),
    distance: Math.round(d.distanceTraveled / 1000), // km
    activeTime: Number(d.activeTime.toFixed(1)),
    idleTime: Number(d.idleTime.toFixed(1)),
    loads: d.loadsHandled,
  }));

  // Calculate totals
  const totals = filteredData.reduce((acc, curr) => ({
    distance: acc.distance + curr.distanceTraveled,
    activeTime: acc.activeTime + curr.activeTime,
    idleTime: acc.idleTime + curr.idleTime,
    loads: acc.loads + curr.loadsHandled,
    incidents: acc.incidents + curr.incidents,
  }), { distance: 0, activeTime: 0, idleTime: 0, loads: 0, incidents: 0 });

  // Utilization by forklift
  const utilizationByForklift = mockForklifts.slice(0, 5).map(fl => {
    const flData = mockAnalyticsData.filter(d => d.forkliftId === fl.id);
    const totalActive = flData.reduce((sum, d) => sum + d.activeTime, 0);
    const totalIdle = flData.reduce((sum, d) => sum + d.idleTime, 0);
    return {
      name: fl.id,
      utilization: Math.round((totalActive / (totalActive + totalIdle)) * 100),
    };
  });

  // Time distribution pie chart
  const timeDistribution = [
    { name: 'Active', value: totals.activeTime, fill: 'hsl(var(--status-safe))' },
    { name: 'Idle', value: totals.idleTime, fill: 'hsl(var(--status-warning))' },
  ];

  const handleExport = (format: 'csv' | 'pdf') => {
    toast({
      title: `Exporting ${format.toUpperCase()}`,
      description: 'Your report is being generated...',
    });
    // In real app, this would trigger actual export
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics & Reports</h1>
            <p className="text-muted-foreground">Forklift performance and utilization metrics</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedForklift} onValueChange={setSelectedForklift}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Forklift" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Forklifts</SelectItem>
                {mockForklifts.slice(0, 5).map(fl => (
                  <SelectItem key={fl.id} value={fl.id}>{fl.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExport('csv')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* KPI Cards */}
        <DashboardGrid columns={4}>
          <KPICard
            title="Total Distance"
            value={`${(totals.distance / 1000).toFixed(1)} km`}
            subtitle={`in ${dateRange}`}
            icon={Route}
            trend={{ value: 8, direction: 'up' }}
          />
          <KPICard
            title="Active Time"
            value={`${totals.activeTime.toFixed(0)} hrs`}
            subtitle="operational hours"
            icon={Clock}
            trend={{ value: 5, direction: 'up' }}
          />
          <KPICard
            title="Loads Handled"
            value={totals.loads.toLocaleString()}
            subtitle="total operations"
            icon={BarChart3}
            trend={{ value: 12, direction: 'up' }}
          />
          <KPICard
            title="Avg Utilization"
            value={`${Math.round((totals.activeTime / (totals.activeTime + totals.idleTime)) * 100)}%`}
            subtitle="efficiency rate"
            icon={TrendingUp}
            status="safe"
          />
        </DashboardGrid>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Distance Traveled */}
          <DashboardCard 
            title="Distance Traveled" 
            description="Daily distance in kilometers"
            className="lg:col-span-2"
          >
            <div className="h-[300px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar 
                    dataKey="distance" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                    name="Distance (km)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>

          {/* Time Distribution */}
          <DashboardCard title="Time Distribution" description="Active vs Idle">
            <div className="h-[300px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={timeDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {timeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)} hrs`, '']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>
        </div>

        {/* Active vs Idle Time */}
        <DashboardCard title="Active vs Idle Time" description="Daily breakdown">
          <div className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="activeTime" fill="hsl(var(--status-safe))" name="Active" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="idleTime" fill="hsl(var(--status-warning))" name="Idle" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardCard>

        {/* Forklift Utilization */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardCard title="Utilization by Forklift" description="Efficiency comparison">
            <div className="h-[250px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilizationByForklift} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value}%`, 'Utilization']}
                  />
                  <Bar dataKey="utilization" radius={[0, 4, 4, 0]}>
                    {utilizationByForklift.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>

          {/* Summary Table */}
          <DashboardCard title="Forklift Summary" description="Performance metrics">
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Forklift</TableHead>
                    <TableHead className="text-right">Distance</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                    <TableHead className="text-right">Loads</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockForklifts.slice(0, 5).map(fl => {
                    const flData = mockAnalyticsData.filter(d => d.forkliftId === fl.id);
                    const distance = flData.reduce((sum, d) => sum + d.distanceTraveled, 0);
                    const active = flData.reduce((sum, d) => sum + d.activeTime, 0);
                    const loads = flData.reduce((sum, d) => sum + d.loadsHandled, 0);
                    return (
                      <TableRow key={fl.id}>
                        <TableCell className="font-medium">{fl.id}</TableCell>
                        <TableCell className="text-right">{(distance / 1000).toFixed(1)} km</TableCell>
                        <TableCell className="text-right">{active.toFixed(1)} hrs</TableCell>
                        <TableCell className="text-right">{loads}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </DashboardCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
