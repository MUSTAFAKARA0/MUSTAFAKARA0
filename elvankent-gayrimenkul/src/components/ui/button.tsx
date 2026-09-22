import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-150 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-55 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand-700 text-white shadow-sm hover:bg-brand-800',
        accent: 'bg-accent-500 text-brand-950 shadow-sm hover:bg-accent-400',
        outline: 'border border-line bg-surface text-ink hover:border-brand-300 hover:bg-brand-50',
        ghost: 'text-ink hover:bg-sand-100',
        subtle: 'bg-brand-50 text-brand-800 hover:bg-brand-100',
        whatsapp: 'bg-whatsapp text-white shadow-sm hover:bg-whatsapp-hover',
        danger: 'bg-danger text-white shadow-sm hover:bg-red-800',
        link: 'text-brand-700 underline-offset-4 hover:underline px-0',
      },
      size: {
        sm: 'h-9 px-3 text-[13px]',
        md: 'h-11 px-4',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'size-10 p-0',
        'icon-sm': 'size-8 p-0 rounded-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({ className, variant, size, asChild, loading, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
}
