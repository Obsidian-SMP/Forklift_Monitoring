import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusDot, type getStatusVariant } from './StatusIndicator';
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  status?: ReturnType<typeof getStatusVariant>;
  loading?: boolean;
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  status,
  loading = false,
  className,
}: KPICardProps) {
  if (loading) {
    return (
      <Card className={cn('card-hover', className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8 rounded" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-20 mb-1" />
          <Skeleton className="h-3 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('card-hover', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex items-center gap-2">
          {status && <StatusDot variant={status} size="md" />}
          {Icon && (
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          {trend && (
            <span
              className={cn(
                'flex items-center text-xs font-medium',
                trend.direction === 'up' && 'text-status-safe',
                trend.direction === 'down' && 'text-status-danger',
                trend.direction === 'neutral' && 'text-muted-foreground'
              )}
            >
              {trend.direction === 'up' && <TrendingUp className="h-3 w-3 mr-0.5" />}
              {trend.direction === 'down' && <TrendingDown className="h-3 w-3 mr-0.5" />}
              {trend.direction === 'neutral' && <Minus className="h-3 w-3 mr-0.5" />}
              {trend.value > 0 && '+'}
              {trend.value}%
            </span>
          )}
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Compact version for tight spaces
interface KPIBadgeProps {
  label: string;
  value: string | number;
  status?: ReturnType<typeof getStatusVariant>;
  className?: string;
}

export function KPIBadge({ label, value, status, className }: KPIBadgeProps) {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-2 rounded-lg bg-card border', className)}>
      {status && <StatusDot variant={status} size="sm" />}
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}
