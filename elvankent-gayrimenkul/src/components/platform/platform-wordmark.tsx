import { PLATFORM_BRAND } from '@/platform/branding/platform-brand';
import { cn } from '@/lib/utils';

/**
 * Platform sahibinin (KARAY) yazı tabanlı markası. Logo teslim edilince
 * PLATFORM_BRAND.logoUrl doldurulur ve burada otomatik olarak logo gösterilir.
 * Kiracı (emlak ofisi) logosu burada ASLA kullanılmaz.
 */
export function PlatformWordmark({ tone = 'dark', subtitle = PLATFORM_BRAND.product, className }: { tone?: 'dark' | 'light'; subtitle?: string | null; className?: string }) {
  const light = tone === 'light';
  return (
    <span className={cn('inline-flex flex-col leading-none', className)}>
      {PLATFORM_BRAND.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={PLATFORM_BRAND.logoUrl} alt={PLATFORM_BRAND.name} width={140} height={28} className="block h-7 w-auto" />
      ) : (
        <span className={cn('text-[1.35rem] font-extrabold tracking-[0.28em]', light ? 'text-white' : 'text-foreground')}>{PLATFORM_BRAND.name}</span>
      )}
      {subtitle && (
        <span className={cn('mt-1.5 text-[11.5px] font-semibold tracking-[0.08em] uppercase', light ? 'text-white/60' : 'text-muted-foreground')}>{subtitle}</span>
      )}
    </span>
  );
}
