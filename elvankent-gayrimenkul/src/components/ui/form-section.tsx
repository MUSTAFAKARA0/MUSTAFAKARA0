import { cn } from '@/lib/utils';

/** Form bölümü: başlık + açıklama + (varsayılan 2 sütunlu) alan ızgarası */
export function FormSection({ title, description, children, className, columns = 2 }: { title: string; description?: string; children: React.ReactNode; className?: string; columns?: 1 | 2 }) {
  return (
    <fieldset className={cn('min-w-0 border-0 p-0', className)}>
      <legend className="p-0 text-[15px] font-bold text-foreground">{title}</legend>
      {description && <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      <div className={cn('mt-4 grid gap-x-4 gap-y-4', columns === 2 && 'sm:grid-cols-2')}>{children}</div>
    </fieldset>
  );
}

/** Yapışkan kaydet çubuğu (mobilde güvenli alan payı, kenardan kenara). `dirty` yalnızca görsel göstergedir. */
export function StickyActionBar({ children, dirty, className }: { children: React.ReactNode; dirty?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-topbar/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-2)] backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5',
        className,
      )}
    >
      {dirty && <span className="mr-auto text-[12.5px] font-medium text-muted-foreground">Kaydedilmemiş değişiklikler var</span>}
      {children}
    </div>
  );
}
