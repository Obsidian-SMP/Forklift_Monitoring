import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import type { StatusLevel } from '@/types/warehouse';

const statusIndicatorVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full font-medium',
  {
    variants: {
      variant: {
        safe: 'bg-status-safe/15 text-status-safe',
        warning: 'bg-status-warning/15 text-status-warning',
        danger: 'bg-status-danger/15 text-status-danger',
        offline: 'bg-status-offline/15 text-status-offline',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-sm',
        lg: 'px-3 py-1.5 text-base',
      },
    },
    defaultVariants: {
      variant: 'safe',
      size: 'md',
    },
  }
);

const dotVariants = cva('rounded-full', {
  variants: {
    variant: {
      safe: 'bg-status-safe',
      warning: 'bg-status-warning',
      danger: 'bg-status-danger',
      offline: 'bg-status-offline',
    },
    size: {
      sm: 'h-1.5 w-1.5',
      md: 'h-2 w-2',
      lg: 'h-2.5 w-2.5',
    },
    pulse: {
      true: 'animate-pulse-glow',
      false: '',
    },
  },
  defaultVariants: {
    variant: 'safe',
    size: 'md',
    pulse: true,
  },
});

interface StatusIndicatorProps
  extends VariantProps<typeof statusIndicatorVariants> {
  label?: string;
  showDot?: boolean;
  pulse?: boolean;
  className?: string;
}

export function StatusIndicator({
  variant = 'safe',
  size = 'md',
  label,
  showDot = true,
  pulse = true,
  className,
}: StatusIndicatorProps) {
  return (
    <span className={cn(statusIndicatorVariants({ variant, size }), className)}>
      {showDot && (
        <span className={dotVariants({ variant, size, pulse })} />
      )}
      {label && <span>{label}</span>}
    </span>
  );
}

// Simple dot indicator
interface StatusDotProps extends VariantProps<typeof dotVariants> {
  className?: string;
}

export function StatusDot({ variant, size, pulse, className }: StatusDotProps) {
  return <span className={cn(dotVariants({ variant, size, pulse }), className)} />;
}

// Helper to convert status to variant
export function getStatusVariant(level: StatusLevel): StatusIndicatorProps['variant'] {
  return level;
}

// Numeric threshold helper
export function getThresholdStatus(
  value: number,
  warningThreshold: number,
  dangerThreshold: number,
  inverse: boolean = false
): StatusLevel {
  if (inverse) {
    if (value <= dangerThreshold) return 'danger';
    if (value <= warningThreshold) return 'warning';
    return 'safe';
  }
  if (value >= dangerThreshold) return 'danger';
  if (value >= warningThreshold) return 'warning';
  return 'safe';
}
