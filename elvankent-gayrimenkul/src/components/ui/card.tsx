import * as React from 'react';
import { cn } from '@/lib/utils';

/** Kart temel bileşeni. Özel kartlar (ilan, istatistik, dashboard, lead) bunun üzerine kurulur. */
export function Card({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'muted' | 'flat' | 'inverse' }) {
  return (
    <div
      className={cn(
        'rounded-2xl',
        variant === 'default' && 'border border-border bg-surface shadow-xs',
        variant === 'muted' && 'bg-surface-muted',
        variant === 'flat' && 'border border-border bg-surface',
        variant === 'inverse' && 'bg-surface-inverse text-inverse-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6', className)} {...props} />;
}

export function CardTitle({ className, as: Tag = 'h2', ...props }: React.HTMLAttributes<HTMLHeadingElement> & { as?: 'h2' | 'h3' | 'h4' }) {
  return <Tag className={cn('text-[15px] font-bold tracking-tight text-foreground', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-[13px] leading-snug text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-5 sm:px-6', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-3 border-t border-border px-5 py-4 sm:px-6', className)} {...props} />;
}
