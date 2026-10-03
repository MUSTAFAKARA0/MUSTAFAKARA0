'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Açılıp kapanabilen seçim çipi (çoklu seçim) */
export function ChoiceChip({
  pressed,
  onPressedChange,
  children,
  className,
  size = 'md',
}: {
  pressed: boolean;
  onPressedChange: (value: boolean) => void;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors select-none',
        size === 'md' ? 'h-10 px-4 text-sm' : 'h-8 px-3 text-[13px]',
        pressed
          ? 'border-foreground bg-foreground text-background'
          : 'border-border-strong bg-surface text-foreground/85 hover:border-foreground/50',
        className,
      )}
    >
      {pressed && <Check className="size-3.5" aria-hidden />}
      {children}
    </button>
  );
}

/** Tekli seçim (ör. Satılık / Kiralık / Tümü) — erişilebilir radiogroup */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
  size = 'md',
  tone = 'default',
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
  size?: 'sm' | 'md';
  tone?: 'default' | 'glass';
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    onValueChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex rounded-xl p-1',
        tone === 'default' ? 'bg-surface-muted' : 'bg-white/15 backdrop-blur',
        className,
      )}
    >
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, i)}
            onClick={() => onValueChange(o.value)}
            className={cn(
              'flex-1 rounded-lg font-semibold whitespace-nowrap transition-colors',
              size === 'md' ? 'h-9 px-4 text-sm' : 'h-8 px-3 text-[13px]',
              checked
                ? tone === 'default'
                  ? 'bg-surface text-foreground shadow-xs'
                  : 'bg-white text-foreground shadow-xs'
                : tone === 'default'
                  ? 'text-muted-foreground hover:text-foreground'
                  : 'text-white/85 hover:text-white',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
