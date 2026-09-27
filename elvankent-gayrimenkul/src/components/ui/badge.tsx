import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[11.5px] leading-4 font-semibold whitespace-nowrap [&_svg]:size-3',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-muted text-foreground/80',
        primary: 'bg-primary text-primary-fg',
        'primary-soft': 'bg-primary-soft text-primary-ink',
        accent: 'bg-accent text-accent-fg',
        'accent-soft': 'bg-accent-soft text-accent-ink',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-danger',
        info: 'bg-info-soft text-info',
        outline: 'border border-border bg-surface text-foreground/80',
        inverse: 'bg-surface-inverse/85 text-white backdrop-blur-sm',
        glass: 'bg-white/92 text-foreground shadow-xs backdrop-blur-sm',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
