import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold tracking-wide whitespace-nowrap',
  {
    variants: {
      variant: {
        sale: 'bg-brand-700 text-white',
        rent: 'bg-accent-500 text-brand-950',
        featured: 'bg-white/95 text-accent-700 ring-1 ring-accent-200',
        demo: 'bg-sand-800/85 text-white uppercase',
        neutral: 'bg-sand-100 text-sand-700',
        success: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
        warning: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
        danger: 'bg-red-50 text-red-800 ring-1 ring-red-200',
        info: 'bg-brand-50 text-brand-800 ring-1 ring-brand-200',
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
