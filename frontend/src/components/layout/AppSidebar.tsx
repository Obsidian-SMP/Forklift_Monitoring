import { useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Home,
  Thermometer,
  Truck,
  Package,
  MapPin,
  AlertTriangle,
  BarChart3,
  Activity,
  ChevronLeft,
  ChevronRight,
  Warehouse,
  Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const navItems = [
  { title: 'Homepage', url: '/', icon: Home },
  { title: 'Environment', url: '/environment', icon: Thermometer },
  { title: 'Forklifts', url: '/forklifts', icon: Truck },
  { title: 'Inventory', url: '/inventory', icon: Package },
  { title: 'Path Tracking', url: '/tracking', icon: MapPin },
  { title: 'RSSI Monitor', url: '/rssi', icon: Wifi },
  { title: 'Alerts', url: '/alerts', icon: AlertTriangle },
];

export function AppSidebar({ collapsed, onToggle, onMouseEnter, onMouseLeave }: AppSidebarProps) {
  const location = useLocation();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out flex flex-col',
        collapsed ? 'w-16' : 'w-64'
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Warehouse className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sidebar-foreground text-sm">Warehouse IoT</span>
              <span className="text-[10px] text-sidebar-foreground/60">Monitoring System</span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.url;
            const Icon = item.icon;

            const linkContent = (
              <Link
                to={item.url}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative overflow-hidden',
                  'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent',
                  isActive && 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground'
                )}
              >
                <Icon className={cn('h-7 w-7 shrink-0', isActive && 'text-current')} />
                <span className={cn(
                  'text-sm font-medium whitespace-nowrap transition-all duration-200',
                  collapsed ? 'opacity-0 -translate-x-2 w-0' : 'opacity-100 translate-x-0'
                )}>
                  {item.title}
                </span>
              </Link>
            );

            if (collapsed) {
              return (
                <li key={item.url}>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.title}
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            }

            return <li key={item.url}>{linkContent}</li>;
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn(
            'w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent flex items-center gap-2 px-3 relative overflow-hidden'
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-6 w-6 shrink-0" />
          ) : (
            <ChevronLeft className="h-6 w-6 shrink-0" />
          )}
          <span className={cn(
            'text-sm whitespace-nowrap transition-all duration-200',
            collapsed ? 'opacity-0 -translate-x-2 w-0' : 'opacity-100 translate-x-0'
          )}>
            Collapse
          </span>
        </Button>
      </div>
    </aside>
  );
}
