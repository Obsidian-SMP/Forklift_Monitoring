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
import { useNavigate } from 'react-router-dom';

interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  source: string;
  timestamp: string;
  acknowledged?: boolean;
}

interface TopStatusBarProps {
  sidebarCollapsed: boolean;
}

export function TopStatusBar({ sidebarCollapsed }: TopStatusBarProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Initialize from localStorage
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const navigate = useNavigate();
  
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  
  // Severity order for sorting (higher value = more important)
  const severityOrder: Record<string, number> = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1,
  };
  
  // Filter and sort alerts
  const unacknowledgedAlerts = alerts
    .filter(a => !a.acknowledged)
    .sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
  
  const criticalAlerts = unacknowledgedAlerts.filter(a => a.severity === 'critical').length;

  // Fetch alerts from API
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await fetch(`${API_BASE}/alerts`);
        if (response.ok) {
          const data = await response.json();
          setAlerts(data.alerts || []);
        }
      } catch (err) {
        console.error('Error fetching alerts:', err);
      }
    };
    
    fetchAlerts();
    // Refresh alerts every 5 seconds
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
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
                {unacknowledgedAlerts.length > 0 && (
                  <Badge 
                    className={cn(
                      'absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]',
                      criticalAlerts > 0 
                        ? 'bg-status-danger text-status-danger-foreground' 
                        : 'bg-status-warning text-status-warning-foreground'
                    )}
                  >
                    {unacknowledgedAlerts.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="px-3 py-2 border-b">
                <h4 className="font-semibold text-sm">Active Alerts</h4>
                <p className="text-xs text-muted-foreground">
                  {unacknowledgedAlerts.length} unacknowledged alerts
                </p>
              </div>
              {unacknowledgedAlerts.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No active alerts
                </div>
              ) : (
                unacknowledgedAlerts.slice(0, 5).map((alert) => (
                  <DropdownMenuItem key={alert.id} className="flex items-start gap-3 py-3">
                    <StatusDot 
                      variant={
                        alert.severity === 'critical' ? 'danger' :
                        alert.severity === 'high' ? 'warning' :
                        alert.severity === 'medium' ? 'warning' :
                        'safe'
                      } 
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{alert.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                      </p>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
              <div className="px-3 py-2 border-t">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-xs"
                  onClick={() => navigate('/alerts')}
                >
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
