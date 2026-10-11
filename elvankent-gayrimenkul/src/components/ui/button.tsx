import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'btn relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-fg shadow-xs hover:bg-primary-hover',
        secondary: 'bg-surface-inverse text-inverse-foreground shadow-xs hover:bg-foreground/90',
        outline: 'border border-border-strong bg-surface text-foreground hover:border-foreground/40 hover:bg-surface-muted',
        ghost: 'text-foreground hover:bg-surface-muted',
        soft: 'bg-primary-soft text-primary-ink hover:bg-primary/12',
        danger: 'bg-danger text-white shadow-xs hover:bg-danger/90',
        'danger-ghost': 'text-danger hover:bg-danger-soft',
        whatsapp: 'bg-whatsapp text-white shadow-xs hover:bg-whatsapp-hover',
        inverse: 'bg-white text-foreground shadow-sm hover:bg-white/90',
        link: 'h-auto px-0 text-primary-ink underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-8 px-2.5 text-xs [&_svg]:size-3.5',
        sm: 'h-9 px-3 text-[13px] [&_svg]:size-4',
        md: 'h-11 px-4 text-sm [&_svg]:size-[18px]',
        lg: 'h-12 px-6 text-[15px] [&_svg]:size-5',
        icon: 'size-10 p-0 [&_svg]:size-5',
        'icon-sm': 'size-9 rounded-lg p-0 [&_svg]:size-[18px]',
        'icon-xs': 'size-8 rounded-lg p-0 [&_svg]:size-4',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** İşlem sürerken butonu kilitler (çift tıklama koruması) ve dönen ikon gösterir */
  loading?: boolean;
}

export function Button({ className, variant, size, asChild, loading, disabled, children, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      type={asChild ? undefined : (type ?? 'button')}
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
