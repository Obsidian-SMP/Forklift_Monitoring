import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard, DashboardGrid } from '@/components/dashboard/DashboardCard';
import { KPICard } from '@/components/dashboard/KPICard';
import { StatusIndicator } from '@/components/dashboard/StatusIndicator';
import { mockAlerts } from '@/data/mockData';
import type { Alert, AlertSeverity, AlertType } from '@/types/warehouse';
import { 
  AlertTriangle, 
  Bell, 
  Check, 
  Filter,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const severityConfig: Record<AlertSeverity, { variant: 'safe' | 'warning' | 'danger' | 'offline', label: string }> = {
  low: { variant: 'offline', label: 'Low' },
  medium: { variant: 'safe', label: 'Medium' },
  high: { variant: 'warning', label: 'High' },
  critical: { variant: 'danger', label: 'Critical' },
};

const typeIcons: Record<AlertType, string> = {
  temperature: '🌡️',
  humidity: '💧',
  collision: '⚠️',
  speed: '🏎️',
  battery: '🔋',
  inventory: '📦',
  system: '⚙️',
};

export default function AlertsEvents() {
  const [alerts, setAlerts] = useState(mockAlerts);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const handleAcknowledge = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, acknowledged: true, acknowledgedBy: 'Admin', acknowledgedAt: new Date().toISOString() }
        : alert
    ));
    toast({
      title: 'Alert Acknowledged',
      description: 'The alert has been marked as acknowledged.',
    });
  };

  const handleAcknowledgeAll = () => {
    setAlerts(prev => prev.map(alert => ({
      ...alert,
      acknowledged: true,
      acknowledgedBy: 'Admin',
      acknowledgedAt: new Date().toISOString(),
    })));
    toast({
      title: 'All Alerts Acknowledged',
      description: 'All alerts have been marked as acknowledged.',
    });
  };

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         alert.source.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter;
    const matchesType = typeFilter === 'all' || alert.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'acknowledged' && alert.acknowledged) ||
                         (statusFilter === 'pending' && !alert.acknowledged);
    return matchesSearch && matchesSeverity && matchesType && matchesStatus;
  });

  const stats = {
    total: alerts.length,
    pending: alerts.filter(a => !a.acknowledged).length,
    critical: alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length,
    acknowledged: alerts.filter(a => a.acknowledged).length,
  };

  const alertTypes = [...new Set(alerts.map(a => a.type))];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Alerts & Events</h1>
            <p className="text-muted-foreground">Monitor and manage system alerts</p>
          </div>
          <Button 
            onClick={handleAcknowledgeAll}
            disabled={stats.pending === 0}
          >
            <Check className="h-4 w-4 mr-2" />
            Acknowledge All
          </Button>
        </div>

        {/* KPI Cards */}
        <DashboardGrid columns={4}>
          <KPICard
            title="Total Alerts"
            value={stats.total}
            subtitle="all time today"
            icon={Bell}
          />
          <KPICard
            title="Pending"
            value={stats.pending}
            subtitle="require attention"
            icon={Clock}
            status={stats.pending > 0 ? 'warning' : 'safe'}
          />
          <KPICard
            title="Critical"
            value={stats.critical}
            subtitle="high priority"
            icon={AlertTriangle}
            status={stats.critical > 0 ? 'danger' : 'safe'}
          />
          <KPICard
            title="Acknowledged"
            value={stats.acknowledged}
            subtitle="resolved"
            icon={CheckCircle2}
            status="safe"
          />
        </DashboardGrid>

        {/* Alert List */}
        <DashboardCard 
          title="Alert List" 
          description="All system alerts and events"
          actions={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search alerts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[200px]"
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
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {alertTypes.map(type => (
                    <SelectItem key={type} value={type} className="capitalize">
                      {typeIcons[type]} {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        >
          <div className="space-y-3 mt-4">
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
                    !alert.acknowledged && 'bg-muted/50',
                    alert.severity === 'critical' && !alert.acknowledged && 'border-status-danger/50 bg-status-danger/5',
                    alert.severity === 'high' && !alert.acknowledged && 'border-status-warning/50 bg-status-warning/5'
                  )}
                >
                  {/* Type Icon */}
                  <div className="text-2xl shrink-0">{typeIcons[alert.type]}</div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusIndicator 
                        variant={severityConfig[alert.severity].variant}
                        label={severityConfig[alert.severity].label}
                        size="sm"
                      />
                      <Badge variant="outline" className="capitalize text-xs">
                        {alert.type}
                      </Badge>
                    </div>
                    <p className="font-medium">{alert.message}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>Source: {alert.source}</span>
                      <span>•</span>
                      <span>{new Date(alert.timestamp).toLocaleString()}</span>
                    </div>
                    {alert.acknowledged && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-status-safe">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>
                          Acknowledged by {alert.acknowledgedBy} at{' '}
                          {new Date(alert.acknowledgedAt!).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="shrink-0">
                    {!alert.acknowledged ? (
                      <Button 
                        size="sm" 
                        onClick={() => handleAcknowledge(alert.id)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Acknowledge
                      </Button>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Resolved
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DashboardCard>
      </div>
    </DashboardLayout>
  );
}
