import { PLATFORM_BRAND } from '@/platform/branding/platform-brand';
import { cn } from '@/lib/utils';

/**
 * KARAY logosu (logo paketindeki SVG'ler; yeniden çizilmez, renkleri değiştirilmez).
 *   tone: zemin rengi (dark → koyu zemin versiyonu)
 *   tagline: sloganlı ana versiyon (en az 200 px genişlik) veya slogansız (en az 110 px)
 * Kiracı (emlak ofisi) logosu burada ASLA kullanılmaz.
 */
export function PlatformWordmark({ tone = 'light', tagline = true, height = 36, className }: { tone?: 'dark' | 'light'; tagline?: boolean; height?: number; className?: string }) {
  const { logos, logoAspect, name } = PLATFORM_BRAND;
  const src = tone === 'dark' ? (tagline ? logos.dark : logos.darkCompact) : tagline ? logos.light : logos.lightCompact;
  const width = Math.round(height * logoAspect);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} width={width} height={height} decoding="async" className={cn('block h-auto max-w-full shrink-0', className)} style={{ width }} />
  );
}
