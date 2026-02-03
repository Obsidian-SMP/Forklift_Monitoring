import { cn } from '@/lib/utils';
import { StatusDot } from '@/components/dashboard/StatusIndicator';
import { Bell, Wifi, Clock, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState, useEffect } from 'react';
import { mockAlerts, mockKPIData } from '@/data/mockData';

interface TopStatusBarProps {
  sidebarCollapsed: boolean;
}

export function TopStatusBar({ sidebarCollapsed }: TopStatusBarProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const unacknowledgedAlerts = mockAlerts.filter(a => !a.acknowledged).length;
  const criticalAlerts = mockAlerts.filter(a => !a.acknowledged && a.severity === 'critical').length;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-16 bg-statusbar border-b border-statusbar-border transition-all duration-300',
        sidebarCollapsed ? 'left-16' : 'left-64'
      )}
    >
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left section - System status */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <StatusDot variant="safe" />
            <span className="text-sm font-medium">System Online</span>
          </div>
          
          <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Wifi className="h-4 w-4" />
              <span>{mockKPIData.activeForklifts}/{mockKPIData.totalForklifts} Connected</span>
            </div>
          </div>
        </div>

        {/* Right section - Actions */}
        <div className="flex items-center gap-4">
          {/* Time display */}
          <div className="hidden lg:flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="font-mono">
              {currentTime.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                hour12: false 
              })}
            </span>
          </div>

          {/* Dark mode toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="h-9 w-9"
          >
            {isDarkMode ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>

          {/* Alerts dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9">
                <Bell className="h-4 w-4" />
                {unacknowledgedAlerts > 0 && (
                  <Badge 
                    className={cn(
                      'absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]',
                      criticalAlerts > 0 
                        ? 'bg-status-danger text-status-danger-foreground' 
                        : 'bg-status-warning text-status-warning-foreground'
                    )}
                  >
                    {unacknowledgedAlerts}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="px-3 py-2 border-b">
                <h4 className="font-semibold text-sm">Active Alerts</h4>
                <p className="text-xs text-muted-foreground">
                  {unacknowledgedAlerts} unacknowledged alerts
                </p>
              </div>
              {mockAlerts.filter(a => !a.acknowledged).slice(0, 5).map((alert) => (
                <DropdownMenuItem key={alert.id} className="flex items-start gap-3 py-3">
                  <StatusDot 
                    variant={
                      alert.severity === 'critical' ? 'danger' :
                      alert.severity === 'high' ? 'warning' :
                      'safe'
                    } 
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{alert.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </DropdownMenuItem>
              ))}
              <div className="px-3 py-2 border-t">
                <Button variant="ghost" size="sm" className="w-full text-xs">
                  View All Alerts
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
